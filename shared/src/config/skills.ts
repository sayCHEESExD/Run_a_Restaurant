/**
 * SKILLS: Service, Cooking, Cleaning, Farming, Ranching and Fishing. Each levels up by
 * DOING it - seating and serving, cooking, washing up, harvesting, collecting -
 * on the classic curve where level 2 is 83 XP and every level asks a little
 * more than the last. Staff doing the job earn their owner half the XP.
 */

export const SKILL = { service: 0, cooking: 1, cleaning: 2, farming: 3, ranching: 4, fishing: 5 } as const;
export type SkillIndex = (typeof SKILL)[keyof typeof SKILL];

export interface SkillDef {
  readonly index: number;
  readonly key: string;
  readonly name: string;
  readonly perk: string;
  /** Least rank index before it can be trained (Farming and Ranching unlock with the restaurant). */
  readonly rank: number;
}

export const SKILLS: readonly SkillDef[] = [
  { index: 0, key: 'service', name: 'Service', perk: '+1% tips per level and unlocks better waiters', rank: 0 },
  { index: 1, key: 'cooking', name: 'Cooking', perk: '-1% cook time per level and unlocks recipes and cooks', rank: 0 },
  { index: 2, key: 'cleaning', name: 'Cleaning', perk: '+2% wash speed per level and unlocks cleaners', rank: 0 },
  { index: 3, key: 'farming', name: 'Farming', perk: '+1% crop growth per level and unlocks crops', rank: 1 },
  { index: 4, key: 'ranching', name: 'Ranching', perk: '+1% animal output per level and unlocks animals', rank: 2 },
  { index: 5, key: 'fishing', name: 'Fishing', perk: 'Faster bites, rarer fish and better rods per level', rank: 3 },
];

export const MAX_LEVEL = 99;

/** Total XP needed to reach each level (index = level), level 1 = 0, level 2 = 83. */
export const XP_TABLE: readonly number[] = (() => {
  const out = [0, 0];
  let points = 0;
  for (let level = 1; level < MAX_LEVEL; level += 1) {
    points += Math.floor(level + 300 * 2 ** (level / 7));
    out.push(Math.floor(points / 4));
  }
  return out;
})();

export const levelOf = (xp: number): number => {
  let level = 1;
  while (level < MAX_LEVEL && xp >= (XP_TABLE[level + 1] ?? Infinity)) level += 1;
  return level;
};

/** Progress inside the current level: xp into it and xp the level spans. */
export const levelProgress = (xp: number): { level: number; into: number; span: number } => {
  const level = levelOf(xp);
  const base = XP_TABLE[level] ?? 0;
  const next = XP_TABLE[level + 1] ?? base;
  return { level, into: xp - base, span: Math.max(1, next - base) };
};

/** XP for each kind of work. */
export const XP = {
  seat: 6,
  order: 8,
  serve: 12,
  /** Cooking: this plus a fifth of the recipe's price. */
  cook: 14,
  pickup: 6,
  wash: 5,
  harvest: 10,
  collect: 10,
  /** Fishing: this plus 8 per rarity step of the catch. */
  fish: 12,
} as const;

/** Of the XP a staff member earns, the owner's skill receives this share. */
export const STAFF_XP_SHARE = 0.5;

// --------------------------------------------------------------- effects

export const tipBonus = (serviceLevel: number): number => Math.min(0.6, (serviceLevel - 1) * 0.01);
export const cookTimeFactor = (cookingLevel: number): number => Math.max(0.5, 1 - (cookingLevel - 1) * 0.01);
export const washSpeedFactor = (cleaningLevel: number): number => 1 + (cleaningLevel - 1) * 0.02;
export const growSpeedFactor = (farmingLevel: number): number => 1 + (farmingLevel - 1) * 0.01;
export const animalSpeedFactor = (ranchingLevel: number): number => 1 + (ranchingLevel - 1) * 0.01;
