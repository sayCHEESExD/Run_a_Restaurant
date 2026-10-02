import { footprint, itemById, type ItemDef } from './items.js';
import { ENTRY, FARM, PORCH, RANCH, SIGNS, insidePlot, insideRect, interiorOf, type Rect } from './plot.js';
import { toWorldBox, type PlotSlot } from './town.js';
import type { Aabb } from '../types/math.js';

/**
 * WHERE THINGS MAY GO, as pure functions over a restaurant's contents. The
 * server enforces these; the client runs the very same code to tint its
 * placement ghost green or red and to say why - so a ghost that looks fine is
 * never refused, and nothing can ever overlap.
 */

export interface PlacedItem {
  readonly id: number;
  readonly kind: number;
  readonly x: number;
  readonly z: number;
  readonly rot: number;
}

export interface RestaurantContents {
  readonly tier: number;
  forEachItem(visit: (item: PlacedItem) => void): void;
}

/** Wrap anything with a Map-like `items` collection (a Colyseus MapSchema, an array) as contents. */
export const contentsOf = (r: { tier: number; items: { forEach(visit: (value: PlacedItem) => void): void } }): RestaurantContents => ({
  tier: r.tier,
  forEachItem: (visit) => r.items.forEach((item) => visit(item)),
});

export const itemRect = (def: ItemDef, x: number, z: number, rot: number): Rect => {
  const f = footprint(def, rot);
  return { minX: x - f.hx, maxX: x + f.hx, minZ: z - f.hz, maxZ: z + f.hz };
};

const EPS = 0.01;

export const rectsOverlap = (a: Rect, b: Rect, gap = 0): boolean =>
  a.minX < b.maxX + gap - EPS && a.maxX > b.minX - gap + EPS && a.minZ < b.maxZ + gap - EPS && a.maxZ > b.minZ - gap + EPS;

const within = (inner: Rect, outer: Rect): boolean =>
  inner.minX >= outer.minX - EPS && inner.maxX <= outer.maxX + EPS && inner.minZ >= outer.minZ - EPS && inner.maxZ <= outer.maxZ + EPS;

/** Footprints of the plot's signs on the lawn, kept clear. */
const SIGN_RECTS: readonly Rect[] = Object.values(SIGNS).map((s) => ({ minX: s.x - 1.6, maxX: s.x + 1.6, minZ: s.z - 1, maxZ: s.z + 1 }));

/** Is this rect a legal OUTDOOR spot: on the lawn, off the building, the yards, the porch and the signs? */
const outdoorProblem = (r: Rect, tier: number): string | null => {
  if (!insidePlot(r.minX, r.minZ) || !insidePlot(r.maxX, r.maxZ)) return 'Keep it on your own lot.';
  const building = interiorOf(tier);
  const shell: Rect = { minX: building.minX - 1.5, maxX: building.maxX + 1.5, minZ: building.minZ - 1.5, maxZ: building.maxZ + 1.5 };
  if (rectsOverlap(r, shell)) return 'That is against the restaurant wall.';
  if (rectsOverlap(r, FARM, 1)) return 'That is in the farm fence.';
  if (rectsOverlap(r, RANCH, 1)) return 'That is in the ranch fence.';
  if (rectsOverlap(r, PORCH)) return 'Keep the path to your door clear.';
  for (const sign of SIGN_RECTS) if (rectsOverlap(r, sign)) return 'That spot is taken by a sign.';
  return null;
};

/** Why an item may not go at a plot-local spot, or null when it may. `ignore` is an item being moved. */
export const placeProblem = (contents: RestaurantContents, kind: number, x: number, z: number, rot: number, ignore = 0): string | null => {
  const def = itemById(kind);
  if (!def || def.zone === 'none') return 'That cannot be placed.';
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 'Pick a spot.';
  const r = itemRect(def, x, z, rot);
  const interior = interiorOf(contents.tier);
  switch (def.zone) {
    case 'interior':
      if (!within(r, interior)) return 'Place it inside your restaurant.';
      break;
    case 'farm':
      if (!within(r, FARM)) return 'Place it in your farm.';
      break;
    case 'ranch':
      if (!within(r, RANCH)) return 'Place it in your ranch.';
      break;
    case 'outdoor': {
      const problem = outdoorProblem(r, contents.tier);
      if (problem) return problem;
      break;
    }
    case 'any': {
      if (!within(r, interior)) {
        if (insideRect(interior, x, z)) return 'Place it fully inside your restaurant.';
        const problem = outdoorProblem(r, contents.tier);
        if (problem) return problem;
      }
      break;
    }
  }
  if (rectsOverlap(r, ENTRY)) return 'Keep the doorway clear for customers.';
  let count = 0;
  let blocked: string | null = null;
  contents.forEachItem((other) => {
    if (blocked || other.id === ignore) return;
    const otherDef = itemById(other.kind);
    if (!otherDef) return;
    if (def.limit && otherDef.role === def.role) count += 1;
    // A rug lies under things: it only clashes with another rug.
    if ((def.role === 'rug') !== (otherDef.role === 'rug')) return;
    if (rectsOverlap(r, itemRect(otherDef, other.x, other.z, other.rot))) blocked = `That overlaps the ${otherDef.name}.`;
  });
  if (blocked) return blocked;
  if (def.limit && count >= def.limit) return `You can only have ${def.limit} ${def.role === 'stand' ? 'order stand' : def.role === 'register' ? 'register' : def.name}.`;
  return null;
};

/** The placed item whose footprint holds a plot-local point (rugs last), or null. */
export const itemAt = (contents: RestaurantContents, x: number, z: number): PlacedItem | null => {
  let hit: PlacedItem | null = null;
  let rug: PlacedItem | null = null;
  contents.forEachItem((item) => {
    const def = itemById(item.kind);
    if (!def) return;
    const r = itemRect(def, item.x, item.z, item.rot);
    if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) return;
    if (def.role === 'rug') rug ??= item;
    else hit ??= item;
  });
  return hit ?? rug;
};

// ------------------------------------------------------------------ seats

export interface SeatInfo {
  /** The table the chair serves. */
  readonly table: number;
  /** Which way a seated customer faces. */
  readonly yaw: number;
  /** Where their plate goes on the table. */
  readonly dishX: number;
  readonly dishZ: number;
  readonly tableTop: number;
}

/**
 * A CHAIR IS A SEAT when it stands against a table (touching, or within half a
 * cell). The customer sitting there faces the table, and their plate goes on
 * the table's edge in front of them. Chairs also turn to face their table.
 */
export const seatOf = (contents: RestaurantContents, chair: PlacedItem): SeatInfo | null => {
  const chairDef = itemById(chair.kind);
  if (!chairDef || chairDef.role !== 'chair') return null;
  const cr = itemRect(chairDef, chair.x, chair.z, chair.rot);
  let best: SeatInfo | null = null;
  let bestD = Infinity;
  contents.forEachItem((item) => {
    const def = itemById(item.kind);
    if (!def || def.role !== 'table') return;
    const tr = itemRect(def, item.x, item.z, item.rot);
    if (!rectsOverlap(cr, tr, 0.55)) return;
    const nx = Math.max(tr.minX, Math.min(tr.maxX, chair.x));
    const nz = Math.max(tr.minZ, Math.min(tr.maxZ, chair.z));
    let dx = nx - chair.x;
    let dz = nz - chair.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) {
      dx = item.x - chair.x;
      dz = item.z - chair.z;
    }
    const centre = Math.hypot(item.x - chair.x, item.z - chair.z);
    if (centre >= bestD) return;
    bestD = centre;
    const len = Math.max(1e-6, Math.hypot(dx, dz));
    const ux = dx / len;
    const uz = dz / len;
    best = { table: item.id, yaw: Math.atan2(ux, uz), dishX: nx + ux * 0.65, dishZ: nz + uz * 0.65, tableTop: def.h };
  });
  return best;
};

/** Total quality of everything placed (for the rank) and the decor's share (the restaurant's beauty, for rare customers). */
export const qualityOf = (contents: RestaurantContents): { quality: number; beauty: number } => {
  let quality = 0;
  let beauty = 0;
  contents.forEachItem((item) => {
    const def = itemById(item.kind);
    if (!def) return;
    quality += def.quality;
    if (def.role === 'decor' || def.role === 'rug' || def.category === 'furniture') beauty += def.quality;
  });
  return { quality, beauty };
};

/** The solid furniture of a restaurant as world boxes (the server's collision and every client's prediction). */
export const itemSolidBoxes = (slot: PlotSlot, items: { forEach(visit: (item: PlacedItem) => void): void }): Aabb[] => {
  const out: Aabb[] = [];
  items.forEach((item) => {
    const def = itemById(item.kind);
    if (!def || !def.solid || def.zone === 'none') return;
    const f = footprint(def, item.rot);
    out.push(toWorldBox(slot, { minX: item.x - f.hx, maxX: item.x + f.hx, minZ: item.z - f.hz, maxZ: item.z + f.hz, minY: 0, maxY: Math.max(1.2, def.h) }));
  });
  return out;
};
