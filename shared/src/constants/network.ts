/**
 * Network-level constants. Must stay identical on client and server.
 */

/** Colyseus room registered by the server and joined by the client. */
export const ROOM_NAME = 'runarestaurant';

/**
 * Default server port. Override with the PORT env var on the server.
 *
 * Deliberately NOT 2567: the earlier games in this series occupy 2567-2650 on
 * the same machine, and sharing a port means whichever server starts first
 * silently serves both clients.
 */
export const DEFAULT_SERVER_PORT = 2820;

/**
 * Most players in ONE room - and so the number of restaurant plots in town.
 *
 * The matchmaker locks a room at this figure and opens another, so a
 * sixteenth player gets a new room rather than a refusal.
 */
export const MAX_PLAYERS_PER_ROOM = 15;

/**
 * How many OTHER players are drawn at once. A RENDERING limit only: every
 * player in the room is tracked and synchronised on every patch.
 */
export const VISIBLE_REMOTE_PLAYERS = 14;

/** Server simulation / state broadcast rate, in Hz. */
export const SERVER_TICK_RATE = 20;

/** Milliseconds between server ticks. */
export const SERVER_TICK_MS = 1000 / SERVER_TICK_RATE;

/**
 * Client->server and server->client message identifiers.
 *
 * A const object rather than an enum so it survives `verbatimModuleSyntax`.
 */
export const MessageType = {
  /** Client -> server: one frame of INPUT. Never a transform. */
  Move: 'move',
  /** Server -> client: authoritative placement. */
  Respawn: 'respawn',
  /** Client -> server: "put me back at the plaza". */
  RequestRespawn: 'requestRespawn',
  /** Client -> server: go to a named place, home, or somebody's restaurant. */
  Teleport: 'teleport',
  /** Client -> server: a restaurant verb (seat, order, cook, serve, wash, collect...). */
  Act: 'act',
  /** Client -> server: build mode. */
  Place: 'place',
  Pickup: 'pickup',
  MoveItem: 'moveItem',
  /** Client -> server: buy from the Shop, or refresh its shelves with Diamonds. */
  Buy: 'buy',
  Refresh: 'refresh',
  /** Client -> server: staff. */
  Hire: 'hire',
  Staff: 'staff',
  /** Client -> server: put a recipe on (or take it off) the menu. */
  Recipe: 'recipe',
  /** Client -> server: grow the restaurant, apply a structure style. */
  Expand: 'expand',
  Style: 'style',
  /** Client -> server: claim the current milestone, the daily Diamonds, a boost. */
  ClaimTask: 'claimTask',
  ClaimDaily: 'claimDaily',
  Boost: 'boost',
  /** Client -> server: the Pet Merchant (buy an egg, sell a pet) and the pet inventory (equip, unequip). */
  Pet: 'pet',
  /** Client -> server: cast a line, reel it in, or stop fishing. */
  Fish: 'fish',
  /** Client -> server: play a Bloxity emote (cosmetic; replicated through PlayerState.emote). */
  Emote: 'emote',
  /** Client -> server: like somebody's restaurant. */
  Like: 'like',
  /** Client -> server: the tutorial moved on, or was skipped. */
  Tutorial: 'tutorial',
  /** Client -> server: the player's Bloxity friends. */
  Friends: 'friends',

  /** Server -> client: the owner's private state (cash, items, fridge, skills...). */
  Self: 'self',
  /** Server -> client: the outcome of a request, for a toast. */
  Notice: 'notice',
  /** Server -> client: a one-off world effect. */
  Fx: 'fx',
  /** Server -> owner: a skill levelled up / the restaurant ranked up / the away report. */
  LevelUp: 'levelUp',
  RankUp: 'rankUp',
  Away: 'away',
  /** Server -> owner: an egg hatched / a fish was caught. */
  Hatch: 'hatch',
  Catch: 'catch',

  /** Client -> server: "this is what my Bloxity avatar looks like". */
  SetAvatar: 'setAvatar',
  /** Client -> server: the player's Bloxity DISPLAY NAME and portrait. */
  SetIdentity: 'setIdentity',
  /**
   * Client -> server: the portal's game TOKEN, or null when signed out. Never
   * an account id: the server asks Bloxity who the token belongs to.
   */
  SetAuth: 'setAuth',
  /** Server -> client: whose progress this session is now playing on. */
  AuthState: 'authState',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];
