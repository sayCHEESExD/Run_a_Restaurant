import {
  MessageType,
  ROOM_NAME,
  type ActVerb,
  type AuthStateMessage,
  type AwayMessage,
  type BoardId,
  type CatchMessage,
  type HatchMessage,
  type FxMessage,
  type LevelUpMessage,
  type MoveMessage,
  type NoticeMessage,
  type PlaceId,
  type RankUpMessage,
  type RespawnMessage,
  type SelfState,
  type SetAuthMessage,
  type SetAvatarMessage,
  type SetIdentityMessage,
} from '@restaurant/shared';
import { Client, type Room } from 'colyseus.js';
import { clientConfig } from '../config/clientConfig.js';
import { logger } from '../util/logger.js';
import { takeDeepLinkRoom } from './deepLink.js';
import type { ConnectionStatus, NetGameState, NetLeaderEntry, NetPlayerState, NetRestaurant } from './netTypes.js';

const SCOPE = 'NetworkClient';

/** Key under which this browser's stable player id is kept. */
const PLAYER_ID_KEY = 'restaurant.playerId';

/** Backoff between join attempts, in milliseconds. A cold host takes a while. */
const JOIN_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000] as const;

/**
 * The server's "storage unavailable" refusal. Not a failure of THIS join but
 * of the database behind it, so the retry does not give up: it keeps asking
 * at the longest backoff until the server can read profiles again.
 */
const STORAGE_UNAVAILABLE = 4105;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const resolvePlayerId = (): string => {
  const fresh = `p_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try {
    const existing = window.localStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    window.localStorage.setItem(PLAYER_ID_KEY, fresh);
  } catch {
    return fresh;
  }
  return fresh;
};

export interface NetworkHandlers {
  onStatusChange?(status: ConnectionStatus, detail?: string): void;
  onSelfJoined?(sessionId: string): void;
  onRespawn?(message: RespawnMessage): void;
  onSelf?(state: SelfState): void;
  onNotice?(message: NoticeMessage): void;
  onLevelUp?(message: LevelUpMessage): void;
  onRankUp?(message: RankUpMessage): void;
  onAway?(message: AwayMessage): void;
  onHatch?(message: HatchMessage): void;
  onCatch?(message: CatchMessage): void;
  onFx?(message: FxMessage): void;
  onAuthState?(message: AuthStateMessage): void;
  /** A state patch landed: players and restaurants may have changed. */
  onPatch?(): void;
}

/**
 * Thin wrapper over colyseus.js. The rest of the client never imports
 * colyseus.js directly, and never writes to the room: it READS the replicated
 * state (players, restaurants, clock, boards) and SENDS requests.
 */
export class NetworkClient {
  private readonly handlers: NetworkHandlers;
  private client: Client | null = null;
  private room: Room<NetGameState> | null = null;
  private status: ConnectionStatus = 'idle';
  private token: (() => string | null) | null = null;
  private sentToken: string | null | undefined = undefined;
  private look: (() => SetAvatarMessage | null) | null = null;
  private identityOf: (() => SetIdentityMessage) | null = null;

  /** The server's clock, sampled with the local clock it arrived at. */
  private serverNow = 0;
  private serverNowAt = 0;

  constructor(handlers: NetworkHandlers = {}) {
    this.handlers = handlers;
  }

  setLookProvider(provider: () => SetAvatarMessage | null): void {
    this.look = provider;
  }

  setTokenProvider(provider: () => string | null): void {
    this.token = provider;
  }

  setDisplayProvider(provider: () => SetIdentityMessage): void {
    this.identityOf = provider;
  }

  sendAvatar(message: SetAvatarMessage): void {
    this.room?.send(MessageType.SetAvatar, message);
  }

  sendIdentity(message: SetIdentityMessage): void {
    this.room?.send(MessageType.SetIdentity, message);
  }

  /**
   * Tell the server the login changed (sign-in, sign-out, account switch).
   * The live session switches profile; there is no reconnect. Deduped.
   */
  sendAuth(token: string | null): void {
    if (!this.room) return;
    if (token === this.sentToken) return;
    this.sentToken = token;
    const message: SetAuthMessage = { token };
    this.room.send(MessageType.SetAuth, message);
  }

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  get roomId(): string {
    return this.room?.roomId ?? '';
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  get connected(): boolean {
    return this.room !== null && this.status === 'connected';
  }

  /**
   * THE SERVER'S WALL CLOCK NOW (ms), extrapolated from its last sample.
   * Growth, restocks, weather and quests are all timed against this, so a
   * player whose own clock is wrong still sees the kitchen the server sees.
   */
  now(): number {
    if (this.serverNowAt === 0) return Date.now();
    return this.serverNow + (performance.now() - this.serverNowAt);
  }

  get state(): NetGameState | null {
    return this.room?.state ?? null;
  }

  get players(): NetGameState['players'] | null {
    return this.room?.state?.players ?? null;
  }

  restaurant(slot: number): NetRestaurant | null {
    return this.room?.state?.restaurants?.[slot] ?? null;
  }

  get restaurants(): ArrayLike<NetRestaurant> | null {
    return this.room?.state?.restaurants ?? null;
  }

  player(sessionId: string): NetPlayerState | null {
    return this.room?.state?.players?.get(sessionId) ?? null;
  }

  board(id: BoardId): NetLeaderEntry[] {
    const rows = this.room?.state?.leaderboard?.[id];
    const out: NetLeaderEntry[] = [];
    if (!rows) return out;
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (row && row.handle) out.push({ handle: row.handle, name: row.name, avatarUrl: row.avatarUrl, value: row.value });
    }
    return out;
  }

  async connect(): Promise<void> {
    if (!clientConfig.serverUrl) {
      this.setStatus('error');
      throw new Error('No game server is configured. Set VITE_SERVER_URL to the Colyseus endpoint (for example wss://your-server-host) and rebuild.');
    }

    this.setStatus('connecting');
    logger.info(SCOPE, `joining "${ROOM_NAME}" at ${clientConfig.serverUrl}`);

    this.client ??= new Client(clientConfig.serverUrl);
    const playerId = resolvePlayerId();
    const attempts = JOIN_BACKOFF_MS.length + 1;
    let joinedWith: string | null = null;

    // An invite link or the store page's Join button names a room: try it first, once.
    const linked = takeDeepLinkRoom();
    if (linked) {
      try {
        const token = this.token?.() ?? null;
        this.room = await this.client.joinById<NetGameState>(linked, {
          playerId,
          token,
          avatar: this.look?.() ?? undefined,
          identity: this.identityOf?.() ?? undefined,
        });
        joinedWith = token;
        logger.info(SCOPE, `joined the linked room ${linked}`);
      } catch (error) {
        // Gone, full, or held by another pod: the ordinary join below still gets them in.
        logger.warn(SCOPE, `linked room ${linked} could not be joined (${error instanceof Error ? error.message : String(error)}); joining any room`);
      }
    }

    for (let attempt = 1; !this.room; attempt += 1) {
      const token = this.token?.() ?? null;
      try {
        this.room = await this.client.joinOrCreate<NetGameState>(ROOM_NAME, {
          playerId,
          token,
          avatar: this.look?.() ?? undefined,
          identity: this.identityOf?.() ?? undefined,
        });
        joinedWith = token;
        break;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const code = (error as { code?: unknown }).code;
        const storageDown = code === STORAGE_UNAVAILABLE;
        logger.warn(SCOPE, `join attempt ${attempt}${storageDown ? '' : `/${attempts}`} failed: ${detail}`);
        if (!storageDown && attempt >= attempts) {
          this.setStatus('error', detail);
          throw error;
        }
        const wait = JOIN_BACKOFF_MS[Math.min(attempt, JOIN_BACKOFF_MS.length) - 1] ?? 0;
        this.setStatus('connecting', storageDown ? 'the server is waiting for its database' : `attempt ${attempt + 1}/${attempts}`);
        await sleep(wait);
      }
    }

    if (!this.room) throw new Error('join produced no room');

    this.sentToken = joinedWith;
    this.bindRoom(this.room);
    this.setStatus('connected');
    logger.info(SCOPE, `joined roomId=${this.room.roomId} sessionId=${this.room.sessionId}`);
    this.handlers.onSelfJoined?.(this.room.sessionId);
    this.sendAuth(this.token?.() ?? null);
  }

  // ---------------------------------------------------------------- requests

  sendInput(message: MoveMessage): void {
    this.room?.send(MessageType.Move, message);
  }

  teleport(to: PlaceId | 'home' | `visit:${number}`): void {
    this.room?.send(MessageType.Teleport, { to });
  }

  act(verb: ActVerb, id = 0): void {
    this.room?.send(MessageType.Act, { verb, id });
  }

  place(kind: number, x: number, z: number, rot: number): void {
    this.room?.send(MessageType.Place, { kind, x, z, rot });
  }

  pickup(id: number): void {
    this.room?.send(MessageType.Pickup, { id });
  }

  moveItem(id: number, x: number, z: number, rot: number): void {
    this.room?.send(MessageType.MoveItem, { id, x, z, rot });
  }

  buy(id: number, count = 1): void {
    this.room?.send(MessageType.Buy, { id, count });
  }

  refreshShop(): void {
    this.room?.send(MessageType.Refresh, {});
  }

  hire(staff: number): void {
    this.room?.send(MessageType.Hire, { staff });
  }

  staff(id: number, action: 'upgrade' | 'fire'): void {
    this.room?.send(MessageType.Staff, { id, action });
  }

  recipe(id: number, on: boolean): void {
    this.room?.send(MessageType.Recipe, { id, on });
  }

  expand(): void {
    this.room?.send(MessageType.Expand, {});
  }

  style(id: number): void {
    this.room?.send(MessageType.Style, { id });
  }

  claimTask(): void {
    this.room?.send(MessageType.ClaimTask, {});
  }

  claimDaily(): void {
    this.room?.send(MessageType.ClaimDaily, {});
  }

  boost(id: 'cash' | 'cook' | 'rush'): void {
    this.room?.send(MessageType.Boost, { id });
  }

  pet(action: 'buy' | 'equip' | 'unequip' | 'sell', extra: { egg?: number; uid?: number } = {}): void {
    this.room?.send(MessageType.Pet, { action, ...extra });
  }

  /** Play a Bloxity emote (cosmetic): the server replicates it to everyone. */
  emote(id: string): void {
    this.room?.send(MessageType.Emote, { id });
  }

  fish(action: 'cast' | 'reel' | 'stop'): void {
    this.room?.send(MessageType.Fish, { action });
  }

  like(slot: number): void {
    this.room?.send(MessageType.Like, { slot });
  }

  tutorial(skip: boolean): void {
    this.room?.send(MessageType.Tutorial, { skip });
  }

  friends(ids: string[]): void {
    this.room?.send(MessageType.Friends, { ids });
  }

  /** Dev builds only (the server ignores it without --dev-cheats). */
  dev(message: Record<string, unknown>): void {
    this.room?.send('dev', message);
  }

  requestRespawn(): void {
    this.room?.send(MessageType.RequestRespawn, {});
  }

  async disconnect(): Promise<void> {
    await this.room?.leave(true);
    this.room = null;
    this.sentToken = undefined;
    this.setStatus('disconnected');
  }

  private bindRoom(room: Room<NetGameState>): void {
    room.onStateChange((state) => {
      if (state.now > 0 && state.now !== this.serverNow) {
        this.serverNow = state.now;
        this.serverNowAt = performance.now();
      }
      this.handlers.onPatch?.();
    });

    room.onMessage<RespawnMessage>(MessageType.Respawn, (message) => this.handlers.onRespawn?.(message));
    room.onMessage<SelfState>(MessageType.Self, (message) => this.handlers.onSelf?.(message));
    room.onMessage<NoticeMessage>(MessageType.Notice, (message) => this.handlers.onNotice?.(message));
    room.onMessage<LevelUpMessage>(MessageType.LevelUp, (message) => this.handlers.onLevelUp?.(message));
    room.onMessage<RankUpMessage>(MessageType.RankUp, (message) => this.handlers.onRankUp?.(message));
    room.onMessage<AwayMessage>(MessageType.Away, (message) => this.handlers.onAway?.(message));
    room.onMessage<HatchMessage>(MessageType.Hatch, (message) => this.handlers.onHatch?.(message));
    room.onMessage<CatchMessage>(MessageType.Catch, (message) => this.handlers.onCatch?.(message));
    room.onMessage<FxMessage>(MessageType.Fx, (message) => this.handlers.onFx?.(message));
    room.onMessage<AuthStateMessage>(MessageType.AuthState, (message) => {
      logger.info(SCOPE, `playing as ${message.status}${message.note ? ` (${message.note})` : ''}`);
      this.handlers.onAuthState?.(message);
    });

    room.onError((code, message) => {
      logger.error(SCOPE, `room error ${code}: ${message ?? ''}`);
      this.setStatus('error', message);
    });

    room.onLeave((code) => {
      logger.warn(SCOPE, `left room (code ${code})`);
      this.setStatus('disconnected', `code ${code}`);
    });
  }

  private setStatus(status: ConnectionStatus, detail?: string): void {
    this.status = status;
    this.handlers.onStatusChange?.(status, detail);
  }
}
