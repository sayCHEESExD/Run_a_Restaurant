/**
 * MILESTONES: the chain of goals in the card at the right of the screen
 * ("Serve 2 customers! 0/2" with its Rewards button). One is current at a
 * time; finishing it lights Rewards, and claiming pays out and moves on. Each
 * goal reads one of the owner's lifetime stats, so nothing extra is stored but
 * the index of the next goal.
 */

export type StatKey =
  | 'served'
  | 'earned'
  | 'placed'
  | 'rank'
  | 'cooking'
  | 'service'
  | 'cleaning'
  | 'farming'
  | 'ranching'
  | 'hired'
  | 'harvested'
  | 'collected'
  | 'tier'
  | 'recipes'
  | 'washed'
  | 'rare'
  | 'fish'
  | 'pets'
  | 'fishing';

export interface TaskDef {
  readonly text: string;
  readonly stat: StatKey;
  readonly target: number;
  readonly cash: number;
  readonly diamonds: number;
}

const t = (text: string, stat: StatKey, target: number, cash: number, diamonds = 0): TaskDef => ({ text, stat, target, cash, diamonds });

export const TASKS: readonly TaskDef[] = [
  t('Serve 2 customers!', 'served', 2, 50),
  t('Own 6 pieces of furniture!', 'placed', 6, 75),
  t('Serve 10 customers!', 'served', 10, 120, 5),
  t('Reach Cooking level 3!', 'cooking', 3, 150),
  t('Reach Bronze II rank!', 'rank', 1, 200, 10),
  t('Earn $1,000!', 'earned', 1_000, 250),
  t('Harvest 5 crops!', 'harvested', 5, 300),
  t('Hire your first staff member!', 'hired', 1, 400, 10),
  t('Serve 50 customers!', 'served', 50, 600),
  t('Reach Bronze III rank!', 'rank', 2, 800, 10),
  t('Expand to a Bistro!', 'tier', 1, 1_000, 15),
  t('Collect 5 ranch products!', 'collected', 5, 1_200),
  t('Adopt a pet from the Pet Merchant!', 'pets', 1, 1_000, 10),
  t('Unlock 6 recipes!', 'recipes', 6, 1_500),
  t('Serve 5 rare customers!', 'rare', 5, 2_000, 10),
  t('Catch 5 fish!', 'fish', 5, 2_500, 10),
  t('Earn $25,000!', 'earned', 25_000, 3_000, 10),
  t('Hire 4 staff!', 'hired', 4, 4_000),
  t('Reach Silver II rank!', 'rank', 4, 6_000, 20),
  t('Serve 250 customers!', 'served', 250, 8_000),
  t('Reach Cooking level 20!', 'cooking', 20, 12_000, 15),
  t('Expand to a Restaurant!', 'tier', 2, 20_000, 25),
  t('Wash 500 dishes!', 'washed', 500, 25_000),
  t('Reach Fishing level 15!', 'fishing', 15, 30_000, 25),
  t('Reach Gold I rank!', 'rank', 6, 40_000, 30),
  t('Earn $1,000,000!', 'earned', 1_000_000, 100_000, 40),
  t('Serve 2,500 customers!', 'served', 2_500, 150_000, 40),
  t('Expand to a Grand Restaurant!', 'tier', 3, 300_000, 60),
  t('Reach Diamond I rank!', 'rank', 12, 1_000_000, 100),
  t('Reach Master rank!', 'rank', 15, 5_000_000, 250),
];

export type Stats = Readonly<Record<StatKey, number>>;
