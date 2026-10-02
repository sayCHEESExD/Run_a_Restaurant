import {
  CARRY,
  CUSTOMER_RARITIES,
  DOOR,
  MAX_TIER,
  PHASE,
  RANKS,
  SIGNS,
  STAGE,
  TIERS,
  BUILDING,
  contentsOf,
  customerById,
  decodePath,
  formatAmount,
  formatPrice,
  interiorOf,
  isSeatedPhase,
  itemById,
  pointAlong,
  seatOf,
  staffById,
  visibleName,
  type PlacedItem,
  type PlotSlot,
  type Point,
  type SeatInfo,
} from '@restaurant/shared';
import { Group, Vector3, type BufferGeometry, type Object3D } from 'three';
import { SIDES, buildEmptyLot, buildShell, buildYardFences, type Shell, type Side } from '../models/buildings.js';
import { buildDirtyDish, buildDish, buildIngredient, buildTicket } from '../models/food.js';
import { buildAnimal, buildCrop, buildItem } from '../models/items.js';
import { block, cylinder } from '../models/shapes.js';
import type { NetCustomer, NetItem, NetRestaurant, NetStaff } from '../net/netTypes.js';
import { buildHeldModel, heldKeyOf } from '../player/held.js';
import { CUSTOMER_LOOKS, NpcCharacter, staffLook } from '../player/NpcCharacter.js';
import { PartBuilder, meshesFor, type PartKind } from '../render/PartBuilder.js';
import { CanvasSign } from './CanvasSign.js';
import { WoodSign } from './WoodSign.js';

// --------------------------------------------------------------- caches

const geometryCache = new Map<string, Partial<Record<PartKind, BufferGeometry>>>();

/** Shared geometry for a model, built once by key. */
const cached = (key: string, build: (b: PartBuilder) => void): Group => {
  let geometries = geometryCache.get(key);
  if (!geometries) {
    const b = new PartBuilder();
    build(b);
    geometries = b.geometries();
    geometryCache.set(key, geometries);
  }
  return meshesFor(geometries, key);
};

/** The yellow "!" that floats over a customer who needs you. */
const exclamation = (): Group =>
  cached('exclaim', (b) => {
    block(b, 0.5, 1.2, 0.5, 0xffd21a, { y: 0.8 }, 'glow');
    block(b, 0.5, 0.5, 0.5, 0xffd21a, { y: 0 }, 'glow');
  });

// ----------------------------------------------------------------- types

interface ItemView {
  readonly group: Group;
  readonly model: Group;
  readonly dynamic: Group;
  kind: number;
  x: number;
  z: number;
  rot: number;
  signature: string;
  /** Pens: the animals, wandering. */
  animals: Group[];
}

interface NpcView {
  readonly npc: NpcCharacter;
  readonly kind: 'customer' | 'staff';
  pathKey: string;
  points: Point[];
  readonly marker: Group;
  lastX: number;
  lastZ: number;
}

/** What the view tells the game about each frame (for the overlay). */
export interface ViewHooks {
  /** A world effect: steam off a pan, bubbles from a sink. */
  effect(kind: 'steam' | 'sizzle' | 'bubbles', x: number, y: number, z: number): void;
}

/** NPCs drawn per restaurant at most, and created per frame at most (cloning a body is not free). */
const MAX_NPCS = 24;
const SPAWNS_PER_FRAME = 2;
let spawnBudget = SPAWNS_PER_FRAME;

/** Reset the per-frame creation budget (call once a frame). */
export const resetNpcBudget = (): void => {
  spawnBudget = SPAWNS_PER_FRAME;
};

/**
 * ONE RESTAURANT PLOT ON SCREEN: the building (rebuilt when it grows or is
 * restyled), every placed item with what is happening on it, the customers
 * and staff walking their routes, and the plot's signs. Everything is drawn
 * from the replicated state; nothing here decides anything.
 */
export class RestaurantView {
  readonly root = new Group();
  private shell: Shell | null = null;
  private shellKey = '';
  private readonly lot: Group;
  private readonly fences: Group;
  private readonly items = new Map<number, ItemView>();
  private readonly npcs = new Map<number, NpcView>();
  private readonly ownerSign = new WoodSign(7, 4.2, 72);
  private readonly expandSign = new WoodSign(5, 2.6, 64);
  private readonly yardSigns: CanvasSign[] = [];
  private marquee: CanvasSign | null = null;
  private marqueeKey = '';
  private seats = new Map<number, SeatInfo>();
  private seatsKey = '';
  private owned = false;
  private cutSide: Side | null = null;
  private roofHidden = false;
  private effectClock = 0;

  constructor(
    readonly slot: PlotSlot,
    private readonly hooks: ViewHooks,
  ) {
    this.root.name = `plot-${slot.index}`;
    this.root.position.set(slot.x, 0, slot.z);
    this.root.rotation.y = slot.yaw;
    const lb = new PartBuilder();
    buildEmptyLot(lb);
    this.lot = lb.build('lot');
    this.root.add(this.lot);
    const fb = new PartBuilder();
    buildYardFences(fb);
    this.fences = fb.build('fences');
    this.fences.visible = false;
    this.root.add(this.fences);

    const post = (x: number, z: number, h: number): void => {
      const pb = new PartBuilder();
      block(pb, 0.3, h, 0.3, 0x7a4a2a, { x: x - 1.4, y: h / 2, z });
      block(pb, 0.3, h, 0.3, 0x7a4a2a, { x: x + 1.4, y: h / 2, z });
      this.root.add(pb.build('sign-posts'));
    };
    post(SIGNS.owner.x, SIGNS.owner.z + 0.2, 4.6);
    this.ownerSign.mesh.position.set(SIGNS.owner.x, 4.4, SIGNS.owner.z);
    this.ownerSign.mesh.rotation.y = Math.PI;
    this.root.add(this.ownerSign.mesh);
    post(SIGNS.expand.x, SIGNS.expand.z + 0.2, 2.6);
    this.expandSign.mesh.position.set(SIGNS.expand.x, 2.6, SIGNS.expand.z);
    this.expandSign.mesh.rotation.y = Math.PI;
    this.root.add(this.expandSign.mesh);
    for (const [spot, text, color] of [
      [SIGNS.farm, 'Farming', '#3f8f3a'],
      [SIGNS.ranch, 'Ranching', '#a8701a'],
    ] as const) {
      post(spot.x, spot.z + 0.2, 2.6);
      const sign = new CanvasSign(3.6, 1.2, [{ text, size: 1, fill: '#ffffff', stroke: color, strokeWidth: 0.2 }]);
      sign.mesh.position.set(spot.x, 2.7, spot.z - 0.05);
      sign.mesh.rotation.y = Math.PI;
      sign.mesh.visible = false;
      this.yardSigns.push(sign);
      this.root.add(sign.mesh);
    }
  }

  get isOwned(): boolean {
    return this.owned;
  }

  /** A plot-local point in the world. */
  world(x: number, z: number, y = 0): Vector3 {
    const c = Math.cos(this.slot.yaw);
    const s = Math.sin(this.slot.yaw);
    return new Vector3(this.slot.x + x * c + z * s, y, this.slot.z - x * s + z * c);
  }

  /** Where a customer or staff member stands right now (plot-local), or null when not drawn. */
  npcLocal(id: number): { x: number; z: number } | null {
    const view = this.npcs.get(id);
    if (!view) return null;
    return { x: view.npc.root.position.x, z: view.npc.root.position.z };
  }

  /** The seats as last computed (chair id -> seat). */
  get seatMap(): ReadonlyMap<number, SeatInfo> {
    return this.seats;
  }

  // ----------------------------------------------------------------- frame

  update(state: NetRestaurant, now: number, delta: number, detail: boolean): void {
    const owned = !!state.owner;
    if (owned !== this.owned) {
      this.owned = owned;
      this.lot.visible = !owned;
      this.fences.visible = owned;
      for (const sign of this.yardSigns) sign.mesh.visible = owned;
      if (!owned) this.clear();
    }
    this.syncShell(state);
    this.syncSigns(state);
    if (!owned) return;
    this.syncItems(state);
    this.syncSeats(state);
    if (detail) {
      this.syncDynamic(state, now, delta);
      this.syncNpcs(state, now, delta);
    } else this.dropNpcs();
  }

  private syncShell(state: NetRestaurant): void {
    const key = state.owner ? `${state.tier}:${state.floor}:${state.wall}` : '';
    if (key === this.shellKey) return;
    this.shellKey = key;
    if (this.shell) {
      this.shell.root.removeFromParent();
      disposeTree(this.shell.root);
      this.shell = null;
    }
    this.cutSide = null;
    this.roofHidden = false;
    if (!state.owner) return;
    this.shell = buildShell(state.tier, state.floor, state.wall);
    this.root.add(this.shell.root);
    this.marqueeKey = '';
  }

  private syncSigns(state: NetRestaurant): void {
    if (!state.owner) {
      this.ownerSign.set({ rows: [{ text: 'Available!', size: 1.2 }, { text: 'An empty lot', size: 0.8, color: '#6a5040' }] });
      this.expandSign.mesh.visible = false;
      if (this.marquee) this.marquee.mesh.visible = false;
      return;
    }
    const name = visibleName(state.ownerName);
    const rank = RANKS[state.rank] ?? RANKS[0]!;
    this.ownerSign.set({
      rows: [
        { text: `${name}'s`, size: 0.9 },
        { text: 'Restaurant', size: 0.8, color: '#7a4a2a' },
      ],
      portrait: state.ownerAvatar || undefined,
      panels: [
        { text: rank.name, size: 1, color: rank.color },
        { text: `${state.rating.toFixed(1)} ★  ${formatAmount(state.served)} served`, size: 1, color: '#ffe066' },
      ],
    });
    const next = TIERS[state.tier + 1];
    this.expandSign.mesh.visible = state.tier < MAX_TIER;
    if (next) this.expandSign.set({ rows: [{ text: 'Expand', size: 1 }, { text: `${next.name}  $${formatPrice(next.price)}`, size: 0.7, color: '#2f7a2a' }] });
    const key = `${name}:${state.tier}`;
    if (key !== this.marqueeKey && this.shell) {
      this.marqueeKey = key;
      this.marquee?.dispose();
      this.marquee?.mesh.removeFromParent();
      const r = interiorOf(state.tier);
      this.marquee = new CanvasSign(Math.min(16, r.maxX - r.minX - 4), 2.2, [{ text: `${name}'s Restaurant`, size: 1, fill: '#ffffff', stroke: '#c8443a', strokeWidth: 0.2 }]);
      this.marquee.mesh.position.set(DOOR.x, BUILDING.height - 0.9, r.minZ - BUILDING.wall - 0.08);
      this.marquee.mesh.rotation.y = Math.PI;
      this.root.add(this.marquee.mesh);
    }
    if (this.marquee) this.marquee.mesh.visible = this.cutSide !== 'front';
  }

  // ----------------------------------------------------------------- items

  private syncItems(state: NetRestaurant): void {
    const seen = new Set<number>();
    state.items.forEach((item) => {
      seen.add(item.id);
      let view = this.items.get(item.id);
      if (view && view.kind !== item.kind) {
        this.removeItem(item.id);
        view = undefined;
      }
      if (!view) {
        const group = new Group();
        const model = cached(`item:${item.kind}`, (b) => buildItem(b, item.kind));
        const dynamic = new Group();
        group.add(model, dynamic);
        this.root.add(group);
        view = { group, model, dynamic, kind: item.kind, x: NaN, z: NaN, rot: -1, signature: '', animals: [] };
        this.items.set(item.id, view);
        const def = itemById(item.kind);
        if (def?.role === 'animal' && def.produces) {
          const count = def.produces === 7 ? 3 : 1;
          for (let i = 0; i < count; i += 1) {
            const animal = cached(`animal:${def.produces}`, (b) => buildAnimal(b, def.produces!));
            animal.position.set((i - 1) * 1.1, 0, -1.2 + (i % 2) * 0.6);
            group.add(animal);
            view.animals.push(animal);
          }
        }
      }
      if (view.x !== item.x || view.z !== item.z || view.rot !== item.rot) {
        view.x = item.x;
        view.z = item.z;
        view.rot = item.rot;
        view.group.position.set(item.x, 0, item.z);
        view.group.rotation.y = item.rot * (Math.PI / 2);
        this.seatsKey = '';
      }
    });
    for (const id of [...this.items.keys()]) if (!seen.has(id)) this.removeItem(id);
  }

  private removeItem(id: number): void {
    const view = this.items.get(id);
    if (!view) return;
    view.group.removeFromParent();
    this.items.delete(id);
    this.seatsKey = '';
  }

  /** Seats (and which way each chair turns) follow the furniture. */
  private syncSeats(state: NetRestaurant): void {
    if (this.seatsKey !== '' && this.seatsKey === String(state.items.size)) return;
    this.seatsKey = String(state.items.size);
    const contents = contentsOf(state as unknown as { tier: number; items: { forEach(v: (i: PlacedItem) => void): void } });
    const seats = new Map<number, SeatInfo>();
    state.items.forEach((item) => {
      const seat = seatOf(contents, item);
      if (seat) seats.set(item.id, seat);
      // A chair at a table turns to face it.
      const view = this.items.get(item.id);
      if (view && itemById(item.kind)?.role === 'chair') view.group.rotation.y = seat ? seat.yaw + Math.PI : item.rot * (Math.PI / 2);
    });
    this.seats = seats;
  }

  /** What is going on on each item: a pan on the stove, plates on the pass, dishes on tables... */
  private syncDynamic(state: NetRestaurant, now: number, delta: number): void {
    this.effectClock += delta;
    const puff = this.effectClock > 0.25;
    if (puff) this.effectClock = 0;
    const ready: number[] = [];
    let posted = 0;
    state.orders.forEach((order) => {
      if (order.stage === STAGE.ready) ready.push(order.recipe);
      if (order.stage === STAGE.posted) posted += 1;
    });
    const eatingAt = new Map<number, number>();
    state.customers.forEach((c) => {
      if (c.phase === PHASE.eating) eatingAt.set(c.seat, c.recipe);
    });
    state.items.forEach((item) => {
      const view = this.items.get(item.id);
      const def = itemById(item.kind);
      if (!view || !def) return;
      let signature = '';
      switch (def.role) {
        case 'stove':
          signature = item.c ? `cook:${state.orders.get(String(item.c))?.recipe ?? 0}` : '';
          if (item.c && puff) {
            const at = this.world(item.x, item.z);
            this.hooks.effect(Math.random() < 0.5 ? 'steam' : 'sizzle', at.x, 2.6, at.z);
          }
          break;
        case 'stand':
          signature = `stand:${ready.slice(0, 6).join(',')}:${Math.min(posted, 6)}`;
          break;
        case 'chair':
          signature = item.b ? 'dirty' : eatingAt.has(item.id) ? `eat:${eatingAt.get(item.id)}` : '';
          break;
        case 'sink':
          signature = `sink:${Math.min(item.b, 8)}`;
          if (item.b && puff) {
            const at = this.world(item.x, item.z);
            this.hooks.effect('bubbles', at.x, 2.2, at.z);
          }
          break;
        case 'register':
          signature = state.register >= 1 ? `cash:${Math.min(5, Math.ceil(Math.log10(state.register + 1)))}` : '';
          break;
        case 'crop': {
          const span = (def.seconds ?? 60) * 1000;
          const growth = now >= item.a ? 1 : Math.max(0, 1 - (item.a - now) / span);
          signature = `crop:${growth >= 1 ? 4 : Math.min(3, Math.floor(growth * 4))}`;
          break;
        }
        case 'animal':
          signature = `pen:${Math.min(item.b, 6)}`;
          this.animateAnimals(view, now);
          break;
        default:
          return;
      }
      if (signature === view.signature) return;
      view.signature = signature;
      this.drawDynamic(view, item, def.role, signature, ready, posted, eatingAt.get(item.id) ?? 0);
    });
  }

  private drawDynamic(view: ItemView, item: NetItem, role: string, signature: string, ready: readonly number[], posted: number, eating: number): void {
    const d = view.dynamic;
    d.clear();
    // Dynamic children live in the item's frame, which a chair has turned: undo that for table-relative things.
    d.rotation.y = 0;
    if (!signature) return;
    const def = itemById(item.kind)!;
    switch (role) {
      case 'stove': {
        const recipe = Number(signature.split(':')[1]);
        const pan = cached('pan', (b) => {
          cylinder(b, 0.55, 0.45, 0.22, 0x2a2a2e, { y: 0.11 }, 'smooth', 12);
          block(b, 0.9, 0.08, 0.14, 0x2a2a2e, { x: 0.85, y: 0.18 });
          cylinder(b, 0.36, 0.36, 0.04, 0xff7a1a, { y: -0.02 }, 'glow', 12);
        });
        pan.position.set(-0.45, def.h + 0.1, -0.45);
        d.add(pan);
        if (recipe) {
          const food = cached(`dish-bare:${recipe}`, (b) => buildDish(b, recipe, false));
          food.scale.setScalar(0.6);
          food.position.set(-0.45, def.h + 0.24, -0.45);
          d.add(food);
        }
        return;
      }
      case 'stand': {
        ready.slice(0, 6).forEach((recipe, i) => {
          const plate = cached(`dish:${recipe}`, (b) => buildDish(b, recipe));
          plate.scale.setScalar(0.85);
          plate.position.set(-1.5 + (i % 3) * 1.5, def.h + 0.15, i < 3 ? -0.35 : 0.45);
          d.add(plate);
        });
        for (let i = 0; i < Math.min(posted, 6); i += 1) {
          const ticket = cached('ticket', buildTicket);
          ticket.scale.setScalar(0.7);
          ticket.position.set(-1.4 + i * 0.55, def.h + 0.85, -0.12);
          d.add(ticket);
        }
        return;
      }
      case 'chair': {
        const seat = this.seats.get(item.id);
        if (!seat) return;
        // Into the chair's frame: the dish sits on the table at the seat's edge.
        const inv = -view.group.rotation.y;
        const dx = seat.dishX - item.x;
        const dz = seat.dishZ - item.z;
        const lx = dx * Math.cos(inv) + dz * Math.sin(inv);
        const lz = -dx * Math.sin(inv) + dz * Math.cos(inv);
        const model = signature === 'dirty' ? cached('dirty', buildDirtyDish) : cached(`dish:${eating}`, (b) => buildDish(b, eating));
        model.position.set(lx, seat.tableTop + 0.02, lz);
        d.add(model);
        return;
      }
      case 'sink': {
        const n = Number(signature.split(':')[1]);
        for (let i = 0; i < n; i += 1) {
          const dish = cached('dirty', buildDirtyDish);
          dish.scale.setScalar(0.8);
          dish.position.set(0.9 - (i % 2) * 0.25, def.h + 0.05 + i * 0.12, 0.1);
          d.add(dish);
        }
        return;
      }
      case 'register': {
        const n = Number(signature.split(':')[1]);
        const pile = cached(`cash:${n}`, (b) => {
          for (let i = 0; i < n + 1; i += 1) {
            cylinder(b, 0.22, 0.22, 0.08, 0xffd23a, { x: -0.4 + (i % 3) * 0.25, y: 0.04 + Math.floor(i / 3) * 0.09, z: -0.5 }, 'smooth', 10);
            block(b, 0.5, 0.06, 0.26, 0x5ad86a, { x: 0.35, y: 0.03 + i * 0.07, z: -0.45, ry: i * 0.3 });
          }
        });
        pile.position.y = 1.43;
        d.add(pile);
        return;
      }
      case 'crop': {
        const stage = Number(signature.split(':')[1]);
        const crop = cached(`crop:${def.produces}:${stage}`, (b) => buildCrop(b, def.produces ?? 1, stage / 4));
        d.add(crop);
        return;
      }
      case 'animal': {
        const n = Number(signature.split(':')[1]);
        for (let i = 0; i < n; i += 1) {
          const thing = cached(`ingredient:${def.produces}`, (b) => buildIngredient(b, def.produces ?? 7));
          thing.scale.setScalar(0.6);
          thing.position.set(-1.6 + (i % 3) * 0.5, 0.05, 1.4 + Math.floor(i / 3) * 0.5);
          d.add(thing);
        }
        return;
      }
    }
  }

  private animateAnimals(view: ItemView, now: number): void {
    const t = now / 1000;
    view.animals.forEach((animal, i) => {
      const phase = t * 0.4 + i * 2.1 + view.x;
      animal.position.x = (i - 1) * 1.1 + Math.sin(phase) * 0.8;
      animal.position.z = -0.6 + Math.cos(phase * 0.7) * 0.9;
      animal.rotation.y = Math.atan2(Math.cos(phase), -Math.sin(phase * 0.7) * 0.6);
      animal.position.y = Math.abs(Math.sin(t * 6 + i)) * 0.08;
    });
  }

  // ------------------------------------------------------------------ NPCs

  private syncNpcs(state: NetRestaurant, now: number, delta: number): void {
    const seen = new Set<number>();
    state.customers.forEach((c) => {
      seen.add(c.id);
      this.drawCustomer(c, now, delta);
    });
    state.staff.forEach((s) => {
      seen.add(s.id);
      this.drawStaff(s, now, delta);
    });
    for (const [id, view] of this.npcs) {
      if (seen.has(id)) continue;
      view.npc.dispose();
      this.npcs.delete(id);
    }
  }

  private viewFor(id: number, kind: 'customer' | 'staff', make: () => NpcCharacter): NpcView | null {
    let view = this.npcs.get(id);
    if (view) return view;
    if (spawnBudget <= 0 || this.npcs.size >= MAX_NPCS) return null;
    spawnBudget -= 1;
    const npc = make();
    const marker = exclamation();
    marker.position.y = 4.6;
    marker.visible = false;
    npc.root.add(marker);
    this.root.add(npc.root);
    view = { npc, kind, pathKey: '', points: [], marker, lastX: NaN, lastZ: NaN };
    this.npcs.set(id, view);
    return view;
  }

  /** Place a walker on its route; returns whether they are still walking. */
  private walk(view: NpcView, path: string, t0: number, speed: number, now: number, face: number | null, delta: number): boolean {
    if (view.pathKey !== path) {
      view.pathKey = path;
      view.points = decodePath(path);
    }
    const at = pointAlong(view.points, (Math.max(0, now - t0) / 1000) * speed);
    const root = view.npc.root;
    root.position.set(at.x, 0, at.z);
    const moving = !at.done;
    const yaw = moving || face === null ? at.yaw : face;
    const current = root.rotation.y;
    let diff = yaw - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    root.rotation.y = current + diff * Math.min(1, delta * 12);
    view.lastX = at.x;
    view.lastZ = at.z;
    return moving;
  }

  private drawCustomer(c: NetCustomer, now: number, delta: number): void {
    const view = this.viewFor(c.id, 'customer', () => new NpcCharacter(CUSTOMER_LOOKS[c.type] ?? CUSTOMER_LOOKS[1]!));
    if (!view) return;
    const seated = isSeatedPhase(c.phase);
    const moving = this.walk(view, c.path, c.t0, c.speed, now, seated ? c.face : null, delta);
    const m = view.npc.character.motion;
    m.speed = moving ? c.speed : 0;
    m.sitting = seated && !moving;
    m.eating = c.phase === PHASE.eating;
    view.marker.visible = !moving && (c.phase === PHASE.queued || c.phase === PHASE.ready);
    if (view.marker.visible) {
      view.marker.position.y = 4.4 + Math.sin(now / 220) * 0.18 - (m.sitting ? 0.6 : 0);
      view.marker.rotation.y = now / 600;
    }
    view.npc.update(delta);
  }

  private drawStaff(s: NetStaff, now: number, delta: number): void {
    const role = staffById(s.member)?.role ?? 'waiter';
    const view = this.viewFor(s.id, 'staff', () => new NpcCharacter(staffLook(role, s.member)));
    if (!view) return;
    const moving = this.walk(view, s.path, s.t0, s.speed, now, s.face, delta);
    const m = view.npc.character.motion;
    m.speed = moving ? s.speed : 0;
    m.working = s.pose === 1 && !moving;
    m.tray = s.carry === CARRY.plate || s.carry === CARRY.dish;
    view.npc.character.setHeld(heldKeyOf(s.carry, s.carryRecipe), () => buildHeldModel(s.carry, s.carryRecipe));
    view.npc.update(delta);
  }

  private dropNpcs(): void {
    for (const view of this.npcs.values()) view.npc.dispose();
    this.npcs.clear();
  }

  // -------------------------------------------------------------- cutaway

  /**
   * SEE INSIDE: while the local player is in this restaurant the roof lifts
   * off, and the wall between the camera and the room drops to a knee-high
   * stub - so the camera never has to dive into the wall to keep them in view.
   */
  setCutaway(inside: boolean, cameraLocal: { x: number; z: number } | null, tier: number): void {
    if (!this.shell) return;
    const hideRoof = inside;
    if (hideRoof !== this.roofHidden) {
      this.roofHidden = hideRoof;
      this.shell.roof.visible = !hideRoof;
    }
    let side: Side | null = null;
    if (inside && cameraLocal) {
      const r = interiorOf(tier);
      const dx = cameraLocal.x < r.minX ? r.minX - cameraLocal.x : cameraLocal.x > r.maxX ? cameraLocal.x - r.maxX : 0;
      const dz = cameraLocal.z < r.minZ ? r.minZ - cameraLocal.z : cameraLocal.z > r.maxZ ? cameraLocal.z - r.maxZ : 0;
      if (dx > 0 || dz > 0) {
        if (dz >= dx) side = cameraLocal.z < r.minZ ? 'front' : 'back';
        else side = cameraLocal.x < r.minX ? 'left' : 'right';
      }
    }
    if (side === this.cutSide) return;
    this.cutSide = side;
    if (this.marquee) this.marquee.mesh.visible = side !== 'front';
    for (const s of SIDES) {
      const wall = this.shell.walls[s];
      wall.full.visible = s !== side;
      wall.stub.visible = s === side;
    }
  }

  // -------------------------------------------------------------- helpers

  /** The customer's rarity colour (for the order bubble's rim). */
  static rarityColor(type: number): string {
    return CUSTOMER_RARITIES[customerById(type)?.rarity ?? 'common'].color;
  }

  private clear(): void {
    for (const id of [...this.items.keys()]) this.removeItem(id);
    this.dropNpcs();
    this.seats.clear();
    this.seatsKey = '';
  }

  dispose(): void {
    this.clear();
    this.shell && disposeTree(this.shell.root);
    this.ownerSign.dispose();
    this.expandSign.dispose();
    for (const sign of this.yardSigns) sign.dispose();
    this.marquee?.dispose();
    this.root.removeFromParent();
  }
}

const disposeTree = (object: Object3D): void => {
  object.traverse((child) => {
    const mesh = child as unknown as { isMesh?: boolean; geometry?: { dispose(): void } };
    if (mesh.isMesh) mesh.geometry?.dispose();
  });
};

