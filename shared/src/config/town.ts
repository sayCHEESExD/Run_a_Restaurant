import type { Aabb } from '../types/math.js';
import { hashInts, rng } from '../util/random.js';

/**
 * THE RESTAURANT TOWN, laid out once and shared by the server (collision,
 * teleports, interaction ranges) and every client (the scene).
 *
 *   - The PLAZA in the middle: the big glass-fronted SHOP on its north side,
 *     the fountain, the spawn on its south side, and the leaderboard boards
 *     down its east and west edges.
 *   - Four AVENUES from the plaza out to a square RING ROAD.
 *   - FIFTEEN RESTAURANT PLOTS lining the outside of the ring road, each
 *     facing the street, so every restaurant is seen from the road.
 *   - The INNER PARK between the plaza and the ring: lawns, trees, a pond and
 *     a few town buildings. Past the plots a wooded edge, a beach, the sea.
 *
 * Plots only ever turn in quarter turns, so every wall and every piece of
 * furniture stays an axis-aligned box in the world as well as in its plot.
 */

export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Facing: 0 looks toward +Z. */
  readonly yaw: number;
}

export type Side = 'north' | 'east' | 'south' | 'west';

/** One restaurant plot: where its local origin (front middle, at the street) is in the world, and which way it faces. */
export interface PlotSlot {
  readonly index: number;
  readonly x: number;
  readonly z: number;
  /** Local +Z (into the lot) points along (sin yaw, cos yaw). */
  readonly yaw: number;
  readonly side: Side;
}

// ------------------------------------------------------------- dimensions

/** The plaza is the square |x|, |z| < PLAZA_HALF. */
export const PLAZA_HALF = 72;
/** The ring road runs between these distances from the middle (the square band). */
export const RING_IN = 166;
export const RING_OUT = 178;
/** Half width of the four avenues from the plaza to the ring. */
export const AVENUE_HALF = 6;
/** Distance from the middle to every plot's front edge (the sidewalk is between the road and it). */
export const PLOT_FRONT = 186;
/** Walkable land reaches this far from the middle; then the beach, then the sea. */
export const LAND_HALF = 300;
export const BEACH_HALF = 312;
/** The painted ground reaches this far. */
export const GROUND_HALF = 340;

/** A plot in its own frame: x across the frontage, z from the street (0) back. */
export const PLOT = { minX: -40, maxX: 40, minZ: 0, maxZ: 64 } as const;

const SIDE_YAW: Readonly<Record<Side, number>> = { north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2 };

const slotAt = (index: number, side: Side, along: number): PlotSlot => {
  switch (side) {
    case 'north':
      return { index, side, x: along, z: PLOT_FRONT, yaw: SIDE_YAW.north };
    case 'east':
      return { index, side, x: PLOT_FRONT, z: along, yaw: SIDE_YAW.east };
    case 'south':
      return { index, side, x: along, z: -PLOT_FRONT, yaw: SIDE_YAW.south };
    case 'west':
      return { index, side, x: -PLOT_FRONT, z: along, yaw: SIDE_YAW.west };
  }
};

/**
 * THE FIFTEEN PLOTS - one per player in a room. Four on the north, east and
 * west sides; three on the south, whose fourth lot is the town's market
 * green where the south avenue meets the ring.
 */
export const PLOT_SLOTS: readonly PlotSlot[] = (() => {
  const out: PlotSlot[] = [];
  const add = (side: Side, along: number): void => {
    out.push(slotAt(out.length, side, along));
  };
  for (const x of [-135, -45, 45, 135]) add('north', x);
  for (const z of [135, 45, -45, -135]) add('east', z);
  for (const x of [135, 45, -135]) add('south', x);
  for (const z of [-135, -45, 45, 135]) add('west', z);
  return out;
})();

export const PLOT_COUNT = PLOT_SLOTS.length;

/** The market green: the south side's empty lot. */
export const MARKET_GREEN = { x: -45, z: -PLOT_FRONT - 32 } as const;

// -------------------------------------------------------------- transforms

/** A plot-local point in world coordinates. */
export const toWorld = (slot: PlotSlot, lx: number, lz: number): { x: number; z: number } => {
  const c = Math.cos(slot.yaw);
  const s = Math.sin(slot.yaw);
  return { x: slot.x + lx * c + lz * s, z: slot.z - lx * s + lz * c };
};

/** A world point in a plot's local frame. */
export const toLocal = (slot: PlotSlot, x: number, z: number): { x: number; z: number } => {
  const c = Math.cos(slot.yaw);
  const s = Math.sin(slot.yaw);
  const dx = x - slot.x;
  const dz = z - slot.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
};

/** A plot-local facing as a world facing. */
export const toWorldYaw = (slot: PlotSlot, localYaw: number): number => localYaw + slot.yaw;

/** A plot-local box as a world box (quarter turns keep it axis aligned). */
export const toWorldBox = (slot: PlotSlot, b: { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number }): Aabb => {
  const a = toWorld(slot, b.minX, b.minZ);
  const c = toWorld(slot, b.maxX, b.maxZ);
  return {
    minX: Math.round(Math.min(a.x, c.x) * 1000) / 1000,
    maxX: Math.round(Math.max(a.x, c.x) * 1000) / 1000,
    minZ: Math.round(Math.min(a.z, c.z) * 1000) / 1000,
    maxZ: Math.round(Math.max(a.z, c.z) * 1000) / 1000,
    minY: b.minY,
    maxY: b.maxY,
  };
};

/** True when a world point is on a plot (with an optional margin, positive = larger). */
export const onPlot = (slot: PlotSlot, x: number, z: number, margin = 0): boolean => {
  const l = toLocal(slot, x, z);
  return l.x >= PLOT.minX - margin && l.x <= PLOT.maxX + margin && l.z >= PLOT.minZ - margin && l.z <= PLOT.maxZ + margin;
};

/** The plot under a world point, or -1. */
export const plotAt = (x: number, z: number, margin = 0): number => {
  for (const slot of PLOT_SLOTS) if (onPlot(slot, x, z, margin)) return slot.index;
  return -1;
};

// ---------------------------------------------------------------- the plaza

/** The Shop: a big glass store on the plaza's north side, its doors facing the fountain. */
export const SHOP = {
  minX: -40,
  maxX: 40,
  minZ: 16,
  maxZ: 68,
  wall: 1,
  height: 11,
  /** The doorway in the front (south) wall, |x| < doorHalf. */
  doorHalf: 7,
  /** The shopkeeper stands behind the counter. */
  keeper: { x: 0, z: 62 },
  counter: { minX: -9, maxX: 9, minZ: 57, maxZ: 59.5, height: 1.8 },
} as const;

/** Display plinths: one item on each, laid out in aisles either side of the middle walk. */
export const PLINTH = { half: 1.9, height: 1.1 } as const;

const PLINTH_COLUMNS = [-35, -29, -23, -17, -11, 11, 17, 23, 29, 35] as const;
const PLINTH_ROWS = [23, 29, 35, 41, 47] as const;
/** Behind the aisles, either side of the keeper's counter. */
const BACK_COLUMNS = [-35, -29, -23, -17, -11, 11, 17, 23, 29, 35] as const;
const BACK_ROWS = [54, 60] as const;
/** Columns this close to the middle only have the front back-row plinth (the keeper's counter is behind). */
const NEAR_COUNTER = 12;

/** Every plinth's middle, in display order: the left half front to back, then the right half. */
export const PLINTH_SPOTS: readonly { x: number; z: number }[] = (() => {
  const out: { x: number; z: number }[] = [];
  for (const side of [-1, 1]) {
    for (const x of PLINTH_COLUMNS) {
      if (Math.sign(x) !== side) continue;
      for (const z of PLINTH_ROWS) out.push({ x, z });
    }
    for (const x of BACK_COLUMNS) {
      if (Math.sign(x) !== side) continue;
      for (const z of BACK_ROWS) if (Math.abs(x) > NEAR_COUNTER || z === BACK_ROWS[0]) out.push({ x, z });
    }
  }
  return out;
})();

export const FOUNTAIN = { x: 0, z: -16, radius: 7 } as const;

/** Where a new arrival (or a respawn) stands: the plaza's south side, facing the Shop. */
export const SPAWN: Placement = { x: 0, y: 0, z: -48, yaw: 0 };

export type BoardId = 'cash' | 'served' | 'rank' | 'recipes' | 'success' | 'playtime' | 'fish';

export interface BoardSpot {
  readonly id: BoardId;
  readonly title: string;
  readonly subtitle: string;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/** The leaderboards: three down each side of the plaza, facing in. */
export const BOARDS: readonly BoardSpot[] = [
  { id: 'cash', title: 'Cash Leaderboard', subtitle: 'Most cash earned!', x: -60, z: -40, yaw: Math.PI / 2 },
  { id: 'served', title: 'Customers Leaderboard', subtitle: 'Most customers served!', x: -60, z: -18, yaw: Math.PI / 2 },
  { id: 'rank', title: 'Rank Leaderboard', subtitle: 'Highest restaurant rank!', x: -60, z: 4, yaw: Math.PI / 2 },
  { id: 'recipes', title: 'Recipe Leaderboard', subtitle: 'Most recipes unlocked!', x: 60, z: -40, yaw: -Math.PI / 2 },
  { id: 'success', title: 'Top Restaurants', subtitle: 'Most successful restaurant!', x: 60, z: -18, yaw: -Math.PI / 2 },
  { id: 'playtime', title: 'Playtime Leaderboard', subtitle: 'Most time played!', x: 60, z: 4, yaw: -Math.PI / 2 },
  { id: 'fish', title: 'Biggest Fish Leaderboard', subtitle: 'Heaviest fish caught!', x: 60, z: -62, yaw: -Math.PI / 2 },
];

export const BOARD_SIZE = { width: 11, height: 12, depth: 0.8 } as const;

/**
 * THE FISHING PIER: a path from the ring road down through the market green
 * and the woods to the south beach, and a long wooden pier out over the sea.
 * Fish bite off its far end.
 */
export const PIER = { x: -60, half: 4, pathFrom: -RING_OUT - 4, landZ: -LAND_HALF, minZ: -352, fishFrom: -338 } as const;

/** The Pet Merchant's stall on the plaza's west side, its counter facing east. */
export const PET_MERCHANT = { x: -38, z: -44, keeper: { x: -40.5, z: -44 }, counter: { minX: -39.5, maxX: -36.5, minZ: -48, maxZ: -40 } } as const;

/** Named places a player may be sent to. */
export const PLACES = {
  spawn: SPAWN,
  pier: { x: PIER.x, y: 0, z: PIER.minZ + 10, yaw: Math.PI } as Placement,
  pets: { x: PET_MERCHANT.x + 7, y: 0, z: PET_MERCHANT.z, yaw: -Math.PI / 2 } as Placement,
  shop: { x: 0, y: 0, z: 50, yaw: 0 } as Placement,
  boards: { x: 0, y: 0, z: -28, yaw: Math.PI / 2 } as Placement,
} as const;

export type PlaceId = keyof typeof PLACES;

/** True when a world point is inside the Shop building. */
export const insideShop = (x: number, z: number, margin = 0): boolean =>
  x > SHOP.minX - margin && x < SHOP.maxX + margin && z > SHOP.minZ - margin && z < SHOP.maxZ + margin;

// --------------------------------------------------------- town buildings

export type TownBuildingKind = 'bakery' | 'cafe' | 'grocer' | 'cinema' | 'hall' | 'house' | 'gazebo' | 'market';

export interface TownBuilding {
  readonly kind: TownBuildingKind;
  readonly name: string;
  readonly x: number;
  readonly z: number;
  /** Half extents of the solid footprint. */
  readonly hx: number;
  readonly hz: number;
  readonly height: number;
  /** Which way its front faces. */
  readonly yaw: number;
  readonly color: number;
  readonly roof: number;
}

/** The decorative town round the plaza: shopfronts on the avenues, houses in the park, a cinema and the town hall. */
export const TOWN_BUILDINGS: readonly TownBuilding[] = [
  { kind: 'hall', name: 'Town Hall', x: 118, z: 118, hx: 15, hz: 11, height: 12, yaw: -Math.PI * 0.75, color: 0xf2ece0, roof: 0x5a7ac8 },
  { kind: 'cinema', name: 'Cinema', x: 118, z: -118, hx: 13, hz: 10, height: 11, yaw: -Math.PI * 0.25, color: 0xd84a4a, roof: 0x3a3a48 },
  { kind: 'grocer', name: 'Grocer', x: -118, z: 118, hx: 12, hz: 9, height: 8, yaw: Math.PI * 0.75, color: 0x8ad06a, roof: 0x3f8f3a },
  { kind: 'bakery', name: 'Bakery', x: 24, z: 104, hx: 9, hz: 8, height: 8, yaw: Math.PI, color: 0xf6c8a0, roof: 0xc85a3a },
  { kind: 'cafe', name: 'Cafe', x: -24, z: 104, hx: 9, hz: 8, height: 8, yaw: Math.PI, color: 0x9ad8f0, roof: 0x2f6aa8 },
  { kind: 'house', name: 'House', x: 104, z: 30, hx: 8, hz: 7, height: 8, yaw: -Math.PI / 2, color: 0xffe6a0, roof: 0xd8443a },
  { kind: 'house', name: 'House', x: 104, z: -30, hx: 8, hz: 7, height: 8, yaw: -Math.PI / 2, color: 0xd8f0ff, roof: 0x3a6ac8 },
  { kind: 'house', name: 'House', x: -104, z: 30, hx: 8, hz: 7, height: 8, yaw: Math.PI / 2, color: 0xffd8e8, roof: 0x8a4ab8 },
  { kind: 'house', name: 'House', x: -104, z: -30, hx: 8, hz: 7, height: 8, yaw: Math.PI / 2, color: 0xe8ffd8, roof: 0x3f8f3a },
  { kind: 'house', name: 'House', x: 30, z: -104, hx: 8, hz: 7, height: 8, yaw: 0, color: 0xfff0d0, roof: 0xc87a3a },
  { kind: 'house', name: 'House', x: -30, z: -104, hx: 8, hz: 7, height: 8, yaw: 0, color: 0xe0e8ff, roof: 0x5a5ab8 },
  { kind: 'gazebo', name: 'Gazebo', x: -118, z: -118, hx: 6, hz: 6, height: 7, yaw: 0, color: 0xffffff, roof: 0x8a5a3a },
  { kind: 'market', name: 'Market', x: MARKET_GREEN.x, z: MARKET_GREEN.z, hx: 4, hz: 3, height: 4, yaw: 0, color: 0xd8443a, roof: 0xffffff },
];

/** The pond in the south-west park, beside the gazebo. */
export const POND = { x: -96, z: -138, rx: 16, rz: 10 } as const;

// ----------------------------------------------------------------- ground

export type GroundKind = 'grass' | 'plaza' | 'road' | 'sidewalk' | 'avenue' | 'plot' | 'sand' | 'water' | 'pond' | 'path';

/** True on the path from the ring road down to the pier. */
export const onPierPath = (x: number, z: number, margin = 0): boolean => Math.abs(x - PIER.x) < PIER.half + margin && z < PIER.pathFrom + margin && z > PIER.landZ - 12;

/** Distance to the ring band, in the square (Chebyshev) sense. */
const ringDistance = (x: number, z: number): number => Math.max(Math.abs(x), Math.abs(z));

/** What the ground is at a world point: the painter's and the scatter's one source. */
export const groundAt = (x: number, z: number): GroundKind => {
  const r = ringDistance(x, z);
  if (r > BEACH_HALF) return 'water';
  if (r > LAND_HALF) return 'sand';
  if (onPierPath(x, z)) return 'path';
  if (((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2 < 1) return 'pond';
  if (Math.abs(x) <= PLAZA_HALF && Math.abs(z) <= PLAZA_HALF) return 'plaza';
  if (r >= RING_IN && r <= RING_OUT) return 'road';
  if (r > RING_OUT && r < RING_OUT + 4 && Math.min(Math.abs(x), Math.abs(z)) < RING_OUT + 4) return 'sidewalk';
  if (r > RING_IN - 4 && r < RING_IN) return 'sidewalk';
  if (r < RING_IN && (Math.abs(x) <= AVENUE_HALF || Math.abs(z) <= AVENUE_HALF)) return 'avenue';
  if (plotAt(x, z) >= 0) return 'plot';
  return 'grass';
};

// ---------------------------------------------------------------- scenery

/** True when scenery (a tree, a bush) may stand at a world point. */
export const sceneryClear = (x: number, z: number, margin = 2): boolean => {
  const r = ringDistance(x, z);
  if (r > LAND_HALF - margin) return false;
  if (Math.abs(x) < PLAZA_HALF + margin && Math.abs(z) < PLAZA_HALF + margin) return false;
  if (r > RING_IN - 4 - margin && r < RING_OUT + 4 + margin) return false;
  if (r < RING_IN && (Math.abs(x) < AVENUE_HALF + margin || Math.abs(z) < AVENUE_HALF + margin)) return false;
  if (plotAt(x, z, margin + 3) >= 0) return false;
  if (onPierPath(x, z, margin + 2)) return false;
  if (Math.abs(x - PET_MERCHANT.x) < 8 + margin && Math.abs(z - PET_MERCHANT.z) < 8 + margin) return false;
  if (((x - POND.x) / (POND.rx + margin)) ** 2 + ((z - POND.z) / (POND.rz + margin)) ** 2 < 1) return false;
  for (const b of TOWN_BUILDINGS) {
    if (Math.abs(x - b.x) < b.hx + margin + 3 && Math.abs(z - b.z) < b.hz + margin + 3) return false;
  }
  // The market green keeps its lawn.
  if (Math.abs(x - MARKET_GREEN.x) < 30 && Math.abs(z - MARKET_GREEN.z) < 26) return false;
  return true;
};

export interface TreeSpot {
  readonly x: number;
  readonly z: number;
  /** Which model (0 round oak, 1 pine, 2 birch, 3 blossom). */
  readonly kind: number;
  readonly variant: number;
  readonly scale: number;
}

/** The trees, placed once from a fixed seed: the park thinly, the wooded edge past the plots densely. */
export const TREES: readonly TreeSpot[] = (() => {
  const random = rng(hashInts(0x7ee5, 2026));
  const out: TreeSpot[] = [];
  const near = (x: number, z: number, gap: number): boolean => out.some((t) => Math.abs(t.x - x) < gap && Math.abs(t.z - z) < gap);
  for (let attempt = 0; attempt < 9000 && out.length < 560; attempt += 1) {
    const x = (random() * 2 - 1) * (LAND_HALF - 4);
    const z = (random() * 2 - 1) * (LAND_HALF - 4);
    if (!sceneryClear(x, z, 3)) continue;
    const r = ringDistance(x, z);
    const outer = r > RING_OUT;
    // The park is open lawn with a tree here and there; the edge is woodland.
    if (!outer && random() > 0.35) continue;
    if (near(x, z, outer ? 7 : 11)) continue;
    const kind = outer ? (random() < 0.55 ? 1 : 0) : random() < 0.25 ? 3 : random() < 0.5 ? 2 : 0;
    out.push({ x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, kind, variant: Math.floor(random() * 4), scale: 0.85 + random() * 0.5 });
  }
  return out;
})();

/** Street lamps along both edges of the ring road and the avenues. */
export const LAMPS: readonly { x: number; z: number }[] = (() => {
  const out: { x: number; z: number }[] = [];
  for (let t = -150; t <= 150; t += 30) {
    for (const s of [-1, 1]) {
      // The inner edge of the ring.
      out.push({ x: t, z: s * (RING_IN - 2.5) });
      out.push({ x: s * (RING_IN - 2.5), z: t });
    }
  }
  for (let d = PLAZA_HALF + 14; d < RING_IN - 8; d += 22) {
    for (const s of [-1, 1]) {
      out.push({ x: AVENUE_HALF + 2, z: s * d });
      out.push({ x: -AVENUE_HALF - 2, z: s * d });
      out.push({ x: s * d, z: AVENUE_HALF + 2 });
      out.push({ x: s * d, z: -AVENUE_HALF - 2 });
    }
  }
  return out;
})();

// --------------------------------------------------------------- collision

/** The thin wall pieces of a building with one doorway in one face. */
export const wallBoxes = (
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  thickness: number,
  height: number,
  door: { face: 'minZ' | 'maxZ'; centre: number; half: number } | null,
): Aabb[] => {
  const t = thickness;
  const out: Aabb[] = [];
  const box = (x0: number, x1: number, z0: number, z1: number): void => {
    if (x1 - x0 > 0.01 && z1 - z0 > 0.01) out.push({ minX: x0, maxX: x1, minY: 0, maxY: height, minZ: z0, maxZ: z1 });
  };
  const face = (z0: number, z1: number, hasDoor: boolean): void => {
    if (hasDoor && door) {
      box(minX - t, door.centre - door.half, z0, z1);
      box(door.centre + door.half, maxX + t, z0, z1);
    } else box(minX - t, maxX + t, z0, z1);
  };
  face(minZ - t, minZ, door?.face === 'minZ');
  face(maxZ, maxZ + t, door?.face === 'maxZ');
  box(minX - t, minX, minZ, maxZ);
  box(maxX, maxX + t, minZ, maxZ);
  return out;
};

/** A tree trunk: thin enough to walk round, solid enough to bump into. */
const TRUNK_HALF = 0.55;

/**
 * Every STATIC solid in the town: the Shop's walls, counter and plinths, the
 * fountain, the leaderboards, the town buildings and the tree trunks.
 * Restaurants are DYNAMIC (they exist once owned, and grow): the room and
 * every client set them as collision groups.
 */
export const buildStaticSolids = (): Aabb[] => {
  const out: Aabb[] = [];
  out.push(...wallBoxes(SHOP.minX, SHOP.maxX, SHOP.minZ, SHOP.maxZ, SHOP.wall, SHOP.height, { face: 'minZ', centre: 0, half: SHOP.doorHalf }));
  const c = SHOP.counter;
  out.push({ minX: c.minX, maxX: c.maxX, minY: 0, maxY: c.height, minZ: c.minZ, maxZ: c.maxZ });
  for (const spot of PLINTH_SPOTS) {
    out.push({ minX: spot.x - PLINTH.half, maxX: spot.x + PLINTH.half, minY: 0, maxY: PLINTH.height + 0.3, minZ: spot.z - PLINTH.half, maxZ: spot.z + PLINTH.half });
  }
  const pc = PET_MERCHANT.counter;
  out.push({ minX: pc.minX, maxX: pc.maxX, minY: 0, maxY: 1.6, minZ: pc.minZ, maxZ: pc.maxZ });
  const f = FOUNTAIN;
  out.push({ minX: f.x - f.radius * 0.8, maxX: f.x + f.radius * 0.8, minY: 0, maxY: 1.6, minZ: f.z - f.radius * 0.8, maxZ: f.z + f.radius * 0.8 });
  for (const board of BOARDS) {
    const across = BOARD_SIZE.width / 2;
    const thick = 0.6;
    const alongX = Math.abs(Math.sin(board.yaw)) < 0.5;
    out.push({
      minX: board.x - (alongX ? across : thick),
      maxX: board.x + (alongX ? across : thick),
      minY: 0,
      maxY: BOARD_SIZE.height,
      minZ: board.z - (alongX ? thick : across),
      maxZ: board.z + (alongX ? thick : across),
    });
  }
  for (const b of TOWN_BUILDINGS) {
    if (b.kind === 'market') continue;
    out.push({ minX: b.x - b.hx, maxX: b.x + b.hx, minY: 0, maxY: b.height, minZ: b.z - b.hz, maxZ: b.z + b.hz });
  }
  for (const tree of TREES) {
    const h = TRUNK_HALF * tree.scale;
    out.push({ minX: tree.x - h, maxX: tree.x + h, minY: 0, maxY: 6, minZ: tree.z - h, maxZ: tree.z + h });
  }
  return out;
};

/** The walkable rectangle: everything inside the beach. */
export const worldBounds = (): Aabb => ({ minX: -BEACH_HALF + 2, maxX: BEACH_HALF - 2, minY: -10, maxY: 200, minZ: PIER.minZ, maxZ: BEACH_HALF - 2 });

/** The town is square and flat: walkers stay ashore - except out along the pier. */
export const clampToLand = (position: { x: number; z: number }, r: number): void => {
  const limit = BEACH_HALF - 2 - r;
  const pierX = Math.abs(position.x - PIER.x) < PIER.half;
  if (position.z < -limit && pierX) {
    position.x = Math.max(PIER.x - PIER.half + r, Math.min(PIER.x + PIER.half - r, position.x));
    position.z = Math.max(PIER.minZ + r, position.z);
    return;
  }
  position.x = Math.max(-limit, Math.min(limit, position.x));
  position.z = Math.max(-limit, Math.min(limit, position.z));
};

/** Where a player stands to enter a plot from the street: the sidewalk in front of the door, facing in. */
export const plotEntrance = (slot: PlotSlot, doorX: number): Placement => {
  const at = toWorld(slot, doorX, -3);
  return { x: at.x, y: 0, z: at.z, yaw: slot.yaw };
};
