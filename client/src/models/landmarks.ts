import type { PartBuilder } from '../render/PartBuilder.js';
import { ball, block, brick, cone, cylinder, shade, wedge } from './shapes.js';

/**
 * THE ISLAND'S LANDMARKS, block by block: the Quest Point's pavilion, the
 * Town Hall and its clock tower, the windmill, the well, market carts, the
 * viewpoint's telescope, the fishermen's hut, signposts and lanterns. Each is
 * built round the builder's origin facing +Z; callers place and turn them.
 */

const WOOD = 0xb07a48;
const WOOD_DARK = 0x7a4e2a;
const STONE = 0xbfc2c8;
const STONE_DARK = 0x8e929c;
const PLASTER = 0xf4ecdc;

/** A brass telescope on a wooden tripod, looking out along +Z. */
export const buildTelescope = (b: PartBuilder, x = 0, z = 0, ry = 0, y = 0): void => {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    block(b, 0.14, 2.2, 0.14, WOOD_DARK, { x: x + Math.sin(a) * 0.45, y: y + 1, z: z + Math.cos(a) * 0.45, rx: Math.cos(a) * 0.25, rz: -Math.sin(a) * 0.25 });
  }
  cylinder(b, 0.22, 0.3, 1.8, 0xd8a83a, { x: x + s * 0.3, y: y + 2.35, z: z + c * 0.3, ry, rx: Math.PI / 2 - 0.25 }, 'smooth', 10);
  cylinder(b, 0.34, 0.34, 0.2, 0x3a3e4a, { x: x + s * 1.1, y: y + 2.55, z: z + c * 1.1, ry, rx: Math.PI / 2 - 0.25 }, 'smooth', 10);
};

/** A lantern on a post: a warm glowing block under a little cap. */
export const buildLanternPost = (b: PartBuilder, x: number, z: number, h = 3.6, y = 0): void => {
  block(b, 0.3, h, 0.3, WOOD_DARK, { x, y: y + h / 2, z });
  block(b, 1.1, 0.14, 0.14, WOOD_DARK, { x: x + 0.45, y: y + h - 0.1, z });
  block(b, 0.5, 0.6, 0.5, 0xffd98a, { x: x + 0.8, y: y + h - 0.6, z }, 'glow');
  block(b, 0.6, 0.1, 0.6, 0x2a2e3a, { x: x + 0.8, y: y + h - 0.25, z });
};

/** A wooden bench facing +Z, standing at (x, z). */
export const buildSeat = (b: PartBuilder, x: number, z: number, ry: number, y = 0): void => {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const at = (lx: number, lz: number): { x: number; z: number } => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
  for (const lx of [-1.4, 1.4]) block(b, 0.22, 0.9, 1, WOOD_DARK, { ...at(lx, 0), y: y + 0.45, ry });
  for (let i = 0; i < 3; i += 1) block(b, 3.4, 0.14, 0.3, WOOD, { ...at(0, -0.3 + i * 0.3), y: y + 0.95, ry });
  for (let i = 0; i < 2; i += 1) block(b, 3.4, 0.24, 0.1, WOOD, { ...at(0, -0.52), y: y + 1.4 + i * 0.36, ry });
};

/** A planter of flowers: a timber box brimming with coloured blooms. */
export const buildPlanter = (b: PartBuilder, x: number, z: number, w = 3, d = 1.2, ry = 0, colors: readonly number[] = [0xff5a8a, 0xffd23a, 0xffffff], y = 0): void => {
  brick(b, w, 0.8, d, WOOD, { x, y: y + 0.4, z, ry });
  block(b, w - 0.2, 0.1, d - 0.2, 0x6a4a2c, { x, y: y + 0.82, z, ry });
  const n = Math.max(3, Math.round(w * 1.6));
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  for (let i = 0; i < n; i += 1) {
    const lx = -w / 2 + 0.35 + ((w - 0.7) * i) / Math.max(1, n - 1);
    const lz = (i % 2 ? 0.2 : -0.2) * d;
    block(b, 0.36, 0.34, 0.36, colors[i % colors.length]!, { x: x + lx * c + lz * s, y: y + 1.05, z: z - lx * s + lz * c, ry });
    block(b, 0.3, 0.3, 0.3, 0x4cb83a, { x: x + lx * c + lz * s, y: y + 0.88, z: z - lx * s + lz * c, ry }, 'leaf');
  }
};

/**
 * THE QUEST POINT: the Quest Board under a timber pavilion with a red roof,
 * lanterns at its corners, a bench and a telescope looking out to sea behind
 * it, planters and a low stone lookout wall along the cliff. Faces +Z (the
 * board's front); the sea is behind it (-Z).
 */
export const buildQuestPoint = (b: PartBuilder): void => {
  // The deck: flat planks under the pavilion.
  for (let i = 0; i < 9; i += 1) block(b, 12, 0.12, 1.1, i % 2 ? WOOD : shade(WOOD, 0.92), { y: 0.06, z: -4.4 + i * 1.1 });
  // Posts and roof.
  for (const x of [-5.6, 5.6]) for (const z of [-4.4, 4.2]) block(b, 0.5, 6.6, 0.5, WOOD_DARK, { x, y: 3.3, z });
  block(b, 12.4, 0.4, 0.6, WOOD_DARK, { y: 6.6, z: 4.2 });
  block(b, 12.4, 0.4, 0.6, WOOD_DARK, { y: 6.6, z: -4.4 });
  wedge(b, 13.6, 2.2, 5.4, 0xc8342e, { y: 7.9, z: 2.3, ry: Math.PI });
  wedge(b, 13.6, 2.2, 5.4, 0xc8342e, { y: 7.9, z: -2.5 });
  block(b, 13.8, 0.3, 0.4, 0xffd23a, { y: 9, z: -0.1 });
  // Lanterns hanging from the roof's corners.
  for (const x of [-5.6, 5.6]) {
    for (const z of [-4.4, 4.2]) {
      block(b, 0.08, 0.9, 0.08, 0x2a2e3a, { x, y: 5.9, z: z + (z > 0 ? 0.5 : -0.5) });
      block(b, 0.55, 0.65, 0.55, 0xffd98a, { x, y: 5.2, z: z + (z > 0 ? 0.5 : -0.5) }, 'glow');
    }
  }
  // The lookout, behind the board: a bench and a telescope facing the sea.
  buildSeat(b, -2.6, -7.5, Math.PI);
  buildTelescope(b, 3.2, -8.2, Math.PI);
  // A low wall of stones along the cliff edge.
  for (let i = 0; i < 8; i += 1) {
    const x = -10.5 + i * 3;
    brick(b, 2.8, 0.9 + (i % 3) * 0.15, 1.2, i % 2 ? STONE : shade(STONE, 0.93), { x, y: 0.5, z: -11 - Math.sin(i * 1.3) * 0.6, ry: (i % 2) * 0.1 });
  }
  buildPlanter(b, -7.6, 3.6, 2.6, 1.1, Math.PI / 2);
  buildPlanter(b, 7.6, 3.6, 2.6, 1.1, Math.PI / 2, [0x8ab8ff, 0xffffff, 0xff8ad8]);
  // A treasure chest and a coil of rope: adventures await.
  brick(b, 1.6, 1, 1.1, 0x8a5a2a, { x: -4.2, y: 0.62, z: 2.8, ry: 0.3 });
  block(b, 1.64, 0.4, 1.14, 0x6a4020, { x: -4.2, y: 1.3, z: 2.8, ry: 0.3 });
  block(b, 0.3, 0.3, 0.1, 0xffd23a, { x: -4.05, y: 1.05, z: 3.35, ry: 0.3 });
  cylinder(b, 0.6, 0.6, 0.3, 0xd8c08a, { x: 4.6, y: 0.3, z: 2.9 }, 'smooth', 10);
};

/**
 * THE TOWN HALL: a stone-footed plaster hall with a timber frame, a blue
 * roof, a clock tower with a golden bell and a flag, steps and columns at
 * the door. Faces +Z. Footprint `hx` x `hz`; the tower rises from the back.
 */
export const buildTownHall = (b: PartBuilder, hx: number, hz: number, height: number, tower: number): void => {
  const wall = height * 0.6;
  brick(b, hx * 2 + 0.8, 1.2, hz * 2 + 0.8, STONE_DARK, { y: 0.6 });
  brick(b, hx * 2, wall, hz * 2, PLASTER, { y: 1.2 + wall / 2 });
  for (const x of [-hx, -hx / 3, hx / 3, hx]) block(b, 0.6, wall, 0.6, WOOD_DARK, { x, y: 1.2 + wall / 2, z: hz });
  for (const x of [-hx, hx]) block(b, 0.6, wall, 0.6, WOOD_DARK, { x, y: 1.2 + wall / 2, z: -hz });
  block(b, hx * 2 + 0.2, 0.5, hz * 2 + 0.2, WOOD_DARK, { y: 1.2 + wall * 0.55 });
  const roofH = height - wall - 1.2;
  wedge(b, hx * 2 + 1.6, roofH, hz + 1, 0x3a6ac8, { y: 1.2 + wall + roofH / 2, z: -(hz + 1) / 2 });
  wedge(b, hx * 2 + 1.6, roofH, hz + 1, 0x3a6ac8, { y: 1.2 + wall + roofH / 2, z: (hz + 1) / 2, ry: Math.PI });
  // Steps and a portico of columns.
  for (let i = 0; i < 3; i += 1) brick(b, 8 - i * 0.8, 0.4, 1.2, STONE, { y: 0.2 + i * 0.4, z: hz + 3.2 - i * 1 });
  for (const x of [-3.4, -1.2, 1.2, 3.4]) cylinder(b, 0.35, 0.4, wall, 0xffffff, { x, y: 1.2 + wall / 2, z: hz + 1.6 }, 'smooth', 10);
  wedge(b, 9, 1.6, 2.4, 0x3a6ac8, { y: 1.2 + wall + 0.8, z: hz + 1.6, ry: Math.PI });
  block(b, 9, 0.4, 2.6, 0xffffff, { y: 1.2 + wall, z: hz + 1.6 });
  // Door and windows.
  block(b, 2.4, 3.6, 0.2, 0x7a3a22, { y: 3, z: hz + 0.05 });
  block(b, 0.24, 0.24, 0.24, 0xffd23a, { x: 0.8, y: 3, z: hz + 0.2 });
  for (const x of [-hx * 0.62, hx * 0.62]) {
    for (const y of [3.2, wall - 0.4]) {
      block(b, 2, 1.8, 0.16, 0x9ad8ff, { x, y, z: hz + 0.05 });
      block(b, 2.2, 0.2, 0.34, 0xffffff, { x, y: y - 1, z: hz + 0.12 });
      block(b, 2, 0.34, 0.44, 0xff6a8a, { x, y: y - 0.8, z: hz + 0.3 }, 'leaf');
    }
  }
  // The clock tower at the back.
  const tw = 5;
  const tz = -hz + tw / 2 + 0.5;
  brick(b, tw, tower, tw, 0xe8dcc6, { y: tower / 2, z: tz });
  for (const x of [-tw / 2, tw / 2]) for (const z of [tz - tw / 2, tz + tw / 2]) block(b, 0.5, tower, 0.5, STONE_DARK, { x, y: tower / 2, z });
  cylinder(b, 1.5, 1.5, 0.3, 0xffffff, { y: tower - 3, z: tz + tw / 2 + 0.1, rx: Math.PI / 2 }, 'smooth', 16);
  block(b, 0.16, 1.1, 0.1, 0x1a1a1a, { y: tower - 2.6, z: tz + tw / 2 + 0.3 });
  block(b, 0.8, 0.14, 0.1, 0x1a1a1a, { x: 0.3, y: tower - 3, z: tz + tw / 2 + 0.3 });
  // The belfry: open arches, the bell, a spire and a flag.
  for (const x of [-tw / 2 + 0.3, tw / 2 - 0.3]) for (const z of [tz - tw / 2 + 0.3, tz + tw / 2 - 0.3]) block(b, 0.6, 3, 0.6, 0xe8dcc6, { x, y: tower + 1.5, z });
  cone(b, 0.9, 1.2, 0xffd23a, { y: tower + 1.8, z: tz }, 'smooth', 8);
  block(b, tw + 0.6, 0.4, tw + 0.6, STONE_DARK, { y: tower + 3.1, z: tz });
  cone(b, tw * 0.75, 5, 0x3a6ac8, { y: tower + 5.8, z: tz, ry: Math.PI / 4 }, 'smooth', 4);
  cylinder(b, 0.08, 0.08, 3, 0x3a3e4a, { y: tower + 9.6, z: tz }, 'smooth', 6);
  block(b, 1.8, 1.1, 0.08, 0xe0343a, { x: 0.9, y: tower + 10.4, z: tz });
};

/** A stone well with a tiled roof and a bucket on its rope. */
export const buildWell = (b: PartBuilder): void => {
  cylinder(b, 1.6, 1.7, 1.2, STONE, { y: 0.6 }, 'flat', 10);
  cylinder(b, 1.25, 1.25, 0.1, 0x3a8ad8, { y: 1.05 }, 'smooth', 10);
  for (const x of [-1.4, 1.4]) block(b, 0.3, 3, 0.3, WOOD_DARK, { x, y: 2.1 });
  wedge(b, 3.8, 1, 1.4, 0xd8443a, { y: 4, z: -0.7 });
  wedge(b, 3.8, 1, 1.4, 0xd8443a, { y: 4, z: 0.7, ry: Math.PI });
  cylinder(b, 0.12, 0.12, 3, WOOD, { y: 3, rz: Math.PI / 2 }, 'smooth', 6);
  block(b, 0.05, 1, 0.05, 0xd8c08a, { y: 2.4 });
  cylinder(b, 0.3, 0.25, 0.45, 0x8a5a32, { y: 1.8 }, 'smooth', 8);
};

/** A market cart heaped with produce, a striped canopy over it. Faces +Z. */
export const buildMarketCart = (b: PartBuilder, stripe: number, goods: readonly number[]): void => {
  brick(b, 3.6, 1, 2, WOOD, { y: 1.2 });
  for (const x of [-1.9, 1.9]) cylinder(b, 0.7, 0.7, 0.24, WOOD_DARK, { x, y: 0.7, z: 0.3, rz: Math.PI / 2 }, 'smooth', 10);
  for (const x of [-1.6, 1.6]) for (const z of [-0.8, 0.8]) block(b, 0.16, 2.6, 0.16, WOOD_DARK, { x, y: 2.9, z });
  for (let i = 0; i < 6; i += 1) block(b, 0.64, 0.2, 2.6, i % 2 ? 0xffffff : stripe, { x: -1.6 + i * 0.64, y: 4.3, z: 0.1, rx: -0.12 });
  for (let i = 0; i < 9; i += 1) ball(b, 0.28, goods[i % goods.length]!, { x: -1.3 + (i % 5) * 0.62, y: 1.95 + Math.floor(i / 5) * 0.3, z: -0.4 + (i % 2) * 0.6 }, 'smooth', 0);
  block(b, 0.16, 0.16, 2.2, WOOD_DARK, { x: 2.8, y: 1, z: -1.2, ry: 0.3 });
};

/**
 * A BIG WINDMILL for the hill by the village: a white tower tapering up, a
 * red cap and a door. The sails are built separately (`buildWindmillSails`)
 * so they can turn.
 */
export const buildWindmill = (b: PartBuilder): void => {
  brick(b, 7, 1, 7, STONE_DARK, { y: 0.5 });
  for (let i = 0; i < 5; i += 1) {
    const s = 6 - i * 0.55;
    brick(b, s, 2.4, s, i % 2 ? 0xf6f2ea : 0xece4d4, { y: 1 + 1.2 + i * 2.4 });
  }
  wedge(b, 4.6, 2, 2.4, 0xc8342e, { y: 14, z: -1.2 });
  wedge(b, 4.6, 2, 2.4, 0xc8342e, { y: 14, z: 1.2, ry: Math.PI });
  block(b, 1.6, 2.6, 0.2, WOOD_DARK, { y: 2.3, z: 3.05 });
  for (const y of [6, 9.5]) block(b, 1, 1, 0.2, 0x9ad8ff, { y, z: 2.6 - (y - 6) * 0.1 });
  cylinder(b, 0.5, 0.5, 1.4, WOOD_DARK, { y: 12.6, z: 2.6, rx: Math.PI / 2 }, 'smooth', 8);
};

/** The windmill's four sails round the origin (the hub), in the XY plane: spun about Z. */
export const buildWindmillSails = (b: PartBuilder): void => {
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    block(b, 0.3, 7, 0.2, WOOD_DARK, { x: -s * 3.6, y: c * 3.6, rz: a });
    block(b, 1.6, 5.6, 0.1, i % 2 ? 0xf6f2ea : 0xe8dcc6, { x: -s * 4 + c * 0.9, y: c * 4 + s * 0.9, z: 0.1, rz: a });
  }
  cylinder(b, 0.7, 0.7, 0.6, 0xc8342e, { z: 0.2, rx: Math.PI / 2 }, 'smooth', 8);
};

/** A fisherman's hut: plank walls, a tin roof, nets hung to dry. Faces +Z. */
export const buildFishingHut = (b: PartBuilder): void => {
  brick(b, 6, 3.6, 5, 0x8a6a4a, { y: 1.8 });
  wedge(b, 7, 1.6, 3, 0x6a8a9a, { y: 4.4, z: -1.5 });
  wedge(b, 7, 1.6, 3, 0x6a8a9a, { y: 4.4, z: 1.5, ry: Math.PI });
  block(b, 1.4, 2.4, 0.2, WOOD_DARK, { x: -1.2, y: 1.2, z: 2.55 });
  block(b, 1.2, 1, 0.16, 0x9ad8ff, { x: 1.4, y: 2.2, z: 2.55 });
  block(b, 2.6, 1.6, 0.06, 0xd8d0b0, { x: 1.2, y: 1.6, z: 2.7 }, 'leaf');
  for (let i = 0; i < 3; i += 1) cylinder(b, 0.5, 0.6, 0.8, WOOD, { x: 3.6 + (i % 2) * 0.6, y: 0.4 + Math.floor(i / 2) * 0.8, z: 1 - i * 0.9 }, 'smooth', 8);
};

/** A signpost: a post with arrow boards pointing along the given bearings (radians from +Z toward +X). */
export const buildSignpost = (b: PartBuilder, bearings: readonly number[]): void => {
  block(b, 0.3, 4, 0.3, WOOD_DARK, { y: 2 });
  bearings.forEach((bearing, i) => {
    const y = 3.4 - i * 0.7;
    const c = Math.cos(bearing);
    const s = Math.sin(bearing);
    block(b, 0.12, 0.55, 2.2, WOOD, { x: s * 1.1, y, z: c * 1.1, ry: bearing });
    wedge(b, 0.12, 0.55, 0.5, WOOD, { x: s * 2.4, y, z: c * 2.4, ry: bearing + Math.PI, rz: 0 });
  });
  cone(b, 0.3, 0.4, 0xd8443a, { y: 4.2 }, 'smooth', 4);
};

/** A picnic: a checked blanket, a basket, a pie and two cushions. */
export const buildPicnic = (b: PartBuilder): void => {
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 3; j += 1) block(b, 1.5, 0.05, 1.5, (i + j) % 2 ? 0xffffff : 0xe8443a, { x: -2.25 + i * 1.5, y: 0.03, z: -1.5 + j * 1.5 });
  }
  brick(b, 1.2, 0.8, 0.8, 0xc8904a, { x: -1, y: 0.45, z: 0.2 });
  block(b, 0.1, 0.7, 0.9, 0x8a5a2a, { x: -1, y: 1.1, z: 0.2, rx: 0 });
  cylinder(b, 0.5, 0.5, 0.2, 0xe8b060, { x: 1.2, y: 0.15, z: -0.4 }, 'smooth', 10);
  for (const x of [-2.4, 2.4]) block(b, 1, 0.3, 1, 0xffd23a, { x, y: 0.2, z: 1.4 });
};
