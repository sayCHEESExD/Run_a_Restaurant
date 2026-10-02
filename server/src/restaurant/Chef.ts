import { CARRY, MAX_CASH, itemById, type BoardId, type CarryKind, type StackItem } from '@restaurant/shared';
import type { ProgressFields } from '../persistence/index.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { Restaurant } from './Restaurant.js';

/**
 * ONE CONNECTED OWNER, as the server holds them: their public schema, the
 * restaurant they were given, what is in their hands, and their PROFILE - a
 * plain object that is the authoritative copy of their cash, items, fridge
 * and skills while they play. (Their furniture lives in the restaurant's
 * schema while they are here, and is folded back into the profile on save.)
 */
export interface Chef {
  readonly sessionId: string;
  /** The profile key: a guest id or an account key. Empty for a probe with no id. */
  key: string;
  /** The verified Bloxity account id, for mutual friends. */
  accountId: string | null;
  profile: ProgressFields;
  readonly player: PlayerState;
  restaurant: Restaurant | null;
  carry: { kind: CarryKind; order: number; recipe: number };
  /** The owner's `Self` snapshot is out of date. */
  dirty: boolean;
  lastSelfAt: number;
  /** Wall clock of the last accepted action, for the per-player rate limit. */
  lastActionAt: number;
  friendIds: Set<string>;
  friends: number;
  boards: Record<BoardId, number>;
  /** The line in the water, while fishing. */
  fishing: { state: 1 | 2; water: 'pond' | 'sea'; x: number; z: number; biteAt: number; until: number } | null;
}

// ------------------------------------------------------------------ purse

/** Add Cash. `earned` counts it toward lifetime earnings (the boards and milestones). */
export const addCash = (chef: Chef, amount: number, earned: boolean): number => {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const before = chef.profile.cash;
  chef.profile.cash = Math.min(MAX_CASH, Math.floor(before + amount));
  const granted = chef.profile.cash - before;
  if (earned) chef.profile.earned = Math.min(MAX_CASH, chef.profile.earned + granted);
  chef.dirty = true;
  return granted;
};

/** Deduct Cash. False and unchanged when they cannot afford it. */
export const spendCash = (chef: Chef, cost: number): boolean => {
  const price = Math.floor(Number.isFinite(cost) ? Math.max(0, cost) : 0);
  if (chef.profile.cash < price) return false;
  chef.profile.cash -= price;
  chef.dirty = true;
  return true;
};

export const addDiamonds = (chef: Chef, amount: number): void => {
  if (!Number.isFinite(amount) || amount <= 0) return;
  chef.profile.diamonds = Math.min(1e9, Math.floor(chef.profile.diamonds + amount));
  chef.dirty = true;
};

export const spendDiamonds = (chef: Chef, cost: number): boolean => {
  if (chef.profile.diamonds < cost) return false;
  chef.profile.diamonds -= cost;
  chef.dirty = true;
  return true;
};

// ----------------------------------------------------------------- stacks

export const countOf = (stacks: readonly StackItem[], id: number): number => stacks.find((s) => s.id === id)?.count ?? 0;

export const addStack = (stacks: StackItem[], id: number, count: number): void => {
  if (count <= 0) return;
  const at = stacks.findIndex((s) => s.id === id);
  if (at >= 0) stacks[at] = { id, count: Math.min(1_000_000_000, stacks[at]!.count + count) };
  else stacks.push({ id, count });
};

/** Take `count` from a stack. False and unchanged when there are not enough. */
export const takeStack = (stacks: StackItem[], id: number, count = 1): boolean => {
  const at = stacks.findIndex((s) => s.id === id);
  if (at < 0 || stacks[at]!.count < count) return false;
  const left = stacks[at]!.count - count;
  if (left > 0) stacks[at] = { id, count: left };
  else stacks.splice(at, 1);
  return true;
};

// ----------------------------------------------------------------- fridge

/** Everything the restaurant's fridges can hold. */
export const fridgeCapacity = (chef: Chef): number => {
  let cap = 0;
  chef.restaurant?.state.items.forEach((item) => {
    const def = itemById(item.kind);
    if (def?.role === 'fridge') cap += def.capacity ?? 0;
  });
  return cap;
};

export const fridgeTotal = (chef: Chef): number => chef.profile.ingredients.reduce((sum, s) => sum + s.count, 0);

/** Put ingredients in the fridge, as many as fit. Returns how many went in. */
export const stockFridge = (chef: Chef, ingredient: number, count: number): number => {
  const room = Math.max(0, fridgeCapacity(chef) - fridgeTotal(chef));
  const n = Math.min(room, Math.max(0, Math.floor(count)));
  if (n > 0) {
    addStack(chef.profile.ingredients, ingredient, n);
    chef.dirty = true;
  }
  return n;
};

// ------------------------------------------------------------------ hands

/** Put something in (or empty) the owner's hands, and show everyone. */
export const setCarry = (chef: Chef, kind: CarryKind, order = 0, recipe = 0): void => {
  chef.carry = { kind, order, recipe };
  chef.player.carryKind = kind;
  chef.player.carryRecipe = kind === CARRY.plate || kind === CARRY.ticket ? recipe : 0;
  chef.player.actionCount = (chef.player.actionCount + 1) & 0xffff;
  chef.dirty = true;
};

export const handsFree = (chef: Chef): boolean => chef.carry.kind === CARRY.none;
