import { itemById } from '@restaurant/shared';
import { PartBuilder } from '../render/PartBuilder.js';
import { buildFish, buildRod, ROD_COLORS } from './pets.js';
import { ball, block, brick, cone, cylinder, dome, shade } from './shapes.js';

/**
 * EVERY PLACEABLE ITEM, block by block, round its footprint's middle at floor
 * level, its front facing -Z (the way a customer in a chair faces, the side a
 * cook stands at a stove). Sizes follow the catalog footprint in units.
 */

const WOOD = 0xb87a45;
const DARK = 0x5a3420;
const STEEL = 0xc8ccd4;
const CHROME = 0xe4e8ee;
const BLACK = 0x26262c;
const GOLD = 0xf2c23a;

// --------------------------------------------------------------- seating

const legs4 = (b: PartBuilder, hx: number, hz: number, h: number, t: number, color: number): void => {
  for (const x of [-hx, hx]) for (const z of [-hz, hz]) block(b, t, h, t, color, { x, y: h / 2, z });
};

const chair = (b: PartBuilder, seat: number, frame: number, back: number, opts: { back?: number; stool?: boolean; cushion?: number; crown?: boolean } = {}): void => {
  const seatY = 1.05;
  legs4(b, 0.55, 0.55, seatY, 0.16, frame);
  if (opts.stool) {
    cylinder(b, 0.75, 0.75, 0.22, seat, { y: seatY + 0.1 }, 'smooth', 14);
    block(b, 1.1, 0.08, 0.08, frame, { y: 0.45 });
    return;
  }
  block(b, 1.4, 0.2, 1.4, seat, { y: seatY + 0.1 });
  if (opts.cushion !== undefined) block(b, 1.25, 0.14, 1.25, opts.cushion, { y: seatY + 0.27 });
  const backH = opts.back ?? 1.3;
  for (const x of [-0.6, 0.6]) block(b, 0.16, backH, 0.16, frame, { x, y: seatY + 0.2 + backH / 2, z: 0.62 });
  block(b, 1.36, backH * 0.55, 0.14, back, { y: seatY + 0.2 + backH * 0.62, z: 0.63 });
  if (opts.cushion !== undefined) block(b, 1.2, backH * 0.5, 0.1, opts.cushion, { y: seatY + 0.2 + backH * 0.58, z: 0.54 });
  if (opts.crown) {
    for (const x of [-0.45, 0, 0.45]) cone(b, 0.12, 0.35, GOLD, { x, y: seatY + 0.35 + backH, z: 0.63 }, 'smooth', 4);
    ball(b, 0.1, 0xd8302a, { y: seatY + 0.3 + backH * 0.9, z: 0.55 }, 'glow', 0);
  }
};

const table = (b: PartBuilder, top: number, frame: number, kind: 'plain' | 'checker' | 'industrial' | 'glass' | 'royal' = 'plain'): void => {
  const h = 1.7;
  const s = 2.8;
  switch (kind) {
    case 'industrial':
      for (const x of [-1, 1]) {
        block(b, 0.14, h - 0.2, 0.14, BLACK, { x: x * 1.15, y: (h - 0.2) / 2, z: -1.15 });
        block(b, 0.14, h - 0.2, 0.14, BLACK, { x: x * 1.15, y: (h - 0.2) / 2, z: 1.15 });
        block(b, 0.14, 0.14, 2.4, BLACK, { x: x * 1.15, y: 0.3 });
      }
      brick(b, s, 0.22, s, top, { y: h - 0.11 });
      return;
    case 'glass':
      cylinder(b, 0.14, 0.2, h - 0.12, GOLD, { y: (h - 0.12) / 2 }, 'smooth', 10);
      cylinder(b, 0.9, 0.9, 0.12, GOLD, { y: 0.06 }, 'smooth', 14);
      block(b, s, 0.12, s, 0xb8e8ff, { y: h - 0.06 });
      block(b, s + 0.06, 0.06, s + 0.06, GOLD, { y: h - 0.14 });
      return;
    case 'royal':
      legs4(b, 1.15, 1.15, h - 0.25, 0.3, GOLD);
      block(b, s + 0.1, 0.18, s + 0.1, GOLD, { y: h - 0.3 });
      block(b, s, 0.2, s, 0xf4f0ea, { y: h - 0.1 });
      block(b, s * 0.5, 0.02, s, 0xc8302a, { y: h + 0.005 });
      return;
    default:
      legs4(b, 1.2, 1.2, h - 0.2, 0.2, frame);
      if (kind === 'checker') {
        for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) block(b, s / 4, 0.2, s / 4, (i + j) % 2 ? 0xffffff : 0xd8302a, { x: (i - 1.5) * (s / 4), y: h - 0.1, z: (j - 1.5) * (s / 4) });
        block(b, s + 0.08, 0.1, s + 0.08, CHROME, { y: h - 0.24 });
      } else brick(b, s, 0.22, s, top, { y: h - 0.11 });
  }
};

// ------------------------------------------------------------- appliances

const burner = (b: PartBuilder, x: number, z: number, y: number): void => {
  cylinder(b, 0.32, 0.32, 0.06, 0x1a1a1e, { x, y, z }, 'smooth', 12);
  cylinder(b, 0.2, 0.2, 0.07, 0x3a3a40, { x, y, z }, 'smooth', 12);
};

const stove = (b: PartBuilder, body: number, top: number, knob: number, burners: number, door: number): void => {
  const h = 2;
  brick(b, 2.9, h, 1.9, body, { y: h / 2 });
  block(b, 2.92, 0.12, 1.92, top, { y: h + 0.06 });
  const cols = burners >= 6 ? 3 : 2;
  for (let i = 0; i < cols; i += 1) for (const z of [-0.45, 0.45]) burner(b, (i - (cols - 1) / 2) * 0.9, z, h + 0.14);
  // The oven door with its window, and the knob row.
  block(b, 2.2, 1.05, 0.06, door, { y: 0.78, z: -0.96 });
  block(b, 1.5, 0.5, 0.07, 0x2a1a12, { y: 0.84, z: -0.97 });
  block(b, 1.3, 0.08, 0.12, CHROME, { y: 1.4, z: -1.02 });
  for (let i = 0; i < (cols === 3 ? 6 : 4); i += 1) cylinder(b, 0.09, 0.09, 0.1, knob, { x: -1.05 + i * (2.1 / ((cols === 3 ? 6 : 4) - 1)), y: 1.72, z: -0.97, rx: Math.PI / 2 }, 'smooth', 8);
  // The back splash.
  block(b, 2.9, 0.4, 0.14, shade(body, 0.85), { y: h + 0.2, z: 0.88 });
};

const fridge = (b: PartBuilder, w: number, d: number, h: number, body: number, handle: number, doors: number): void => {
  brick(b, w * 0.96, h, d * 0.92, body, { y: h / 2 });
  block(b, w * 0.96, 0.05, 0.04, shade(body, 0.75), { y: h * 0.62, z: -d * 0.46 - 0.02 });
  for (let i = 0; i < doors; i += 1) {
    const x = doors === 1 ? w * 0.32 : (i === 0 ? -0.12 : 0.12);
    block(b, 0.1, h * 0.25, 0.12, handle, { x, y: h * 0.8, z: -d * 0.46 - 0.06 });
    block(b, 0.1, h * 0.2, 0.12, handle, { x, y: h * 0.4, z: -d * 0.46 - 0.06 });
    if (doors > 1) block(b, 0.04, h * 0.95, 0.03, shade(body, 0.75), { y: h / 2, z: -d * 0.46 - 0.02 });
  }
};

const sink = (b: PartBuilder, body: number, top: number, basins: number, dishwasher = false): void => {
  const h = 1.9;
  if (dishwasher) {
    brick(b, 2.9, h, 1.9, body, { y: h / 2 });
    block(b, 2.6, 1.2, 0.06, shade(body, 0.92), { y: 0.8, z: -0.97 });
    block(b, 1.6, 0.12, 0.12, CHROME, { y: 1.5, z: -1 });
    block(b, 0.8, 0.22, 0.05, 0x4ad0ff, { x: 0.8, y: 1.72, z: -0.97 }, 'glow');
    block(b, 2.92, 0.1, 1.92, top, { y: h + 0.05 });
    return;
  }
  brick(b, 2.9, h - 0.2, 1.9, body, { y: (h - 0.2) / 2 });
  block(b, 2.92, 0.2, 1.92, top, { y: h - 0.1 });
  for (let i = 0; i < basins; i += 1) {
    const x = basins === 1 ? 0 : (i - 0.5) * 1.3;
    block(b, 1.1, 0.06, 1.2, 0x9ad8f0, { x, y: h - 0.02 });
    block(b, 1.2, 0.1, 0.08, CHROME, { x, y: h + 0.02, z: -0.62 });
  }
  cylinder(b, 0.07, 0.07, 0.8, CHROME, { y: h + 0.4, z: 0.65 }, 'smooth', 8);
  block(b, 0.1, 0.1, 0.6, CHROME, { y: h + 0.8, z: 0.4 });
  for (const x of [-0.3, 0.3]) block(b, 0.12, 0.1, 0.12, x < 0 ? 0x3a8ad8 : 0xd8443a, { x, y: h + 0.1, z: 0.65 });
};

const stand = (b: PartBuilder, deluxe: boolean): void => {
  const h = 1.8;
  const frame = deluxe ? CHROME : 0xf2c23a;
  const body = deluxe ? 0x2a2a30 : 0xffffff;
  brick(b, 3.9, h, 1.9, body, { y: h / 2 });
  block(b, 3.96, 0.14, 1.96, deluxe ? 0x8a8e98 : 0xb87a45, { y: h + 0.07 });
  // The pass: two posts and a rail the tickets hang from.
  for (const x of [-1.85, 1.85]) block(b, 0.16, 1.5, 0.16, frame, { x, y: h + 0.75 });
  block(b, 3.86, 0.16, 0.2, frame, { y: h + 1.5 });
  block(b, 3.6, 0.06, 0.06, 0x3a3a3a, { y: h + 1.32, z: -0.1 });
  if (deluxe) {
    for (const x of [-1.2, 0, 1.2]) {
      cone(b, 0.32, 0.3, 0xd8443a, { x, y: h + 1.32 }, 'smooth', 10);
      ball(b, 0.14, 0xffa040, { x, y: h + 1.2 }, 'glow', 0);
    }
  }
  // A yellow trim frame along the front.
  block(b, 3.96, 0.14, 0.08, frame, { y: h - 0.1, z: -0.98 });
};

const register = (b: PartBuilder, body: number, machine: number, accent: number): void => {
  legs4(b, 0.75, 0.6, 1.3, 0.16, 0xd8dce4);
  block(b, 1.8, 0.16, 1.5, 0xe4e8ee, { y: 1.35 });
  block(b, 1.2, 0.5, 0.9, machine, { y: 1.68 });
  block(b, 0.9, 0.12, 0.5, shade(machine, 1.4), { y: 1.95, z: -0.1, rx: -0.3 });
  block(b, 0.7, 0.3, 0.06, accent, { y: 2.18, z: 0.3, rx: 0.2 }, 'glow');
  block(b, 1.1, 0.14, 0.5, body, { y: 1.5, z: -0.5 });
};

// ------------------------------------------------------------------ decor

const pot = (b: PartBuilder, r: number, h: number, color = 0xc8683e): void => {
  cylinder(b, r, r * 0.75, h, color, { y: h / 2 }, 'smooth', 10);
  cylinder(b, r * 0.9, r * 0.9, 0.06, 0x5a3a22, { y: h - 0.02 }, 'smooth', 10);
};

const leafBall = (b: PartBuilder, x: number, y: number, z: number, r: number, color = 0x4cb83a): void => {
  ball(b, r, color, { x, y, z }, 'flat', 0);
};

// ------------------------------------------------------------------- yard

const fenceRing = (b: PartBuilder, hx: number, hz: number, color = 0xf2ece0, gate = true): void => {
  const h = 1.1;
  const rail = (x: number, z: number, w: number, d: number): void => {
    block(b, w, 0.14, d, color, { x, y: h * 0.75, z });
    block(b, w, 0.14, d, color, { x, y: h * 0.35, z });
  };
  rail(0, hz, hx * 2, 0.12);
  rail(-hx, 0, 0.12, hz * 2);
  rail(hx, 0, 0.12, hz * 2);
  if (gate) {
    rail(-hx * 0.6, -hz, hx * 0.8, 0.12);
    rail(hx * 0.6, -hz, hx * 0.8, 0.12);
  } else rail(0, -hz, hx * 2, 0.12);
  for (const x of [-hx, hx]) for (const z of [-hz, hz]) block(b, 0.22, h + 0.2, 0.22, color, { x, y: (h + 0.2) / 2, z });
};

export const buildChicken = (b: PartBuilder): void => {
  ball(b, 0.38, 0xffffff, { y: 0.45, sx: 1.2 }, 'smooth', 1);
  ball(b, 0.22, 0xffffff, { y: 0.82, z: -0.3 }, 'smooth', 0);
  cone(b, 0.07, 0.16, 0xffa020, { y: 0.8, z: -0.52, rx: -Math.PI / 2 }, 'smooth', 4);
  block(b, 0.08, 0.16, 0.18, 0xe8302a, { y: 1.02, z: -0.3 });
  block(b, 0.22, 0.25, 0.3, 0xf2f2f2, { y: 0.55, z: 0.36, rx: 0.5 });
  for (const x of [-0.12, 0.12]) block(b, 0.05, 0.2, 0.05, 0xffa020, { x, y: 0.1 });
};

export const buildCow = (b: PartBuilder): void => {
  block(b, 1.1, 0.9, 1.9, 0xffffff, { y: 1.15 });
  block(b, 0.5, 0.4, 0.6, 0x1a1a1a, { x: 0.3, y: 1.4, z: 0.3 });
  block(b, 0.45, 0.35, 0.5, 0x1a1a1a, { x: -0.32, y: 1.2, z: -0.4 });
  block(b, 0.7, 0.7, 0.7, 0xffffff, { y: 1.55, z: -1.15 });
  block(b, 0.6, 0.35, 0.2, 0xf6b0b8, { y: 1.35, z: -1.55 });
  for (const x of [-0.25, 0.25]) block(b, 0.1, 0.22, 0.1, 0xe8e0c8, { x, y: 2.0, z: -1.15 });
  for (const x of [-0.38, 0.38]) for (const z of [-0.65, 0.65]) block(b, 0.22, 0.75, 0.22, 0xf2f2f2, { x, y: 0.38, z });
  block(b, 0.4, 0.2, 0.3, 0xf6b0b8, { y: 0.66, z: 0.4 });
};

export const buildPig = (b: PartBuilder): void => {
  block(b, 1, 0.8, 1.5, 0xf6a8b8, { y: 0.75 });
  block(b, 0.7, 0.65, 0.5, 0xf6a8b8, { y: 0.95, z: -0.95 });
  block(b, 0.4, 0.3, 0.15, 0xe88aa0, { y: 0.88, z: -1.25 });
  for (const x of [-0.08, 0.08]) block(b, 0.06, 0.08, 0.05, 0x8a4a5a, { x, y: 0.9, z: -1.33 });
  for (const x of [-0.25, 0.25]) block(b, 0.18, 0.2, 0.08, 0xe88aa0, { x, y: 1.35, z: -0.85, rx: -0.3 });
  for (const x of [-0.32, 0.32]) for (const z of [-0.5, 0.5]) block(b, 0.2, 0.4, 0.2, 0xe88aa0, { x, y: 0.2, z });
  block(b, 0.08, 0.08, 0.25, 0xe88aa0, { y: 1, z: 0.8, rx: 0.8 });
};

/** A crop at a growth stage (0 seedling .. 1 ripe), in a 4x4 soil bed. */
export const buildCrop = (b: PartBuilder, ingredient: number, growth: number): void => {
  const g = Math.max(0, Math.min(1, growth));
  const ripe = g >= 1;
  const rows = [-1.1, 0, 1.1];
  for (const x of rows) {
    for (const z of rows) {
      const k = 0.25 + 0.75 * g;
      switch (ingredient) {
        case 1: // wheat
          for (let i = 0; i < 3; i += 1) block(b, 0.07, 1.4 * k, 0.07, ripe ? 0xe0b84a : 0x8ad05a, { x: x + (i - 1) * 0.16, y: 0.5 + 0.7 * k, z: z + ((i * 7) % 3 - 1) * 0.12, rz: (i - 1) * 0.12 });
          if (g > 0.5) ball(b, 0.12, ripe ? 0xf0c850 : 0xc8e07a, { x, y: 0.5 + 1.4 * k, z, sy: 2 }, 'smooth', 0);
          break;
        case 2: // tomato
          leafBall(b, x, 0.5 + 0.45 * k, z, 0.42 * k + 0.08, 0x3f9a3a);
          if (g > 0.6) for (let i = 0; i < 3; i += 1) ball(b, 0.14, ripe ? 0xe8402e : 0x9ad04a, { x: x + Math.cos(i * 2.1) * 0.3 * k, y: 0.55 + 0.4 * k, z: z + Math.sin(i * 2.1) * 0.3 * k }, 'smooth', 0);
          break;
        case 3: // potato
          leafBall(b, x, 0.5 + 0.25 * k, z, 0.38 * k + 0.08, 0x5ab84a);
          if (ripe) ball(b, 0.16, 0xc8955a, { x: x + 0.25, y: 0.52, z: z - 0.2, sx: 1.3 }, 'smooth', 0);
          break;
        case 4: // lettuce
          for (let i = 0; i < 4; i += 1) ball(b, 0.22 * k + 0.06, i % 2 ? 0x6ad04a : 0x8ae05a, { x: x + Math.cos(i * 1.6) * 0.15 * k, y: 0.55 + 0.1 * k, z: z + Math.sin(i * 1.6) * 0.15 * k, sy: 0.8 }, 'smooth', 0);
          break;
        case 5: // corn
          block(b, 0.12, 2.2 * k, 0.12, 0x5ab84a, { x, y: 0.5 + 1.1 * k, z });
          for (const s of [-1, 1]) block(b, 0.35 * k, 0.08, 0.1, 0x6ad04a, { x: x + s * 0.18 * k, y: 0.5 + 1.3 * k, z, rz: s * 0.5 });
          if (g > 0.6) cylinder(b, 0.11, 0.1, 0.5, ripe ? 0xf8d838 : 0xc8e07a, { x: x + 0.14, y: 0.5 + 1.2 * k, z }, 'smooth', 6);
          break;
        case 6: // carrot
          for (let i = -1; i <= 1; i += 1) block(b, 0.06, 0.55 * k + 0.1, 0.06, 0x5ab84a, { x: x + i * 0.08, y: 0.55 + 0.3 * k, z, rz: i * 0.35 });
          if (g > 0.5) cylinder(b, 0.13, 0.08, 0.16, 0xf27a1e, { x, y: 0.55, z }, 'smooth', 6);
          break;
      }
    }
  }
};

/** The bed under a crop: tilled soil in a wooden frame. */
const soilBed = (b: PartBuilder): void => {
  block(b, 3.9, 0.36, 3.9, 0x6a4024, { y: 0.18 });
  for (let i = -1; i <= 1; i += 1) block(b, 3.6, 0.1, 0.5, 0x5a3420, { y: 0.4, z: i * 1.1 });
  for (const s of [-1, 1]) {
    block(b, 4, 0.5, 0.18, 0x9a6a3a, { y: 0.25, z: s * 1.95 });
    block(b, 0.18, 0.5, 4, 0x9a6a3a, { x: s * 1.95, y: 0.25 });
  }
};

// ------------------------------------------------------------------ build

/**
 * Build an item by catalog id. Crops build only their bed (the plants are
 * drawn separately as they grow); pens build their fence and house (the
 * animals are drawn separately so they can move).
 */
export const buildItem = (b: PartBuilder, kind: number): void => {
  const def = itemById(kind);
  if (!def) return;
  switch (def.key) {
    case 'wooden_chair':
      return chair(b, WOOD, shade(WOOD, 0.85), WOOD);
    case 'wooden_stool':
      return chair(b, WOOD, shade(WOOD, 0.85), WOOD, { stool: true });
    case 'dark_chair':
      return chair(b, DARK, shade(DARK, 0.85), DARK, { back: 1.6 });
    case 'diner_chair':
      return chair(b, 0xd8302a, CHROME, 0xd8302a, { cushion: 0xe8443a });
    case 'modern_chair':
      return chair(b, 0xf6f6f6, BLACK, 0xf6f6f6, { back: 1.2 });
    case 'velvet_chair':
      return chair(b, 0x6a2a9a, GOLD, 0x6a2a9a, { cushion: 0x8a3ac8, back: 1.5 });
    case 'royal_chair':
      return chair(b, GOLD, GOLD, GOLD, { cushion: 0xc8202a, back: 2, crown: true });
    case 'wooden_table':
      return table(b, WOOD, shade(WOOD, 0.85));
    case 'dark_table':
      return table(b, DARK, shade(DARK, 0.85));
    case 'diner_table':
      return table(b, 0xffffff, CHROME, 'checker');
    case 'industrial_table':
      return table(b, 0xc8955a, BLACK, 'industrial');
    case 'glass_table':
      return table(b, 0xb8e8ff, GOLD, 'glass');
    case 'royal_table':
      return table(b, 0xffffff, GOLD, 'royal');
    case 'wooden_counter':
      brick(b, 1.96, 1.65, 1.96, 0xf6f2ea, { y: 0.825 });
      block(b, 1.8, 1.3, 0.04, 0xe8e2d6, { y: 0.8, z: -0.99 });
      return brick(b, 2, 0.2, 2, WOOD, { y: 1.75 });
    case 'marble_counter':
      brick(b, 1.96, 1.65, 1.96, 0x2a2a34, { y: 0.825 });
      return brick(b, 2, 0.2, 2, 0xf0eee8, { y: 1.75 });
    case 'rusty_stove':
      return stove(b, 0xb8683a, 0x3a3a3a, 0x2a2a2a, 4, 0x8a4a2a);
    case 'retro_stove':
      return stove(b, 0x6ad8a0, 0x2a2a2e, 0x1a1a1a, 4, 0x5ac890);
    case 'steel_stove':
      return stove(b, STEEL, 0x2a2a2e, 0x1a1a1a, 6, 0xb8bcc4);
    case 'pro_stove':
      return stove(b, 0x2a2a30, 0x1a1a1e, 0xd8302a, 6, 0x3a3a40);
    case 'golden_stove':
      return stove(b, GOLD, 0x2a2a2e, 0xffffff, 6, 0xe0b030);
    case 'mini_fridge':
      return fridge(b, 2, 2, 2.4, 0x6ad8a0, 0xe8e8e8, 1);
    case 'fridge':
      return fridge(b, 2, 2, 4, 0x6ad8a0, 0xe8e8e8, 1);
    case 'double_fridge':
      return fridge(b, 3, 2, 4, STEEL, 0x8a8e98, 2);
    case 'freezer':
      fridge(b, 4, 3, 4.4, 0xe8eef6, 0x8a8e98, 1);
      return block(b, 1.6, 0.4, 0.05, 0x4ad0ff, { y: 3.9, z: -1.42 }, 'glow');
    case 'basic_sink':
      return sink(b, 0xd8dce4, 0xeef0f4, 1);
    case 'double_sink':
      return sink(b, 0xf2f2f2, CHROME, 2);
    case 'dishwasher':
      return sink(b, 0xf6f6f6, 0x8a8e98, 0, true);
    case 'order_stand':
      return stand(b, false);
    case 'deluxe_stand':
      return stand(b, true);
    case 'register':
      return register(b, 0x3a3a3a, 0x2a2a30, 0x5af0a0);
    case 'modern_register':
      return register(b, 0xf2f2f2, 0xe8e8ee, 0x4ad0ff);
    case 'gold_register':
      return register(b, GOLD, GOLD, 0xffffff);
    case 'potted_plant':
      pot(b, 0.4, 0.7);
      leafBall(b, 0, 1.15, 0, 0.5);
      leafBall(b, 0.2, 1.45, 0.1, 0.32, 0x5ac84a);
      return;
    case 'tall_fern':
      pot(b, 0.7, 1.1, 0xd87a4a);
      for (let i = 0; i < 7; i += 1) block(b, 0.2, 1.8, 0.06, i % 2 ? 0x4cb83a : 0x5ac84a, { x: Math.cos(i) * 0.25, y: 2, z: Math.sin(i) * 0.25, rx: Math.sin(i) * 0.45, rz: Math.cos(i) * 0.45 }, 'leaf');
      return;
    case 'floor_lamp':
      cylinder(b, 0.35, 0.4, 0.12, BLACK, { y: 0.06 }, 'smooth', 10);
      cylinder(b, 0.05, 0.05, 3.2, BLACK, { y: 1.7 }, 'smooth', 6);
      cylinder(b, 0.3, 0.5, 0.6, 0xfff0c8, { y: 3.5 }, 'glow', 12);
      return;
    case 'red_rug':
      block(b, 4.9, 0.06, 3.9, 0xc8302a, { y: 0.03 });
      block(b, 4.3, 0.065, 3.3, 0xe8a03a, { y: 0.035 });
      return block(b, 3.9, 0.07, 2.9, 0xb82a2a, { y: 0.04 });
    case 'painting':
      for (const x of [-0.6, 0.6]) block(b, 0.1, 3, 0.1, DARK, { x, y: 1.5, z: 0.2, rx: -0.12 });
      block(b, 1.8, 1.4, 0.12, GOLD, { y: 2.3, z: 0.1, rx: -0.12 });
      block(b, 1.5, 1.1, 0.13, 0x6ac8f0, { y: 2.3, z: 0.08, rx: -0.12 });
      block(b, 1.5, 0.45, 0.14, 0x5ab84a, { y: 1.98, z: 0.04, rx: -0.12 });
      return ball(b, 0.16, 0xffe066, { x: 0.4, y: 2.6, z: 0.01 }, 'glow', 0);
    case 'bookshelf':
      brick(b, 2.9, 3.9, 0.9, DARK, { y: 1.95 });
      for (let s = 0; s < 4; s += 1) for (let i = 0; i < 9; i += 1) block(b, 0.22, 0.7, 0.6, [0xd8443a, 0x3a6ac8, 0x5ab84a, 0xffd23a, 0x8a4ab8][(i + s) % 5]!, { x: -1.15 + i * 0.29, y: 0.55 + s * 0.95, z: -0.2 });
      return;
    case 'jukebox':
      brick(b, 1.8, 2.4, 1.6, 0xd8302a, { y: 1.2 });
      dome(b, 0.9, 0xffd23a, { y: 2.4, sz: 0.9 });
      block(b, 1.3, 1, 0.06, 0x4ad0ff, { y: 1.6, z: -0.82 }, 'glow');
      for (let i = 0; i < 3; i += 1) block(b, 0.2, 1.8, 0.06, [0xff5ad8, 0xffd23a, 0x5af0a0][i]!, { x: -0.6 + i * 0.6, y: 1.1, z: -0.83 }, 'glow');
      return;
    case 'aquarium':
      block(b, 2.9, 1, 1.9, BLACK, { y: 0.5 });
      block(b, 2.8, 1.8, 1.8, 0x5ac8f0, { y: 1.9 });
      block(b, 2.9, 0.12, 1.9, BLACK, { y: 2.86 });
      for (let i = 0; i < 4; i += 1) block(b, 0.3, 0.18, 0.08, [0xff8a2a, 0xffd23a, 0xff5a8a, 0x5af0a0][i]!, { x: -0.9 + i * 0.6, y: 1.5 + (i % 2) * 0.6, z: -0.6 + i * 0.3 }, 'glow');
      for (let i = 0; i < 3; i += 1) block(b, 0.08, 0.6 + i * 0.2, 0.08, 0x3fae4a, { x: 0.9 - i * 0.3, y: 1.3 + i * 0.1, z: 0.5 });
      return;
    case 'piano':
      block(b, 3.6, 0.9, 2.4, BLACK, { y: 1.55, z: 0.2 });
      block(b, 3.4, 0.8, 0.3, BLACK, { y: 2.2, z: 1.3, rx: -0.6 });
      block(b, 3.2, 0.1, 0.5, 0xffffff, { y: 1.2, z: -1.1 });
      for (let i = 0; i < 9; i += 1) block(b, 0.12, 0.08, 0.3, BLACK, { x: -1.4 + i * 0.35, y: 1.27, z: -1.0 });
      for (const [x, z] of [[-1.5, -0.8], [1.5, -0.8], [0, 1.2]] as const) block(b, 0.2, 1.1, 0.2, BLACK, { x, y: 0.55, z });
      return;
    case 'chef_statue':
      brick(b, 1.9, 0.8, 1.9, 0xe8e2d6, { y: 0.4 });
      block(b, 1, 1.4, 0.7, GOLD, { y: 1.6 });
      block(b, 0.8, 0.8, 0.8, GOLD, { y: 2.7 });
      cylinder(b, 0.5, 0.5, 0.3, GOLD, { y: 3.25 }, 'smooth', 10);
      ball(b, 0.45, GOLD, { y: 3.6, sy: 0.75 }, 'smooth', 1);
      return block(b, 0.3, 1, 0.3, GOLD, { x: 0.65, y: 2.2, rz: -0.6 });
    case 'neon_sign':
      for (const x of [-0.7, 0.7]) block(b, 0.1, 1.6, 0.1, BLACK, { x, y: 0.8 });
      block(b, 1.9, 1, 0.1, 0x1a1a24, { y: 2.1 });
      block(b, 1.6, 0.18, 0.12, 0xff4ad8, { y: 2.4 }, 'glow');
      block(b, 1.6, 0.18, 0.12, 0x4ad8ff, { y: 1.8 }, 'glow');
      for (let i = 0; i < 4; i += 1) block(b, 0.22, 0.3, 0.12, 0xff4ad8, { x: -0.6 + i * 0.4, y: 2.1 }, 'glow');
      return;
    case 'flower_box':
      brick(b, 2.9, 0.6, 0.9, 0x9a6a3a, { y: 0.3 });
      for (let i = 0; i < 6; i += 1) ball(b, 0.22, [0xff5a8a, 0xffd23a, 0xffffff, 0xff8a2a][i % 4]!, { x: -1.2 + i * 0.48, y: 0.85, z: (i % 2) * 0.2 - 0.1 }, 'smooth', 0);
      return;
    case 'park_bench':
      for (const x of [-1.2, 1.2]) block(b, 0.2, 0.9, 1.2, BLACK, { x, y: 0.45 });
      block(b, 2.9, 0.15, 1.2, WOOD, { y: 0.95 });
      return block(b, 2.9, 0.7, 0.12, WOOD, { y: 1.45, z: 0.6, rx: 0.1 });
    case 'street_lamp':
      cylinder(b, 0.12, 0.16, 4.4, BLACK, { y: 2.2 }, 'smooth', 8);
      cylinder(b, 0.3, 0.3, 0.1, BLACK, { y: 4.4 }, 'smooth', 8);
      ball(b, 0.32, 0xfff0c8, { y: 4.75 }, 'glow', 1);
      return cone(b, 0.4, 0.3, BLACK, { y: 5.05 }, 'smooth', 8);
    case 'garden_fountain':
      cylinder(b, 1.9, 1.95, 0.7, 0xd8dce4, { y: 0.35 }, 'smooth', 16);
      cylinder(b, 1.7, 1.7, 0.1, 0x5ac8f0, { y: 0.66 }, 'smooth', 16);
      cylinder(b, 0.3, 0.4, 1.6, 0xd8dce4, { y: 1.3 }, 'smooth', 10);
      cylinder(b, 0.8, 0.6, 0.3, 0xd8dce4, { y: 2.1 }, 'smooth', 12);
      return ball(b, 0.3, 0x9ae4ff, { y: 2.45 }, 'glow', 0);
    case 'balloons':
      block(b, 0.3, 0.3, 0.3, 0xd8d8d8, { y: 0.15 });
      for (let i = 0; i < 5; i += 1) {
        const x = Math.cos(i * 1.3) * 0.5;
        const z = Math.sin(i * 1.3) * 0.5;
        block(b, 0.03, 3.6, 0.03, 0xf2f2f2, { x: x / 2, y: 2.1, z: z / 2, rz: x * 0.25, rx: -z * 0.25 });
        ball(b, 0.45, [0xff4a5a, 0xffd23a, 0x4ad0ff, 0x6ae05a, 0xff7ad9][i]!, { x, y: 3.9 + (i % 2) * 0.4, z, sy: 1.15 }, 'smooth', 1);
      }
      return;
    case 'sprinkler':
      cylinder(b, 0.3, 0.35, 0.3, 0x8a8e98, { y: 0.15 }, 'smooth', 8);
      cylinder(b, 0.06, 0.06, 0.8, 0x3a8ad8, { y: 0.6 }, 'smooth', 6);
      return block(b, 0.8, 0.1, 0.1, 0x3a8ad8, { y: 1.05 });
    case 'scarecrow':
      block(b, 0.14, 3.2, 0.14, 0x8a5a2a, { y: 1.6 });
      block(b, 1.8, 0.14, 0.14, 0x8a5a2a, { y: 2.3 });
      block(b, 0.8, 1, 0.4, 0x3a6ac8, { y: 2.1 });
      ball(b, 0.35, 0xf2d27a, { y: 2.95 }, 'smooth', 0);
      return cylinder(b, 0.7, 0.7, 0.08, 0xc8a050, { y: 3.25 }, 'smooth', 10);
    case 'chicken_coop':
      fenceRing(b, 2.4, 2.4);
      brick(b, 2, 1.6, 1.6, 0xd8443a, { x: 0.9, y: 1.1, z: 1.2 });
      for (const x of [0.2, 1.6]) block(b, 0.14, 0.3, 0.14, 0x5a3420, { x, y: 0.15, z: 1.2 });
      block(b, 2.3, 0.15, 1.1, 0xf2ece0, { x: 0.9, y: 2.05, z: 0.85, rx: 0.5 });
      block(b, 2.3, 0.15, 1.1, 0xf2ece0, { x: 0.9, y: 2.05, z: 1.55, rx: -0.5 });
      block(b, 0.6, 0.6, 0.06, 0x2a1a12, { x: 0.9, y: 0.9, z: 0.39 });
      return block(b, 0.3, 0.06, 0.8, 0x9a6a3a, { x: 0.9, y: 0.5, z: 0.0, rx: 0.5 });
    case 'cow_pen':
      fenceRing(b, 2.9, 2.9, 0x9a6a3a);
      block(b, 1.2, 0.5, 0.6, 0x8a8e98, { x: 2, y: 0.25, z: 2.1 });
      return block(b, 1, 0.1, 0.4, 0x6ac8f0, { x: 2, y: 0.52, z: 2.1 });
    case 'pig_pen':
      fenceRing(b, 2.9, 2.9, 0x9a6a3a);
      cylinder(b, 1.6, 1.6, 0.08, 0x6a4a2a, { x: -0.6, y: 0.05, z: 0.6 }, 'smooth', 12);
      return block(b, 1.2, 0.4, 0.5, 0x9a6a3a, { x: 2, y: 0.2, z: 2.1 });
    case 'feeder':
      block(b, 1.8, 0.5, 1.2, 0x9a6a3a, { y: 0.45 });
      block(b, 1.6, 0.15, 1, 0xe8c050, { y: 0.72 });
      for (const x of [-0.8, 0.8]) block(b, 0.15, 0.3, 0.15, 0x5a3420, { x, y: 0.15 });
      return;
    case 'hay_bale':
      brick(b, 1.9, 1, 0.95, 0xe8c050, { y: 0.5 });
      for (const x of [-0.5, 0.5]) block(b, 0.06, 1.02, 0.97, 0xa8803a, { x, y: 0.5 });
      return;
    case 'basic_rod':
    case 'sturdy_rod':
    case 'pro_rod':
    case 'golden_rod':
      return buildRod(b, ROD_COLORS[def.key] ?? 0x9a6a3a);
    case 'trophy_fish':
      for (const x of [-0.5, 0.5]) block(b, 0.12, 2.2, 0.12, DARK, { x, y: 1.1, z: 0.2 });
      block(b, 1.9, 1.1, 0.16, 0x7a4e2a, { y: 2.3, z: 0.1 });
      block(b, 1.6, 0.85, 0.17, 0x2f6ab8, { y: 2.3, z: 0.08 });
      for (const x of [-0.5, 0.5]) block(b, 0.06, 0.06, 0.04, 0xffd23a, { x, y: 1.85, z: -0.02 });
      {
        const fish = new PartBuilder();
        buildFish(fish, 0x5a7ab8, true);
        b.absorb(fish, { y: 1.9, z: -0.05, rz: Math.PI / 2, ry: Math.PI / 2, sx: 0.9, sy: 0.9, sz: 0.9 });
      }
      return;
    case 'anchor':
      block(b, 0.3, 2.2, 0.3, 0x3a3e4a, { y: 1.3 });
      cylinder(b, 0.32, 0.32, 0.12, 0x3a3e4a, { y: 2.5, rx: Math.PI / 2 }, 'smooth', 12);
      block(b, 1.4, 0.24, 0.3, 0x3a3e4a, { y: 2 });
      block(b, 1.6, 0.3, 0.3, 0x3a3e4a, { y: 0.3 });
      for (const s of [-1, 1]) cone(b, 0.25, 0.6, 0x3a3e4a, { x: s * 0.8, y: 0.6, rz: -s * 0.4 }, 'smooth', 4);
      return cylinder(b, 1.1, 1.1, 0.1, 0xc8a070, { y: 0.05 }, 'smooth', 12);
    default:
      if (def.role === 'crop') return soilBed(b);
      brick(b, def.w * 0.9, Math.max(0.3, def.h), def.d * 0.9, 0xd8d8d8, { y: Math.max(0.3, def.h) / 2 });
  }
};

/** The animal that lives in a pen (by the pen's produce ingredient). */
export const buildAnimal = (b: PartBuilder, produce: number): void => {
  if (produce === 7) buildChicken(b);
  else if (produce === 8) buildCow(b);
  else buildPig(b);
};
