import type { Rarity } from './rarity.js';
import { PIER, POND } from './town.js';
import { weightedPick } from '../util/random.js';

/**
 * FISHING: stand at the end of the pier (sea fish) or on the bank of the
 * park pond (pond fish) with a rod, cast, wait for the bite - and reel in
 * before the fish gets away. Every catch is Fish for the fridge (bigger and
 * rarer fish give more), Fishing XP, and a shot at the Biggest Fish board.
 */

export type Water = 'pond' | 'sea';

export interface FishDef {
  readonly id: number;
  readonly name: string;
  readonly rarity: Rarity;
  readonly water: Water;
  /** Weight range in kg. */
  readonly min: number;
  readonly max: number;
  /** Fish (ingredient) it gives. */
  readonly yield: number;
  /** Fishing level before it bites. */
  readonly level: number;
  readonly color: number;
}

export const FISH: readonly FishDef[] = [
  { id: 1, name: 'Minnow', rarity: 'common', water: 'pond', min: 0.05, max: 0.2, yield: 1, level: 1, color: 0xb8c4cc },
  { id: 2, name: 'Perch', rarity: 'common', water: 'pond', min: 0.3, max: 1.2, yield: 1, level: 1, color: 0x8ab84a },
  { id: 3, name: 'Carp', rarity: 'uncommon', water: 'pond', min: 1, max: 6, yield: 2, level: 3, color: 0xc89a4a },
  { id: 4, name: 'Catfish', rarity: 'rare', water: 'pond', min: 2, max: 12, yield: 2, level: 8, color: 0x6a5a4a },
  { id: 5, name: 'Golden Koi', rarity: 'legendary', water: 'pond', min: 1, max: 5, yield: 4, level: 15, color: 0xffc21a },
  { id: 6, name: 'Sardine', rarity: 'common', water: 'sea', min: 0.05, max: 0.2, yield: 1, level: 1, color: 0x9ab8d8 },
  { id: 7, name: 'Mackerel', rarity: 'common', water: 'sea', min: 0.3, max: 1.5, yield: 1, level: 1, color: 0x4a8ab8 },
  { id: 8, name: 'Sea Bass', rarity: 'uncommon', water: 'sea', min: 1, max: 8, yield: 2, level: 4, color: 0x7a8a98 },
  { id: 9, name: 'Salmon', rarity: 'rare', water: 'sea', min: 2, max: 15, yield: 2, level: 10, color: 0xf28a6a },
  { id: 10, name: 'Tuna', rarity: 'epic', water: 'sea', min: 20, max: 200, yield: 3, level: 20, color: 0x3a5a8a },
  { id: 11, name: 'Swordfish', rarity: 'legendary', water: 'sea', min: 50, max: 400, yield: 4, level: 30, color: 0x5a7ab8 },
  { id: 12, name: 'Shark', rarity: 'legendary', water: 'sea', min: 100, max: 900, yield: 5, level: 40, color: 0x8a98a8 },
];

const FISH_BY_ID = new Map(FISH.map((f) => [f.id, f]));
export const fishById = (id: number): FishDef | undefined => FISH_BY_ID.get(id);

/** The rods, by catalog item id: how fast fish bite and how lucky the catch. */
export const RODS: Readonly<Record<number, { speed: number; luck: number }>> = {
  90: { speed: 1, luck: 0 },
  91: { speed: 1.3, luck: 0.4 },
  92: { speed: 1.7, luck: 1 },
  93: { speed: 2.2, luck: 2 },
};

/** The best rod among owned item ids, or null. */
export const bestRod = (owned: readonly number[]): { id: number; speed: number; luck: number } | null => {
  let best: { id: number; speed: number; luck: number } | null = null;
  for (const id of owned) {
    const rod = RODS[id];
    if (rod && (!best || rod.luck > best.luck)) best = { id, ...rod };
  }
  return best;
};

export const FISHING = {
  /** Seconds before a bite at speed 1 (random between). */
  biteMin: 4,
  biteMax: 9,
  /** Seconds to reel once the bobber dips. */
  window: 2.6,
  /** Walking further than this from where you cast reels the line in. */
  leash: 6,
} as const;

const RARITY_WEIGHT: Readonly<Record<Rarity, number>> = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1, mythic: 0.5, divine: 0.2, prismatic: 0.1 };
const RARITY_STEP: Readonly<Record<Rarity, number>> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, divine: 6, prismatic: 7 };

export const rarityStep = (rarity: Rarity): number => RARITY_STEP[rarity];

/** Which fish bites: by water, fishing level and luck (rod + level + pets). */
export const rollFish = (random: () => number, water: Water, level: number, luck: number): FishDef => {
  const pool = FISH.filter((f) => f.water === water && f.level <= level);
  const entries = pool.map((f) => [f.id, RARITY_WEIGHT[f.rarity] * (f.rarity === 'common' ? 1 : 1 + luck * (0.5 + RARITY_STEP[f.rarity] * 0.4))] as const);
  return fishById(weightedPick(random, entries))!;
};

/** A weight in the fish's range, skewed small (big ones are the stories). */
export const rollWeight = (random: () => number, fish: FishDef, luck: number): number => {
  const t = random() ** (2.2 / (1 + luck * 0.3));
  return Math.round((fish.min + (fish.max - fish.min) * t) * 100) / 100;
};

/**
 * Where a cast from a world point lands, or null when there is nowhere to fish
 * from here: off the far end of the pier into the sea, or into the pond from
 * its bank (or from wading in it).
 */
export const castFrom = (x: number, z: number): { water: Water; x: number; z: number } | null => {
  if (Math.abs(x - PIER.x) <= PIER.half + 0.5 && z <= PIER.fishFrom) return { water: 'sea', x, z: PIER.minZ - 6 };
  const ex = (x - POND.x) / (POND.rx + 4);
  const ez = (z - POND.z) / (POND.rz + 4);
  if (ex * ex + ez * ez <= 1) {
    const dx = POND.x - x;
    const dz = POND.z - z;
    const d = Math.hypot(dx, dz) || 1;
    const reach = Math.min(6, d);
    return { water: 'pond', x: x + (dx / d) * reach, z: z + (dz / d) * reach };
  }
  return null;
};
