import type { PlaceId } from '../config/town.js';
import type { AvatarAppearance, AvatarProportions } from './avatar.js';

/**
 * Client -> server input (MessageType.Move).
 *
 * INPUT ONLY. No position, velocity or target: the server simulates movement
 * from intent and owns the result.
 */
export interface MoveMessage {
  /** Monotonically increasing input sequence number. */
  seq: number;
  /** Seconds this input covers. Clamped and rate-limited server-side. */
  dt: number;
  /** -1..1, camera-relative. */
  moveX: number;
  /** -1..1, camera-relative. */
  moveZ: number;
  /** The jump control, held. Only a fresh press jumps. */
  jump: boolean;
  /** Yaw the camera faced: movement is camera-relative. */
  cameraYaw: number;
}

/** Why a player was placed. */
export type RespawnReason = 'manual' | 'join' | 'teleport';

/** Server -> client authoritative placement (MessageType.Respawn). */
export interface RespawnMessage {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  reason: RespawnReason;
}

export interface TeleportMessage {
  /** A named place, your own restaurant, or somebody's restaurant to visit ('visit:3'). */
  to: PlaceId | 'home' | `visit:${number}`;
}

/**
 * THE RESTAURANT VERBS, each aimed at one thing in your own restaurant:
 *
 *   seat     a waiting customer (id: customer)  -> they walk to a free seat
 *   order    a seated customer (customer)       -> the ticket goes up on the order stand
 *   ticket   the order stand                    -> take the oldest ticket
 *   cook     a stove (item)                     -> put the ticket in hand on it
 *   plate    the order stand                    -> take a finished plate
 *   serve    a customer (customer)              -> give them the plate in hand
 *   dish     a chair with a dirty dish (item)   -> pick the dish up
 *   wash     a sink (item)                      -> load the dish in hand
 *   cash     the register                       -> collect what customers paid
 *   harvest  a ripe crop plot (item)
 *   collect  an animal pen with produce (item)
 */
export type ActVerb = 'seat' | 'order' | 'ticket' | 'cook' | 'plate' | 'serve' | 'dish' | 'wash' | 'cash' | 'harvest' | 'collect';

export interface ActMessage {
  verb: ActVerb;
  id: number;
}

/** Place an item from your Items, plot-local. */
export interface PlaceMessage {
  kind: number;
  x: number;
  z: number;
  rot: number;
}

/** Pick a placed item back up into your Items, or move it in one go. */
export interface PickupMessage {
  id: number;
}

export interface MoveItemMessage {
  id: number;
  x: number;
  z: number;
  rot: number;
}

/** Buy from the Shop: from the keeper's menu, or straight off a display plinth. */
export interface BuyMessage {
  id: number;
  count: number;
}

export interface HireMessage {
  staff: number;
}

/** Level up, or let go, a hired staff member (by their slot in the roster). */
export interface StaffMessage {
  id: number;
  action: 'upgrade' | 'fire';
}

export interface RecipeMessage {
  id: number;
  on: boolean;
}

export interface StyleMessage {
  id: number;
}

export interface BoostMessage {
  id: 'cash' | 'cook' | 'rush';
}

export interface PetMessage {
  action: 'buy' | 'equip' | 'unequip' | 'sell';
  /** The egg to buy. */
  egg?: number;
  /** The pet (by its uid in the inventory). */
  uid?: number;
}

/**
 * Client -> server: the player chose a Bloxity emote in the portal's picker.
 * Cosmetic: only its shape is checked (the portal sends only emotes the player owns).
 */
export interface EmoteMessage {
  id: string;
}

/** A Bloxity emote catalogue id: 24 hex characters. */
export const isEmoteId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id);

export interface FishMessage {
  action: 'cast' | 'reel' | 'stop';
}

export interface LikeMessage {
  slot: number;
}

/** The tutorial moved on (or was skipped). */
export interface TutorialMessage {
  skip: boolean;
}

/** The player's Bloxity friends' account ids. */
export interface FriendsMessage {
  ids: string[];
}

// ---------------------------------------------------------- server -> client

/** Server -> client: what happened to a request, so the UI can say so. */
export interface NoticeMessage {
  kind: 'good' | 'bad' | 'info' | 'gold';
  text: string;
}

/** Server -> client: a one-off effect in the world, plot-local to `slot` (or world when slot is -1). */
export interface FxMessage {
  kind: 'pay' | 'cook' | 'ready' | 'serve' | 'clean' | 'harvest' | 'collect' | 'sparkle' | 'confetti' | 'buy' | 'place' | 'angry';
  slot: number;
  x: number;
  z: number;
  /** An amount (pay) or an id (recipe, ingredient). */
  value?: number;
}

/** Server -> owner: an egg hatched. */
export interface HatchMessage {
  pet: number;
  uid: number;
  egg: number;
}

/** Server -> owner: a fish was landed. */
export interface CatchMessage {
  fish: number;
  weight: number;
  /** Fish that went into the fridge (0 when it was full). */
  stored: number;
  /** A new personal best. */
  record: boolean;
}

/** Server -> owner: a skill went up. */
export interface LevelUpMessage {
  skill: number;
  level: number;
}

/** Server -> owner: the restaurant reached a new rank. */
export interface RankUpMessage {
  rank: number;
}

/** Server -> owner, on joining: what the restaurant earned while they were away. */
export interface AwayMessage {
  seconds: number;
  cash: number;
  served: number;
  crops: number;
}

export interface SetAvatarMessage {
  appearance: AvatarAppearance;
  proportions: AvatarProportions;
}

export interface SetIdentityMessage {
  displayName: string;
  avatarUrl: string;
}

/** Client -> server: the portal's game TOKEN, or null when signed out. */
export interface SetAuthMessage {
  token: string | null;
}

export type AuthStatus = 'account' | 'guest' | 'unavailable';

export interface AuthStateMessage {
  status: AuthStatus;
  note?: string;
}
