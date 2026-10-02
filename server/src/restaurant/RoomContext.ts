import type { FxMessage, NoticeMessage, PetPerk, WorldCollision } from '@restaurant/shared';
import type { GameState } from '../rooms/state/GameState.js';
import type { Chef } from './Chef.js';

/**
 * What a restaurant service may ask of the room: the clock, the world, and
 * ways to tell players things. Services hold no connections of their own.
 */
export interface RoomContext {
  readonly state: GameState;
  readonly collision: WorldCollision;
  now(): number;
  random(): number;
  notify(chef: Chef, kind: NoticeMessage['kind'], text: string): void;
  send(chef: Chef, type: string, payload: unknown): void;
  /** A world effect for everyone in the room. */
  fx(message: FxMessage): void;
  /** The tutorial step `step` was completed (ignored unless the owner is on it). */
  tutorial(chef: Chef, step: number): void;
  /** Skill XP for the owner (a level-up is announced, the rank refreshed). */
  xp(chef: Chef, skill: number, amount: number): void;
  /** Something the rank reads changed: recompute it. */
  rankChanged(chef: Chef): void;
  /** Every owner in the room. */
  chefs(): Iterable<Chef>;
  /** An owner's equipped pets' perk of a kind (0.1 = +10%). */
  perk(chef: Chef | null | undefined, perk: PetPerk): number;
  /** Move a player out of anything solid that appeared round them. */
  unstick(slot: number): void;
}
