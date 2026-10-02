import type { BoardId } from '../config/town.js';
import type { RankBreakdown } from '../config/ranks.js';
import type { StatKey } from '../config/tasks.js';

/**
 * WHAT AN OWNER HAS, as the server keeps it and as it tells the owner.
 *
 * The public world - everyone's position, every restaurant's furniture,
 * customers, staff and orders - is replicated to the room through the
 * Colyseus schema. An owner's POCKETS are nobody else's business: their Cash,
 * Diamonds, Items, fridge, skills and progress travel to their own client
 * only, as a `Self` snapshot the server sends when something changed.
 */

/** A counted stack: items by catalog id, ingredients by ingredient id, customers served by type. */
export interface StackItem {
  readonly id: number;
  readonly count: number;
}

/** What is in an owner's hands. */
export const CARRY = { none: 0, ticket: 1, plate: 2, dish: 3 } as const;
export type CarryKind = (typeof CARRY)[keyof typeof CARRY];

export interface CarryState {
  readonly kind: CarryKind;
  /** The order a ticket or plate belongs to. */
  readonly order: number;
  readonly recipe: number;
}

export interface Boosts {
  /** Wall clock (ms) each premium boost runs until. */
  readonly cash: number;
  readonly cook: number;
  readonly rush: number;
}

export interface OwnedPet {
  readonly uid: number;
  readonly type: number;
}

/** The owner's line in the water: 1 waiting for a bite, 2 a bite (reel now!). */
export interface FishingState {
  readonly state: number;
  readonly water: 'pond' | 'sea';
  readonly biteAt: number;
  readonly until: number;
}

export interface SelfState {
  readonly cash: number;
  readonly diamonds: number;
  readonly earned: number;
  readonly served: number;
  readonly playSeconds: number;
  /** Tutorial step, `TUTORIAL.done` once finished or skipped. */
  readonly tutorial: number;

  /** Unplaced items by catalog id. */
  readonly inventory: readonly StackItem[];
  /** Owned structure styles. */
  readonly styles: readonly number[];
  /** The fridges' contents and their total capacity. */
  readonly ingredients: readonly StackItem[];
  readonly fridgeCap: number;
  /** XP per skill (Service, Cooking, Cleaning, Farming, Ranching). */
  readonly xp: readonly number[];
  /** Recipes taken off the menu. */
  readonly recipesOff: readonly number[];
  /** Customers served, by type: the Customers book. */
  readonly index: readonly StackItem[];

  /** What was bought from the current restock, by item id, and how often the shelves were refreshed with Diamonds. */
  readonly shopEpoch: number;
  readonly shopSalt: number;
  readonly bought: Readonly<Record<number, number>>;

  /** The next milestone to finish, and the lifetime stats the milestones read. */
  readonly task: number;
  readonly stats: Readonly<Record<StatKey, number>>;

  readonly boosts: Boosts;
  readonly rank: RankBreakdown;
  readonly rating: number;
  /** Board positions (1-based), 0 when unranked. */
  readonly boards: Readonly<Record<BoardId, number>>;
  /** Restaurants this owner has liked today, by slot. */
  readonly likedSlots: readonly number[];
  readonly carry: CarryState;
  /** Today's daily Diamonds are claimed. */
  readonly dailyClaimed: boolean;
  readonly pets: readonly OwnedPet[];
  readonly petsEquipped: readonly number[];
  /** Fish caught, by species, and the heaviest. */
  readonly fishIndex: readonly StackItem[];
  readonly bestFish: { readonly fish: number; readonly weight: number };
  readonly fishing: FishingState | null;
}

/**
 * THE TUTORIAL, one step at a time, each finished by doing the real thing:
 * walk in, place a table and chairs, seat the first customer, take their
 * order, grab the ticket, cook it, grab the plate, serve it, clear the dish,
 * wash it, collect the cash, then visit the Shop, buy something and place it.
 */
export const TUTORIAL = {
  enter: 0,
  place: 1,
  seat: 2,
  order: 3,
  ticket: 4,
  cook: 5,
  plate: 6,
  serve: 7,
  dish: 8,
  wash: 9,
  cash: 10,
  shop: 11,
  buy: 12,
  placeNew: 13,
  done: 14,
} as const;

/** While the tutorial is before this step, only the tutorial customer comes. */
export const TUTORIAL_OPEN_STEP = TUTORIAL.shop;
