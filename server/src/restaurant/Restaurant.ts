import {
  PHASE,
  buildNav,
  contentsOf,
  encodePath,
  itemSolidBoxes,
  isSeatedPhase,
  itemById,
  pathLength,
  plotSolids,
  pointAlong,
  seatOf,
  toWorldBox,
  type Aabb,
  type ItemRole,
  type NavGrid,
  type PlacedItem,
  type PlotSlot,
  type Point,
  type RestaurantContents,
  type SeatInfo,
  type WorldCollision,
} from '@restaurant/shared';
import type { CustomerState, ItemState, RestaurantState, StaffState } from '../rooms/state/RestaurantState.js';
import type { Chef } from './Chef.js';

/** A walker's route as the server times it. */
export interface Walk {
  points: Point[];
  t0: number;
  speed: number;
  /** When they arrive (ms). */
  arriveAt: number;
}

export interface CustomerRuntime {
  readonly state: CustomerState;
  walk: Walk;
  /** When they ordered (for the satisfaction of a quick plate). */
  orderedAt: number;
  /** Their place in the door queue while queued. */
  queueSpot: number;
  /** The tutorial guest pays a generous first bill. */
  tutorial: boolean;
}

export type StaffTask =
  | { kind: 'seat'; customer: number }
  | { kind: 'order'; customer: number }
  | { kind: 'serve'; order: number; customer: number; step: 0 | 1 }
  | { kind: 'cook'; order: number; stove: number; step: 0 | 1 }
  | { kind: 'clean'; chair: number; sink: number; step: 0 | 1 }
  | { kind: 'harvest'; item: number }
  | { kind: 'collect'; item: number }
  | { kind: 'cash' }
  | { kind: 'home' };

export interface StaffRuntime {
  readonly state: StaffState;
  /** Index in the owner's hired list. */
  hired: number;
  walk: Walk;
  task: StaffTask | null;
  /** A working pause after arriving: the step runs when it ends. */
  workUntil: number;
  idleSince: number;
}

let nextId = 1;
/** Ids unique across the room, so schema keys never collide. */
export const freshId = (): number => {
  nextId = nextId >= 0x7fffffff ? 1 : nextId + 1;
  return nextId;
};

/**
 * ONE RESTAURANT PLOT AT RUN TIME: its replicated state, its owner, and what
 * the simulation keeps beside the schema - the walk grid, the seats, every
 * walker's decoded route, and which customers, orders and things staff have
 * already claimed (so two waiters never chase one customer).
 */
export class Restaurant {
  owner: Chef | null = null;
  readonly customers = new Map<number, CustomerRuntime>();
  readonly staff = new Map<number, StaffRuntime>();
  readonly claims = new Set<string>();
  spawnTimer = 4;
  managerTimer = 0;
  /** Seconds the rank and quality have been stale (recomputed on a timer as well as on change). */
  private navGrid: NavGrid | null = null;
  private seatCache: Map<number, SeatInfo> | null = null;

  constructor(
    readonly slot: PlotSlot,
    readonly state: RestaurantState,
    private readonly collision: WorldCollision,
  ) {}

  get contents(): RestaurantContents {
    return contentsOf(this.state);
  }

  // ------------------------------------------------------------- layout

  /** The furniture changed (or the building grew): the walk grid, seats and solids follow. */
  layoutChanged(): void {
    this.navGrid = null;
    this.seatCache = null;
    this.syncCollision();
  }

  get nav(): NavGrid {
    if (!this.navGrid) {
      const items: PlacedItem[] = [];
      this.state.items.forEach((item) => items.push(item));
      this.navGrid = buildNav(this.state.tier, items);
    }
    return this.navGrid;
  }

  /** Every chair that is a seat (against a table), with where its customer faces and eats. */
  get seats(): Map<number, SeatInfo> {
    if (!this.seatCache) {
      const out = new Map<number, SeatInfo>();
      const contents = this.contents;
      this.state.items.forEach((item) => {
        const seat = seatOf(contents, item);
        if (seat) out.set(item.id, seat);
      });
      this.seatCache = out;
    }
    return this.seatCache;
  }

  /** The walls, fences and solid furniture into the shared collision (the server's and, mirrored, every client's). */
  syncCollision(): void {
    const key = this.slot.index;
    if (!this.state.owner) {
      this.collision.setGroup(`plot:${key}`, []);
      this.collision.setGroup(`items:${key}`, []);
      return;
    }
    this.collision.setGroup(`plot:${key}`, plotSolids(this.state.tier).map((b) => toWorldBox(this.slot, b)));
    this.collision.setGroup(`items:${key}`, itemSolids(this.slot, this.state));
  }

  // ------------------------------------------------------------- lookups

  item(id: number): ItemState | undefined {
    return this.state.items.get(String(id));
  }

  itemsOf(role: ItemRole): ItemState[] {
    const out: ItemState[] = [];
    this.state.items.forEach((item) => {
      if (itemById(item.kind)?.role === role) out.push(item);
    });
    return out;
  }

  firstOf(role: ItemRole): ItemState | undefined {
    return this.itemsOf(role)[0];
  }

  /** The customer sitting in (or walking to) a chair. */
  occupantOf(chair: number): CustomerRuntime | undefined {
    for (const c of this.customers.values()) {
      if (c.state.seat === chair && (c.state.phase === PHASE.toSeat || isSeatedPhase(c.state.phase))) return c;
    }
    return undefined;
  }

  /** Chairs a new customer may take: a seat, clean, empty. */
  freeSeats(): ItemState[] {
    const out: ItemState[] = [];
    for (const [id] of this.seats) {
      const chair = this.item(id);
      if (!chair || chair.b !== 0 || this.occupantOf(id)) continue;
      out.push(chair);
    }
    return out;
  }

  claim(key: string): boolean {
    if (this.claims.has(key)) return false;
    this.claims.add(key);
    return true;
  }

  release(key: string): void {
    this.claims.delete(key);
  }

  // ------------------------------------------------------------- walking

  /** Where a walker is now on their route. */
  static positionOf(walk: Walk, now: number): { x: number; z: number; yaw: number; done: boolean } {
    return pointAlong(walk.points, ((now - walk.t0) / 1000) * walk.speed);
  }

  /** A route to somewhere, timed from now. Null when there is no way through. */
  static route(points: Point[] | null, now: number, speed: number): Walk | null {
    if (!points || points.length === 0) return null;
    const length = pathLength(points);
    return { points, t0: now, speed, arriveAt: now + (length / Math.max(0.1, speed)) * 1000 };
  }

  /** Publish a walk on a walker's schema. */
  static publish(target: { path: string; t0: number; speed: number }, walk: Walk): void {
    target.path = encodePath(walk.points);
    target.t0 = walk.t0;
    target.speed = walk.speed;
  }

  /** A route of one point: standing still at a spot. */
  static standAt(x: number, z: number, now: number): Walk {
    return { points: [{ x, z }], t0: now, speed: 1, arriveAt: now };
  }

  // ------------------------------------------------------------ teardown

  /** Empty the plot: the owner has gone. */
  clear(): void {
    this.owner = null;
    this.customers.clear();
    this.staff.clear();
    this.claims.clear();
    const s = this.state;
    s.owner = '';
    s.ownerName = '';
    s.ownerAvatar = '';
    s.rank = 0;
    s.rankPoints = 0;
    s.served = 0;
    s.rating = 0;
    s.likes = 0;
    s.tier = 0;
    s.register = 0;
    s.items.clear();
    s.customers.clear();
    s.staff.clear();
    s.orders.clear();
    this.layoutChanged();
  }
}

/** The solid furniture of a restaurant as world boxes. */
export const itemSolids = (slot: PlotSlot, state: { items: { forEach(visit: (item: PlacedItem) => void): void } }): Aabb[] => itemSolidBoxes(slot, state.items);
