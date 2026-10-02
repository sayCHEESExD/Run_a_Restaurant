/**
 * STAFF: the people who slowly take the restaurant off the owner's hands.
 *
 * Six roles, each with a roster of hireable people. The first of each are
 * cheap; better ones are faster, unlocked by the matching skill's level.
 * Hired staff can be levelled up (faster still). A restaurant's size caps how
 * many it can employ, and each role opens at a restaurant rank, so the early
 * game is played by hand.
 */

export type StaffRole = 'waiter' | 'cook' | 'cleaner' | 'farmer' | 'rancher' | 'manager';

export interface RoleDef {
  readonly id: StaffRole;
  readonly index: number;
  readonly name: string;
  readonly plural: string;
  /** The skill their unlocks follow (and their XP feeds). -1: none. */
  readonly skill: number;
  readonly skillName: string;
  /** Least rank index to hire any. */
  readonly rank: number;
  readonly job: string;
}

export const ROLES: readonly RoleDef[] = [
  { id: 'waiter', index: 0, name: 'Waiter', plural: 'Waiters', skill: 0, skillName: 'Service', rank: 1, job: 'Seats customers, takes orders and serves food' },
  { id: 'cook', index: 1, name: 'Cook', plural: 'Cooks', skill: 1, skillName: 'Cooking', rank: 1, job: 'Takes tickets from the order stand and cooks them' },
  { id: 'cleaner', index: 2, name: 'Cleaner', plural: 'Cleaners', skill: 2, skillName: 'Cleaning', rank: 2, job: 'Clears dirty dishes and loads the sink' },
  { id: 'farmer', index: 3, name: 'Farmer', plural: 'Farmers', skill: 3, skillName: 'Farming', rank: 3, job: 'Harvests ripe crops into the fridge' },
  { id: 'rancher', index: 4, name: 'Rancher', plural: 'Ranchers', skill: 4, skillName: 'Ranching', rank: 4, job: 'Collects eggs, milk and bacon into the fridge' },
  { id: 'manager', index: 5, name: 'Manager', plural: 'Managers', skill: -1, skillName: '', rank: 5, job: 'Collects the register, speeds up all staff and earns while you are away' },
];

export const roleByIndex = (index: number): RoleDef | undefined => ROLES[index];

export interface StaffDef {
  readonly id: number;
  readonly role: StaffRole;
  readonly name: string;
  readonly price: number;
  /** Walking and working speed multiplier at level 1. */
  readonly speed: number;
  /** Skill level required (of the role's skill), 0 for none. */
  readonly level: number;
  /** Least rank index (managers). */
  readonly rank?: number;
}

const roster = (role: StaffRole, base: number, names: readonly string[], prices: readonly number[], levels: readonly number[], speeds: readonly number[]): StaffDef[] =>
  names.map((name, i) => ({ id: base + i, role, name, price: prices[i]!, level: levels[i]!, speed: speeds[i]! }));

const PRICES = [100, 750, 5_000, 20_000, 80_000, 250_000, 800_000, 2_500_000];
const LEVELS = [0, 0, 10, 20, 30, 40, 60, 70];
const SPEEDS = [0.8, 1, 1.2, 1.4, 1.6, 1.85, 2.15, 2.5];

export const STAFF: readonly StaffDef[] = [
  ...roster('waiter', 1, ['Milo', 'Rosa', 'Theo', 'Ivy', 'Leo', 'Nora', 'Max', 'Zara'], PRICES, LEVELS, SPEEDS),
  ...roster('cook', 11, ['Gus', 'Lola', 'Marco', 'Yuki', 'Pierre', 'Ama', 'Bruno', 'Sofia'], PRICES.map((p) => Math.round(p * 1.15)), LEVELS, SPEEDS),
  ...roster('cleaner', 21, ['Dot', 'Benny', 'Kiki', 'Otto', 'Pearl', 'Rex'], [300, 1_500, 8_000, 30_000, 120_000, 400_000], [0, 0, 10, 20, 35, 50], [0.8, 1, 1.25, 1.5, 1.8, 2.2]),
  ...roster('farmer', 31, ['Hank', 'Daisy', 'Clem', 'Juniper', 'Barley'], [2_000, 9_000, 40_000, 150_000, 500_000], [0, 5, 15, 30, 50], [0.8, 1, 1.3, 1.6, 2]),
  ...roster('rancher', 41, ['Dusty', 'Willow', 'Colt', 'Maple', 'Duke'], [5_000, 20_000, 70_000, 250_000, 750_000], [0, 5, 15, 30, 50], [0.8, 1, 1.3, 1.6, 2]),
  { id: 51, role: 'manager', name: 'Manager Mia', price: 25_000, level: 0, speed: 1, rank: 5 },
  { id: 52, role: 'manager', name: 'Manager Ben', price: 400_000, level: 0, speed: 1.3, rank: 9 },
];

const STAFF_BY_ID = new Map(STAFF.map((s) => [s.id, s]));
export const staffById = (id: number): StaffDef | undefined => STAFF_BY_ID.get(id);

export const roleOf = (role: StaffRole): RoleDef => ROLES.find((r) => r.id === role)!;

export const MAX_STAFF_LEVEL = 10;

/** Cost to raise a hired member from `level` to `level + 1`. */
export const upgradeCost = (def: StaffDef, level: number): number => Math.round((def.price * 0.6 + 150) * 1.55 ** (level - 1));

/** Speed of a hired member at a level. */
export const staffSpeed = (def: StaffDef, level: number): number => def.speed * (1 + (Math.max(1, level) - 1) * 0.08);

/** World units a staff member walks per second at speed 1. */
export const STAFF_WALK = 7.5;
/** Seconds a task step (picking up, putting down, ringing up) takes at speed 1. */
export const STAFF_WORK = 0.9;

/** A manager's effects. */
export const MANAGER = {
  /** Seconds between trips to the register. */
  collectEvery: 25,
  /** All other staff move this much faster per manager speed point. */
  staffBoost: 0.12,
  /** Extra hours of offline income. */
  offlineHours: 4,
} as const;
