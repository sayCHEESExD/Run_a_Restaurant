/**
 * THE CUSTOMERS. Every customer is a type with a rarity: commons fill the
 * seats, and rarer guests - who appear more as the restaurant's rank and
 * beauty grow - pay more and sometimes bring something special.
 */

export type CustomerRarity = 'common' | 'uncommon' | 'rare' | 'gourmet' | 'legendary';

export interface CustomerRarityDef {
  readonly id: CustomerRarity;
  readonly name: string;
  readonly color: string;
  readonly dark: string;
  /** Payment multiplier. */
  readonly pay: number;
  /** Base spawn weight at rank 0, and how much each rank index adds (as a fraction of the base). */
  readonly weight: number;
  readonly perRank: number;
}

export const CUSTOMER_RARITIES: Readonly<Record<CustomerRarity, CustomerRarityDef>> = {
  common: { id: 'common', name: 'Common', color: '#9aa4b0', dark: '#5c6470', pay: 1, weight: 100, perRank: 0 },
  uncommon: { id: 'uncommon', name: 'Uncommon', color: '#5ad84a', dark: '#2a8a2a', pay: 1.5, weight: 22, perRank: 0.18 },
  rare: { id: 'rare', name: 'Rare', color: '#4aa8ff', dark: '#1f5ab0', pay: 2.5, weight: 6, perRank: 0.3 },
  gourmet: { id: 'gourmet', name: 'Gourmet', color: '#f5b72a', dark: '#a8700a', pay: 5, weight: 1.6, perRank: 0.42 },
  legendary: { id: 'legendary', name: 'Legendary', color: '#ff5ad8', dark: '#9a1f8a', pay: 10, weight: 0.35, perRank: 0.55 },
};

export const CUSTOMER_RARITY_ORDER: readonly CustomerRarity[] = ['common', 'uncommon', 'rare', 'gourmet', 'legendary'];

/** Something a special guest brings beside their bill. */
export type CustomerPerk = 'none' | 'diamonds' | 'rating' | 'xp' | 'tip';

export interface CustomerDef {
  readonly id: number;
  readonly name: string;
  readonly rarity: CustomerRarity;
  /** Least rank index before they visit. */
  readonly rank: number;
  readonly perk: CustomerPerk;
  readonly perkText: string;
  /** Seconds eating. */
  readonly eat: number;
}

const c = (id: number, name: string, rarity: CustomerRarity, rank = 0, perk: CustomerPerk = 'none', perkText = '', eat = 7): CustomerDef => ({ id, name, rarity, rank, perk, perkText, eat });

export const CUSTOMERS: readonly CustomerDef[] = [
  c(1, 'Casual Carl', 'common'),
  c(2, 'Jogger Jess', 'common'),
  c(3, 'Office Owen', 'common'),
  c(4, 'Student Sara', 'common'),
  c(5, 'Grandpa Gus', 'common', 0, 'none', '', 9),
  c(6, 'Tourist Tina', 'common'),
  c(7, 'Beach Bob', 'uncommon', 1),
  c(8, 'Skater Sky', 'uncommon', 1),
  c(9, 'Farmer Fern', 'uncommon', 1),
  c(10, 'Artist Ari', 'uncommon', 2),
  c(11, 'Business Boss', 'rare', 2, 'tip', 'Tips +50%'),
  c(12, 'Food Blogger', 'rare', 3, 'rating', 'Boosts your rating'),
  c(13, 'Firefighter', 'rare', 3),
  c(14, 'Doctor Dee', 'rare', 4),
  c(15, 'Pirate Captain', 'gourmet', 4, 'tip', 'Tips double'),
  c(16, 'Food Critic', 'gourmet', 5, 'rating', 'Big rating boost'),
  c(17, 'Lifeguard', 'gourmet', 5),
  c(18, 'Brave Knight', 'gourmet', 6, 'xp', 'Double skill XP'),
  c(19, 'Royal King', 'legendary', 7, 'diamonds', 'Leaves 3 Diamonds'),
  c(20, 'Astronaut', 'legendary', 8, 'xp', 'Triple skill XP'),
  c(21, 'Wizard', 'legendary', 9, 'diamonds', 'Leaves 5 Diamonds'),
  c(22, 'Zeus', 'legendary', 11, 'tip', 'Tips x5'),
];

const CUSTOMER_BY_ID = new Map(CUSTOMERS.map((d) => [d.id, d]));
export const customerById = (id: number): CustomerDef | undefined => CUSTOMER_BY_ID.get(id);

/** The tutorial's first guest: a regular, so the first meal is simple. */
export const TUTORIAL_CUSTOMER = 1;

/** Spawn weights for a rank and the restaurant's decor beauty (sum of decor quality). */
export const customerWeights = (rank: number, beauty: number, luck = 0): [number, number][] => {
  const out: [number, number][] = [];
  const charm = 1 + Math.min(1.5, beauty / 200);
  for (const def of CUSTOMERS) {
    if (def.rank > rank) continue;
    const rarity = CUSTOMER_RARITIES[def.rarity];
    const bonus = rarity.id === 'common' ? 1 : (1 + rarity.perRank * rank) * charm * (1 + luck);
    out.push([def.id, rarity.weight * bonus]);
  }
  return out;
};

/** What a customer is doing (CustomerState.phase). */
export const PHASE = {
  /** Walking from the street to their place in the queue. */
  arriving: 0,
  /** Waiting at the door to be seated. */
  queued: 1,
  /** Walking to their seat. */
  toSeat: 2,
  /** Seated, reading the menu. */
  browsing: 3,
  /** Seated, ready to order ("!"). */
  ready: 4,
  /** Ordered, waiting for the food. */
  waiting: 5,
  eating: 6,
  /** Walking back out to the street. */
  leaving: 7,
} as const;

/** True while a customer is in their chair. */
export const isSeatedPhase = (phase: number): boolean => phase >= PHASE.browsing && phase <= PHASE.eating;

/** Where an order is (OrderState.stage). */
export const STAGE = {
  /** A ticket up on the order stand, waiting for a cook. */
  posted: 0,
  /** A ticket in someone's hand on the way to a stove. */
  ticket: 1,
  cooking: 2,
  /** A finished plate on the order stand. */
  ready: 3,
  /** A plate in someone's hand on the way to the customer. */
  plate: 4,
} as const;
