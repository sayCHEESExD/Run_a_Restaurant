import type { PartBuilder, Transform } from '../render/PartBuilder.js';
import { ball, block, cone, cylinder, dome, shade } from './shapes.js';

/**
 * FOOD, block by block: every dish on the menu (served on a plate, carried
 * in a hand, drawn as the recipe book's icon) and every ingredient. Built
 * round the origin at plate level, about one unit across.
 */

const plate = (b: PartBuilder, color = 0xffffff, r = 0.62, t: Transform = {}): void => {
  cylinder(b, r, r * 0.8, 0.08, color, { ...t, y: (t.y ?? 0) + 0.04 }, 'smooth', 16);
  cylinder(b, r * 0.72, r * 0.72, 0.02, shade(color, 0.93), { ...t, y: (t.y ?? 0) + 0.085 }, 'smooth', 16);
};

const bowl = (b: PartBuilder, color: number, fill: number, r = 0.42): void => {
  cylinder(b, r, r * 0.62, 0.36, color, { y: 0.26 }, 'smooth', 14);
  cylinder(b, r * 0.88, r * 0.88, 0.04, fill, { y: 0.42 }, 'smooth', 14);
};

/** A dish by recipe id, on its plate. */
export const buildDish = (b: PartBuilder, recipe: number, onPlate = true): void => {
  const y = onPlate ? 0.1 : 0;
  const lift = (t: Transform): Transform => ({ ...t, y: (t.y ?? 0) + y });
  switch (recipe) {
    case 1: // Rice: a red bowl, chopsticks
      cylinder(b, 0.42, 0.26, 0.36, 0xc8302a, lift({ y: 0.2 }), 'smooth', 14);
      dome(b, 0.38, 0xfaf8f2, lift({ y: 0.36, sy: 0.6 }));
      block(b, 0.04, 0.04, 0.8, 0x8a5a2a, lift({ x: 0.18, y: 0.52, z: 0.1, rx: -0.7, ry: 0.3 }));
      block(b, 0.04, 0.04, 0.8, 0x8a5a2a, lift({ x: 0.26, y: 0.52, z: 0.06, rx: -0.7, ry: 0.3 }));
      if (!onPlate) return;
      break;
    case 2: // Bread
      ball(b, 0.38, 0xd89a4a, lift({ y: 0.22, sx: 1.3, sy: 0.7 }), 'smooth', 1);
      for (let i = -1; i <= 1; i += 1) block(b, 0.06, 0.04, 0.3, 0xf2d29a, lift({ x: i * 0.2, y: 0.46, rz: 0.3 }));
      break;
    case 3: // Tomato soup
      bowl(b, 0xffffff, 0xd8402e);
      ball(b, 0.06, 0xf6f0e4, lift({ y: 0.42, x: 0.1 }), 'smooth', 0);
      ball(b, 0.05, 0x5ab84a, lift({ y: 0.42, x: -0.12, z: 0.08 }), 'smooth', 0);
      break;
    case 4: // Baked potato
      ball(b, 0.34, 0xb8854a, lift({ y: 0.24, sx: 1.25, sy: 0.75 }), 'smooth', 1);
      block(b, 0.3, 0.12, 0.2, 0xfff2b0, lift({ y: 0.44 }));
      ball(b, 0.05, 0x5ab84a, lift({ y: 0.5, x: 0.05 }), 'smooth', 0);
      break;
    case 5: // Garden salad
      bowl(b, 0xf2f2f2, 0x6ad04a);
      for (let i = 0; i < 5; i += 1) ball(b, 0.1, i % 2 ? 0xe8402e : 0x8ae05a, lift({ x: Math.cos(i * 1.3) * 0.2, y: 0.46, z: Math.sin(i * 1.3) * 0.2 }), 'smooth', 0);
      break;
    case 6: // Corn on the cob
      cylinder(b, 0.15, 0.15, 0.9, 0xf8d838, lift({ y: 0.18, rz: Math.PI / 2 }), 'smooth', 8);
      block(b, 0.2, 0.1, 0.1, 0xfff2b0, lift({ y: 0.34 }));
      break;
    case 7: // Roasted carrots
      for (let i = -1; i <= 1; i += 1) cone(b, 0.1, 0.6, 0xf27a1e, lift({ x: i * 0.2, y: 0.14, rz: Math.PI / 2, rx: i * 0.2 }), 'smooth', 6);
      ball(b, 0.05, 0x5ab84a, lift({ x: 0.3, y: 0.18 }), 'smooth', 0);
      break;
    case 8: // Fries in a red box
      block(b, 0.46, 0.4, 0.3, 0xd8302a, lift({ y: 0.22 }));
      for (let i = 0; i < 7; i += 1) block(b, 0.06, 0.4, 0.06, 0xf8c838, lift({ x: -0.16 + i * 0.055, y: 0.52 + (i % 3) * 0.04, z: (i % 2) * 0.06 - 0.03, rz: (i - 3) * 0.05 }));
      break;
    case 9: // Bruschetta
      for (const x of [-0.22, 0.22]) {
        block(b, 0.38, 0.1, 0.24, 0xd8a050, lift({ x, y: 0.08 }));
        for (let i = 0; i < 3; i += 1) block(b, 0.09, 0.08, 0.09, 0xe8402e, lift({ x: x - 0.1 + i * 0.1, y: 0.17 }));
      }
      break;
    case 10: // Fried egg
      cylinder(b, 0.38, 0.38, 0.05, 0xffffff, lift({ y: 0.04 }), 'smooth', 14);
      dome(b, 0.14, 0xffc81e, lift({ y: 0.06 }));
      break;
    case 11: // Pancakes
      for (let i = 0; i < 4; i += 1) cylinder(b, 0.36, 0.36, 0.09, 0xe0a050, lift({ y: 0.05 + i * 0.1 }), 'smooth', 14);
      block(b, 0.18, 0.06, 0.18, 0xfff2b0, lift({ y: 0.46 }));
      cylinder(b, 0.3, 0.3, 0.02, 0x8a4a1a, lift({ y: 0.43 }), 'smooth', 12);
      break;
    case 12: // Mac & cheese
      bowl(b, 0x5a8ad8, 0xffc838);
      for (let i = 0; i < 6; i += 1) block(b, 0.08, 0.06, 0.08, 0xffd84a, lift({ x: Math.cos(i) * 0.18, y: 0.45, z: Math.sin(i) * 0.18, ry: i }));
      break;
    case 13: // Bacon & eggs
      cylinder(b, 0.2, 0.2, 0.04, 0xffffff, lift({ x: -0.18, y: 0.04 }), 'smooth', 12);
      dome(b, 0.08, 0xffc81e, lift({ x: -0.18, y: 0.06 }));
      for (const z of [-0.12, 0.12]) block(b, 0.5, 0.04, 0.12, 0xc84a3a, lift({ x: 0.2, y: 0.05, z, rx: 0.1 }));
      break;
    case 14: // Pizza
      cylinder(b, 0.55, 0.55, 0.08, 0xe0a050, lift({ y: 0.05 }), 'smooth', 16);
      cylinder(b, 0.48, 0.48, 0.04, 0xffd84a, lift({ y: 0.1 }), 'smooth', 16);
      for (let i = 0; i < 6; i += 1) cylinder(b, 0.08, 0.08, 0.03, 0xc8302a, lift({ x: Math.cos(i * 1.05) * 0.28, y: 0.13, z: Math.sin(i * 1.05) * 0.28 }), 'smooth', 8);
      break;
    case 15: // Deluxe burger
      dome(b, 0.34, 0xe0a050, lift({ y: 0.42 }));
      cylinder(b, 0.36, 0.36, 0.06, 0x6ad04a, lift({ y: 0.4 }), 'smooth', 12);
      cylinder(b, 0.34, 0.34, 0.06, 0xe8402e, lift({ y: 0.34 }), 'smooth', 12);
      cylinder(b, 0.35, 0.35, 0.05, 0xffc838, lift({ y: 0.28 }), 'smooth', 4);
      cylinder(b, 0.34, 0.34, 0.12, 0x6a3a1a, lift({ y: 0.2 }), 'smooth', 12);
      cylinder(b, 0.34, 0.32, 0.12, 0xe0a050, lift({ y: 0.08 }), 'smooth', 12);
      break;
    case 16: // Chef's feast
      dome(b, 0.32, 0xc8783a, lift({ y: 0.06, sx: 1.3 }));
      for (let i = 0; i < 6; i += 1) ball(b, 0.1, [0x6ad04a, 0xf27a1e, 0xf8d838, 0xe8402e][i % 4]!, lift({ x: Math.cos(i) * 0.48, y: 0.1, z: Math.sin(i) * 0.48 }), 'smooth', 0);
      block(b, 0.06, 0.4, 0.06, 0xffffff, lift({ x: 0.3, y: 0.3, rz: -0.5 }));
      break;
    default:
      ball(b, 0.3, 0xc8a070, lift({ y: 0.2 }));
  }
  if (onPlate) plate(b, recipe === 16 ? 0xffd23a : 0xffffff, recipe === 16 ? 0.72 : 0.62);
};

/** An ingredient by id. */
export const buildIngredient = (b: PartBuilder, id: number): void => {
  switch (id) {
    case 1: // Wheat bundle
      for (let i = 0; i < 5; i += 1) {
        const x = (i - 2) * 0.08;
        block(b, 0.04, 0.9, 0.04, 0xd8b04a, { x, y: 0.45, rz: (i - 2) * 0.08 });
        ball(b, 0.08, 0xf0c850, { x: x * 1.6, y: 0.95, sy: 2 }, 'smooth', 0);
      }
      block(b, 0.3, 0.08, 0.14, 0x8a5a2a, { y: 0.4 });
      break;
    case 2: // Tomato
      ball(b, 0.32, 0xe8402e, { y: 0.32, sy: 0.85 }, 'smooth', 1);
      block(b, 0.2, 0.05, 0.05, 0x3f8f3a, { y: 0.6 });
      block(b, 0.05, 0.05, 0.2, 0x3f8f3a, { y: 0.6 });
      break;
    case 3: // Potato
      ball(b, 0.32, 0xc8955a, { y: 0.26, sx: 1.25, sy: 0.8 }, 'smooth', 1);
      for (const [x, z] of [[0.15, 0.18], [-0.2, 0.12]] as const) ball(b, 0.03, 0x8a6a3a, { x, y: 0.4, z }, 'smooth', 0);
      break;
    case 4: // Lettuce
      for (let i = 0; i < 6; i += 1) ball(b, 0.22, i % 2 ? 0x6ad04a : 0x8ae05a, { x: Math.cos(i) * 0.14, y: 0.28, z: Math.sin(i) * 0.14, sy: 0.8 }, 'smooth', 0);
      ball(b, 0.2, 0xb8f08a, { y: 0.4 }, 'smooth', 0);
      break;
    case 5: // Corn
      cylinder(b, 0.14, 0.12, 0.8, 0xf8d838, { y: 0.45 }, 'smooth', 8);
      for (const s of [-1, 1]) block(b, 0.16, 0.6, 0.05, 0x6ad04a, { x: s * 0.14, y: 0.35, rz: s * 0.3 });
      break;
    case 6: // Carrot
      cone(b, 0.13, 0.8, 0xf27a1e, { y: 0.4, rx: Math.PI }, 'smooth', 6);
      for (let i = -1; i <= 1; i += 1) block(b, 0.05, 0.3, 0.05, 0x5ab84a, { x: i * 0.06, y: 0.9, rz: i * 0.3 });
      break;
    case 7: // Egg
      ball(b, 0.24, 0xfaf4e4, { y: 0.3, sy: 1.3 }, 'smooth', 1);
      break;
    case 8: // Milk bottle
      cylinder(b, 0.2, 0.2, 0.6, 0xffffff, { y: 0.3 }, 'smooth', 10);
      cylinder(b, 0.1, 0.18, 0.2, 0xffffff, { y: 0.7 }, 'smooth', 10);
      cylinder(b, 0.11, 0.11, 0.08, 0x3a8ad8, { y: 0.82 }, 'smooth', 10);
      block(b, 0.3, 0.2, 0.02, 0x3a8ad8, { y: 0.35, z: 0.2 });
      break;
    case 9: // Bacon
      for (let i = 0; i < 3; i += 1) block(b, 0.7, 0.05, 0.14, i % 2 ? 0xf6c8b8 : 0xc84a3a, { y: 0.06, z: (i - 1) * 0.14, rx: 0.05 * i });
      break;
    default:
      ball(b, 0.3, 0xffffff, { y: 0.3 });
  }
};

/** A paper ticket (an order in hand). */
export const buildTicket = (b: PartBuilder): void => {
  block(b, 0.5, 0.7, 0.03, 0xfffbe8, { y: 0.35 });
  for (let i = 0; i < 4; i += 1) block(b, 0.34 - (i % 2) * 0.1, 0.04, 0.035, 0x6a6a6a, { y: 0.55 - i * 0.12 });
  block(b, 0.5, 0.06, 0.035, 0xd8443a, { y: 0.67 });
};

/** A dirty plate: smears and crumbs. */
export const buildDirtyDish = (b: PartBuilder): void => {
  plate(b, 0xe8e4dc);
  for (let i = 0; i < 4; i += 1) cylinder(b, 0.12 + (i % 2) * 0.05, 0.12, 0.02, [0x8a5a2a, 0xc8a070, 0x6a4a2a][i % 3]!, { x: Math.cos(i * 1.7) * 0.25, y: 0.1, z: Math.sin(i * 1.7) * 0.22 }, 'smooth', 7);
  block(b, 0.05, 0.03, 0.5, 0xc0c4cc, { x: 0.3, y: 0.12, ry: 0.4 });
};
