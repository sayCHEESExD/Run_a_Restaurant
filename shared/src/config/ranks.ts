/**
 * RESTAURANT RANKS, Bronze I to Master, shown on every owner's sign.
 *
 * A rank is earned by the restaurant as a whole: its furniture, appliances and
 * decor (each item's quality), its size, its owner's skill levels and the
 * customers it has served. A higher rank brings more customers, rarer
 * customers, a longer queue and unlocks better items, staff and expansions.
 */

export interface RankDef {
  readonly index: number;
  readonly name: string;
  readonly tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';
  readonly points: number;
  readonly color: string;
  readonly dark: string;
}

const TIER_COLORS = {
  bronze: ['#e0905a', '#8a4a22'],
  silver: ['#cfd6e0', '#6a7484'],
  gold: ['#ffd23a', '#a87a10'],
  platinum: ['#7ae0e0', '#2a8a9a'],
  diamond: ['#8ab8ff', '#3a5ad8'],
  master: ['#ff7ad8', '#8a2ab8'],
} as const;

const THRESHOLDS = [0, 70, 130, 210, 310, 440, 600, 800, 1050, 1350, 1700, 2150, 2700, 3400, 4300, 5500];

export const RANKS: readonly RankDef[] = THRESHOLDS.map((points, index) => {
  const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;
  const tier = index === 15 ? 'master' : tiers[Math.floor(index / 3)]!;
  const numeral = ['I', 'II', 'III'][index % 3]!;
  const name = tier === 'master' ? 'Master' : `${tier[0]!.toUpperCase()}${tier.slice(1)} ${numeral}`;
  return { index, name, tier, points, color: TIER_COLORS[tier][0], dark: TIER_COLORS[tier][1] };
});

export const MAX_RANK = RANKS.length - 1;

export const rankOf = (points: number): number => {
  let rank = 0;
  for (const def of RANKS) if (points >= def.points) rank = def.index;
  return rank;
};

export interface RankBreakdown {
  readonly items: number;
  readonly skills: number;
  readonly served: number;
  readonly size: number;
  readonly total: number;
}

/** Rank points from the restaurant's parts. */
export const rankPoints = (itemQuality: number, skillLevels: number, served: number, tier: number): RankBreakdown => {
  const items = Math.floor(itemQuality);
  const skills = skillLevels * 5;
  const servedPoints = Math.floor(Math.sqrt(Math.max(0, served)) * 4);
  const size = tier * 60;
  return { items, skills, served: servedPoints, size, total: items + skills + servedPoints + size };
};

/** How much more often customers come at a rank (1 = the Bronze I pace). */
export const rankFlow = (rank: number): number => 1 + rank * 0.1;

/** Most customers waiting at the door at a rank. */
export const queueSize = (rank: number): number => Math.min(5, 3 + Math.floor(rank / 4));

/** What reaching each rank brings, for the Rank page. */
export const RANK_UNLOCKS: Readonly<Record<number, string>> = {
  1: 'Farming, Waiters & Cooks',
  2: 'Ranching, Cleaners & the Bistro expansion',
  3: 'Farmers & rare furniture',
  4: 'Ranchers & premium appliances',
  5: 'Managers & the Restaurant expansion',
  6: 'Epic furniture & Pro Chef Range',
  7: 'Royal guests & the Walk-in Freezer',
  8: 'The Grand Restaurant & Golden Register',
  9: 'Royal furniture',
  10: 'The Golden Oven',
  11: 'Zeus himself may visit',
};
