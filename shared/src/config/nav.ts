import { footprint, frontOf, itemById } from './items.js';
import { plotSolids } from './plot.js';
import type { PlacedItem } from './placement.js';
import { PLOT } from './town.js';

/**
 * WALKING ROUND THE FURNITURE: a one-unit grid over the whole plot (and the
 * sidewalk in front), with the walls, fences and every placed item marked
 * blocked, and an A* search over it. Customers and staff walk the paths it
 * finds; the server computes each path once, pulls it taut into a few
 * waypoints, and replicates the waypoints - so every client draws exactly the
 * route the server timed, without searching anything itself.
 */

export const NAV = { x0: PLOT.minX, z0: PLOT.minZ - 10, w: PLOT.maxX - PLOT.minX, h: PLOT.maxZ - PLOT.minZ + 10 } as const;

export interface NavGrid {
  readonly blocked: Uint8Array;
}

export interface Point {
  x: number;
  z: number;
}

const idx = (i: number, j: number): number => j * NAV.w + i;
const cellX = (x: number): number => Math.floor(x - NAV.x0);
const cellZ = (z: number): number => Math.floor(z - NAV.z0);
const inGrid = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < NAV.w && j < NAV.h;

const mark = (g: Uint8Array, minX: number, maxX: number, minZ: number, maxZ: number): void => {
  const e = 0.02;
  for (let i = cellX(minX + e); i <= cellX(maxX - e); i += 1) {
    for (let j = cellZ(minZ + e); j <= cellZ(maxZ - e); j += 1) if (inGrid(i, j)) g[idx(i, j)] = 1;
  }
};

/** The grid for a restaurant of this tier with these items in it. */
export const buildNav = (tier: number, items: Iterable<PlacedItem>): NavGrid => {
  const blocked = new Uint8Array(NAV.w * NAV.h);
  for (const box of plotSolids(tier)) mark(blocked, box.minX, box.maxX, box.minZ, box.maxZ);
  for (const item of items) {
    const def = itemById(item.kind);
    if (!def || def.zone === 'none' || def.role === 'rug') continue;
    const f = footprint(def, item.rot);
    mark(blocked, item.x - f.hx, item.x + f.hx, item.z - f.hz, item.z + f.hz);
  }
  return { blocked };
};

export const walkable = (grid: NavGrid, x: number, z: number): boolean => {
  const i = cellX(x);
  const j = cellZ(z);
  return inGrid(i, j) && grid.blocked[idx(i, j)] === 0;
};

/** The middle of the free cell nearest a point (breadth first), or null. */
export const nearestFree = (grid: NavGrid, x: number, z: number, maxRing = 12): Point | null => {
  const ci = cellX(x);
  const cj = cellZ(z);
  let best: Point | null = null;
  let bestD = Infinity;
  for (let ring = 0; ring <= maxRing; ring += 1) {
    for (let i = ci - ring; i <= ci + ring; i += 1) {
      for (let j = cj - ring; j <= cj + ring; j += 1) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== ring) continue;
        if (!inGrid(i, j) || grid.blocked[idx(i, j)] !== 0) continue;
        const px = NAV.x0 + i + 0.5;
        const pz = NAV.z0 + j + 0.5;
        const d = Math.hypot(px - x, pz - z);
        if (d < bestD) {
          bestD = d;
          best = { x: px, z: pz };
        }
      }
    }
    if (best) return best;
  }
  return null;
};

/**
 * Where someone stands to use an item: in front of it (the way it faces) if
 * that is free, else the nearest free cell round its footprint.
 */
export const accessPoint = (grid: NavGrid, item: PlacedItem): Point | null => {
  const def = itemById(item.kind);
  if (!def) return null;
  const f = footprint(def, item.rot);
  const front = frontOf(item.rot);
  const reach = (Math.abs(front.x) > 0 ? f.hx : f.hz) + 0.7;
  const fx = item.x + front.x * reach;
  const fz = item.z + front.z * reach;
  if (def.role !== 'chair' && walkable(grid, fx, fz)) return { x: fx, z: fz };
  return nearestFree(grid, fx, fz, 8);
};

// --------------------------------------------------------------------- A*

class Heap {
  private readonly keys: number[] = [];
  private readonly prio: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, priority: number): void {
    const k = this.keys;
    const p = this.prio;
    k.push(key);
    p.push(priority);
    let i = k.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (p[parent]! <= p[i]!) break;
      [k[parent], k[i]] = [k[i]!, k[parent]!];
      [p[parent], p[i]] = [p[i]!, p[parent]!];
      i = parent;
    }
  }

  pop(): number {
    const k = this.keys;
    const p = this.prio;
    const top = k[0]!;
    const lastK = k.pop()!;
    const lastP = p.pop()!;
    if (k.length > 0) {
      k[0] = lastK;
      p[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < k.length && p[l]! < p[m]!) m = l;
        if (r < k.length && p[r]! < p[m]!) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i]!, k[m]!];
        [p[m], p[i]] = [p[i]!, p[m]!];
        i = m;
      }
    }
    return top;
  }
}

const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const;

const gScore = new Float32Array(NAV.w * NAV.h);
const came = new Int32Array(NAV.w * NAV.h);
const closed = new Uint8Array(NAV.w * NAV.h);

/**
 * A path between two plot-local points as taut waypoints (start and end
 * included), or null when there is none. The end may be inside furniture (a
 * chair): the walk goes to the nearest free cell and then steps onto it.
 */
export const findPath = (grid: NavGrid, from: Point, to: Point): Point[] | null => {
  const start = walkable(grid, from.x, from.z) ? { x: from.x, z: from.z } : nearestFree(grid, from.x, from.z, 6);
  const goal = walkable(grid, to.x, to.z) ? { x: to.x, z: to.z } : nearestFree(grid, to.x, to.z, 6);
  if (!start || !goal) return null;
  const si = cellX(start.x);
  const sj = cellZ(start.z);
  const gi = cellX(goal.x);
  const gj = cellZ(goal.z);
  const s = idx(si, sj);
  const t = idx(gi, gj);
  gScore.fill(Infinity);
  closed.fill(0);
  came.fill(-1);
  const heap = new Heap();
  gScore[s] = 0;
  heap.push(s, 0);
  let found = s === t;
  let expanded = 0;
  while (heap.size > 0 && !found) {
    const current = heap.pop();
    if (closed[current]) continue;
    closed[current] = 1;
    if (current === t) {
      found = true;
      break;
    }
    if ((expanded += 1) > 6000) break;
    const ci = current % NAV.w;
    const cj = (current - ci) / NAV.w;
    for (const [di, dj, cost] of DIRS) {
      const ni = ci + di;
      const nj = cj + dj;
      if (!inGrid(ni, nj)) continue;
      const n = idx(ni, nj);
      if (grid.blocked[n] !== 0 || closed[n]) continue;
      // No cutting a corner past a blocked cell.
      if (di !== 0 && dj !== 0 && (grid.blocked[idx(ci + di, cj)] !== 0 || grid.blocked[idx(ci, cj + dj)] !== 0)) continue;
      const g = gScore[current]! + cost;
      if (g >= gScore[n]!) continue;
      gScore[n] = g;
      came[n] = current;
      const hx = Math.abs(ni - gi);
      const hz = Math.abs(nj - gj);
      heap.push(n, g + Math.max(hx, hz) + (Math.SQRT2 - 1) * Math.min(hx, hz));
    }
  }
  if (!found) return null;
  const cells: Point[] = [];
  for (let c = t; c !== -1 && c !== s; c = came[c]!) cells.push({ x: NAV.x0 + (c % NAV.w) + 0.5, z: NAV.z0 + Math.floor(c / NAV.w) + 0.5 });
  cells.reverse();
  const raw: Point[] = [{ x: from.x, z: from.z }];
  if (start.x !== from.x || start.z !== from.z) raw.push(start);
  raw.push(...cells);
  raw.push(goal);
  if (goal.x !== to.x || goal.z !== to.z) raw.push({ x: to.x, z: to.z });
  return pull(grid, raw);
};

/** True when a straight walk between two points crosses no blocked cell (with a little body width). */
const clear = (grid: NavGrid, a: Point, b: Point): boolean => {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.ceil(length / 0.25));
  const r = 0.3;
  for (let k = 1; k < steps; k += 1) {
    const t = k / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    if (!walkable(grid, x - r, z - r) || !walkable(grid, x + r, z - r) || !walkable(grid, x - r, z + r) || !walkable(grid, x + r, z + r)) return false;
  }
  return true;
};

/**
 * String-pull: from each kept point, jump to the furthest later point a
 * straight walk reaches. A leg into or out of furniture (a chair) is never
 * "clear", so the free cell beside it is kept and the step on is short.
 */
const pull = (grid: NavGrid, points: Point[]): Point[] => {
  if (points.length <= 2) return points;
  const out: Point[] = [points[0]!];
  let i = 0;
  while (i < points.length - 1) {
    let j = points.length - 1;
    while (j > i + 1 && !clear(grid, points[i]!, points[j]!)) j -= 1;
    const next = points[j]!;
    const prev = out[out.length - 1]!;
    if (Math.hypot(next.x - prev.x, next.z - prev.z) > 0.01) out.push(next);
    i = j;
  }
  return out;
};

// ------------------------------------------------------- along a path

export const pathLength = (points: readonly Point[]): number => {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z);
  return total;
};

/** Where on a path someone is after walking `distance` (clamped), and which way they face. */
export const pointAlong = (points: readonly Point[], distance: number): { x: number; z: number; yaw: number; done: boolean } => {
  if (points.length === 0) return { x: 0, z: 0, yaw: 0, done: true };
  let left = Math.max(0, distance);
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    if (left <= seg && seg > 1e-6) {
      const t = left / seg;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw, done: false };
    }
    left -= seg;
  }
  const last = points[points.length - 1]!;
  const prev = points[points.length - 2];
  return { x: last.x, z: last.z, yaw: prev ? Math.atan2(last.x - prev.x, last.z - prev.z) : 0, done: true };
};

/** Compact text form for replication: "x,z;x,z" with two decimals. */
export const encodePath = (points: readonly Point[]): string => points.map((p) => `${Math.round(p.x * 100) / 100},${Math.round(p.z * 100) / 100}`).join(';');

export const decodePath = (text: string): Point[] => {
  if (!text) return [];
  const out: Point[] = [];
  for (const part of text.split(';')) {
    const [x, z] = part.split(',');
    const px = Number(x);
    const pz = Number(z);
    if (Number.isFinite(px) && Number.isFinite(pz)) out.push({ x: px, z: pz });
  }
  return out;
};
