import type { PartBuilder } from '../render/PartBuilder.js';
import { ball, block, cone, cylinder, dome, wedge } from './shapes.js';

/**
 * THE UI'S ART, as little 3D models rendered into icons: the rail's basket,
 * store, pencil, shield and bar chart; the Items hammer; the tabs' chef,
 * cookbook and customers; each skill's bell, pan, sponge, sprout and hen;
 * cash, diamonds, the trophy and the rank badge. No image files - they cost
 * nothing to ship and match the world's plastic look.
 */
export type ArtKey =
  | 'premium'
  | 'shop'
  | 'home'
  | 'manage'
  | 'visit'
  | 'skills'
  | 'items'
  | 'staff'
  | 'recipes'
  | 'customers'
  | 'restaurant'
  | 'rank'
  | 'milestones'
  | 'service'
  | 'cooking'
  | 'cleaning'
  | 'farming'
  | 'ranching'
  | 'cash'
  | 'diamond'
  | 'leaderboard'
  | 'boost'
  | 'arrow'
  | 'fishing'
  | 'pets';

export const buildArt = (b: PartBuilder, key: ArtKey): void => {
  switch (key) {
    case 'premium': // a red shopping basket
      cylinder(b, 1.1, 0.85, 1, 0xe8302a, { y: 0.5 }, 'smooth', 4);
      for (let i = 0; i < 4; i += 1) block(b, 1.6, 0.08, 0.06, 0xb81a1a, { y: 0.25 + i * 0.22, z: 0.78, ry: Math.PI / 4 });
      block(b, 0.12, 0.9, 0.12, 0xb81a1a, { x: -0.7, y: 1.3 });
      block(b, 0.12, 0.9, 0.12, 0xb81a1a, { x: 0.7, y: 1.3 });
      block(b, 1.52, 0.12, 0.12, 0xb81a1a, { y: 1.75 });
      return;
    case 'shop': // a store front with a striped awning
      block(b, 2, 1.4, 1.2, 0xf2f2f2, { y: 0.7 });
      block(b, 1.2, 0.7, 0.06, 0x8ad8ff, { y: 0.75, z: 0.62 });
      for (let i = 0; i < 5; i += 1) block(b, 0.42, 0.2, 0.7, i % 2 ? 0xffffff : 0xe8302a, { x: -0.84 + i * 0.42, y: 1.45, z: 0.6, rx: -0.4 });
      block(b, 2.2, 0.3, 1.3, 0x2f8ad8, { y: 1.75 });
      return;
    case 'home':
    case 'restaurant': // a little diner with a roof
      block(b, 1.8, 1.2, 1.4, 0xf3e6d6, { y: 0.6 });
      wedge(b, 2.1, 0.8, 0.8, 0xe8443a, { y: 1.6, z: 0.36 });
      wedge(b, 2.1, 0.8, 0.8, 0xe8443a, { y: 1.6, z: -0.36, ry: Math.PI });
      block(b, 0.5, 0.8, 0.06, 0x7a4a2a, { y: 0.4, z: 0.72 });
      block(b, 0.5, 0.4, 0.06, 0x8ad8ff, { x: 0.55, y: 0.75, z: 0.72 });
      return;
    case 'manage': // a yellow pencil
      cylinder(b, 0.32, 0.32, 2.2, 0xffc21a, { rz: 0.8, y: 1 }, 'smooth', 6);
      cone(b, 0.32, 0.5, 0xf2d2a0, { x: -0.98, y: -0.02, rz: 0.8 + Math.PI }, 'smooth', 6);
      cone(b, 0.1, 0.16, 0x2a2a2a, { x: -1.2, y: -0.22, rz: 0.8 + Math.PI }, 'smooth', 6);
      cylinder(b, 0.33, 0.33, 0.3, 0xe86aa0, { x: 0.86, y: 1.82, rz: 0.8 }, 'smooth', 6);
      return;
    case 'visit': // a shield with a chef's hat
      block(b, 1.6, 1.8, 0.3, 0x2f8ad8, { y: 0.9 });
      cone(b, 0.8, 0.6, 0x2f8ad8, { y: -0.3, rz: Math.PI, sz: 0.4 }, 'smooth', 4);
      block(b, 1.3, 1.5, 0.32, 0xff8a3a, { y: 0.95 });
      cylinder(b, 0.32, 0.32, 0.25, 0xffffff, { y: 0.8, z: 0.2 }, 'smooth', 10);
      ball(b, 0.32, 0xffffff, { y: 1.15, z: 0.2 }, 'smooth', 0);
      return;
    case 'skills': // a bar chart
      block(b, 0.5, 0.9, 0.5, 0x5ad84a, { x: -0.65, y: 0.45 });
      block(b, 0.5, 1.4, 0.5, 0x3a8ad8, { y: 0.7 });
      block(b, 0.5, 2, 0.5, 0xe8302a, { x: 0.65, y: 1 });
      block(b, 2, 0.12, 0.6, 0x2a2a2a, { y: 0.02 });
      return;
    case 'items': // a hammer
      cylinder(b, 0.14, 0.14, 2, 0x9a6a3a, { rz: -0.6, y: 0.9 }, 'smooth', 8);
      block(b, 1.1, 0.42, 0.42, 0x6a6e78, { x: 0.6, y: 1.75, rz: -0.6 });
      return;
    case 'staff': // a chef's head
      ball(b, 0.7, 0xf2c8a0, { y: 0.7 }, 'smooth', 1);
      cylinder(b, 0.62, 0.62, 0.4, 0xffffff, { y: 1.3 }, 'smooth', 12);
      ball(b, 0.62, 0xffffff, { y: 1.7, sy: 0.7 }, 'smooth', 1);
      block(b, 0.12, 0.12, 0.05, 0x1a1a1a, { x: -0.22, y: 0.8, z: 0.66 });
      block(b, 0.12, 0.12, 0.05, 0x1a1a1a, { x: 0.22, y: 0.8, z: 0.66 });
      block(b, 0.5, 0.18, 0.08, 0x5a3a1a, { y: 0.5, z: 0.66 });
      return;
    case 'recipes': // a red cookbook with a chef hat
      block(b, 1.8, 0.4, 1.4, 0xd8302a, { y: 0.2, ry: 0.3 });
      block(b, 1.7, 0.3, 1.3, 0xffffff, { y: 0.22, x: 0.06, ry: 0.3 });
      cylinder(b, 0.36, 0.36, 0.25, 0xffffff, { y: 0.55 }, 'smooth', 10);
      ball(b, 0.38, 0xffffff, { y: 0.9, sy: 0.75 }, 'smooth', 0);
      return;
    case 'customers': // three heads
      for (const [x, z, c, hair] of [[-0.7, 0, 0xd8443a, 0x6a3a1a], [0.7, 0, 0xe8302a, 0x1a1a1a], [0, 0.4, 0x2f8ad8, 0xd89a3a]] as const) {
        block(b, 0.8, 0.7, 0.5, c, { x, y: 0.35, z });
        ball(b, 0.38, 0xf2c8a0, { x, y: 1.05, z }, 'smooth', 0);
        dome(b, 0.4, hair, { x, y: 1.12, z });
      }
      return;
    case 'rank': // a red and gold badge
      cylinder(b, 1, 1, 0.3, 0xffd23a, { rx: Math.PI / 2, y: 1 }, 'smooth', 8);
      cylinder(b, 0.75, 0.75, 0.34, 0xd8302a, { rx: Math.PI / 2, y: 1 }, 'smooth', 8);
      ball(b, 0.3, 0xffffff, { y: 1, z: 0.12 }, 'smooth', 0);
      return;
    case 'milestones':
    case 'leaderboard': // a trophy
      cylinder(b, 0.7, 0.4, 0.9, 0xffc21a, { y: 1.3 }, 'smooth', 12);
      cylinder(b, 0.12, 0.12, 0.5, 0xffc21a, { y: 0.65 }, 'smooth', 8);
      block(b, 0.9, 0.3, 0.6, 0x8a5a2a, { y: 0.25 });
      for (const x of [-0.75, 0.75]) cylinder(b, 0.18, 0.18, 0.08, 0xffc21a, { x, y: 1.4, rx: Math.PI / 2 }, 'smooth', 8);
      return;
    case 'service': // a silver cloche bell
      dome(b, 0.9, 0xc8ccd4, { y: 0.2 });
      ball(b, 0.15, 0xe8e8ee, { y: 1.15 }, 'smooth', 0);
      cylinder(b, 1.05, 1.05, 0.12, 0x8a8e98, { y: 0.15 }, 'smooth', 16);
      return;
    case 'cooking': // a frying pan with a flame
      cylinder(b, 0.9, 0.75, 0.3, 0x3a3a40, { y: 0.4 }, 'smooth', 14);
      block(b, 1.4, 0.15, 0.25, 0x2a2a2e, { x: 1.4, y: 0.5, rz: 0.2 });
      cone(b, 0.5, 0.9, 0xff7a1a, { y: -0.2, rx: Math.PI }, 'glow', 8);
      return;
    case 'cleaning': // a sponge and bubbles
      block(b, 1.6, 0.6, 1, 0xffd23a, { y: 0.3 });
      block(b, 1.6, 0.25, 1, 0x5ad84a, { y: 0.72 });
      for (let i = 0; i < 4; i += 1) ball(b, 0.2 + i * 0.05, 0xcff0ff, { x: -0.6 + i * 0.45, y: 1.1 + (i % 2) * 0.3, z: 0.2 }, 'smooth', 0);
      return;
    case 'farming': // a sprout in soil
      cylinder(b, 0.9, 1, 0.4, 0x6a4024, { y: 0.2 }, 'smooth', 12);
      block(b, 0.1, 0.8, 0.1, 0x3f9a3a, { y: 0.8 });
      ball(b, 0.35, 0x5ad84a, { x: -0.3, y: 1.15, sy: 0.6 }, 'smooth', 0);
      ball(b, 0.35, 0x6ae05a, { x: 0.3, y: 1.25, sy: 0.6 }, 'smooth', 0);
      return;
    case 'ranching': // a hen
      ball(b, 0.7, 0xffffff, { y: 0.7, sx: 1.2 }, 'smooth', 1);
      ball(b, 0.4, 0xffffff, { y: 1.35, z: 0.5 }, 'smooth', 0);
      cone(b, 0.12, 0.3, 0xffa020, { y: 1.3, z: 0.95, rx: Math.PI / 2 }, 'smooth', 4);
      block(b, 0.14, 0.3, 0.3, 0xe8302a, { y: 1.75, z: 0.5 });
      return;
    case 'cash': // a stack of green bills
      for (let i = 0; i < 3; i += 1) block(b, 1.8, 0.16, 0.9, i % 2 ? 0x5ad86a : 0x4ac85a, { y: 0.08 + i * 0.17, ry: i * 0.12 });
      block(b, 0.4, 0.5, 0.92, 0xffd23a, { y: 0.3 });
      return;
    case 'diamond': // a blue gem
      cone(b, 0.9, 0.5, 0x6ad8ff, { y: 1 }, 'smooth', 6);
      cone(b, 0.9, 1.1, 0x3ab0f0, { y: 0.2, rx: Math.PI }, 'smooth', 6);
      return;
    case 'boost': // a lightning bolt
      block(b, 0.5, 1.2, 0.3, 0xffd23a, { x: 0.15, y: 1.3, rz: -0.4 });
      block(b, 0.5, 1.2, 0.3, 0xffd23a, { x: -0.15, y: 0.5, rz: -0.4 });
      block(b, 0.8, 0.3, 0.3, 0xffd23a, { y: 0.9 });
      return;
    case 'fishing': // a rod with a fish on the line
      cylinder(b, 0.05, 0.09, 2.6, 0x9a6a3a, { x: -0.4, y: 1.2, rz: 0.5 }, 'smooth', 6);
      block(b, 0.02, 1.1, 0.02, 0xffffff, { x: 0.25, y: 1.6 });
      ball(b, 0.3, 0x4a8ab8, { x: 0.25, y: 0.9, sx: 0.7, sy: 1.6 }, 'smooth', 1);
      block(b, 0.04, 0.35, 0.3, 0x2f6a98, { x: 0.25, y: 0.35 });
      return;
    case 'pets': // a paw print
      ball(b, 0.55, 0x8a5a3a, { y: 0.6, sy: 0.4, sz: 0.8 }, 'smooth', 1);
      for (let i = 0; i < 4; i += 1) ball(b, 0.2, 0x8a5a3a, { x: -0.6 + i * 0.4, y: 0.6, z: 0.75 + Math.abs(i - 1.5) * -0.15, sy: 0.4 }, 'smooth', 0);
      return;
    case 'arrow':
      block(b, 1.2, 0.4, 0.2, 0xffffff, { x: -0.3 });
      cone(b, 0.5, 0.7, 0xffffff, { x: 0.55, rz: -Math.PI / 2 }, 'smooth', 3);
      return;
  }
};
