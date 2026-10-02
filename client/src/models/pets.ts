import { petById } from '@restaurant/shared';
import type { PartBuilder } from '../render/PartBuilder.js';
import { ball, block, cone, cylinder, dome, shade } from './shapes.js';

/**
 * PETS, FISH AND THE THINGS AROUND THEM, block by block: ten blocky pets
 * (the reference's dark little dog among them), fish, rods, eggs, the Pet
 * Merchant's stall and the fishing pier. Pets face +Z, about a unit tall.
 */

const eyes = (b: PartBuilder, y: number, z: number, gap = 0.18, size = 0.1): void => {
  for (const x of [-gap, gap]) block(b, size, size, 0.04, 0x111111, { x, y, z });
};

/** A four-legged blocky body. */
const quadruped = (b: PartBuilder, body: number, belly: number, opts: { tall?: number; long?: number; head?: number } = {}): void => {
  const tall = opts.tall ?? 1;
  const long = opts.long ?? 1;
  block(b, 0.6, 0.45 * tall, 0.9 * long, body, { y: 0.55 * tall });
  block(b, 0.5, 0.12, 0.7 * long, belly, { y: 0.32 * tall });
  for (const x of [-0.2, 0.2]) for (const z of [-0.3 * long, 0.3 * long]) block(b, 0.16, 0.38 * tall, 0.16, shade(body, 0.85), { x, y: 0.19 * tall, z });
  const h = opts.head ?? 0.48;
  block(b, h, h, h, body, { y: 0.88 * tall, z: 0.5 * long });
  eyes(b, 0.95 * tall, 0.5 * long + h / 2 + 0.01);
};

export const buildPet = (b: PartBuilder, type: number): void => {
  const key = petById(type)?.key ?? 'dog';
  switch (key) {
    case 'dog':
      quadruped(b, 0x3a2a22, 0x4a3a2e);
      block(b, 0.22, 0.2, 0.2, 0x2a1e18, { y: 0.8, z: 0.86 });
      block(b, 0.06, 0.06, 0.04, 0x111111, { y: 0.84, z: 0.97 });
      for (const x of [-0.22, 0.22]) block(b, 0.1, 0.3, 0.16, 0x2a1e18, { x, y: 1.12, z: 0.42, rx: 0.3 });
      block(b, 0.08, 0.08, 0.4, 0x3a2a22, { y: 0.78, z: -0.6, rx: -0.6 });
      return;
    case 'cat':
      quadruped(b, 0xf2a04a, 0xfff0d8, { head: 0.44 });
      for (const x of [-0.14, 0.14]) cone(b, 0.1, 0.22, 0xf2a04a, { x, y: 1.2, z: 0.5 }, 'smooth', 4);
      block(b, 0.08, 0.08, 0.5, 0xf2a04a, { y: 0.9, z: -0.62, rx: -1.1 });
      for (let i = 0; i < 3; i += 1) block(b, 0.62, 0.06, 0.12, 0xd8783a, { y: 0.7, z: -0.25 + i * 0.25 });
      return;
    case 'bunny':
      ball(b, 0.38, 0xf6f6f6, { y: 0.42, sz: 1.2 }, 'smooth', 1);
      ball(b, 0.26, 0xf6f6f6, { y: 0.78, z: 0.3 }, 'smooth', 1);
      for (const x of [-0.1, 0.1]) block(b, 0.1, 0.42, 0.06, 0xffc8d8, { x, y: 1.15, z: 0.28, rz: x });
      eyes(b, 0.82, 0.55, 0.1, 0.07);
      ball(b, 0.12, 0xffffff, { y: 0.45, z: -0.45 }, 'smooth', 0);
      return;
    case 'chick':
      ball(b, 0.34, 0xffe04a, { y: 0.4 }, 'smooth', 1);
      ball(b, 0.24, 0xffe04a, { y: 0.78, z: 0.08 }, 'smooth', 1);
      cone(b, 0.07, 0.16, 0xff8a1a, { y: 0.76, z: 0.34, rx: Math.PI / 2 }, 'smooth', 4);
      eyes(b, 0.84, 0.3, 0.09, 0.06);
      for (const x of [-0.1, 0.1]) block(b, 0.04, 0.16, 0.04, 0xff8a1a, { x, y: 0.06 });
      return;
    case 'frog':
      ball(b, 0.38, 0x5ac84a, { y: 0.32, sy: 0.7, sz: 1.1 }, 'smooth', 1);
      for (const x of [-0.18, 0.18]) {
        ball(b, 0.12, 0x5ac84a, { x, y: 0.58, z: 0.2 }, 'smooth', 0);
        block(b, 0.07, 0.07, 0.04, 0x111111, { x, y: 0.6, z: 0.31 });
      }
      block(b, 0.3, 0.03, 0.04, 0x2a6a2a, { y: 0.34, z: 0.4 });
      return;
    case 'fox':
      quadruped(b, 0xe8682a, 0xfff0e0, { head: 0.46 });
      block(b, 0.22, 0.18, 0.24, 0xfff0e0, { y: 0.8, z: 0.84 });
      for (const x of [-0.15, 0.15]) cone(b, 0.11, 0.26, 0xe8682a, { x, y: 1.22, z: 0.5 }, 'smooth', 4);
      cylinder(b, 0.16, 0.08, 0.6, 0xe8682a, { y: 0.75, z: -0.68, rx: -1.0 }, 'smooth', 6);
      ball(b, 0.1, 0xfff0e0, { y: 0.98, z: -0.92 }, 'smooth', 0);
      return;
    case 'penguin':
      ball(b, 0.36, 0x1e2230, { y: 0.48, sy: 1.3 }, 'smooth', 1);
      ball(b, 0.27, 0xffffff, { y: 0.44, z: 0.12, sy: 1.2 }, 'smooth', 1);
      eyes(b, 0.86, 0.3, 0.1, 0.06);
      cone(b, 0.07, 0.16, 0xffa020, { y: 0.78, z: 0.36, rx: Math.PI / 2 }, 'smooth', 4);
      for (const x of [-0.12, 0.12]) block(b, 0.14, 0.04, 0.18, 0xffa020, { x, y: 0.02, z: 0.08 });
      return;
    case 'panda':
      quadruped(b, 0xf6f6f6, 0xf6f6f6, { head: 0.54, tall: 0.95 });
      for (const x of [-0.2, 0.2]) for (const z of [-0.29, 0.29]) block(b, 0.17, 0.38, 0.17, 0x1a1a1a, { x, y: 0.18, z });
      for (const x of [-0.18, 0.18]) {
        block(b, 0.16, 0.16, 0.16, 0x1a1a1a, { x, y: 1.16, z: 0.48 });
        block(b, 0.14, 0.12, 0.04, 0x1a1a1a, { x: x * 0.7, y: 0.9, z: 0.78 });
      }
      return;
    case 'dragon':
      quadruped(b, 0x8a3ad8, 0xffc84a, { head: 0.5, long: 1.15 });
      for (const s of [-1, 1]) block(b, 0.6, 0.06, 0.4, 0xb86af2, { x: s * 0.5, y: 0.95, z: -0.05, rz: s * 0.5 });
      for (const x of [-0.14, 0.14]) cone(b, 0.07, 0.24, 0xffe080, { x, y: 1.26, z: 0.5 }, 'smooth', 4);
      cylinder(b, 0.14, 0.04, 0.7, 0x8a3ad8, { y: 0.6, z: -0.8, rx: -1.3 }, 'smooth', 6);
      block(b, 0.12, 0.12, 0.04, 0xff5a1a, { y: 0.86, z: 0.97 }, 'glow');
      return;
    case 'unicorn':
      quadruped(b, 0xffffff, 0xf6f0ff, { head: 0.46, tall: 1.15 });
      cone(b, 0.07, 0.4, 0xffd23a, { y: 1.42, z: 0.62, rx: 0.4 }, 'glow', 6);
      for (let i = 0; i < 4; i += 1) block(b, 0.1, 0.18, 0.14, [0xff7ad9, 0x8ab8ff, 0xffd23a, 0x8ae05a][i]!, { y: 1.25 - i * 0.05, z: 0.3 - i * 0.16 });
      cylinder(b, 0.12, 0.06, 0.5, 0xff7ad9, { y: 0.7, z: -0.6, rx: -0.9 }, 'smooth', 6);
      return;
  }
};

/** A fish, by colour, about a unit long, nose toward +Z. */
export const buildFish = (b: PartBuilder, color: number, big = false): void => {
  const k = big ? 1.4 : 1;
  ball(b, 0.32 * k, color, { y: 0.3 * k, sz: 2, sx: 0.6 }, 'smooth', 1);
  ball(b, 0.22 * k, shade(color, 1.3), { y: 0.2 * k, z: 0.05, sz: 1.6, sx: 0.5 }, 'smooth', 0);
  block(b, 0.06, 0.45 * k, 0.32 * k, shade(color, 0.8), { y: 0.3 * k, z: -0.72 * k, rx: 0.2 });
  block(b, 0.04, 0.22 * k, 0.3 * k, shade(color, 0.8), { y: 0.56 * k, z: -0.05 });
  for (const x of [-0.17, 0.17]) block(b, 0.04, 0.08, 0.08, 0x111111, { x: x * k, y: 0.36 * k, z: 0.42 * k });
};

/** A rod, standing up (as on a display plinth or in a hand). */
export const buildRod = (b: PartBuilder, color: number, reel = 0x8a8e98): void => {
  cylinder(b, 0.05, 0.09, 3.2, color, { y: 1.6, rz: 0.15 }, 'smooth', 6);
  block(b, 0.14, 0.5, 0.14, 0x2a2a2a, { x: 0.04, y: 0.3 });
  cylinder(b, 0.16, 0.16, 0.12, reel, { x: 0.18, y: 0.7, rz: Math.PI / 2 }, 'smooth', 10);
  block(b, 0.02, 0.6, 0.02, 0xffffff, { x: -0.24, y: 2.9 });
};

export const ROD_COLORS: Readonly<Record<string, number>> = { basic_rod: 0x9a6a3a, sturdy_rod: 0x2f6ab8, pro_rod: 0x2a2a30, golden_rod: 0xffc21a };

/** An egg on a little nest. */
export const buildEgg = (b: PartBuilder, color: number, spots: number): void => {
  cylinder(b, 0.7, 0.55, 0.25, 0xc8a050, { y: 0.12 }, 'smooth', 10);
  ball(b, 0.55, color, { y: 0.8, sy: 1.25 }, 'smooth', 2);
  for (let i = 0; i < 5; i += 1) ball(b, 0.12, spots, { x: Math.cos(i * 1.3) * 0.48, y: 0.6 + (i % 3) * 0.28, z: Math.sin(i * 1.3) * 0.48 }, 'smooth', 0);
};

/** The Pet Merchant's stall, its counter facing +X: a striped awning, paw banners, crates of pet food. */
export const buildPetStall = (b: PartBuilder): void => {
  b.box(3, 1.6, 8, 0x9a6a3a, 'stud', { y: 0.8 });
  block(b, 3.3, 0.2, 8.3, 0x6a4024, { y: 1.7 });
  for (const z of [-4.2, 4.2]) for (const x of [-1.2, 2]) block(b, 0.3, 4.6, 0.3, 0x6a4024, { x, y: 2.3, z });
  for (let i = 0; i < 8; i += 1) block(b, 4.2, 0.25, 1.06, i % 2 ? 0xffffff : 0xff9a2a, { x: 0.6, y: 4.7, z: -3.7 + i * 1.06, rz: -0.22 });
  for (const z of [-2.5, 0, 2.5]) {
    block(b, 0.6, 0.5, 0.6, 0xd8443a, { x: -0.6, y: 1.95, z });
    ball(b, 0.16, 0x8a5a2a, { x: -0.6, y: 2.25, z }, 'smooth', 0);
  }
  for (let i = 0; i < 6; i += 1) {
    const z = -3.5 + i * 1.4;
    cone(b, 0.45, 0.7, i % 2 ? 0xffd23a : 0xff7ad9, { x: 2.2, y: 4.1, z, rx: Math.PI }, 'smooth', 3);
  }
  dome(b, 0.4, 0xffffff, { x: 1, y: 1.8, z: 2.6 });
};

/** The fishing pier: a plank deck on posts, rails, a lamp, a bench and a bait barrel at the end. */
export const buildPier = (b: PartBuilder, x: number, fromZ: number, toZ: number, half: number): void => {
  const length = fromZ - toZ;
  for (let z = toZ; z < fromZ; z += 1.2) {
    block(b, half * 2, 0.22, 1.1, z % 2.4 < 1.2 ? 0xb07a48 : 0xa06a3a, { x, y: -0.1, z: z + 0.6 });
  }
  for (let z = toZ + 1; z < fromZ; z += 6) {
    for (const s of [-1, 1]) {
      block(b, 0.5, 4, 0.5, 0x7a4e2a, { x: x + s * (half - 0.3), y: -2, z });
      block(b, 0.2, 1.4, 0.2, 0x7a4e2a, { x: x + s * (half - 0.2), y: 0.7, z });
    }
  }
  for (const s of [-1, 1]) block(b, 0.16, 0.16, length, 0x8a5a2a, { x: x + s * (half - 0.2), y: 1.3, z: (fromZ + toZ) / 2 });
  block(b, half * 2, 0.16, 0.16, 0x8a5a2a, { x, y: 1.3, z: toZ + 0.1 });
  cylinder(b, 0.5, 0.55, 1.1, 0x8a5a2a, { x: x + half - 1.2, y: 0.55, z: toZ + 2 }, 'smooth', 10);
  block(b, 2.4, 0.18, 0.8, 0xb07a48, { x: x - half + 1.4, y: 0.75, z: toZ + 5 });
  for (const dz of [-0.3, 0.3]) block(b, 0.2, 0.75, 0.2, 0x5a3a22, { x: x - half + 1.4, y: 0.37, z: toZ + 5 + dz });
};
