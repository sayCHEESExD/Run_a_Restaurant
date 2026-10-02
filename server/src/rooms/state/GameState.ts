import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import { LEADERBOARD_SIZE, PLOT_COUNT } from '@restaurant/shared';
import { PlayerState } from './PlayerState.js';
import { RestaurantState } from './RestaurantState.js';

/** One row of one board. */
export class LeaderEntry extends Schema {
  /** The row's KEY, derived from the account id. NEVER DRAWN. */
  @type('string') handle = '';
  /** THE NAME THE BOARD SHOWS: the portal's display name, or empty. */
  @type('string') name = '';
  @type('string') avatarUrl = '';
  @type('float64') value = 0;
}

/** The plaza's seven boards. Fixed-length, written in place. */
export class LeaderboardState extends Schema {
  @type([LeaderEntry]) cash = rows();
  @type([LeaderEntry]) served = rows();
  @type([LeaderEntry]) rank = rows();
  @type([LeaderEntry]) recipes = rows();
  @type([LeaderEntry]) success = rows();
  @type([LeaderEntry]) playtime = rows();
  @type([LeaderEntry]) fish = rows();
}

const rows = (): ArraySchema<LeaderEntry> => {
  const list = new ArraySchema<LeaderEntry>();
  for (let i = 0; i < LEADERBOARD_SIZE; i += 1) list.push(new LeaderEntry());
  return list;
};

const restaurants = (): ArraySchema<RestaurantState> => {
  const list = new ArraySchema<RestaurantState>();
  for (let i = 0; i < PLOT_COUNT; i += 1) {
    const restaurant = new RestaurantState();
    restaurant.slot = i;
    list.push(restaurant);
  }
  return list;
};

/** Root replicated state for one room. */
export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type([RestaurantState]) restaurants = restaurants();
  /** The server's wall clock (ms), so every client times cooking, crops, walks and restocks against the same clock. */
  @type('float64') now = 0;
  @type('float64') elapsed = 0;
  @type(LeaderboardState) leaderboard = new LeaderboardState();
}
