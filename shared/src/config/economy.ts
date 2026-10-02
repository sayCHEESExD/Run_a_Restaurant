/**
 * THE ECONOMY'S NUMBERS: what a new owner starts with, how customers arrive,
 * how patient they are, what makes them tip, the offline income caps and the
 * premium boosts. One place, so balance changes are one-line edits.
 */

export const STARTING_CASH = 0;
export const STARTING_DIAMONDS = 10;
export const MAX_CASH = 1e15;

/** The tutorial customer's generous first bill. */
export const TUTORIAL_PAYMENT = 100;

export const CUSTOMER = {
  /** Seconds between arrivals at Bronze I with a 3-star rating and nothing special. */
  interval: 13,
  /** Walking speed (units/s). */
  walk: 6.5,
  /** Seconds reading the menu once seated. */
  browse: 2.5,
  /** Seconds a seated customer waits to order before giving up. */
  orderPatience: 90,
  /** Seconds waiting for food before leaving angry. */
  foodPatience: 150,
  /** Seconds waiting at the door to be seated. */
  queuePatience: 75,
  /** Most customers in one restaurant at once (seated + queued). */
  max: 18,
} as const;

/** Wait (order to plate) thresholds for satisfaction, seconds. */
export const SATISFACTION = [
  { within: 30, stars: 5, tip: 0.25 },
  { within: 60, stars: 4, tip: 0.12 },
  { within: 100, stars: 3, tip: 0.04 },
  { within: Infinity, stars: 2, tip: 0 },
] as const;

export const RATING = {
  start: 3.5,
  /** Weight of each new visit in the rolling rating. */
  weight: 0.06,
  /** Stars counted when a customer gives up and leaves. */
  angry: 1,
} as const;

/** Spawn pace multiplier from the rating (0..5). */
export const ratingFlow = (rating: number): number => 0.6 + Math.max(0, Math.min(5, rating)) * 0.12;

export const OFFLINE = {
  /** Hours of offline income without a manager. */
  baseHours: 2,
  /** Fraction of the estimated online income earned while away. */
  share: 0.35,
  /** Shorter absences than this earn nothing (a reconnect is not a holiday). */
  minSeconds: 120,
} as const;

/** Premium boosts bought with Diamonds. */
export interface BoostDef {
  readonly id: 'cash' | 'cook' | 'rush';
  readonly name: string;
  readonly desc: string;
  readonly diamonds: number;
  readonly minutes: number;
}

export const BOOSTS: readonly BoostDef[] = [
  { id: 'cash', name: '2x Cash', desc: 'Every customer pays double', diamonds: 25, minutes: 15 },
  { id: 'cook', name: 'Speed Cooking', desc: 'Stoves cook twice as fast', diamonds: 20, minutes: 15 },
  { id: 'rush', name: 'Customer Rush', desc: 'Customers arrive twice as often', diamonds: 15, minutes: 10 },
];

/** Diamonds for logging in each day, and for each rank reached. */
export const DAILY_DIAMONDS = 5;
export const RANK_UP_DIAMONDS = 10;

/** Bloxity store packs: SKU -> what they grant. */
export const BUX_PACKS: Readonly<Record<string, { cash: number; diamonds: number; name: string }>> = {
  diamonds_small: { cash: 0, diamonds: 120, name: '120 Diamonds' },
  diamonds_large: { cash: 0, diamonds: 1_400, name: '1,400 Diamonds' },
  cash_small: { cash: 25_000, diamonds: 0, name: '$25K Cash' },
};
