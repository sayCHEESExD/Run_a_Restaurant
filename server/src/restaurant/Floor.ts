import {
  CUSTOMER,
  CUSTOMER_RARITIES,
  PHASE,
  QUEUE_SPOTS,
  RATING,
  RECIPES,
  SATISFACTION,
  SKILL,
  STAGE,
  STARTER_RECIPE,
  STREET_POINT,
  TUTORIAL_PAYMENT,
  XP,
  accessPoint,
  animalSpeedFactor,
  canAfford,
  cookTimeFactor,
  customerById,
  findPath,
  growSpeedFactor,
  itemById,
  levelOf,
  queueSize,
  recipeById,
  tipBonus,
  washSpeedFactor,
  weightedPick,
  type Point,
  type RecipeDef,
} from '@restaurant/shared';
import { CustomerState, OrderState, type ItemState } from '../rooms/state/RestaurantState.js';
import { addStack, countOf, stockFridge, takeStack, type Chef } from './Chef.js';
import { Restaurant, freshId, type CustomerRuntime } from './Restaurant.js';
import type { RoomContext } from './RoomContext.js';

/** Most seats whose routes are searched when picking where a customer sits. */
const SEAT_CANDIDATES = 5;

/**
 * THE FRONT OF HOUSE AND THE KITCHEN: what happens to customers, orders,
 * stoves, sinks, crops and animals - shared by the owner's own hands and by
 * their staff, so a waiter seats a customer exactly the way the owner does.
 * Every operation re-checks the state it acts on, because the world may have
 * moved on since it was asked for.
 */
export class Floor {
  constructor(private readonly ctx: RoomContext) {}

  // ------------------------------------------------------------ helpers

  private level(chef: Chef, skill: number): number {
    return levelOf(chef.profile.xp[skill] ?? 0);
  }

  /** Where a customer is right now (plot-local). */
  positionOf(c: CustomerRuntime, now: number): Point {
    const p = Restaurant.positionOf(c.walk, now);
    return { x: p.x, z: p.z };
  }

  /** Customers waiting at (or walking to) the door, oldest first. */
  queue(r: Restaurant): CustomerRuntime[] {
    const out: CustomerRuntime[] = [];
    for (const c of r.customers.values()) if (c.state.phase === PHASE.arriving || c.state.phase === PHASE.queued) out.push(c);
    return out.sort((a, b) => a.state.id - b.state.id);
  }

  /** Walk everyone in the queue up to their place in it. */
  reflowQueue(r: Restaurant, now: number): void {
    this.queue(r).forEach((c, i) => {
      if (c.queueSpot === i) return;
      c.queueSpot = i;
      const spot = QUEUE_SPOTS[Math.min(i, QUEUE_SPOTS.length - 1)]!;
      const from = this.positionOf(c, now);
      const walk = Restaurant.route(findPath(r.nav, from, spot) ?? [from, spot], now, CUSTOMER.walk)!;
      c.walk = walk;
      Restaurant.publish(c.state, walk);
      c.state.phase = PHASE.arriving;
    });
  }

  // ------------------------------------------------------------ arrivals

  /** A new customer walks in from the street to the back of the queue. */
  spawn(r: Restaurant, type: number, now: number, tutorial = false): CustomerRuntime | null {
    const queued = this.queue(r).length;
    if (queued >= Math.min(QUEUE_SPOTS.length, queueSize(r.state.rank))) return null;
    const spot = QUEUE_SPOTS[queued]!;
    const from = { x: STREET_POINT.x + (this.ctx.random() - 0.5) * 6, z: STREET_POINT.z };
    const walk = Restaurant.route(findPath(r.nav, from, spot) ?? [from, spot], now, CUSTOMER.walk)!;
    const state = new CustomerState();
    state.id = freshId();
    state.type = type;
    state.phase = PHASE.arriving;
    state.face = 0;
    Restaurant.publish(state, walk);
    const c: CustomerRuntime = { state, walk, orderedAt: 0, queueSpot: queued, tutorial };
    r.customers.set(state.id, c);
    r.state.customers.set(String(state.id), state);
    return c;
  }

  // ------------------------------------------------------------ seating

  /** Seat a waiting customer: they walk to the nearest free seat they can reach. An error message when they cannot. */
  seat(r: Restaurant, c: CustomerRuntime, now: number): string | null {
    if (c.state.phase !== PHASE.arriving && c.state.phase !== PHASE.queued) return 'They are already seated.';
    const free = r.freeSeats();
    if (free.length === 0) return r.seats.size === 0 ? 'Place a table with chairs first!' : 'No free seats! Clear the dirty dishes or add more chairs.';
    const from = this.positionOf(c, now);
    const candidates = free
      .map((chair) => ({ chair, d: Math.hypot(chair.x - from.x, chair.z - from.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, SEAT_CANDIDATES);
    let best: { chair: ItemState; points: Point[]; length: number } | null = null;
    for (const { chair } of candidates) {
      const points = findPath(r.nav, from, { x: chair.x, z: chair.z });
      if (!points) continue;
      let length = 0;
      for (let i = 1; i < points.length; i += 1) length += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z);
      if (!best || length < best.length) best = { chair, points, length };
    }
    if (!best) return 'They cannot reach any free seat! Clear a path.';
    const walk = Restaurant.route(best.points, now, CUSTOMER.walk)!;
    c.walk = walk;
    Restaurant.publish(c.state, walk);
    c.state.phase = PHASE.toSeat;
    c.state.seat = best.chair.id;
    c.state.until = 0;
    c.state.face = r.seats.get(best.chair.id)?.yaw ?? 0;
    c.queueSpot = -1;
    this.reflowQueue(r, now);
    return null;
  }

  // ------------------------------------------------------------- ordering

  /** What this owner's kitchen can make right now, from the menu. */
  menu(chef: Chef): RecipeDef[] {
    const cooking = this.level(chef, SKILL.cooking);
    const stock = (id: number): number => countOf(chef.profile.ingredients, id);
    return RECIPES.filter((recipe) => recipe.level <= cooking && !chef.profile.recipesOff.includes(recipe.id) && canAfford(recipe, stock));
  }

  /** Take a seated customer's order: the ingredients come out of the fridge, the ticket goes up on the stand. */
  order(r: Restaurant, c: CustomerRuntime, now: number): string | null {
    const chef = r.owner;
    if (!chef) return 'No owner.';
    if (c.state.phase !== PHASE.ready) return c.state.phase === PHASE.browsing ? 'They are still reading the menu.' : 'They are not ready to order.';
    let recipe: RecipeDef | undefined;
    if (c.tutorial) recipe = recipeById(STARTER_RECIPE);
    else {
      const menu = this.menu(chef);
      if (menu.length > 0) recipe = recipeById(weightedPick(this.ctx.random, menu.map((m, i) => [m.id, 1 + i * 0.35] as const)));
    }
    if (!recipe) {
      this.leave(r, c, now, true);
      return 'Nothing on your menu can be cooked! Turn on a recipe in Manage > Recipes, or stock your fridge.';
    }
    for (const [id, n] of recipe.needs) takeStack(chef.profile.ingredients, id, n);
    chef.dirty = true;
    const order = new OrderState();
    order.id = freshId();
    order.customer = c.state.id;
    order.recipe = recipe.id;
    order.stage = STAGE.posted;
    order.at = now;
    r.state.orders.set(String(order.id), order);
    c.state.recipe = recipe.id;
    c.state.phase = PHASE.waiting;
    c.state.until = now + CUSTOMER.foodPatience * 1000;
    c.orderedAt = now;
    return null;
  }

  // -------------------------------------------------------------- kitchen

  /** The oldest order at a stage. */
  oldest(r: Restaurant, stage: number, unclaimed = false): OrderState | undefined {
    let best: OrderState | undefined;
    r.state.orders.forEach((order) => {
      if (order.stage !== stage) return;
      if (unclaimed && r.claims.has(`order:${order.id}`)) return;
      if (!best || order.at < best.at) best = order;
    });
    return best;
  }

  /** Put a ticket on a stove. */
  startCooking(r: Restaurant, order: OrderState, stove: ItemState, now: number, cookLevel: number): void {
    const recipe = recipeById(order.recipe)!;
    const def = itemById(stove.kind)!;
    const owner = r.owner;
    const boost = (owner && owner.profile.boosts.cook > now ? 2 : 1) * (1 + this.ctx.perk(owner, 'cook'));
    const seconds = (recipe.cook * cookTimeFactor(cookLevel)) / ((def.speed ?? 1) * boost);
    order.stage = STAGE.cooking;
    stove.c = order.id;
    stove.a = now + Math.max(1, seconds) * 1000;
    this.ctx.fx({ kind: 'cook', slot: r.slot.index, x: stove.x, z: stove.z, value: recipe.id });
  }

  /** A customer gets their plate: they eat, and the order is done. */
  serve(r: Restaurant, c: CustomerRuntime, order: OrderState, now: number): void {
    const def = customerById(c.state.type);
    r.state.orders.delete(String(order.id));
    c.state.phase = PHASE.eating;
    c.state.until = now + (def?.eat ?? 7) * 1000;
    const seat = r.item(c.state.seat);
    if (seat) this.ctx.fx({ kind: 'serve', slot: r.slot.index, x: seat.x, z: seat.z, value: order.recipe });
  }

  /** Load one dirty dish into a sink. */
  loadSink(r: Restaurant, sink: ItemState, now: number): void {
    sink.b += 1;
    if (sink.a <= now) sink.a = now + this.washMs(r, sink);
  }

  sinkRoom(sink: ItemState): number {
    return (itemById(sink.kind)?.capacity ?? 0) - sink.b;
  }

  private washMs(r: Restaurant, sink: ItemState): number {
    const def = itemById(sink.kind);
    const cleaning = r.owner ? this.level(r.owner, SKILL.cleaning) : 1;
    return (6 / ((def?.speed ?? 1) * washSpeedFactor(cleaning))) * 1000;
  }

  /** Collect the register into the owner's purse. */
  collectRegister(r: Restaurant): number {
    const amount = Math.floor(r.state.register);
    if (amount <= 0 || !r.owner) return 0;
    r.state.register = 0;
    r.owner.profile.cash = Math.min(1e15, r.owner.profile.cash + amount);
    r.owner.dirty = true;
    const register = r.firstOf('register');
    if (register) this.ctx.fx({ kind: 'pay', slot: r.slot.index, x: register.x, z: register.z, value: -amount });
    return amount;
  }

  // ----------------------------------------------------------------- farm

  growMs(r: Restaurant, crop: ItemState): number {
    const def = itemById(crop.kind)!;
    const farming = r.owner ? this.level(r.owner, SKILL.farming) : 1;
    let boost = 1;
    for (const s of r.itemsOf('sprinkler')) if (Math.hypot(s.x - crop.x, s.z - crop.z) <= 7) boost = Math.max(boost, itemById(s.kind)?.speed ?? 1);
    return ((def.seconds ?? 60) * 1000) / (growSpeedFactor(farming) * boost);
  }

  produceMs(r: Restaurant, pen: ItemState): number {
    const def = itemById(pen.kind)!;
    const ranching = r.owner ? this.level(r.owner, SKILL.ranching) : 1;
    let boost = 1;
    for (const f of r.itemsOf('feeder')) if (Math.hypot(f.x - pen.x, f.z - pen.z) <= 9) boost = Math.max(boost, itemById(f.kind)?.speed ?? 1);
    return ((def.seconds ?? 60) * 1000) / (animalSpeedFactor(ranching) * boost);
  }

  /** Harvest a ripe crop into the fridge, and plant it again. Returns how many went in, or an error. */
  harvest(r: Restaurant, crop: ItemState, now: number): number | string {
    const chef = r.owner;
    const def = itemById(crop.kind);
    if (!chef || !def?.produces) return 'Nothing to harvest.';
    if (now < crop.a) return 'Still growing!';
    const stored = stockFridge(chef, def.produces, def.yield ?? 1);
    if (stored <= 0) return 'Your fridges are full! Buy a bigger fridge or cook more.';
    crop.a = now + this.growMs(r, crop);
    chef.profile.counters.harvested += stored;
    this.ctx.fx({ kind: 'harvest', slot: r.slot.index, x: crop.x, z: crop.z, value: def.produces });
    return stored;
  }

  /** Collect an animal pen's produce into the fridge. */
  collect(r: Restaurant, pen: ItemState): number | string {
    const chef = r.owner;
    const def = itemById(pen.kind);
    if (!chef || !def?.produces) return 'Nothing to collect.';
    if (pen.b <= 0) return 'Nothing to collect yet!';
    const stored = stockFridge(chef, def.produces, pen.b);
    if (stored <= 0) return 'Your fridges are full! Buy a bigger fridge or cook more.';
    pen.b -= stored;
    chef.profile.counters.collected += stored;
    this.ctx.fx({ kind: 'collect', slot: r.slot.index, x: pen.x, z: pen.z, value: def.produces });
    return stored;
  }

  // ----------------------------------------------------------------- tick

  tick(r: Restaurant, now: number): void {
    this.tickKitchen(r, now);
    this.tickYard(r, now);
    this.tickCustomers(r, now);
  }

  private tickKitchen(r: Restaurant, now: number): void {
    for (const stove of r.itemsOf('stove')) {
      if (stove.c === 0 || now < stove.a) continue;
      const order = r.state.orders.get(String(stove.c));
      stove.c = 0;
      stove.a = 0;
      if (!order) continue;
      order.stage = STAGE.ready;
      order.at = now;
      const stand = r.firstOf('stand');
      this.ctx.fx({ kind: 'ready', slot: r.slot.index, x: stand?.x ?? stove.x, z: stand?.z ?? stove.z, value: order.recipe });
    }
    for (const sink of r.itemsOf('sink')) {
      if (sink.b === 0 || now < sink.a) continue;
      sink.b -= 1;
      sink.a = sink.b > 0 ? now + this.washMs(r, sink) : 0;
      const chef = r.owner;
      if (chef) {
        chef.profile.counters.washed += 1;
        chef.dirty = true;
        this.ctx.xp(chef, SKILL.cleaning, XP.wash);
      }
      this.ctx.fx({ kind: 'clean', slot: r.slot.index, x: sink.x, z: sink.z });
    }
  }

  private tickYard(r: Restaurant, now: number): void {
    for (const pen of r.itemsOf('animal')) {
      const def = itemById(pen.kind)!;
      const cap = def.capacity ?? 6;
      if (pen.a === 0) pen.a = now + this.produceMs(r, pen);
      // Catch up (also after a long absence), but never past the pen's storage.
      let guard = 0;
      while (now >= pen.a && guard < 50) {
        guard += 1;
        if (pen.b >= cap) {
          pen.a = now + this.produceMs(r, pen);
          break;
        }
        pen.b = Math.min(cap, pen.b + (def.yield ?? 1));
        pen.a += this.produceMs(r, pen);
      }
    }
  }

  private tickCustomers(r: Restaurant, now: number): void {
    let queueChanged = false;
    for (const c of [...r.customers.values()]) {
      const s = c.state;
      switch (s.phase) {
        case PHASE.arriving:
          if (now >= c.walk.arriveAt) {
            s.phase = PHASE.queued;
            if (s.until === 0) s.until = now + CUSTOMER.queuePatience * 1000;
          }
          break;
        case PHASE.queued:
          if (!c.tutorial && now >= s.until) {
            this.leave(r, c, now, true);
            queueChanged = true;
          }
          break;
        case PHASE.toSeat:
          if (now >= c.walk.arriveAt) {
            const seat = r.seats.get(s.seat);
            const chair = r.item(s.seat);
            if (!seat || !chair) {
              // The chair went away under them: back to the door.
              this.leave(r, c, now, true);
              break;
            }
            s.phase = PHASE.browsing;
            s.face = seat.yaw;
            s.until = now + CUSTOMER.browse * 1000;
          }
          break;
        case PHASE.browsing:
          if (now >= s.until) {
            s.phase = PHASE.ready;
            s.until = now + CUSTOMER.orderPatience * 1000;
          }
          break;
        case PHASE.ready:
          if (!c.tutorial && now >= s.until) this.leave(r, c, now, true);
          break;
        case PHASE.waiting:
          if (!c.tutorial && now >= s.until) this.leave(r, c, now, true);
          break;
        case PHASE.eating:
          if (now >= s.until) {
            this.pay(r, c, now);
            const chair = r.item(s.seat);
            if (chair) chair.b = 1;
            this.leave(r, c, now, false);
          }
          break;
        case PHASE.leaving:
          if (now >= c.walk.arriveAt) {
            r.customers.delete(s.id);
            r.state.customers.delete(String(s.id));
          }
          break;
      }
    }
    if (queueChanged) this.reflowQueue(r, now);
  }

  /** A customer heads home: paid and happy, or fed up. Any order of theirs is cancelled. */
  leave(r: Restaurant, c: CustomerRuntime, now: number, angry: boolean): void {
    const wasQueued = c.state.phase === PHASE.arriving || c.state.phase === PHASE.queued;
    const from = this.positionOf(c, now);
    const walk = Restaurant.route(findPath(r.nav, from, STREET_POINT) ?? [from, STREET_POINT], now, CUSTOMER.walk)!;
    c.walk = walk;
    Restaurant.publish(c.state, walk);
    c.state.phase = PHASE.leaving;
    c.state.until = 0;
    c.queueSpot = -1;
    // Their order, wherever it is, is void.
    r.state.orders.forEach((order, key) => {
      if (order.customer !== c.state.id) return;
      for (const stove of r.itemsOf('stove')) {
        if (stove.c === order.id) {
          stove.c = 0;
          stove.a = 0;
        }
      }
      r.state.orders.delete(key);
    });
    if (angry) {
      this.rate(r, RATING.angry);
      const at = this.positionOf(c, now);
      this.ctx.fx({ kind: 'angry', slot: r.slot.index, x: at.x, z: at.z });
    }
    if (wasQueued) this.reflowQueue(r, now);
  }

  private rate(r: Restaurant, stars: number): void {
    const s = r.state;
    s.rating = Math.round((s.rating * (1 - RATING.weight) + stars * RATING.weight) * 1000) / 1000;
  }

  /** The bill: price x rarity x (1 + tips) x boosts, into the register. */
  private pay(r: Restaurant, c: CustomerRuntime, now: number): void {
    const chef = r.owner;
    if (!chef) return;
    const def = customerById(c.state.type);
    const recipe = recipeById(c.state.recipe) ?? recipeById(STARTER_RECIPE)!;
    const wait = (now - c.orderedAt) / 1000;
    const mood = SATISFACTION.find((s) => wait <= s.within) ?? SATISFACTION[SATISFACTION.length - 1]!;
    const stand = r.firstOf('stand');
    let tip = mood.tip + tipBonus(this.level(chef, SKILL.service)) + (itemById(stand?.kind ?? 0)?.tips ?? 0) + this.ctx.perk(chef, 'tips');
    if (def?.perk === 'tip') tip += def.rarity === 'legendary' ? 4 : def.rarity === 'gourmet' ? 1 : 0.5;
    const rarity = CUSTOMER_RARITIES[def?.rarity ?? 'common'];
    const boost = chef.profile.boosts.cash > now ? 2 : 1;
    const amount = c.tutorial ? TUTORIAL_PAYMENT : Math.max(1, Math.round(recipe.price * rarity.pay * (1 + tip) * boost));
    r.state.register += amount;
    chef.profile.earned = Math.min(1e15, chef.profile.earned + amount);
    chef.profile.served += 1;
    r.state.served = chef.profile.served;
    addStack(chef.profile.index, c.state.type, 1);
    if (rarity.id !== 'common' && rarity.id !== 'uncommon') chef.profile.counters.rare += 1;
    this.rate(r, def?.perk === 'rating' ? 5 : mood.stars);
    if (def?.perk === 'rating') this.rate(r, 5);
    if (def?.perk === 'diamonds') {
      chef.profile.diamonds += def.name === 'Wizard' ? 5 : 3;
      this.ctx.notify(chef, 'gold', `${def.name} left you ${def.name === 'Wizard' ? 5 : 3} Diamonds!`);
    }
    if (def?.perk === 'xp') {
      const k = def.rarity === 'legendary' ? 3 : 2;
      this.ctx.xp(chef, SKILL.service, XP.serve * (k - 1));
    }
    chef.dirty = true;
    const register = r.firstOf('register');
    this.ctx.fx({ kind: 'pay', slot: r.slot.index, x: register?.x ?? 0, z: register?.z ?? 0, value: amount });
    this.ctx.rankChanged(chef);
  }

  /** Where someone stands to work at an item. */
  access(r: Restaurant, item: ItemState): Point {
    return accessPoint(r.nav, item) ?? { x: item.x, z: item.z };
  }
}
