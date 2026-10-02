import { LEADERBOARD_SIZE, RECIPES, SKILL, handleFor, levelOf, type BoardId } from '@restaurant/shared';
import type { Chef } from '../restaurant/Chef.js';
import type { LeaderEntry, LeaderboardState } from '../rooms/state/GameState.js';
import { profileStore } from './ProfileStore.js';

/** Seconds between rebuilds. A board is not a thing that needs 20 Hz. */
const REFRESH_SECONDS = 3;

const BOARDS: readonly BoardId[] = ['cash', 'served', 'rank', 'recipes', 'success', 'playtime', 'fish'];

type Figures = Record<BoardId, number>;

interface Candidate extends Figures {
  readonly handle: string;
  readonly name: string;
  readonly avatarUrl: string;
}

/** The figures a board ranks, from a profile's progress. */
const figuresOf = (p: { earned?: number; served?: number; rankPoints?: number; xp?: number[]; playSeconds?: number; restaurant?: { rating?: number }; bestFish?: { weight?: number } }): Figures => {
  const cooking = levelOf(p.xp?.[SKILL.cooking] ?? 0);
  const served = p.served ?? 0;
  const rating = p.restaurant?.rating ?? 0;
  return {
    cash: Math.floor(p.earned ?? 0),
    served,
    rank: p.rankPoints ?? 0,
    recipes: RECIPES.filter((r) => r.level <= cooking).length,
    // Success: a great rating over many customers.
    success: Math.floor(rating * Math.sqrt(served) * 10),
    playtime: Math.floor(p.playSeconds ?? 0),
    // Kilograms, to the hundredth.
    fish: Math.round((p.bestFish?.weight ?? 0) * 100),
  };
};

/**
 * The plaza's six boards - Most Cash, Customers Served, Rank, Recipes
 * Unlocked, Top Restaurants and Playtime - and every live owner's own place
 * on each. Every figure is the SERVER's, merged from stored profiles and live
 * owners, the live figure winning. Rebuilt on a timer.
 */
export class LeaderboardService {
  private timer = 0;

  update(delta: number, board: LeaderboardState, live: Iterable<Chef>): void {
    this.timer -= delta;
    if (this.timer > 0) return;
    this.timer = REFRESH_SECONDS;
    this.rebuild(board, live);
  }

  rebuild(board: LeaderboardState, live: Iterable<Chef>): void {
    const byHandle = new Map<string, Candidate>();
    for (const [id, profile] of profileStore.entries()) {
      if (profile.migratedTo) continue;
      const handle = handleFor(id);
      byHandle.set(handle, { handle, name: profile.displayName ?? '', avatarUrl: profile.avatarUrl ?? '', ...figuresOf(profile) });
    }
    const chefs = [...live];
    for (const chef of chefs) {
      if (!chef.key) continue;
      const handle = handleFor(chef.key);
      const rating = chef.restaurant?.state.rating ?? chef.profile.restaurant.rating;
      byHandle.set(handle, { handle, name: chef.player.displayName, avatarUrl: chef.player.avatarUrl, ...figuresOf({ ...chef.profile, restaurant: { rating } }) });
    }
    const all = [...byHandle.values()];
    for (const name of BOARDS) {
      const ranked = all.filter((c) => c[name] > 0).sort((a, b) => b[name] - a[name]);
      fill(board[name], ranked, name);
      for (const chef of chefs) {
        if (!chef.key) continue;
        const handle = handleFor(chef.key);
        const at = ranked.findIndex((c) => c.handle === handle);
        const rank = at >= 0 ? at + 1 : 0;
        if (chef.boards[name] !== rank) {
          chef.boards[name] = rank;
          chef.dirty = true;
        }
      }
    }
  }
}

/** Write the top N into a replicated array, in place. */
const fill = (into: LeaderEntry[], ranked: readonly Candidate[], board: BoardId): void => {
  for (let i = 0; i < LEADERBOARD_SIZE; i += 1) {
    const entry = into[i];
    if (!entry) continue;
    const candidate = ranked[i];
    const handle = candidate ? candidate.handle : '';
    const name = candidate ? candidate.name : '';
    const avatarUrl = candidate ? candidate.avatarUrl : '';
    const value = candidate ? Math.floor(candidate[board]) : 0;
    if (entry.handle !== handle) entry.handle = handle;
    if (entry.name !== name) entry.name = name;
    if (entry.avatarUrl !== avatarUrl) entry.avatarUrl = avatarUrl;
    if (entry.value !== value) entry.value = value;
  }
};

export const leaderboardService = new LeaderboardService();
