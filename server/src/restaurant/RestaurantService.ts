import {
  CARRY,
  CUSTOMER,
  MANAGER,
  MAX_STAFF_LEVEL,
  MAX_TIER,
  MessageType,
  OFFLINE,
  PHASE,
  PLAYER_RADIUS,
  RANKS,
  RECIPES,
  ROLES,
  SKILL,
  STAGE,
  STARTER_LAYOUT,
  TIERS,
  TUTORIAL,
  TUTORIAL_CUSTOMER,
  TUTORIAL_OPEN_STEP,
  XP,
  customerById,
  customerWeights,
  formatPrice,
  insideBuilding,
  itemById,
  itemRect,
  levelOf,
  placeProblem,
  qualityOf,
  rankFlow,
  ratingFlow,
  recipeById,
  snapCentre,
  staffById,
  toLocal,
  upgradeCost,
  weightedPick,
  type ActVerb,
  type AwayMessage,
  type PlacedItem,
} from '@restaurant/shared';
import type { RestaurantRecord } from '../persistence/index.js';
import { ItemState, type RestaurantState } from '../rooms/state/RestaurantState.js';
import { addCash, addStack, countOf, handsFree, setCarry, spendCash, takeStack, type Chef } from './Chef.js';
import { Floor } from './Floor.js';
import type { Progress } from './Progress.js';
import { Restaurant, freshId } from './Restaurant.js';
import type { RoomContext } from './RoomContext.js';
import { StaffSim } from './StaffSim.js';

/** How close (plot-local units) an owner must be to a customer, or to an item's edge, to act on it. */
const REACH_CUSTOMER = 7;
const REACH_ITEM = 3.4;

/**
 * EVERY RESTAURANT IN THE ROOM: who owns which plot, laying a restaurant out
 * from its owner's profile (and folding it back for a save), the owner's own
 * hands at work, building, staff, and the simulation tick.
 *
 * Every request is checked against the server's own position of the player,
 * their own restaurant, items and purse. Nothing a client sends is copied: a
 * position is a request to be validated, never a fact.
 */
export class RestaurantService {
  readonly restaurants: Restaurant[];
  readonly floor: Floor;
  readonly staff: StaffSim;

  constructor(
    private readonly ctx: RoomContext,
    private readonly progress: Progress,
    states: readonly RestaurantState[],
    slots: readonly import('@restaurant/shared').PlotSlot[],
  ) {
    this.floor = new Floor(ctx);
    this.staff = new StaffSim(ctx, this.floor);
    this.restaurants = states.map((state, i) => new Restaurant(slots[i]!, state, ctx.collision));
  }

  // ------------------------------------------------------------ lifecycle

  /** A free plot, if any. */
  free(): Restaurant | undefined {
    return this.restaurants.find((r) => !r.state.owner);
  }

  /** Give an owner their restaurant, laid out from their profile. Returns the away report, if any. */
  load(chef: Chef, r: Restaurant): AwayMessage | null {
    const now = this.ctx.now();
    const record = chef.profile.restaurant;
    const s = r.state;
    r.owner = chef;
    s.owner = chef.sessionId;
    s.ownerName = chef.player.displayName;
    s.ownerAvatar = chef.player.avatarUrl;
    s.tier = record.tier;
    s.floor = record.floor;
    s.wall = record.wall;
    s.register = record.register;
    s.rating = record.rating;
    s.likes = record.likes;
    s.served = chef.profile.served;
    s.items.clear();
    s.customers.clear();
    s.staff.clear();
    s.orders.clear();
    r.customers.clear();
    r.staff.clear();
    r.claims.clear();
    chef.restaurant = r;
    chef.player.slot = r.slot.index;

    const fresh = record.items.length === 0 && chef.profile.served === 0 && chef.profile.tutorial === TUTORIAL.enter;
    const layout = fresh ? STARTER_LAYOUT.map((it) => ({ ...it, a: 0, b: 0 })) : record.items;
    let returned = 0;
    for (const it of layout) {
      const problem = placeProblem(r.contents, it.kind, it.x, it.z, it.rot);
      if (problem) {
        addStack(chef.profile.inventory, it.kind, 1);
        returned += 1;
        continue;
      }
      const item = new ItemState();
      item.id = freshId();
      item.kind = it.kind;
      item.x = it.x;
      item.z = it.z;
      item.rot = it.rot;
      item.a = it.a;
      item.b = it.b;
      s.items.set(String(item.id), item);
    }
    r.layoutChanged();
    // Back mid-tutorial: the guest, their order and their dish did not survive the trip. Pick up where it makes sense.
    const step = chef.profile.tutorial;
    if (step > TUTORIAL.seat && step <= TUTORIAL.serve) chef.profile.tutorial = TUTORIAL.seat;
    else if (step > TUTORIAL.serve && step <= TUTORIAL.cash) chef.profile.tutorial = TUTORIAL.shop;
    for (const crop of r.itemsOf('crop')) if (crop.a === 0) crop.a = now + this.floor.growMs(r, crop);
    record.staff.forEach((hired, i) => this.staff.spawn(r, i, hired, now));
    if (returned > 0) this.ctx.notify(chef, 'info', `${returned} item${returned === 1 ? '' : 's'} did not fit and went back to your Items.`);
    r.spawnTimer = 3;
    this.ctx.unstick(r.slot.index);
    this.progress.refreshRank(chef);
    return null;
  }

  /**
   * WHILE YOU WERE AWAY: a restaurant with a waiter and a cook keeps some
   * trade going. Estimated from the staff's pace, the seats and the menu,
   * capped by hours (more with a manager) and by what the register holds.
   */
  offlineIncome(chef: Chef, awaySeconds: number): AwayMessage | null {
    const r = chef.restaurant;
    if (!r || chef.profile.tutorial < TUTORIAL.done || awaySeconds < OFFLINE.minSeconds) return null;
    const hired = chef.profile.restaurant.staff.map((h) => ({ def: staffById(h.member), level: h.level }));
    const speed = (role: string): number => hired.filter((h) => h.def?.role === role).reduce((sum, h) => sum + (h.def?.speed ?? 0) * (1 + (h.level - 1) * 0.08), 0);
    const manager = hired.some((h) => h.def?.role === 'manager');
    const hours = OFFLINE.baseHours + (manager ? MANAGER.offlineHours : 0);
    const seconds = Math.min(awaySeconds, hours * 3600);
    let crops = 0;
    for (const crop of r.itemsOf('crop')) if (crop.a <= this.ctx.now()) crops += 1;
    const waiters = speed('waiter');
    const cooks = speed('cook');
    if (waiters <= 0 || cooks <= 0) return { seconds: Math.floor(awaySeconds), cash: 0, served: 0, crops };
    const seats = r.seats.size;
    const arrivalsPerMin = (60 / CUSTOMER.interval) * rankFlow(r.state.rank) * ratingFlow(r.state.rating);
    const perMin = Math.min(seats * 2, arrivalsPerMin, Math.min(waiters, cooks) * 3);
    const cooking = levelOf(chef.profile.xp[SKILL.cooking] ?? 0);
    const menu = RECIPES.filter((m) => m.level <= cooking && !chef.profile.recipesOff.includes(m.id) && m.needs.length === 0);
    const avg = menu.length > 0 ? menu.reduce((sum, m) => sum + m.price, 0) / menu.length : 10;
    const register = itemById(r.firstOf('register')?.kind ?? 0)?.capacity ?? 0;
    const cash = Math.floor(Math.min(register, perMin * (seconds / 60) * avg * OFFLINE.share));
    const served = Math.floor(cash / Math.max(1, avg));
    if (cash > 0) {
      addCash(chef, cash, true);
      chef.profile.served += served;
      r.state.served = chef.profile.served;
    }
    return { seconds: Math.floor(awaySeconds), cash, served, crops };
  }

  /** What a restaurant holds, for a save. */
  snapshot(chef: Chef): RestaurantRecord {
    const r = chef.restaurant;
    const record = chef.profile.restaurant;
    if (!r) return record;
    const items: RestaurantRecord['items'] = [];
    r.state.items.forEach((item) => {
      const def = itemById(item.kind);
      const keep = def?.role === 'crop' || def?.role === 'animal';
      items.push({ kind: item.kind, x: item.x, z: item.z, rot: item.rot, a: keep ? item.a : 0, b: def?.role === 'animal' ? item.b : 0 });
    });
    return {
      tier: r.state.tier,
      floor: r.state.floor,
      wall: r.state.wall,
      items,
      staff: record.staff.map((h) => ({ ...h })),
      register: r.state.register,
      rating: r.state.rating,
      likes: r.state.likes,
    };
  }

  /** The owner left: whatever they held goes back, and the plot is empty again. */
  unload(chef: Chef): void {
    const r = chef.restaurant;
    if (!r) return;
    chef.profile.restaurant = this.snapshot(chef);
    r.clear();
    chef.restaurant = null;
  }

  // ------------------------------------------------------------- actions

  private localOf(chef: Chef, r: Restaurant): { x: number; z: number } {
    return toLocal(r.slot, chef.player.x, chef.player.z);
  }

  private nearItem(chef: Chef, r: Restaurant, item: ItemState): boolean {
    const def = itemById(item.kind);
    if (!def) return false;
    const p = this.localOf(chef, r);
    const rect = itemRect(def, item.x, item.z, item.rot);
    const dx = Math.max(rect.minX - p.x, 0, p.x - rect.maxX);
    const dz = Math.max(rect.minZ - p.z, 0, p.z - rect.maxZ);
    return Math.hypot(dx, dz) <= REACH_ITEM;
  }

  /** An owner's own hands at work: seat, order, ticket, cook, plate, serve, dish, wash, cash, harvest, collect. */
  act(chef: Chef, verb: ActVerb, id: number): void {
    const r = chef.restaurant;
    if (!r) return;
    const now = this.ctx.now();
    const bad = (text: string): void => this.ctx.notify(chef, 'bad', text);
    const customer = (): ReturnType<Restaurant['customers']['get']> => {
      const c = r.customers.get(Math.floor(id));
      if (!c) return undefined;
      const at = this.floor.positionOf(c, now);
      const p = this.localOf(chef, r);
      return Math.hypot(at.x - p.x, at.z - p.z) <= REACH_CUSTOMER ? c : undefined;
    };
    const item = (role: string): ItemState | undefined => {
      const it = r.item(Math.floor(id));
      if (!it || itemById(it.kind)?.role !== role) return undefined;
      return this.nearItem(chef, r, it) ? it : undefined;
    };
    const roleItem = (role: 'stand' | 'register'): ItemState | undefined => {
      const it = r.firstOf(role);
      return it && this.nearItem(chef, r, it) ? it : undefined;
    };

    switch (verb) {
      case 'seat': {
        const c = customer();
        if (!c) return;
        const problem = this.floor.seat(r, c, now);
        if (problem) return bad(problem);
        this.ctx.xp(chef, SKILL.service, XP.seat);
        this.ctx.tutorial(chef, TUTORIAL.seat);
        this.act2(chef);
        return;
      }
      case 'order': {
        const c = customer();
        if (!c) return;
        const problem = this.floor.order(r, c, now);
        if (problem) return bad(problem);
        this.ctx.xp(chef, SKILL.service, XP.order);
        this.ctx.tutorial(chef, TUTORIAL.order);
        this.act2(chef);
        return;
      }
      case 'ticket': {
        if (!roleItem('stand')) return;
        if (!handsFree(chef)) return bad('Your hands are full!');
        const order = this.floor.oldest(r, STAGE.posted);
        if (!order) return bad('No tickets waiting.');
        order.stage = STAGE.ticket;
        setCarry(chef, CARRY.ticket, order.id, order.recipe);
        this.ctx.tutorial(chef, TUTORIAL.ticket);
        return;
      }
      case 'cook': {
        const stove = item('stove');
        if (!stove) return;
        if (chef.carry.kind !== CARRY.ticket) return bad('Grab a ticket from the order stand first!');
        if (stove.c !== 0) return bad('This stove is busy!');
        const order = r.state.orders.get(String(chef.carry.order));
        if (!order || order.stage !== STAGE.ticket) {
          setCarry(chef, CARRY.none);
          return bad('That order was cancelled.');
        }
        this.floor.startCooking(r, order, stove, now, levelOf(chef.profile.xp[SKILL.cooking] ?? 0));
        chef.profile.counters.cooked += 1;
        this.ctx.xp(chef, SKILL.cooking, XP.cook + Math.floor((recipeById(order.recipe)?.price ?? 0) / 5));
        setCarry(chef, CARRY.none);
        this.ctx.tutorial(chef, TUTORIAL.cook);
        return;
      }
      case 'plate': {
        if (!roleItem('stand')) return;
        if (!handsFree(chef)) return bad('Your hands are full!');
        const order = this.floor.oldest(r, STAGE.ready);
        if (!order) return bad('No food is ready yet.');
        order.stage = STAGE.plate;
        setCarry(chef, CARRY.plate, order.id, order.recipe);
        this.ctx.tutorial(chef, TUTORIAL.plate);
        return;
      }
      case 'serve': {
        const c = customer();
        if (!c) return;
        if (chef.carry.kind !== CARRY.plate) return bad('Grab their food from the order stand first!');
        const order = r.state.orders.get(String(chef.carry.order));
        if (!order) {
          setCarry(chef, CARRY.none);
          return bad('That order was cancelled.');
        }
        if (c.state.phase !== PHASE.waiting || order.customer !== c.state.id) return bad(`This ${recipeById(order.recipe)?.name ?? 'plate'} is for someone else!`);
        this.floor.serve(r, c, order, now);
        this.ctx.xp(chef, SKILL.service, XP.serve);
        setCarry(chef, CARRY.none);
        this.ctx.tutorial(chef, TUTORIAL.serve);
        return;
      }
      case 'dish': {
        const chair = item('chair');
        if (!chair || chair.b === 0) return;
        if (!handsFree(chef)) return bad('Your hands are full!');
        chair.b = 0;
        setCarry(chef, CARRY.dish);
        this.ctx.xp(chef, SKILL.cleaning, XP.pickup);
        this.ctx.tutorial(chef, TUTORIAL.dish);
        return;
      }
      case 'wash': {
        const sink = item('sink');
        if (!sink) return;
        if (chef.carry.kind !== CARRY.dish) return bad('Bring a dirty dish to wash!');
        if (this.floor.sinkRoom(sink) <= 0) return bad('The sink is full! Wait for it to finish.');
        this.floor.loadSink(r, sink, now);
        setCarry(chef, CARRY.none);
        this.ctx.tutorial(chef, TUTORIAL.wash);
        return;
      }
      case 'cash': {
        if (!roleItem('register')) return;
        const amount = this.floor.collectRegister(r);
        if (amount <= 0) return bad('The register is empty.');
        this.ctx.notify(chef, 'gold', `Collected $${formatPrice(amount)}!`);
        this.ctx.tutorial(chef, TUTORIAL.cash);
        return;
      }
      case 'harvest': {
        const crop = item('crop');
        if (!crop) return;
        const got = this.floor.harvest(r, crop, now);
        if (typeof got === 'string') return bad(got);
        this.ctx.xp(chef, SKILL.farming, XP.harvest);
        this.ctx.notify(chef, 'good', `+${got} ${itemById(crop.kind)?.name.replace(' Plot', '') ?? ''} to your fridge`);
        return;
      }
      case 'collect': {
        const pen = item('animal');
        if (!pen) return;
        const got = this.floor.collect(r, pen);
        if (typeof got === 'string') return bad(got);
        this.ctx.xp(chef, SKILL.ranching, XP.collect);
        this.ctx.notify(chef, 'good', `+${got} to your fridge`);
        return;
      }
    }
  }

  /** Count an action for everyone's animations. */
  private act2(chef: Chef): void {
    chef.player.actionCount = (chef.player.actionCount + 1) & 0xffff;
  }

  // ------------------------------------------------------------- building

  /** Why an item may not be picked up or moved right now, or null. */
  private inUse(r: Restaurant, item: ItemState): string | null {
    const def = itemById(item.kind);
    if (!def) return null;
    if (this.staff.busyItem(r, item.id)) return 'Your staff are using it!';
    switch (def.role) {
      case 'chair':
        if (r.occupantOf(item.id)) return 'Someone is sitting there!';
        if (item.b !== 0) return 'Clear the dirty dish first!';
        return null;
      case 'table':
        for (const [chair, seat] of r.seats) if (seat.table === item.id && (r.occupantOf(chair) || r.item(chair)?.b)) return 'Customers are using this table!';
        return null;
      case 'stove':
        return item.c !== 0 ? 'Something is cooking!' : null;
      case 'sink':
        return item.b > 0 ? 'Dishes are still washing!' : null;
      case 'stand': {
        let waiting = false;
        r.state.orders.forEach((o) => {
          if (o.stage === STAGE.posted || o.stage === STAGE.ready) waiting = true;
        });
        return waiting ? 'Orders are waiting on the stand!' : null;
      }
      case 'animal':
        return item.b > 0 ? 'Collect the produce first!' : null;
      default:
        return null;
    }
  }

  /** A player standing where a solid would appear gets trapped: refuse. */
  private trapsSomeone(r: Restaurant, kind: number, x: number, z: number, rot: number): boolean {
    const def = itemById(kind);
    if (!def?.solid) return false;
    const rect = itemRect(def, x, z, rot);
    for (const other of this.ctx.chefs()) {
      const p = toLocal(r.slot, other.player.x, other.player.z);
      if (p.x > rect.minX - PLAYER_RADIUS && p.x < rect.maxX + PLAYER_RADIUS && p.z > rect.minZ - PLAYER_RADIUS && p.z < rect.maxZ + PLAYER_RADIUS) return true;
    }
    return false;
  }

  place(chef: Chef, kind: number, rawX: number, rawZ: number, rawRot: number): void {
    const r = chef.restaurant;
    if (!r) return;
    const def = itemById(Math.floor(kind));
    if (!def) return;
    if (countOf(chef.profile.inventory, def.id) <= 0) return this.ctx.notify(chef, 'bad', `You have no ${def.name} in your Items.`);
    const x = snapCentre(rawX);
    const z = snapCentre(rawZ);
    const rot = Math.floor(rawRot) & 3;
    const problem = placeProblem(r.contents, def.id, x, z, rot);
    if (problem) return this.ctx.notify(chef, 'bad', problem);
    if (this.trapsSomeone(r, def.id, x, z, rot)) return this.ctx.notify(chef, 'bad', 'Someone is standing there!');
    if (!takeStack(chef.profile.inventory, def.id, 1)) return;
    const now = this.ctx.now();
    const item = new ItemState();
    item.id = freshId();
    item.kind = def.id;
    item.x = x;
    item.z = z;
    item.rot = rot;
    r.state.items.set(String(item.id), item);
    r.layoutChanged();
    if (def.role === 'crop') item.a = now + this.floor.growMs(r, item);
    if (def.role === 'animal') item.a = now + this.floor.produceMs(r, item);
    chef.dirty = true;
    this.ctx.fx({ kind: 'place', slot: r.slot.index, x, z, value: def.id });
    this.progress.refreshRank(chef);
    if (r.seats.size >= 3) this.ctx.tutorial(chef, TUTORIAL.place);
    this.ctx.tutorial(chef, TUTORIAL.placeNew);
  }

  private lastOfItsKind(r: Restaurant, item: ItemState): string | null {
    const role = itemById(item.kind)?.role;
    if (role !== 'stove' && role !== 'stand' && role !== 'register') return null;
    if (r.itemsOf(role).length > 1) return null;
    return `You need at least one ${role === 'stand' ? 'order stand' : role}! Place another first.`;
  }

  pickup(chef: Chef, id: number): void {
    const r = chef.restaurant;
    if (!r) return;
    const item = r.item(Math.floor(id));
    if (!item) return;
    const problem = this.inUse(r, item) ?? this.lastOfItsKind(r, item);
    if (problem) return this.ctx.notify(chef, 'bad', problem);
    // A register being moved pays out what it held first.
    if (itemById(item.kind)?.role === 'register') this.floor.collectRegister(r);
    r.state.items.delete(String(item.id));
    addStack(chef.profile.inventory, item.kind, 1);
    r.layoutChanged();
    chef.dirty = true;
    this.progress.refreshRank(chef);
  }

  moveItem(chef: Chef, id: number, rawX: number, rawZ: number, rawRot: number): void {
    const r = chef.restaurant;
    if (!r) return;
    const item = r.item(Math.floor(id));
    if (!item) return;
    const busy = this.inUse(r, item);
    if (busy) return this.ctx.notify(chef, 'bad', busy);
    const x = snapCentre(rawX);
    const z = snapCentre(rawZ);
    const rot = Math.floor(rawRot) & 3;
    const problem = placeProblem(r.contents, item.kind, x, z, rot, item.id);
    if (problem) return this.ctx.notify(chef, 'bad', problem);
    if (this.trapsSomeone(r, item.kind, x, z, rot)) return this.ctx.notify(chef, 'bad', 'Someone is standing there!');
    item.x = x;
    item.z = z;
    item.rot = rot;
    r.layoutChanged();
    this.ctx.fx({ kind: 'place', slot: r.slot.index, x, z, value: item.kind });
  }

  expand(chef: Chef): void {
    const r = chef.restaurant;
    if (!r) return;
    const next = TIERS[r.state.tier + 1];
    if (!next || r.state.tier >= MAX_TIER) return this.ctx.notify(chef, 'info', 'Your restaurant is as big as it gets!');
    if (chef.player.rank < next.rank) return this.ctx.notify(chef, 'bad', `The ${next.name} needs ${RANKS[next.rank]!.name} rank.`);
    if (!spendCash(chef, next.price)) return this.ctx.notify(chef, 'bad', `The ${next.name} costs $${formatPrice(next.price)}.`);
    r.state.tier += 1;
    chef.profile.restaurant.tier = r.state.tier;
    r.layoutChanged();
    this.ctx.unstick(r.slot.index);
    this.ctx.notify(chef, 'gold', `Your restaurant is now a ${next.name}! More room, more staff.`);
    this.ctx.fx({ kind: 'confetti', slot: r.slot.index, x: -18, z: 4 });
    this.progress.refreshRank(chef);
  }

  applyStyle(chef: Chef, id: number): void {
    const r = chef.restaurant;
    const def = itemById(Math.floor(id));
    if (!r || !def || (def.role !== 'floor' && def.role !== 'wall')) return;
    if (!chef.profile.styles.includes(def.id)) return this.ctx.notify(chef, 'bad', `Buy ${def.name} at the Shop first.`);
    if (def.role === 'floor') r.state.floor = def.id;
    else r.state.wall = def.id;
    this.ctx.notify(chef, 'good', `${def.name} applied!`);
    this.progress.refreshRank(chef);
  }

  // ----------------------------------------------------------------- staff

  hire(chef: Chef, member: number): void {
    const r = chef.restaurant;
    const def = staffById(Math.floor(member));
    if (!r || !def) return;
    const role = ROLES.find((ro) => ro.id === def.role)!;
    const hired = chef.profile.restaurant.staff;
    const bad = (text: string): void => this.ctx.notify(chef, 'bad', text);
    if (chef.player.rank < Math.max(role.rank, def.rank ?? 0)) return bad(`${role.plural} unlock at ${RANKS[Math.max(role.rank, def.rank ?? 0)]!.name} rank.`);
    if (role.skill >= 0 && levelOf(chef.profile.xp[role.skill] ?? 0) < def.level) return bad(`${def.name} needs ${role.skillName} level ${def.level}.`);
    if (hired.some((h) => h.member === def.id)) return bad(`${def.name} already works for you!`);
    if (def.role === 'manager' && hired.some((h) => staffById(h.member)?.role === 'manager')) return bad('You can only have one manager.');
    const cap = TIERS[r.state.tier]!.staff;
    if (hired.length >= cap) return bad(`Your ${TIERS[r.state.tier]!.name} has room for ${cap} staff. Expand to hire more!`);
    if (!spendCash(chef, def.price)) return bad(`Hiring ${def.name} costs $${formatPrice(def.price)}.`);
    hired.push({ member: def.id, level: 1 });
    this.staff.spawn(r, hired.length - 1, hired[hired.length - 1]!, this.ctx.now());
    this.ctx.notify(chef, 'gold', `${def.name} the ${role.name} joined your team!`);
    chef.dirty = true;
  }

  staffAction(chef: Chef, index: number, action: 'upgrade' | 'fire'): void {
    const r = chef.restaurant;
    const hired = chef.profile.restaurant.staff;
    const at = Math.floor(index);
    const record = hired[at];
    if (!r || !record) return;
    const def = staffById(record.member)!;
    const runtime = [...r.staff.values()].find((s) => s.state.member === record.member);
    if (action === 'upgrade') {
      if (record.level >= MAX_STAFF_LEVEL) return this.ctx.notify(chef, 'info', `${def.name} is already at the top level!`);
      const cost = upgradeCost(def, record.level);
      if (!spendCash(chef, cost)) return this.ctx.notify(chef, 'bad', `Training ${def.name} costs $${formatPrice(cost)}.`);
      record.level += 1;
      if (runtime) runtime.state.level = record.level;
      this.ctx.notify(chef, 'good', `${def.name} is now level ${record.level}!`);
    } else {
      hired.splice(at, 1);
      if (runtime) this.staff.remove(r, runtime);
      this.ctx.notify(chef, 'info', `${def.name} has left your restaurant.`);
    }
    chef.dirty = true;
  }

  toggleRecipe(chef: Chef, id: number, on: boolean): void {
    const recipe = recipeById(Math.floor(id));
    if (!recipe) return;
    const off = chef.profile.recipesOff;
    const at = off.indexOf(recipe.id);
    if (on && at >= 0) off.splice(at, 1);
    if (!on && at < 0) off.push(recipe.id);
    chef.dirty = true;
  }

  // ------------------------------------------------------------------ tick

  tick(delta: number): void {
    const now = this.ctx.now();
    for (const r of this.restaurants) {
      const chef = r.owner;
      if (!chef) continue;
      this.floor.tick(r, now);
      this.staff.tick(r, now, delta);
      this.spawnCustomers(r, chef, now, delta);
      this.checkHands(r, chef);
      // Collected early (before washing up): the cash step has nothing left to teach.
      if (chef.profile.tutorial === TUTORIAL.cash && r.state.register < 1) this.ctx.tutorial(chef, TUTORIAL.cash);
      if (chef.profile.tutorial === TUTORIAL.enter) {
        const p = toLocal(r.slot, chef.player.x, chef.player.z);
        if (insideBuilding(r.state.tier, p.x, p.z, -0.5)) this.ctx.tutorial(chef, TUTORIAL.enter);
      }
    }
  }

  private spawnCustomers(r: Restaurant, chef: Chef, now: number, delta: number): void {
    const step = chef.profile.tutorial;
    if (step < TUTORIAL_OPEN_STEP) {
      if (step >= TUTORIAL.seat && step <= TUTORIAL.serve && r.customers.size === 0) this.floor.spawn(r, TUTORIAL_CUSTOMER, now, true);
      return;
    }
    if (r.seats.size === 0 || r.customers.size >= CUSTOMER.max) return;
    r.spawnTimer -= delta;
    if (r.spawnTimer > 0) return;
    const rush = chef.profile.boosts.rush > now ? 2 : 1;
    const flow = rankFlow(r.state.rank) * ratingFlow(r.state.rating) * rush * (0.7 + Math.min(1, r.seats.size / 8) * 0.5);
    r.spawnTimer = (CUSTOMER.interval / flow) * (0.75 + this.ctx.random() * 0.5);
    const beauty = qualityOf(r.contents).beauty;
    const type = weightedPick(this.ctx.random, customerWeights(r.state.rank, beauty, this.ctx.perk(chef, 'luck')));
    if (customerById(type)) this.floor.spawn(r, type, now);
  }

  /** A ticket or plate whose customer gave up is gone from the owner's hands. */
  private checkHands(r: Restaurant, chef: Chef): void {
    const kind = chef.carry.kind;
    if (kind !== CARRY.ticket && kind !== CARRY.plate) return;
    if (r.state.orders.has(String(chef.carry.order))) return;
    setCarry(chef, CARRY.none);
    this.ctx.notify(chef, 'bad', 'Your customer got tired of waiting and left!');
  }

  /** Placed items, for a probe. */
  placed(r: Restaurant): PlacedItem[] {
    const out: PlacedItem[] = [];
    r.state.items.forEach((item) => out.push(item));
    return out;
  }
}
