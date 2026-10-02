import type { Rarity } from './rarity.js';

/**
 * PETS: little blocky companions that follow their owner around town, each
 * with a perk for the restaurant. Pets hatch from eggs bought at the Pet
 * Merchant in the plaza; an owner keeps up to 25 and takes 3 along at once.
 * Their perks add up (each kind capped), and every perk is applied by the
 * server.
 */

export type PetPerk = 'tips' | 'cook' | 'speed' | 'xp' | 'luck' | 'fish';

export const PERK_TEXT: Readonly<Record<PetPerk, string>> = {
  tips: 'tips',
  cook: 'cooking speed',
  speed: 'walk speed',
  xp: 'skill XP',
  luck: 'rare customers',
  fish: 'fishing luck',
};

export interface PetDef {
  readonly id: number;
  readonly key: string;
  readonly name: string;
  readonly rarity: Rarity;
  readonly perk: PetPerk;
  /** The perk's size: 0.05 is +5%. */
  readonly value: number;
  /** Cash for selling one back to the merchant. */
  readonly sell: number;
}

export const PETS: readonly PetDef[] = [
  { id: 1, key: 'dog', name: 'Dog', rarity: 'common', perk: 'tips', value: 0.05, sell: 150 },
  { id: 2, key: 'cat', name: 'Cat', rarity: 'common', perk: 'cook', value: 0.05, sell: 150 },
  { id: 3, key: 'bunny', name: 'Bunny', rarity: 'common', perk: 'speed', value: 0.06, sell: 150 },
  { id: 4, key: 'chick', name: 'Chick', rarity: 'uncommon', perk: 'xp', value: 0.1, sell: 400 },
  { id: 5, key: 'frog', name: 'Frog', rarity: 'uncommon', perk: 'fish', value: 0.15, sell: 400 },
  { id: 6, key: 'fox', name: 'Fox', rarity: 'rare', perk: 'tips', value: 0.12, sell: 3_000 },
  { id: 7, key: 'penguin', name: 'Penguin', rarity: 'rare', perk: 'fish', value: 0.3, sell: 3_000 },
  { id: 8, key: 'panda', name: 'Panda', rarity: 'epic', perk: 'cook', value: 0.15, sell: 9_000 },
  { id: 9, key: 'dragon', name: 'Dragon', rarity: 'legendary', perk: 'tips', value: 0.25, sell: 30_000 },
  { id: 10, key: 'unicorn', name: 'Unicorn', rarity: 'legendary', perk: 'luck', value: 0.3, sell: 30_000 },
];

const PET_BY_ID = new Map(PETS.map((p) => [p.id, p]));
export const petById = (id: number): PetDef | undefined => PET_BY_ID.get(id);

export interface EggDef {
  readonly id: number;
  readonly name: string;
  readonly price: number;
  readonly diamonds?: number;
  /** Least rank index to buy. */
  readonly rank: number;
  /** [pet id, weight]. */
  readonly odds: readonly (readonly [number, number])[];
  readonly color: number;
  readonly spots: number;
}

export const EGGS: readonly EggDef[] = [
  { id: 1, name: 'Basic Egg', price: 750, rank: 0, odds: [[1, 30], [2, 30], [3, 25], [4, 10], [5, 5]], color: 0xf6efe0, spots: 0x8ad06a },
  { id: 2, name: 'Rare Egg', price: 12_000, rank: 3, odds: [[4, 25], [5, 25], [6, 25], [7, 20], [8, 5]], color: 0x8ac8ff, spots: 0x2f6ab8 },
  { id: 3, name: 'Royal Egg', price: 0, diamonds: 60, rank: 0, odds: [[6, 30], [7, 25], [8, 25], [9, 12], [10, 8]], color: 0xffd23a, spots: 0xd8302a },
];

export const eggById = (id: number): EggDef | undefined => EGGS.find((e) => e.id === id);

export const PET_LIMIT = 25;
export const EQUIP_LIMIT = 3;
/** No perk kind stacks past this. */
export const PERK_CAP = 0.6;

/** The summed perk of the equipped pets (by pet type), capped. */
export const petBonus = (types: readonly number[], perk: PetPerk): number => {
  let total = 0;
  for (const type of types) {
    const def = petById(type);
    if (def?.perk === perk) total += def.value;
  }
  return Math.min(PERK_CAP, total);
};

/** Equipped pet types as the player schema carries them ("1,6,9"). */
export const petsFromText = (text: string): number[] =>
  text
    .split(',')
    .map((part) => Number(part))
    .filter((id) => Number.isFinite(id) && petById(id) !== undefined);

export const eggChance = (egg: EggDef, pet: number): number => {
  const total = egg.odds.reduce((sum, [, w]) => sum + w, 0);
  return (egg.odds.find(([id]) => id === pet)?.[1] ?? 0) / total;
};
