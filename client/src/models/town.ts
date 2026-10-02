import type { PartBuilder } from '../render/PartBuilder.js';
import { ball, block, brick, cone, cylinder, dome, shade, wedge } from './shapes.js';

/**
 * THE TOWN, BLOCK BY BLOCK: shop stalls under striped awnings, the fountain,
 * the lighthouse, the quest board, the dock and its boat. (Every house - the
 * villagers' and the gardeners' - is in `houses.ts`.)
 *
 * All built around the builder's origin, facing +Z unless noted, so a caller
 * places and turns them with a transform.
 */

const WOOD = 0xb07a48;
const WOOD_DARK = 0x7a4e2a;
const PLASTER = 0xf4ecdc;
const STONE = 0xbfc2c8;
const STONE_DARK = 0x8e929c;

/** A barrel, standing on y = 0. */
export const buildBarrel = (b: PartBuilder, x: number, z: number, s = 1): void => {
  cylinder(b, 0.7 * s, 0.8 * s, 1.7 * s, 0x9a6a3a, { x, y: 0.85 * s, z }, 'smooth', 10);
  cylinder(b, 0.82 * s, 0.82 * s, 0.14 * s, 0x4a4e5a, { x, y: 0.35 * s, z }, 'smooth', 10);
  cylinder(b, 0.78 * s, 0.78 * s, 0.14 * s, 0x4a4e5a, { x, y: 1.35 * s, z }, 'smooth', 10);
};

export const buildCrate = (b: PartBuilder, x: number, z: number, s = 1, ry = 0): void => {
  brick(b, 1.4 * s, 1.4 * s, 1.4 * s, 0xc8904a, { x, y: 0.7 * s, z, ry });
  block(b, 1.44 * s, 0.16 * s, 1.44 * s, 0x8a5a2a, { x, y: 1.2 * s, z, ry });
};

/** A wrapped gift box (yellow with a ribbon), a town decoration. */
export const buildGiftBox = (b: PartBuilder, x: number, z: number, s = 1, color = 0xffd23a): void => {
  brick(b, 1.6 * s, 1.2 * s, 1.6 * s, color, { x, y: 0.6 * s, z });
  block(b, 0.3 * s, 1.24 * s, 1.64 * s, 0xe0443a, { x, y: 0.6 * s, z });
  block(b, 1.64 * s, 1.24 * s, 0.3 * s, 0xe0443a, { x, y: 0.6 * s, z });
};

/** A black lamp post with a warm lantern. */
export const buildLamp = (b: PartBuilder, x: number, z: number): void => {
  cylinder(b, 0.14, 0.22, 4.4, 0x2a2e3a, { x, y: 2.2, z }, 'smooth', 8);
  block(b, 0.7, 0.8, 0.7, 0xffdf8a, { x, y: 4.8, z }, 'glow');
  cone(b, 0.62, 0.45, 0x2a2e3a, { x, y: 5.4, z }, 'smooth', 4);
  block(b, 0.8, 0.12, 0.8, 0x2a2e3a, { x, y: 4.35, z });
};

export const buildBench = (b: PartBuilder, x: number, z: number, ry: number): void => {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const at = (lx: number, lz: number): { x: number; z: number } => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
  for (const lx of [-1.4, 1.4]) block(b, 0.2, 0.9, 1, 0x3a3e4a, { ...at(lx, 0), y: 0.45, ry });
  for (let i = 0; i < 3; i += 1) block(b, 3.4, 0.12, 0.28, WOOD, { ...at(0, -0.3 + i * 0.3), y: 0.95, ry });
  for (let i = 0; i < 2; i += 1) block(b, 3.4, 0.22, 0.1, WOOD, { ...at(0, -0.5), y: 1.4 + i * 0.35, ry });
};

// ------------------------------------------------------------ buildings

/** The fountain in the middle of the square. */
export const buildFountain = (b: PartBuilder): void => {
  cylinder(b, 6, 6.2, 1.3, STONE, { y: 0.65 }, 'flat', 16);
  cylinder(b, 5.3, 5.3, 0.1, 0x5ac8f5, { y: 1.1 }, 'glow', 16);
  cylinder(b, 0.9, 1.2, 3, STONE, { y: 2.2 }, 'smooth', 10);
  cylinder(b, 2.6, 1.8, 0.6, STONE, { y: 3.8 }, 'smooth', 14);
  cylinder(b, 2.2, 2.2, 0.08, 0x7ad8ff, { y: 4.1 }, 'glow', 14);
  cylinder(b, 0.4, 0.5, 1.4, STONE, { y: 4.7 }, 'smooth', 8);
  ball(b, 0.7, 0xa8e8ff, { y: 5.8 }, 'glow', 1);
};

/** The lighthouse on the south-west point: red and white bands, a glowing lamp. */
export const buildLighthouse = (b: PartBuilder): void => {
  brick(b, 10, 1.4, 10, STONE_DARK, { y: 0.7 });
  const bands = 6;
  for (let i = 0; i < bands; i += 1) {
    const r0 = 4 - i * 0.35;
    cylinder(b, r0 - 0.35, r0, 3.4, i % 2 ? 0xffffff : 0xe0343a, { y: 1.4 + 1.7 + i * 3.4 }, 'smooth', 12);
  }
  const top = 1.4 + bands * 3.4;
  cylinder(b, 2.6, 2.6, 0.4, 0x2a2e3a, { y: top + 0.2 }, 'smooth', 12);
  cylinder(b, 1.6, 1.6, 2.2, 0xfff2a0, { y: top + 1.5 }, 'glow', 10);
  cone(b, 2, 1.8, 0xe0343a, { y: top + 3.5 }, 'smooth', 10);
  block(b, 1.4, 2.6, 0.3, WOOD_DARK, { y: 2.7, z: 4.6 });
};

/** The Quest Board: a wide notice board on two posts under a little roof, papers pinned on it. */
export const buildQuestBoard = (b: PartBuilder): void => {
  for (const x of [-2.6, 2.6]) block(b, 0.5, 5.2, 0.5, WOOD_DARK, { x, y: 2.6 });
  brick(b, 5.4, 3, 0.4, WOOD, { y: 3.2 });
  block(b, 5.8, 0.3, 0.6, WOOD_DARK, { y: 4.8 });
  block(b, 5.8, 0.3, 0.6, WOOD_DARK, { y: 1.65 });
  wedge(b, 6.4, 1, 1.2, 0xd8443a, { y: 5.5, z: 0.1, ry: Math.PI });
  for (let i = 0; i < 5; i += 1) {
    block(b, 0.9, 1.1, 0.06, 0xfff6dc, { x: -2 + i * 1, y: 3.2 + (i % 2) * 0.35, z: 0.24, rz: (i - 2) * 0.05 });
    block(b, 0.14, 0.14, 0.06, 0xe0343a, { x: -2 + i * 1, y: 3.7 + (i % 2) * 0.35, z: 0.28 });
  }
};

/** The old boat, broken (planks askew, a hole) or mended. Faces +Z, floats at y = 0. */
export const buildBoat = (b: PartBuilder, mended: boolean): void => {
  const hull = mended ? 0xa8683a : 0x7a5a42;
  brick(b, 3.6, 1.4, 7, hull, { y: 0.2 });
  wedge(b, 3.6, 1.4, 2.4, hull, { y: 0.2, z: 4.7, ry: Math.PI });
  block(b, 3.2, 0.2, 6.6, shade(hull, 0.75), { y: 0.95 });
  for (const x of [-1.8, 1.8]) block(b, 0.3, 0.4, 8, shade(hull, 1.15), { x, y: 1.05, z: 0.4 });
  block(b, 3, 0.2, 1, WOOD, { y: 1.2, z: -1.5 });
  if (mended) {
    cylinder(b, 0.14, 0.14, 6, WOOD_DARK, { y: 4 }, 'smooth', 6);
    block(b, 0.1, 3.6, 3, 0xf6f2ea, { y: 4.4, z: 1.2, rx: 0.05 });
  } else {
    block(b, 1.2, 0.3, 1.6, 0x1a1a1a, { x: 0.8, y: 1.0, z: 1.8 });
    block(b, 0.3, 0.2, 2.2, WOOD, { x: -1.2, y: 1.35, z: 2.4, ry: 0.5, rz: 0.3 });
    block(b, 0.3, 0.2, 1.8, WOOD, { x: 2.3, y: 0.4, z: -2.8, ry: 1.1 });
    cylinder(b, 0.14, 0.14, 3, WOOD_DARK, { x: 0.5, y: 1.9, z: -0.5, rz: 0.9 }, 'smooth', 6);
  }
};

/** A seagull, for the boat's figurehead of a friend. */
export const buildGull = (b: PartBuilder, x: number, y: number, z: number): void => {
  block(b, 0.5, 0.45, 0.9, 0xf6f6f6, { x, y: y + 0.3, z });
  block(b, 0.4, 0.4, 0.4, 0xf6f6f6, { x, y: y + 0.7, z: z + 0.4 });
  block(b, 0.14, 0.12, 0.3, 0xffa82a, { x, y: y + 0.66, z: z + 0.7 });
  block(b, 1, 0.1, 0.5, 0xc8ccd6, { x, y: y + 0.45, z: z - 0.1 });
};
