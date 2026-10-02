import {
  BUILDING,
  DOOR,
  FARM,
  FARM_GATE_Z,
  FENCE,
  PLINTH,
  PLINTH_SPOTS,
  RANCH,
  RANCH_GATE_Z,
  SHOP,
  interiorOf,
  itemById,
  type Rect,
  type TownBuilding,
} from '@restaurant/shared';
import { Group, Mesh, MeshLambertMaterial, type Material } from 'three';
import { PartBuilder } from '../render/PartBuilder.js';
import { ball, block, brick, cone, cylinder, shade, wedge } from './shapes.js';

/**
 * BUILDINGS: every restaurant's shell (floor, four walls, roof, awning),
 * the yard fences, the big glass Shop on the plaza, and the town's own
 * buildings. Walls are built per SIDE, each as a full wall and a knee-high
 * stub, so the camera can cut away whichever wall stands between it and a
 * player inside - the way restaurant games on Roblox let you see in.
 */

let glass: Material | null = null;

/** Window glass: pale, see-through, shared. */
export const glassMaterial = (): Material => {
  glass ??= new MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.32, depthWrite: false });
  return glass;
};

/** Build a builder's parts with every mesh on the glass material. */
const glassMeshes = (b: PartBuilder, name: string): Group => {
  const group = b.build(name, false);
  group.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh) {
      mesh.material = glassMaterial();
      mesh.renderOrder = 2;
      mesh.castShadow = false;
    }
  });
  return group;
};

export type Side = 'front' | 'back' | 'left' | 'right';
export const SIDES: readonly Side[] = ['front', 'back', 'left', 'right'];

export interface WallSide {
  readonly full: Group;
  readonly stub: Group;
}

export interface Shell {
  readonly root: Group;
  readonly floor: Group;
  readonly walls: Readonly<Record<Side, WallSide>>;
  readonly roof: Group;
}

const EXTERIOR = 0xf3e6d6;
const TRIM = 0xe2d2bc;

interface Opening {
  readonly from: number;
  readonly to: number;
  /** A doorway runs to the floor; a window has a sill and a head. */
  readonly door: boolean;
}

/** Window (and door) openings along a wall run. */
const openingsFor = (from: number, to: number, door: number | null): Opening[] => {
  const out: Opening[] = [];
  if (door !== null) out.push({ from: door - DOOR.half, to: door + DOOR.half, door: true });
  const span = to - from;
  const count = Math.max(1, Math.floor((span - 2) / 6.5));
  const pitch = span / count;
  for (let i = 0; i < count; i += 1) {
    const centre = from + pitch * (i + 0.5);
    const half = Math.min(1.9, pitch / 2 - 0.9);
    if (half < 0.8) continue;
    if (door !== null && Math.abs(centre - door) < DOOR.half + half + 0.8) continue;
    out.push({ from: centre - half, to: centre + half, door: false });
  }
  return out.sort((a, b) => a.from - b.from);
};

const SILL = 2;
const HEAD = 6.2;

/**
 * One straight wall, built along X (`alongX`) or Z, two-tone: the outer half
 * the building's cream, the inner half the room's wall colour. `fixed` is the
 * wall's middle on the other axis, `outward` which way is outside.
 */
const wallRun = (
  b: PartBuilder,
  panes: PartBuilder,
  alongX: boolean,
  fixed: number,
  outward: number,
  from: number,
  to: number,
  inner: number,
  innerTrim: number,
  door: number | null,
): void => {
  const t = BUILDING.wall;
  const h = BUILDING.height;
  const piece = (a: number, c: number, y0: number, y1: number): void => {
    if (c - a < 0.02 || y1 - y0 < 0.02) return;
    const mid = (a + c) / 2;
    const len = c - a;
    const hy = y1 - y0;
    const outer = fixed + outward * t * 0.25;
    const innerAt = fixed - outward * t * 0.25;
    if (alongX) {
      b.box(len, hy, t / 2, EXTERIOR, 'stud', { x: mid, y: (y0 + y1) / 2, z: outer });
      b.box(len, hy, t / 2, inner, 'smooth', { x: mid, y: (y0 + y1) / 2, z: innerAt });
    } else {
      b.box(t / 2, hy, len, EXTERIOR, 'stud', { x: outer, y: (y0 + y1) / 2, z: mid });
      b.box(t / 2, hy, len, inner, 'smooth', { x: innerAt, y: (y0 + y1) / 2, z: mid });
    }
  };
  let cursor = from;
  for (const o of openingsFor(from, to, door)) {
    piece(cursor, o.from, 0, h);
    if (o.door) piece(o.from, o.to, 5.4, h);
    else {
      piece(o.from, o.to, 0, SILL);
      piece(o.from, o.to, HEAD, h);
      // The pane and a white frame round it.
      const mid = (o.from + o.to) / 2;
      const len = o.to - o.from;
      const cy = (SILL + HEAD) / 2;
      if (alongX) {
        panes.box(len, HEAD - SILL, 0.08, 0xbfe8ff, 'smooth', { x: mid, y: cy, z: fixed });
        block(b, len + 0.3, 0.22, t + 0.16, 0xffffff, { x: mid, y: SILL, z: fixed });
        block(b, len + 0.3, 0.22, t + 0.16, 0xffffff, { x: mid, y: HEAD, z: fixed });
        block(b, 0.12, HEAD - SILL, t + 0.1, 0xffffff, { x: mid, y: cy, z: fixed });
      } else {
        panes.box(0.08, HEAD - SILL, len, 0xbfe8ff, 'smooth', { x: fixed, y: cy, z: mid });
        block(b, t + 0.16, 0.22, len + 0.3, 0xffffff, { x: fixed, y: SILL, z: mid });
        block(b, t + 0.16, 0.22, len + 0.3, 0xffffff, { x: fixed, y: HEAD, z: mid });
        block(b, t + 0.1, HEAD - SILL, 0.12, 0xffffff, { x: fixed, y: cy, z: mid });
      }
    }
    cursor = o.to;
  }
  piece(cursor, to, 0, h);
  // Skirting inside, a base band outside.
  if (alongX) {
    block(b, to - from, 0.3, 0.06, innerTrim, { x: (from + to) / 2, y: 0.15, z: fixed - outward * (t / 2 + 0.03) });
    block(b, to - from + 0.04, 0.6, 0.08, TRIM, { x: (from + to) / 2, y: 0.3, z: fixed + outward * (t / 2 + 0.04) });
  } else {
    block(b, 0.06, 0.3, to - from, innerTrim, { x: fixed - outward * (t / 2 + 0.03), y: 0.15, z: (from + to) / 2 });
    block(b, 0.08, 0.6, to - from + 0.04, TRIM, { x: fixed + outward * (t / 2 + 0.04), y: 0.3, z: (from + to) / 2 });
  }
};

/** The floor of a style, tile by tile. */
const buildFloor = (b: PartBuilder, r: Rect, style: number): void => {
  const colors = itemById(style)?.colors ?? [0x9a5a32, 0x8a4e2a];
  const a = colors[0]!;
  const c = colors[1] ?? shade(a, 0.9);
  const key = itemById(style)?.key ?? 'floor_oak';
  const y = 0.03;
  if (key === 'floor_oak') {
    // Planks: one-unit strips running across, offset joints.
    for (let z = r.minZ; z < r.maxZ - 0.01; z += 1) {
      const row = Math.round(z - r.minZ);
      block(b, r.maxX - r.minX, 0.06, 0.98, row % 2 ? a : c, { x: (r.minX + r.maxX) / 2, y, z: z + 0.5 });
      for (let x = r.minX + (row % 3) * 2.3 + 1.5; x < r.maxX - 0.5; x += 7) block(b, 0.06, 0.065, 0.98, shade(a, 0.7), { x, y, z: z + 0.5 });
    }
    return;
  }
  const tile = key === 'floor_marble' ? 4 : 2;
  for (let x = r.minX; x < r.maxX - 0.01; x += tile) {
    for (let z = r.minZ; z < r.maxZ - 0.01; z += tile) {
      const i = Math.round((x - r.minX) / tile);
      const j = Math.round((z - r.minZ) / tile);
      const w = Math.min(tile, r.maxX - x);
      const d = Math.min(tile, r.maxZ - z);
      block(b, w, 0.06, d, (i + j) % 2 ? a : c, { x: x + w / 2, y, z: z + d / 2 });
    }
  }
};

/** A restaurant's whole shell for a tier and its styles, plot-local. */
export const buildShell = (tier: number, floorStyle: number, wallStyle: number): Shell => {
  const r = interiorOf(tier);
  const t = BUILDING.wall;
  const wallColors = itemById(wallStyle)?.colors ?? [0xf3e6d6, 0xffffff];
  const inner = wallColors[0]!;
  const innerTrim = wallColors[1] ?? 0xffffff;
  const root = new Group();
  root.name = 'shell';

  const fb = new PartBuilder();
  buildFloor(fb, r, floorStyle);
  // The doorstep.
  block(fb, DOOR.half * 2 + 0.4, 0.08, t + 0.2, 0xb8b0a4, { x: DOOR.x, y: 0.04, z: r.minZ - t / 2 });
  const floor = fb.build('floor', false);
  root.add(floor);

  const make = (build: (b: PartBuilder, panes: PartBuilder) => void, stubBuild: (b: PartBuilder) => void, name: string): WallSide => {
    const b = new PartBuilder();
    const panes = new PartBuilder();
    build(b, panes);
    const full = b.build(`wall-${name}`);
    if (!panes.isEmpty) full.add(glassMeshes(panes, `glass-${name}`));
    const sb = new PartBuilder();
    stubBuild(sb);
    const stub = sb.build(`stub-${name}`);
    stub.visible = false;
    root.add(full, stub);
    return { full, stub };
  };
  const stubX = (sb: PartBuilder, z: number, from: number, to: number, door: number | null): void => {
    const pieces = door === null ? [[from, to]] : [[from, door - DOOR.half], [door + DOOR.half, to]];
    for (const [a, c] of pieces) if (c! - a! > 0.05) sb.box(c! - a!, 1.1, t, EXTERIOR, 'stud', { x: (a! + c!) / 2, y: 0.55, z });
  };
  const stubZ = (sb: PartBuilder, x: number, from: number, to: number): void => {
    sb.box(t, 1.1, to - from, EXTERIOR, 'stud', { x, y: 0.55, z: (from + to) / 2 });
  };

  const walls: Record<Side, WallSide> = {
    front: make(
      (b, p) => wallRun(b, p, true, r.minZ - t / 2, -1, r.minX - t, r.maxX + t, inner, innerTrim, DOOR.x),
      (sb) => stubX(sb, r.minZ - t / 2, r.minX - t, r.maxX + t, DOOR.x),
      'front',
    ),
    back: make(
      (b, p) => wallRun(b, p, true, r.maxZ + t / 2, 1, r.minX - t, r.maxX + t, inner, innerTrim, null),
      (sb) => stubX(sb, r.maxZ + t / 2, r.minX - t, r.maxX + t, null),
      'back',
    ),
    left: make(
      (b, p) => wallRun(b, p, false, r.minX - t / 2, -1, r.minZ, r.maxZ, inner, innerTrim, null),
      (sb) => stubZ(sb, r.minX - t / 2, r.minZ, r.maxZ),
      'left',
    ),
    right: make(
      (b, p) => wallRun(b, p, false, r.maxX + t / 2, 1, r.minZ, r.maxZ, inner, innerTrim, null),
      (sb) => stubZ(sb, r.maxX + t / 2, r.minZ, r.maxZ),
      'right',
    ),
  };

  // The roof: a flat top with a parapet, a ceiling light strip inside.
  const rb = new PartBuilder();
  const h = BUILDING.height;
  const w = r.maxX - r.minX + t * 2;
  const d = r.maxZ - r.minZ + t * 2;
  const cx = (r.minX + r.maxX) / 2;
  const cz = (r.minZ + r.maxZ) / 2;
  rb.box(w + 0.6, 0.5, d + 0.6, 0xe8dccb, 'stud', { x: cx, y: h + 0.25, z: cz });
  rb.box(w + 0.6, 0.8, 0.5, 0xf6efe4, 'stud', { x: cx, y: h + 0.9, z: r.minZ - t - 0.05 });
  rb.box(w + 0.6, 0.8, 0.5, 0xf6efe4, 'stud', { x: cx, y: h + 0.9, z: r.maxZ + t + 0.05 });
  rb.box(0.5, 0.8, d + 0.6, 0xf6efe4, 'stud', { x: r.minX - t - 0.05, y: h + 0.9, z: cz });
  rb.box(0.5, 0.8, d + 0.6, 0xf6efe4, 'stud', { x: r.maxX + t + 0.05, y: h + 0.9, z: cz });
  // Rooftop vents and an air conditioner, like a real diner.
  brick(rb, 3, 1.4, 2, 0xc8ccd4, { x: cx + w * 0.25, y: h + 1.2, z: cz + d * 0.2 });
  cylinder(rb, 0.5, 0.5, 1.2, 0xa8acb4, { x: cx - w * 0.25, y: h + 1.1, z: cz + d * 0.25 }, 'smooth', 10);
  const roof = rb.build('roof');
  root.add(roof);

  // The striped awning over the door and a lamp either side.
  const ab = new PartBuilder();
  const stripes = 6;
  const aw = DOOR.half * 2 + 3;
  for (let i = 0; i < stripes; i += 1) {
    const x = DOOR.x - aw / 2 + (aw / stripes) * (i + 0.5);
    block(ab, aw / stripes + 0.01, 0.2, 2.2, i % 2 ? 0xffffff : 0x7a4a2a, { x, y: 6.1, z: r.minZ - t - 1, rx: -0.35 });
  }
  for (const x of [DOOR.x - DOOR.half - 0.9, DOOR.x + DOOR.half + 0.9]) {
    block(ab, 0.3, 0.5, 0.3, 0x2a2a2e, { x, y: 4.6, z: r.minZ - t - 0.25 });
    ball(ab, 0.22, 0xfff0c8, { x, y: 4.3, z: r.minZ - t - 0.35 }, 'glow', 0);
  }
  // Door frame.
  block(ab, 0.3, 5.4, t + 0.3, 0x7a4a2a, { x: DOOR.x - DOOR.half - 0.15, y: 2.7, z: r.minZ - t / 2 });
  block(ab, 0.3, 5.4, t + 0.3, 0x7a4a2a, { x: DOOR.x + DOOR.half + 0.15, y: 2.7, z: r.minZ - t / 2 });
  block(ab, DOOR.half * 2 + 0.6, 0.3, t + 0.3, 0x7a4a2a, { x: DOOR.x, y: 5.4, z: r.minZ - t / 2 });
  // The awning belongs to the front wall: it drops away with it.
  walls.front.full.add(ab.build('awning'));

  return { root, floor, walls, roof };
};

/** The white picket fences round the farm and the ranch, with their gates. */
export const buildYardFences = (b: PartBuilder): void => {
  const run = (x0: number, z0: number, x1: number, z1: number): void => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.1) return;
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    for (const y of [0.55, 1.15]) block(b, alongX ? len : 0.14, 0.16, alongX ? 0.14 : len, 0xffffff, { x: mx, y, z: mz });
    const posts = Math.max(2, Math.round(len / 1.2));
    for (let i = 0; i <= posts; i += 1) {
      const t = i / posts;
      block(b, 0.22, FENCE.height, 0.22, 0xffffff, { x: x0 + (x1 - x0) * t, y: FENCE.height / 2, z: z0 + (z1 - z0) * t });
      cone(b, 0.16, 0.25, 0xffffff, { x: x0 + (x1 - x0) * t, y: FENCE.height + 0.1, z: z0 + (z1 - z0) * t }, 'smooth', 4);
    }
  };
  for (const [yard, gate] of [[FARM, FARM_GATE_Z], [RANCH, RANCH_GATE_Z]] as const) {
    run(yard.minX, yard.minZ, yard.maxX, yard.minZ);
    run(yard.minX, yard.maxZ, yard.maxX, yard.maxZ);
    run(yard.maxX, yard.minZ, yard.maxX, yard.maxZ);
    run(yard.minX, yard.minZ, yard.minX, gate - FENCE.gateHalf);
    run(yard.minX, gate + FENCE.gateHalf, yard.minX, yard.maxZ);
    // Gate posts with a little arch.
    for (const z of [gate - FENCE.gateHalf, gate + FENCE.gateHalf]) block(b, 0.3, 2.6, 0.3, 0x9a6a3a, { x: yard.minX, y: 1.3, z });
    block(b, 0.3, 0.3, FENCE.gateHalf * 2 + 0.3, 0x9a6a3a, { x: yard.minX, y: 2.6, z: gate });
  }
};

/** An empty lot: a stone foundation where the restaurant will stand, and a "For Rent" board. */
export const buildEmptyLot = (b: PartBuilder): void => {
  const r = interiorOf(0);
  brick(b, r.maxX - r.minX + 2, 0.3, r.maxZ - r.minZ + 2, 0xc8c2b6, { x: (r.minX + r.maxX) / 2, y: 0.15, z: (r.minZ + r.maxZ) / 2 });
  for (const [x, z] of [[r.minX - 1, r.minZ - 1], [r.maxX + 1, r.minZ - 1], [r.minX - 1, r.maxZ + 1], [r.maxX + 1, r.maxZ + 1]] as const) {
    block(b, 0.5, 1.4, 0.5, 0xd8443a, { x, y: 0.7, z });
  }
};

// ----------------------------------------------------------------- shop

/** The Shop: white walls, a glass front, an orange and blue band, the big SHOP sign, and inside its plinths and counter. */
export const buildShopBuilding = (): { solid: Group; glass: Group } => {
  const b = new PartBuilder();
  const panes = new PartBuilder();
  const s = SHOP;
  const t = s.wall;
  const h = s.height;
  const cx = (s.minX + s.maxX) / 2;
  const w = s.maxX - s.minX;
  const d = s.maxZ - s.minZ;
  const cz = (s.minZ + s.maxZ) / 2;
  // Floor: big pale tiles, a dark mat by the door.
  for (let x = s.minX; x < s.maxX - 0.01; x += 4) {
    for (let z = s.minZ; z < s.maxZ - 0.01; z += 4) {
      const i = Math.round((x - s.minX) / 4);
      const j = Math.round((z - s.minZ) / 4);
      block(b, 4, 0.08, 4, (i + j) % 2 ? 0xf4f0e8 : 0xe8e2d6, { x: x + 2, y: 0.04, z: z + 2 });
    }
  }
  block(b, 22, 0.1, 8, 0x3a2a24, { x: 0, y: 0.06, z: s.minZ + 9 });
  // The front: glass between white piers, the doorway open.
  const front = s.minZ - t / 2;
  for (let x = s.minX - t; x < s.maxX + t - 0.01; x += 6) {
    const x1 = Math.min(s.maxX + t, x + 6);
    const mid = (x + x1) / 2;
    if (Math.abs(mid) < s.doorHalf) {
      block(b, x1 - x, h - 7, t, 0xffffff, { x: mid, y: 7 + (h - 7) / 2, z: front });
      continue;
    }
    block(b, 0.8, h, t + 0.1, 0xffffff, { x, y: h / 2, z: front });
    block(b, x1 - x, 1.2, t, 0xffffff, { x: mid, y: 0.6, z: front });
    block(b, x1 - x, h - 8, t, 0xffffff, { x: mid, y: 8 + (h - 8) / 2, z: front });
    panes.box(x1 - x - 0.8, 6.8, 0.1, 0xbfe8ff, 'smooth', { x: mid, y: 4.6, z: front });
  }
  // The other three walls: white outside, a soft blue inside.
  for (const [z, outward] of [[s.maxZ + t / 2, 1]] as const) {
    b.box(w + t * 2, h, t / 2, 0xffffff, 'stud', { x: cx, y: h / 2, z: z + outward * t * 0.25 });
    b.box(w + t * 2, h, t / 2, 0xd8ecf8, 'smooth', { x: cx, y: h / 2, z: z - outward * t * 0.25 });
  }
  for (const [x, outward] of [[s.minX - t / 2, -1], [s.maxX + t / 2, 1]] as const) {
    b.box(t / 2, h, d, 0xffffff, 'stud', { x: x + outward * t * 0.25, y: h / 2, z: cz });
    b.box(t / 2, h, d, 0xd8ecf8, 'smooth', { x: x - outward * t * 0.25, y: h / 2, z: cz });
    // Side windows.
    for (let z = s.minZ + 8; z < s.maxZ - 6; z += 12) panes.box(0.12, 4, 6, 0xbfe8ff, 'smooth', { x, y: 5, z });
  }
  // The roof and its striped band, orange over blue.
  b.box(w + t * 2 + 1, 0.8, d + t * 2 + 1, 0xf2f2f2, 'stud', { x: cx, y: h + 0.4, z: cz });
  block(b, w + t * 2 + 1.2, 0.7, 0.3, 0xff9a2a, { x: cx, y: h - 0.6, z: front - 0.65 });
  block(b, w + t * 2 + 1.2, 0.45, 0.3, 0x2f8ad8, { x: cx, y: h - 1.2, z: front - 0.65 });
  for (const x of [s.minX - t / 2 - 0.65, s.maxX + t / 2 + 0.65]) {
    block(b, 0.3, 0.7, d + t * 2 + 1.2, 0xff9a2a, { x, y: h - 0.6, z: cz });
    block(b, 0.3, 0.45, d + t * 2 + 1.2, 0x2f8ad8, { x, y: h - 1.2, z: cz });
  }
  // A canopy over the door.
  block(b, s.doorHalf * 2 + 4, 0.4, 4, 0x2f8ad8, { x: 0, y: 7.4, z: front - 2 });
  for (const x of [-s.doorHalf - 1.6, s.doorHalf + 1.6]) block(b, 0.4, 7.4, 0.4, 0xffffff, { x, y: 3.7, z: front - 3.6 });
  // The counter and the till.
  const c = s.counter;
  brick(b, c.maxX - c.minX, c.height, c.maxZ - c.minZ, 0x2f8ad8, { x: (c.minX + c.maxX) / 2, y: c.height / 2, z: (c.minZ + c.maxZ) / 2 });
  block(b, c.maxX - c.minX + 0.3, 0.2, c.maxZ - c.minZ + 0.3, 0xffffff, { x: (c.minX + c.maxX) / 2, y: c.height + 0.1, z: (c.minZ + c.maxZ) / 2 });
  block(b, 1.4, 0.8, 1, 0x2a2a30, { x: 4, y: c.height + 0.6, z: (c.minZ + c.maxZ) / 2 });
  // Shelves on the back wall behind the keeper.
  for (const x of [-12, 12]) {
    brick(b, 14, 6, 1.4, 0xf2f2f2, { x, y: 3, z: s.maxZ - 0.8 });
    for (let k = 0; k < 3; k += 1) for (let i = 0; i < 6; i += 1) block(b, 1.4, 1.1, 0.8, [0xd8443a, 0x2f8ad8, 0xffd23a, 0x5ab84a][(i + k) % 4]!, { x: x - 5.5 + i * 2.2, y: 1.2 + k * 1.8, z: s.maxZ - 1.3 });
  }
  // Plinths.
  for (const spot of PLINTH_SPOTS) {
    brick(b, PLINTH.half * 2, PLINTH.height, PLINTH.half * 2, 0xffffff, { x: spot.x, y: PLINTH.height / 2, z: spot.z });
    block(b, PLINTH.half * 2 + 0.1, 0.1, PLINTH.half * 2 + 0.1, 0xd8dce4, { x: spot.x, y: PLINTH.height + 0.05, z: spot.z });
  }
  // Ceiling lights.
  for (let x = -30; x <= 30; x += 15) for (let z = s.minZ + 10; z < s.maxZ - 4; z += 14) block(b, 3, 0.2, 0.8, 0xffffff, { x, y: h - 0.2, z }, 'glow');
  return { solid: b.build('shop'), glass: glassMeshes(panes, 'shop-glass') };
};

// ------------------------------------------------------------------ town

/** One of the town's buildings, built round its middle facing +Z (its yaw turns it). */
export const buildTownBuilding = (b: PartBuilder, building: TownBuilding): void => {
  const { hx, hz, height: h, color, roof } = building;
  switch (building.kind) {
    case 'gazebo': {
      cylinder(b, hx, hx, 0.5, 0xe8e2d6, { y: 0.25 }, 'smooth', 8);
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        block(b, 0.4, h - 2, 0.4, 0xffffff, { x: Math.cos(a) * (hx - 0.6), y: (h - 2) / 2 + 0.5, z: Math.sin(a) * (hx - 0.6) });
      }
      cone(b, hx + 0.8, 3, roof, { y: h }, 'smooth', 8);
      ball(b, 0.4, 0xffd23a, { y: h + 1.7 }, 'smooth', 0);
      return;
    }
    case 'market': {
      for (const x of [-hx + 0.3, hx - 0.3]) for (const z of [-hz + 0.3, hz - 0.3]) block(b, 0.3, h, 0.3, 0x8a5a2a, { x, y: h / 2, z });
      brick(b, hx * 2, 1.2, hz * 1.2, 0x9a6a3a, { y: 0.6, z: hz * 0.3 });
      for (let i = 0; i < 6; i += 1) block(b, (hx * 2) / 6 + 0.01, 0.3, hz * 2 + 1, i % 2 ? color : 0xffffff, { x: -hx + (hx * 2 / 6) * (i + 0.5), y: h + 0.2, rx: -0.2 });
      for (let i = 0; i < 5; i += 1) ball(b, 0.3, [0xe8402e, 0xf8d838, 0x6ad04a, 0xf27a1e, 0xc8955a][i]!, { x: -hx + 1 + i * 1.5, y: 1.4, z: hz * 0.3 }, 'smooth', 0);
      return;
    }
    default: {
      brick(b, hx * 2, h, hz * 2, color, { y: h / 2 });
      // Windows on every face and a door on the front.
      for (let i = -1; i <= 1; i += 1) {
        for (const y of h > 9 ? [3.2, 7.2] : [3.4]) {
          block(b, 2.2, 2, 0.12, 0xbfe8ff, { x: i * hx * 0.6, y, z: hz + 0.05 });
          block(b, 2.2, 2, 0.12, 0xbfe8ff, { x: i * hx * 0.6, y, z: -hz - 0.05 });
        }
      }
      block(b, 2.4, 3.4, 0.14, 0x7a4a2a, { y: 1.7, z: hz + 0.08 });
      // A striped awning for the shops.
      if (building.kind !== 'house' && building.kind !== 'hall') {
        for (let i = 0; i < 8; i += 1) block(b, (hx * 2) / 8 + 0.01, 0.2, 2, i % 2 ? 0xffffff : roof, { x: -hx + (hx * 2 / 8) * (i + 0.5), y: 4.6, z: hz + 0.9, rx: -0.35 });
      }
      if (building.kind === 'house') {
        wedge(b, hx * 2 + 0.6, 3, hz + 0.4, roof, { y: h + 1.5, z: hz / 2 + 0.2 });
        wedge(b, hx * 2 + 0.6, 3, hz + 0.4, roof, { y: h + 1.5, z: -hz / 2 - 0.2, ry: Math.PI });
        brick(b, 1.2, 2.4, 1.2, 0xb8553a, { x: hx * 0.5, y: h + 2.4 });
      } else {
        brick(b, hx * 2 + 0.6, 0.6, hz * 2 + 0.6, roof, { y: h + 0.3 });
        if (building.kind === 'hall') {
          brick(b, 6, 6, 6, color, { y: h + 3 });
          cone(b, 4.4, 4, roof, { y: h + 8 }, 'smooth', 4);
          cylinder(b, 1.6, 1.6, 0.2, 0xffffff, { y: h + 3.6, z: 3.05, rx: Math.PI / 2 }, 'smooth', 16);
        }
        if (building.kind === 'cinema') {
          block(b, hx * 1.6, 2.4, 0.4, 0xffd23a, { y: h - 1.6, z: hz + 0.4 });
          for (let i = 0; i < 10; i += 1) ball(b, 0.16, 0xfff6c8, { x: -hx * 0.75 + i * (hx * 1.5 / 9), y: h - 0.3, z: hz + 0.65 }, 'glow', 0);
        }
      }
    }
  }
};

/** A leaderboard's frame: posts, a roof and a lantern either side. The board itself is a canvas. */
export const buildBoardFrame = (b: PartBuilder, width: number, height: number): void => {
  for (const x of [-width / 2 - 0.4, width / 2 + 0.4]) {
    block(b, 0.6, height + 1.4, 0.6, 0x8a5a2a, { x, y: (height + 1.4) / 2 });
    ball(b, 0.35, 0xffd27a, { x, y: height + 0.6, z: 0.5 }, 'glow', 0);
  }
  block(b, width + 2, 0.5, 1.6, 0x6a4024, { y: height + 1.6 });
  block(b, width + 0.4, height + 0.4, 0.4, 0x8a5a2a, { y: height / 2 + 1, z: -0.25 });
  block(b, width, 0.8, 0.6, 0x5a3420, { y: 0.4 });
};
