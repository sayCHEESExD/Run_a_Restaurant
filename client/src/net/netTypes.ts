import type { AvatarAppearance, AvatarProportions, BoardId } from '@restaurant/shared';
import type { MapSchema } from '@colyseus/schema';

/**
 * Client-side TYPE mirror of the server's Colyseus schema.
 *
 * Types only - colyseus.js builds the concrete schema instances at runtime
 * from the handshake reflection.
 */
export interface NetPlayerState {
  sessionId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed: number;
  verticalVelocity: number;
  grounded: boolean;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  lastInputSeq: number;
  jumpLatched: boolean;
  jumpCount: number;

  avatar: AvatarAppearance & AvatarProportions;
  displayName: string;
  avatarUrl: string;
  moveSpeed: number;
  jumpVelocity: number;

  slot: number;
  rank: number;
  carryKind: number;
  carryRecipe: number;
  pets: string;
  fishing: number;
  fishX: number;
  fishZ: number;
  emote: string;
  emoteCount: number;
  actionCount: number;
  ready: boolean;
}

export interface NetItem {
  id: number;
  kind: number;
  x: number;
  z: number;
  rot: number;
  a: number;
  b: number;
  c: number;
}

export interface NetCustomer {
  id: number;
  type: number;
  phase: number;
  seat: number;
  recipe: number;
  path: string;
  t0: number;
  speed: number;
  until: number;
  face: number;
}

export interface NetStaff {
  id: number;
  member: number;
  level: number;
  path: string;
  t0: number;
  speed: number;
  pose: number;
  face: number;
  carry: number;
  carryRecipe: number;
}

export interface NetOrder {
  id: number;
  customer: number;
  recipe: number;
  stage: number;
  at: number;
}

export interface NetRestaurant {
  slot: number;
  owner: string;
  ownerName: string;
  ownerAvatar: string;
  rank: number;
  rankPoints: number;
  served: number;
  rating: number;
  likes: number;
  tier: number;
  floor: number;
  wall: number;
  register: number;
  items: MapSchema<NetItem>;
  customers: MapSchema<NetCustomer>;
  staff: MapSchema<NetStaff>;
  orders: MapSchema<NetOrder>;
}

export interface NetLeaderEntry {
  handle: string;
  name: string;
  avatarUrl: string;
  value: number;
}

export type NetLeaderboardState = Record<BoardId, ArrayLike<NetLeaderEntry>>;

export interface NetGameState {
  players: MapSchema<NetPlayerState>;
  restaurants: ArrayLike<NetRestaurant>;
  now: number;
  elapsed: number;
  leaderboard: NetLeaderboardState;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
