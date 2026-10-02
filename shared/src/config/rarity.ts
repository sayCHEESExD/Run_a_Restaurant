/**
 * RARITY: the star count and the coloured pill every shop row, index entry and
 * seed card carries (COMMON blue, UNCOMMON green, RARE purple...), and how
 * likely a shop is to have the item on its shelf after a restock.
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'divine' | 'prismatic';

export interface RarityDef {
  readonly id: Rarity;
  readonly name: string;
  readonly stars: number;
  /** The pill's fill and its darker rim. */
  readonly color: string;
  readonly dark: string;
  /** Chance an item of this rarity is in stock after a restock. */
  readonly stockChance: number;
  /** Stock range when it is. */
  readonly stockMin: number;
  readonly stockMax: number;
}

export const RARITIES: Readonly<Record<Rarity, RarityDef>> = {
  common: { id: 'common', name: 'Common', stars: 1, color: '#5a8cf0', dark: '#2f55b0', stockChance: 1, stockMin: 2, stockMax: 4 },
  uncommon: { id: 'uncommon', name: 'Uncommon', stars: 2, color: '#3fcf8e', dark: '#1f8a5a', stockChance: 0.8, stockMin: 1, stockMax: 4 },
  rare: { id: 'rare', name: 'Rare', stars: 3, color: '#9b5de5', dark: '#6436a8', stockChance: 0.6, stockMin: 1, stockMax: 3 },
  epic: { id: 'epic', name: 'Epic', stars: 4, color: '#e0489a', dark: '#9c2566', stockChance: 0.42, stockMin: 1, stockMax: 3 },
  legendary: { id: 'legendary', name: 'Legendary', stars: 5, color: '#f5b72a', dark: '#b07810', stockChance: 0.28, stockMin: 1, stockMax: 2 },
  mythic: { id: 'mythic', name: 'Mythic', stars: 6, color: '#ff5a4f', dark: '#b3261e', stockChance: 0.16, stockMin: 1, stockMax: 2 },
  divine: { id: 'divine', name: 'Divine', stars: 7, color: '#35d0f0', dark: '#13869e', stockChance: 0.08, stockMin: 1, stockMax: 1 },
  prismatic: { id: 'prismatic', name: 'Prismatic', stars: 8, color: '#ff7ad9', dark: '#8a3fd6', stockChance: 0.04, stockMin: 1, stockMax: 1 },
};

export const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'divine', 'prismatic'];
