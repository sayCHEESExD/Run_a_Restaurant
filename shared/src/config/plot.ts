import type { Aabb } from '../types/math.js';
import { PLOT, wallBoxes } from './town.js';

/**
 * ONE RESTAURANT PLOT, in its own frame: x across the frontage (-40..40),
 * z from the street (0) to the back (64).
 *
 *   - The RESTAURANT on the left half: its door is fixed at x = DOOR.x in the
 *     front wall (z = 6), and each expansion grows the building sideways about
 *     that door and further back - so everything already placed inside stays
 *     inside.
 *   - The FARM (front right) and the RANCH (back right), each fenced, each
 *     with a gate on the side that faces the restaurant.
 *   - The PORCH in front of the door, where customers queue, kept clear.
 */

export interface BuildingTier {
  readonly name: string;
  /** Interior width (x) and depth (z), in units: always whole cells. */
  readonly w: number;
  readonly d: number;
  readonly price: number;
  /** Least rank index to buy it. */
  readonly rank: number;
  /** Most staff that fit. */
  readonly staff: number;
}

export const TIERS: readonly BuildingTier[] = [
  { name: 'Cozy Diner', w: 30, d: 22, price: 0, rank: 0, staff: 3 },
  { name: 'Bistro', w: 34, d: 26, price: 2_500, rank: 2, staff: 6 },
  { name: 'Restaurant', w: 38, d: 30, price: 30_000, rank: 5, staff: 9 },
  { name: 'Grand Restaurant', w: 40, d: 34, price: 350_000, rank: 8, staff: 13 },
];

export const MAX_TIER = TIERS.length - 1;

export const BUILDING = {
  /** The interior's middle across, and its front wall's inner face. */
  centreX: -18,
  frontZ: 6,
  wall: 1,
  height: 8,
} as const;

/** The doorway in the front wall. */
export const DOOR = { x: -18, half: 2 } as const;

export interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** The interior floor of a tier (inside the walls). */
export const interiorOf = (tier: number): Rect => {
  const t = TIERS[Math.max(0, Math.min(MAX_TIER, tier))]!;
  return { minX: BUILDING.centreX - t.w / 2, maxX: BUILDING.centreX + t.w / 2, minZ: BUILDING.frontZ, maxZ: BUILDING.frontZ + t.d };
};

/** The fenced farm and ranch yards. Gates face the restaurant (the minX side). */
export const FARM: Rect = { minX: 8, maxX: 38, minZ: 4, maxZ: 30 };
export const RANCH: Rect = { minX: 8, maxX: 38, minZ: 36, maxZ: 62 };
export const FENCE = { height: 1.5, thickness: 0.4, gateHalf: 2.5 } as const;
export const FARM_GATE_Z = 17;
export const RANCH_GATE_Z = 49;

/** Kept clear outside the door (the porch and the walk from the street) and just inside it. */
export const PORCH: Rect = { minX: DOOR.x - 4, maxX: DOOR.x + 4, minZ: -2, maxZ: BUILDING.frontZ };
export const ENTRY: Rect = { minX: DOOR.x - 2.5, maxX: DOOR.x + 2.5, minZ: BUILDING.frontZ, maxZ: BUILDING.frontZ + 4 };

/** Where customers appear from (and go back to): the street in front of the door. */
export const STREET_POINT = { x: DOOR.x, z: -8 } as const;

/** Where waiting customers stand: the first just inside the door, the rest out on the porch. */
export const QUEUE_SPOTS: readonly { x: number; z: number }[] = [
  { x: DOOR.x, z: BUILDING.frontZ + 1.6 },
  { x: DOOR.x, z: 3.2 },
  { x: DOOR.x, z: 0.6 },
  { x: DOOR.x - 2.4, z: -1.6 },
  { x: DOOR.x + 2.4, z: -1.6 },
];

/** The plot's signs, out on the lawn by the street (owner name, the expansion board, the yard signs). */
export const SIGNS = {
  owner: { x: -33, z: 2 },
  expand: { x: -3, z: 2.5 },
  farm: { x: 6, z: 2.5 },
  ranch: { x: 6, z: 33.5 },
} as const;

/** The restaurant's walls for a tier, with the doorway (plot-local). */
export const buildingWalls = (tier: number): Aabb[] => {
  const r = interiorOf(tier);
  return wallBoxes(r.minX, r.maxX, r.minZ, r.maxZ, BUILDING.wall, BUILDING.height, { face: 'minZ', centre: DOOR.x, half: DOOR.half });
};

/** A fenced yard's four sides with a gate in the minX side. */
const fenceBoxes = (r: Rect, gateZ: number): Aabb[] => {
  const t = FENCE.thickness;
  const h = FENCE.height;
  const g = FENCE.gateHalf;
  return [
    { minX: r.minX - t, maxX: r.maxX + t, minY: 0, maxY: h, minZ: r.minZ - t, maxZ: r.minZ },
    { minX: r.minX - t, maxX: r.maxX + t, minY: 0, maxY: h, minZ: r.maxZ, maxZ: r.maxZ + t },
    { minX: r.maxX, maxX: r.maxX + t, minY: 0, maxY: h, minZ: r.minZ, maxZ: r.maxZ },
    { minX: r.minX - t, maxX: r.minX, minY: 0, maxY: h, minZ: r.minZ, maxZ: gateZ - g },
    { minX: r.minX - t, maxX: r.minX, minY: 0, maxY: h, minZ: gateZ + g, maxZ: r.maxZ },
  ];
};

export const yardFences = (): Aabb[] => [...fenceBoxes(FARM, FARM_GATE_Z), ...fenceBoxes(RANCH, RANCH_GATE_Z)];

/** Every structural solid of an OWNED plot (plot-local): the building and the yard fences. */
export const plotSolids = (tier: number): Aabb[] => [...buildingWalls(tier), ...yardFences()];

export const insideRect = (r: Rect, x: number, z: number, margin = 0): boolean =>
  x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin;

/** True when a plot-local point is inside the restaurant (its interior floor). */
export const insideBuilding = (tier: number, x: number, z: number, margin = 0): boolean => insideRect(interiorOf(tier), x, z, margin);

/** True when a plot-local point is on the plot at all. */
export const insidePlot = (x: number, z: number, margin = 0): boolean =>
  x >= PLOT.minX - margin && x <= PLOT.maxX + margin && z >= PLOT.minZ - margin && z <= PLOT.maxZ + margin;
