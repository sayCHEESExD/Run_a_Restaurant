import { Client, Room, ServerError } from '@colyseus/core';
import {
  BUX_PACKS,
  DOOR,
  ITEMS,
  MAX_PLAYERS_PER_ROOM,
  MessageType,
  PLACES,
  PLAYER_RADIUS,
  PLOT_SLOTS,
  SKILLS,
  SPAWN,
  TUTORIAL,
  accountKeyFor,
  insideShop,
  isAccountKey,
  isValidAccountId,
  isValidGuestId,
  plotEntrance,
  sanitizeAppearance,
  sanitizeIdentity,
  sanitizeProportions,
  type ActMessage,
  type ActVerb,
  type AuthStateMessage,
  type AuthStatus,
  type BoardId,
  type BoostMessage,
  type BuyMessage,
  type EmoteMessage,
  type FishMessage,
  isEmoteId,
  type FriendsMessage,
  type PetMessage,
  type FxMessage,
  type HireMessage,
  type LikeMessage,
  type MoveItemMessage,
  type MoveMessage,
  type NoticeMessage,
  type PickupMessage,
  type PlaceMessage,
  type Placement,
  type RecipeMessage,
  type RespawnMessage,
  type RespawnReason,
  type SelfState,
  type SetAuthMessage,
  type SetAvatarMessage,
  type SetIdentityMessage,
  type StaffMessage,
  type StyleMessage,
  type TeleportMessage,
  type TutorialMessage,
} from '@restaurant/shared';
import { tokenHash, verifyGameToken } from '../auth/BloxityAuth.js';
import { serverConfig } from '../config/serverConfig.js';
import { MovementService } from '../movement/MovementService.js';
import { hasProgress, progressOf, type ProfileFields, type ProgressFields, type StoredProfile } from '../persistence/index.js';
import { buxGrants } from '../progression/BuxGrants.js';
import { leaderboardService } from '../progression/LeaderboardService.js';
import { profileStore } from '../progression/ProfileStore.js';
import { addCash, addDiamonds, addStack, fridgeCapacity, setCarry, type Chef } from '../restaurant/Chef.js';
import { Progress, dayNumber } from '../restaurant/Progress.js';
import { RestaurantService } from '../restaurant/RestaurantService.js';
import type { RoomContext } from '../restaurant/RoomContext.js';
import { ShopService } from '../restaurant/ShopService.js';
import { FishingService } from '../restaurant/FishingService.js';
import { PetService } from '../restaurant/PetService.js';
import { logger } from '../util/logger.js';
import { rowsOf, statRegistry } from '../bloxity/statReporter.js';
import { GameState } from './state/GameState.js';
import { PlayerState } from './state/PlayerState.js';

const SCOPE = 'GameRoom';

/** Seconds between autosaves of every connected player. */
const AUTOSAVE_SECONDS = 15;
/** Milliseconds between looks for purchases waiting on an account. */
const GRANT_POLL_MS = 15_000;
/** Re-verification backoff for a token Bloxity could not be asked about. */
const REVERIFY_FIRST_MS = 15_000;
const REVERIFY_MAX_MS = 120_000;
/** How long a mid-session switch waits for the leaving profile to land before staying put. */
const SWITCH_SAVE_TIMEOUT_MS = 8000;
/** How long a leave or a dispose waits for its save to land before moving on. */
const LEAVE_SAVE_TIMEOUT_MS = 5000;
/** Longest token accepted. Bloxity's are a few hundred bytes. */
const MAX_TOKEN_LENGTH = 4096;
/** Least milliseconds between two gameplay requests from one player. */
const ACTION_GAP_MS = 60;
/** Least milliseconds between two `Self` snapshots to one player. */
const SELF_GAP_MS = 120;
/** How often the server clock is written into the state. */
const CLOCK_MS = 250;
/** The restaurant simulation runs at this rate (it is all timestamps; 10 Hz is plenty). */
const SIM_SECONDS = 0.1;

const ACT_VERBS: ReadonlySet<string> = new Set<ActVerb>(['seat', 'order', 'ticket', 'cook', 'plate', 'serve', 'dish', 'wash', 'cash', 'harvest', 'collect']);

/** Join refusals. The client's retry/backoff recognises STORAGE_UNAVAILABLE. */
export const JOIN_ERROR = {
  ROOM_FULL: 4103,
  BAD_PLAYER_ID: 4104,
  STORAGE_UNAVAILABLE: 4105,
} as const;

interface JoinOptions {
  /** The browser's own guest id. NEVER an account id; the prefix is refused. */
  playerId?: string;
  /** The portal's game token, or nothing. Verified with Bloxity, never trusted. */
  token?: string | null;
  avatar?: SetAvatarMessage;
  identity?: SetIdentityMessage;
}

/** What `onAuth` resolves and hands to `onJoin`. */
interface ResolvedProfile {
  readonly key: string;
  readonly guestKey: string;
  readonly accountKey: string | null;
  readonly token: string | null;
  readonly tokenHash: string;
  readonly status: AuthStatus;
  readonly profile: StoredProfile | null;
  readonly migrated: boolean;
}

/** Per-session identity bookkeeping the replicated state must not carry. */
interface Session {
  key: string;
  guestKey: string;
  accountKey: string | null;
  token: string | null;
  tokenHash: string;
  status: AuthStatus;
  /** True while a login change is being applied: autosaves and grants hold off. */
  switching: boolean;
  queued: SetAuthMessage | null;
  granting: boolean;
  reverifyAt: number;
  reverifyDelay: number;
  grantPollAt: number;
}

const emptyBoards = (): Record<BoardId, number> => ({ cash: 0, served: 0, rank: 0, recipes: 0, success: 0, playtime: 0, fish: 0 });

/**
 * The authoritative room.
 *
 * Composition only: every restaurant rule lives in a service, and this decides
 * the order they run in. The one hard rule: nothing a client sends is ever
 * copied into state. A Move is simulated; seating a customer, cooking, a
 * purchase or a placement is checked against the server's position of the
 * player, their own restaurant, items and purse - and each produces a result
 * the server writes.
 *
 * WHOSE PROGRESS A SESSION PLAYS ON is decided here too: the client sends its
 * browser id and the portal's TOKEN, Bloxity is asked whose token it is, and
 * the profile is READ FROM STORAGE in `onAuth`. A read that fails refuses the
 * join - a player is never seated on an empty profile that would autosave
 * over their real one.
 */
export class GameRoom extends Room<GameState> {
  override maxClients = MAX_PLAYERS_PER_ROOM;
  override autoDispose = true;

  private readonly movement = new MovementService();
  private readonly chefs = new Map<string, Chef>();
  /** Unregisters this room from the Bloxity stat reporter. */
  private stopStats: (() => void) | null = null;
  private readonly sessions = new Map<string, Session>();

  private readonly ctx: RoomContext = {
    state: undefined as unknown as GameState,
    collision: this.movement.collision,
    now: () => Date.now(),
    random: () => Math.random(),
    notify: (chef, kind, text) => this.clientOf(chef.sessionId)?.send(MessageType.Notice, { kind, text } satisfies NoticeMessage),
    send: (chef, type, payload) => this.clientOf(chef.sessionId)?.send(type, payload),
    fx: (message: FxMessage) => this.broadcast(MessageType.Fx, message),
    tutorial: (chef, step) => this.advanceTutorial(chef, step),
    xp: (chef, skill, amount) => this.progress.xp(chef, skill, amount),
    rankChanged: (chef) => this.progress.refreshRank(chef),
    chefs: () => this.chefs.values(),
    perk: (chef, perk) => this.pets.bonus(chef, perk),
    unstick: (slot) => this.unstick(slot),
  };

  private readonly progress = new Progress(this.ctx);
  private readonly shop = new ShopService(this.ctx);
  private readonly pets = new PetService(this.ctx);
  private readonly fishing = new FishingService(this.ctx, this.pets);
  private restaurants!: RestaurantService;

  private autosaveTimer = 0;
  private simTimer = 0;
  private clockAt = 0;

  override onCreate(): void {
    this.state = new GameState();
    (this.ctx as { state: GameState }).state = this.state;
    this.state.now = Date.now();
    this.restaurants = new RestaurantService(this.ctx, this.progress, [...this.state.restaurants], PLOT_SLOTS);
    this.setPatchRate(serverConfig.patchRateMs);
    // Bloxity profile stats: this room's account players, read from server state at each flush.
    this.stopStats = statRegistry.addSource(() => rowsOf(this.chefs.values()));

    this.onMessage(MessageType.Move, (client, message: MoveMessage) => this.onMove(client, message));
    this.onMessage(MessageType.RequestRespawn, (client) => this.placeAt(client, SPAWN, 'manual'));
    this.onMessage(MessageType.Teleport, (client, message: TeleportMessage) => this.onTeleport(client, message));
    this.onMessage(MessageType.SetIdentity, (client, message: SetIdentityMessage) => this.onSetIdentity(client, message));
    this.onMessage(MessageType.SetAvatar, (client, message: SetAvatarMessage) => this.onSetAvatar(client, message));
    this.onMessage(MessageType.SetAuth, (client, message: SetAuthMessage) => {
      void this.switchAuth(client, message, false);
    });

    this.action(MessageType.Act, (chef, m: ActMessage) => {
      if (typeof m?.verb === 'string' && ACT_VERBS.has(m.verb)) this.restaurants.act(chef, m.verb, Number(m.id));
    });
    this.action(MessageType.Place, (chef, m: PlaceMessage) => this.restaurants.place(chef, Number(m?.kind), Number(m?.x), Number(m?.z), Number(m?.rot)));
    this.action(MessageType.Pickup, (chef, m: PickupMessage) => this.restaurants.pickup(chef, Number(m?.id)));
    this.action(MessageType.MoveItem, (chef, m: MoveItemMessage) => this.restaurants.moveItem(chef, Number(m?.id), Number(m?.x), Number(m?.z), Number(m?.rot)));
    this.action(MessageType.Buy, (chef, m: BuyMessage) => this.shop.buy(chef, Number(m?.id), Number(m?.count)));
    this.action(MessageType.Refresh, (chef) => this.shop.refresh(chef));
    this.action(MessageType.Hire, (chef, m: HireMessage) => this.restaurants.hire(chef, Number(m?.staff)));
    this.action(MessageType.Staff, (chef, m: StaffMessage) => {
      if (m?.action === 'upgrade' || m?.action === 'fire') this.restaurants.staffAction(chef, Number(m.id), m.action);
    });
    this.action(MessageType.Recipe, (chef, m: RecipeMessage) => this.restaurants.toggleRecipe(chef, Number(m?.id), m?.on === true));
    this.action(MessageType.Expand, (chef) => this.restaurants.expand(chef));
    this.action(MessageType.Style, (chef, m: StyleMessage) => this.restaurants.applyStyle(chef, Number(m?.id)));
    this.action(MessageType.ClaimTask, (chef) => this.progress.claimTask(chef));
    this.action(MessageType.ClaimDaily, (chef) => this.progress.claimDaily(chef));
    this.action(MessageType.Boost, (chef, m: BoostMessage) => this.progress.boost(chef, String(m?.id)));
    this.action(MessageType.Pet, (chef, m: PetMessage) => {
      if (m?.action === 'buy') this.pets.buy(chef, Number(m.egg));
      else if (m?.action === 'equip' || m?.action === 'unequip') this.pets.equip(chef, Number(m.uid), m.action === 'equip');
      else if (m?.action === 'sell') this.pets.sell(chef, Number(m.uid));
    });
    this.action(MessageType.Fish, (chef, m: FishMessage) => {
      if (m?.action === 'cast') this.fishing.cast(chef);
      else if (m?.action === 'reel') this.fishing.reel(chef);
      else if (m?.action === 'stop') this.fishing.stop(chef);
    });
    this.action(MessageType.Emote, (chef, m: EmoteMessage) => this.onEmote(chef, m));
    this.action(MessageType.Like, (chef, m: LikeMessage) => this.onLike(chef, Number(m?.slot)));
    this.action(MessageType.Tutorial, (chef, m: TutorialMessage) => this.onTutorial(chef, m));
    this.action(MessageType.Friends, (chef, m: FriendsMessage) => this.onFriends(chef, m));
    if (serverConfig.devCheats) this.action('dev', (chef, m: DevMessage) => this.onDev(chef, m));

    this.setSimulationInterval((deltaMs) => this.tick(deltaMs / 1000), serverConfig.patchRateMs);
    logger.info(SCOPE, `room ${this.roomId} created (capacity ${MAX_PLAYERS_PER_ROOM})`);
  }

  /** A gameplay request: rate limited, and only for a seated owner. */
  private action<T>(type: string, handle: (chef: Chef, message: T) => void): void {
    this.onMessage(type, (client, message: T) => {
      const chef = this.chefs.get(client.sessionId);
      const session = this.sessions.get(client.sessionId);
      if (!chef || !session || session.switching) return;
      const now = Date.now();
      if (now - chef.lastActionAt < ACTION_GAP_MS) return;
      chef.lastActionAt = now;
      handle(chef, message);
    });
  }

  private clientOf(sessionId: string): Client | undefined {
    return this.clients.find((c) => c.sessionId === sessionId);
  }

  override async onAuth(client: Client, options: JoinOptions = {}): Promise<ResolvedProfile> {
    if (this.clients.length >= MAX_PLAYERS_PER_ROOM) {
      logger.warn(SCOPE, `refused a join: room ${this.roomId} is full (${this.clients.length}/${MAX_PLAYERS_PER_ROOM})`);
      throw new ServerError(JOIN_ERROR.ROOM_FULL, 'room is full');
    }
    const guestKey = readGuestKey(options.playerId);
    const token = readToken(options.token);
    try {
      return await this.resolveProfile(guestKey, token, null);
    } catch (error) {
      logger.error(SCOPE, `refused a join: storage unreachable for ${client.sessionId}:`, error);
      throw new ServerError(JOIN_ERROR.STORAGE_UNAVAILABLE, 'storage unavailable, try again shortly');
    }
  }

  override onJoin(client: Client, options: JoinOptions = {}, auth?: ResolvedProfile): void {
    const resolved: ResolvedProfile = auth ?? {
      key: '',
      guestKey: '',
      accountKey: null,
      token: null,
      tokenHash: '',
      status: 'guest',
      profile: null,
      migrated: false,
    };

    const player = new PlayerState();
    player.sessionId = client.sessionId;
    const now = Date.now();
    this.sessions.set(client.sessionId, {
      key: resolved.key,
      guestKey: resolved.guestKey,
      accountKey: resolved.accountKey,
      token: resolved.token,
      tokenHash: resolved.tokenHash,
      status: resolved.status,
      switching: false,
      queued: null,
      granting: false,
      reverifyAt: now + REVERIFY_FIRST_MS,
      reverifyDelay: REVERIFY_FIRST_MS,
      grantPollAt: now + GRANT_POLL_MS,
    });

    if (resolved.profile) {
      player.displayName = resolved.profile.displayName;
      player.avatarUrl = resolved.profile.avatarUrl;
    }
    if (options.avatar) this.writeAvatar(player, options.avatar);
    if (options.identity) {
      const identity = sanitizeIdentity(options.identity);
      if (identity.displayName) {
        player.displayName = identity.displayName;
        player.avatarUrl = identity.avatarUrl;
      }
    }

    const chef: Chef = {
      sessionId: client.sessionId,
      key: resolved.key,
      accountId: accountIdOf(resolved.accountKey),
      profile: profileStore.progressFrom(resolved.profile),
      player,
      restaurant: null,
      carry: { kind: 0, order: 0, recipe: 0 },
      dirty: true,
      lastSelfAt: 0,
      lastActionAt: 0,
      friendIds: new Set(),
      friends: 0,
      boards: emptyBoards(),
      fishing: null,
    };
    this.state.players.set(client.sessionId, player);
    this.chefs.set(client.sessionId, chef);
    this.movement.initialise(player);
    this.seat(chef, resolved.profile?.updatedAt ?? 0);
    this.pets.sync(chef);

    this.placeAt(client, this.homeOf(chef), 'join');
    this.sendAuthState(client, resolved.status);
    this.flushSelf(chef, true);
    if (resolved.accountKey) void this.applyGrants(client.sessionId);
    this.recountFriends();

    logger.info(
      SCOPE,
      `join ${client.sessionId} as ${describe(resolved)} (${resolved.profile ? 'restored' : 'new'}) ` +
        `plot=${chef.restaurant?.slot.index ?? -1} cash=${chef.profile.cash} items=${chef.profile.restaurant.items.length}`,
    );
  }

  /** Give an owner a restaurant (and pay what it earned while they were away). */
  private seat(chef: Chef, lastSeen: number): void {
    const free = this.restaurants.free();
    if (!free) return;
    this.restaurants.load(chef, free);
    this.shop.roll(chef);
    if (lastSeen > 0) {
      const away = this.restaurants.offlineIncome(chef, (Date.now() - lastSeen) / 1000);
      if (away && (away.cash > 0 || away.seconds >= 600)) this.ctx.send(chef, MessageType.Away, away);
    }
  }

  /** Where a player appears: in front of their restaurant's door, or the plaza without one. */
  private homeOf(chef: Chef): Placement {
    if (!chef.restaurant) return SPAWN;
    return plotEntrance(chef.restaurant.slot, DOOR.x);
  }

  override async onLeave(client: Client): Promise<void> {
    const chef = this.chefs.get(client.sessionId);
    const key = this.sessions.get(client.sessionId)?.key;
    const fields = chef ? this.fieldsOf(chef) : null;
    // Their last figures, before the restaurant is unloaded.
    if (chef) statRegistry.depart(chef);

    if (chef) this.restaurants.unload(chef);
    this.state.players.delete(client.sessionId);
    this.chefs.delete(client.sessionId);
    this.movement.forget(client.sessionId);
    this.sessions.delete(client.sessionId);
    this.recountFriends();

    logger.info(SCOPE, `leave ${client.sessionId}`);
    if (fields && key) await this.saveBounded(key, fields);
  }

  override async onDispose(): Promise<void> {
    for (const chef of this.chefs.values()) statRegistry.depart(chef);
    this.stopStats?.();
    this.stopStats = null;
    const saves: Promise<void>[] = [];
    for (const [sessionId, chef] of this.chefs) {
      const key = this.sessions.get(sessionId)?.key;
      if (key) saves.push(this.saveBounded(key, this.fieldsOf(chef)));
    }
    await Promise.all(saves);
    logger.info(SCOPE, `room ${this.roomId} disposed`);
  }

  // ------------------------------------------------------------- identity

  /**
   * WHOSE PROFILE, and the profile itself, read from storage now.
   *
   * With a token, Bloxity is asked. Verified -> the account key; the
   * account's own profile always wins. If the account has none and this
   * browser's guest has real progress, the guest's progress becomes the
   * account's - insert-only, so two pods racing for the same first login
   * create one profile - and the guest is then retired.
   *
   * Rejected -> a guest. Unavailable -> a guest FOR NOW, re-asked on a backoff.
   * Throws when storage cannot be read. Callers refuse or stay put.
   */
  private async resolveProfile(guestKey: string, token: string | null, live: ProfileFields | null): Promise<ResolvedProfile> {
    let status: AuthStatus = 'guest';
    let accountKey: string | null = null;
    const hash = token ? tokenHash(token) : '';
    if (token) {
      const outcome = await verifyGameToken(token);
      if (outcome.status === 'verified') {
        accountKey = accountKeyFor(outcome.accountId);
        status = 'account';
      } else if (outcome.status === 'unavailable') {
        status = 'unavailable';
      }
    }

    if (accountKey) {
      let profile = await profileStore.load(accountKey);
      let migrated = false;
      if (!profile && guestKey) {
        const guest = await profileStore.load(guestKey);
        const retired = Boolean(guest?.migratedTo);
        const source: ProfileFields | null =
          live ?? (guest ? { ...progressOf(guest), displayName: guest.displayName, avatarUrl: guest.avatarUrl, updatedAt: guest.updatedAt } : null);
        if (!retired && source && hasProgress(source)) {
          const created = { ...source, updatedAt: Date.now(), migratedFrom: guestKey };
          if (await profileStore.insertIfAbsent(accountKey, created)) {
            // Only AFTER the account holds it is the guest copy retired.
            await profileStore.retireGuest(guestKey, accountKey, progressOf(source), {
              displayName: source.displayName,
              avatarUrl: source.avatarUrl,
            });
            profile = await profileStore.load(accountKey);
            migrated = true;
            logger.info(SCOPE, `migrated guest ${guestKey} into ${accountKey} (cash=${source.cash})`);
          } else {
            logger.info(SCOPE, `lost the first-login race for ${accountKey}; loading the winner`);
            profile = await profileStore.load(accountKey);
          }
        }
      }
      return { key: accountKey, guestKey, accountKey, token, tokenHash: hash, status, profile, migrated };
    }

    const profile = guestKey ? await profileStore.load(guestKey) : null;
    return { key: guestKey, guestKey, accountKey: null, token, tokenHash: hash, status, profile, migrated: false };
  }

  /**
   * A LOGIN CHANGE ON THE LIVE SESSION: sign-in, sign-out, account switch, or
   * a re-ask about a token Bloxity was unavailable for. Save the profile being
   * left, resolve the new one, and re-seat the owner on it in the same plot.
   */
  private async switchAuth(client: Client, message: SetAuthMessage, reverify: boolean): Promise<void> {
    const session = this.sessions.get(client.sessionId);
    const chef = this.chefs.get(client.sessionId);
    if (!session || !chef) return;

    const token = readToken(message?.token);
    if (session.switching) {
      session.queued = { token };
      return;
    }
    const hash = token ? tokenHash(token) : '';
    if (!reverify && hash === session.tokenHash) return;

    session.switching = true;
    try {
      const leavingKey = session.key;
      const wasGuest = session.accountKey === null;
      const live = this.fieldsOf(chef);

      if (leavingKey) {
        const landed = await withTimeout(profileStore.save(leavingKey, live), SWITCH_SAVE_TIMEOUT_MS);
        if (!landed) {
          logger.warn(SCOPE, `${client.sessionId}: storage did not take the leaving save; staying on ${leavingKey}`);
          this.sendAuthState(client, session.status, 'storage unavailable; staying on the current profile');
          return;
        }
      }

      let target: ResolvedProfile;
      try {
        target = await this.resolveProfile(session.guestKey, token, wasGuest ? live : null);
      } catch (error) {
        logger.warn(SCOPE, `${client.sessionId}: storage unreachable during a login change; staying put:`, error);
        this.sendAuthState(client, session.status, 'storage unavailable; staying on the current profile');
        return;
      }

      session.token = target.token;
      session.tokenHash = target.tokenHash;
      if (target.status === 'unavailable') {
        session.reverifyDelay = Math.min(REVERIFY_MAX_MS, session.reverifyDelay * 2);
        session.reverifyAt = Date.now() + session.reverifyDelay;
      } else {
        session.reverifyDelay = REVERIFY_FIRST_MS;
      }

      if (target.key === session.key) {
        session.status = target.status;
        this.sendAuthState(client, target.status);
        return;
      }

      // Re-seat on the new profile, in the same plot.
      const plot = chef.restaurant;
      this.restaurants.unload(chef);
      setCarry(chef, 0);
      this.fishing.stop(chef);
      chef.profile = profileStore.progressFrom(target.profile);
      chef.key = target.key;
      chef.accountId = accountIdOf(target.accountKey);
      if (plot) this.restaurants.load(chef, plot);
      else this.seat(chef, 0);
      session.key = target.key;
      session.accountKey = target.accountKey;
      session.status = target.status;
      this.pets.sync(chef);
      this.placeAt(client, this.homeOf(chef), 'join');
      this.flushSelf(chef, true);
      this.recountFriends();

      if (target.key) await this.saveBounded(target.key, this.fieldsOf(chef));
      this.sendAuthState(client, target.status);
      leaderboardService.rebuild(this.state.leaderboard, this.chefs.values());
      logger.info(SCOPE, `${client.sessionId} switched ${leavingKey || '(none)'} -> ${describe(target)}${target.migrated ? ' [migrated]' : ''}`);
    } finally {
      session.switching = false;
      const queued = session.queued;
      session.queued = null;
      if (queued) void this.switchAuth(client, queued, false);
      else if (session.accountKey) void this.applyGrants(client.sessionId);
    }
  }

  private sendAuthState(client: Client, status: AuthStatus, note?: string): void {
    const message: AuthStateMessage = note ? { status, note } : { status };
    client.send(MessageType.AuthState, message);
  }

  // ---------------------------------------------------------------- input

  private onMove(client: Client, message: MoveMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    this.movement.applyInput(client.sessionId, player, message);
  }

  /** A teleport is to a NAMED place the server knows, home, or somebody's restaurant. */
  private onTeleport(client: Client, message: TeleportMessage): void {
    const chef = this.chefs.get(client.sessionId);
    if (!chef) return;
    const to = String(message?.to ?? '');
    if (to === 'home') {
      this.placeAt(client, this.homeOf(chef), 'teleport');
      return;
    }
    const visit = /^visit:(\d{1,2})$/.exec(to);
    if (visit) {
      const r = this.restaurants.restaurants[Number(visit[1])];
      if (r?.state.owner) this.placeAt(client, plotEntrance(r.slot, DOOR.x), 'teleport');
      return;
    }
    if (to in PLACES) this.placeAt(client, PLACES[to as keyof typeof PLACES], 'teleport');
  }

  private onLike(chef: Chef, slot: number): void {
    const r = this.restaurants.restaurants[Math.floor(slot)];
    if (!r?.owner || r.owner === chef) return;
    const owner = r.owner;
    const today = dayNumber(Date.now());
    if (chef.profile.likedDay !== today) {
      chef.profile.likedDay = today;
      chef.profile.likedKeys = [];
    }
    const ownerKey = owner.key || owner.sessionId;
    if (chef.profile.likedKeys.includes(ownerKey)) {
      this.ctx.notify(chef, 'info', 'You already liked this restaurant today!');
      return;
    }
    chef.profile.likedKeys.push(ownerKey);
    r.state.likes += 1;
    owner.profile.restaurant.likes = r.state.likes;
    chef.dirty = true;
    owner.dirty = true;
    this.ctx.notify(chef, 'good', `You liked ${owner.player.displayName || 'their'}'s restaurant!`);
    this.ctx.notify(owner, 'gold', `${chef.player.displayName || 'Someone'} liked your restaurant!`);
    this.ctx.fx({ kind: 'sparkle', slot: r.slot.index, x: -33, z: 2 });
  }

  private advanceTutorial(chef: Chef, step: number): void {
    if (chef.profile.tutorial !== step) return;
    chef.profile.tutorial = step + 1;
    chef.dirty = true;
    if (chef.profile.tutorial === TUTORIAL.done) this.finishTutorial(chef);
  }

  private finishTutorial(chef: Chef): void {
    addCash(chef, 150, false);
    chef.dirty = true;
    this.ctx.notify(chef, 'gold', 'Tutorial complete! Here is $150 to grow your restaurant.');
  }

  private onTutorial(chef: Chef, m: TutorialMessage): void {
    if (chef.profile.tutorial >= TUTORIAL.done) return;
    if (m?.skip === true) {
      // Skipping still leaves the player with what the tutorial would have given them.
      if (chef.profile.tutorial <= TUTORIAL.cash) addCash(chef, 100, false);
      chef.profile.tutorial = TUTORIAL.done;
      this.finishTutorial(chef);
      // The tutorial guest goes home.
      const r = chef.restaurant;
      if (r) for (const c of r.customers.values()) if (c.tutorial) this.restaurants.floor.leave(r, c, Date.now(), false);
    }
  }

  private onFriends(chef: Chef, m: FriendsMessage): void {
    const ids = Array.isArray(m?.ids) ? m.ids.slice(0, 300).filter((id): id is string => isValidAccountId(id)) : [];
    chef.friendIds = new Set(ids);
    this.recountFriends();
  }

  /** Only MUTUAL friends present in this server count, so nobody can claim a stranger. */
  private recountFriends(): void {
    const all = [...this.chefs.values()];
    for (const chef of all) {
      let friends = 0;
      if (chef.accountId) {
        for (const other of all) {
          if (other === chef || !other.accountId) continue;
          if (chef.friendIds.has(other.accountId) && other.friendIds.has(chef.accountId)) friends += 1;
        }
      }
      if (chef.friends !== friends) {
        chef.friends = friends;
        chef.dirty = true;
      }
    }
  }

  /** DEV ONLY (RESTAURANT_DEV_CHEATS=1): cash, diamonds, XP, every item, a teleport, a finished tutorial, a customer. */
  private onDev(chef: Chef, m: DevMessage): void {
    if (typeof m?.cash === 'number') addCash(chef, Math.min(1e12, m.cash), false);
    if (typeof m?.diamonds === 'number') addDiamonds(chef, Math.min(1e6, m.diamonds));
    if (typeof m?.xp === 'number') for (let i = 0; i < SKILLS.length; i += 1) this.progress.xp(chef, i, Math.min(1e7, m.xp));
    if (typeof m?.items === 'number') for (const def of ITEMS) if (def.zone !== 'none') addStack(chef.profile.inventory, def.id, Math.min(20, m.items));
    if (typeof m?.ingredients === 'number') for (let id = 1; id <= 9; id += 1) addStack(chef.profile.ingredients, id, Math.min(fridgeCapacity(chef), m.ingredients));
    if (m?.tutorial === true) chef.profile.tutorial = TUTORIAL.done;
    if (typeof m?.customer === 'number' && chef.restaurant) this.restaurants.floor.spawn(chef.restaurant, m.customer, Date.now());
    if (typeof m?.away === 'number') {
      const away = this.restaurants.offlineIncome(chef, Math.min(86_400, m.away));
      if (away) this.ctx.send(chef, MessageType.Away, away);
    }
    if (m?.bite === true && chef.fishing) chef.fishing.biteAt = Date.now();
    if (m?.ripen === true && chef.restaurant) for (const crop of chef.restaurant.itemsOf('crop')) crop.a = Date.now();
    if (Array.isArray(m?.tp) && m.tp.length === 2) {
      const client = this.clientOf(chef.sessionId);
      if (client) this.placeAt(client, { x: Number(m.tp[0]), y: 0, z: Number(m.tp[1]), yaw: chef.player.rotationY }, 'teleport');
    }
    this.progress.refreshRank(chef);
    chef.dirty = true;
  }

  // ------------------------------------------------------- identity events

  private onSetAvatar(client: Client, message: SetAvatarMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    this.writeAvatar(player, message);
  }

  private onSetIdentity(client: Client, message: SetIdentityMessage): void {
    const chef = this.chefs.get(client.sessionId);
    if (!chef) return;
    const identity = sanitizeIdentity(message);
    if (chef.player.displayName === identity.displayName && chef.player.avatarUrl === identity.avatarUrl) return;
    chef.player.displayName = identity.displayName;
    chef.player.avatarUrl = identity.avatarUrl;
    if (chef.restaurant) {
      chef.restaurant.state.ownerName = identity.displayName;
      chef.restaurant.state.ownerAvatar = identity.avatarUrl;
    }
    this.persist(chef);
  }

  /** A Bloxity emote: cosmetic, so only its shape is checked. Replicated to every client. */
  private onEmote(chef: Chef, message: EmoteMessage): void {
    const player = chef.player;
    if (!isEmoteId(message?.id) || player.speed > 1.5 || !player.grounded) return;
    player.emote = message.id.toLowerCase();
    player.emoteCount = (player.emoteCount + 1) % 65536;
  }

  private writeAvatar(player: PlayerState, message: SetAvatarMessage): void {
    player.avatar.apply(sanitizeAppearance(message?.appearance), sanitizeProportions(message?.proportions));
  }

  // ----------------------------------------------------------------- clock

  private tick(delta: number): void {
    const now = Date.now();
    this.state.elapsed += delta;
    if (now - this.clockAt >= CLOCK_MS) {
      this.clockAt = now;
      this.state.now = now;
    }
    this.tickSessions();
    this.simTimer += delta;
    if (this.simTimer >= SIM_SECONDS) {
      this.restaurants.tick(this.simTimer);
      this.simTimer = 0;
    }
    for (const chef of this.chefs.values()) {
      if (chef.player.ready) chef.profile.playSeconds += delta;
      this.shop.roll(chef);
      this.fishing.tick(chef);
      // Moving ends an emote for everybody (the owner's client stops it at once).
      if (chef.player.emote && (chef.player.speed > 1.5 || !chef.player.grounded)) chef.player.emote = '';
      if (chef.profile.tutorial === TUTORIAL.shop && insideShop(chef.player.x, chef.player.z, -1)) this.advanceTutorial(chef, TUTORIAL.shop);
      this.flushSelf(chef, false);
    }
    leaderboardService.update(delta, this.state.leaderboard, this.chefs.values());

    this.autosaveTimer += delta;
    if (this.autosaveTimer >= AUTOSAVE_SECONDS) {
      this.autosaveTimer = 0;
      for (const chef of this.chefs.values()) this.persist(chef);
    }
  }

  /** Send the owner their private state, when it changed (throttled). */
  private flushSelf(chef: Chef, force: boolean): void {
    if (!chef.dirty && !force) return;
    const now = Date.now();
    if (!force && now - chef.lastSelfAt < SELF_GAP_MS) return;
    const client = this.clientOf(chef.sessionId);
    if (!client) return;
    chef.dirty = false;
    chef.lastSelfAt = now;
    client.send(MessageType.Self, this.selfOf(chef));
  }

  private selfOf(chef: Chef): SelfState {
    const p = chef.profile;
    const today = dayNumber(Date.now());
    const likedSlots: number[] = [];
    if (p.likedDay === today) {
      for (const r of this.restaurants.restaurants) {
        const owner = r.owner;
        if (owner && p.likedKeys.includes(owner.key || owner.sessionId)) likedSlots.push(r.slot.index);
      }
    }
    const bought: Record<number, number> = {};
    for (const entry of p.bought) bought[entry.id] = entry.count;
    return {
      cash: p.cash,
      diamonds: p.diamonds,
      earned: p.earned,
      served: p.served,
      playSeconds: p.playSeconds,
      tutorial: p.tutorial,
      inventory: p.inventory,
      styles: p.styles,
      ingredients: p.ingredients,
      fridgeCap: fridgeCapacity(chef),
      xp: p.xp,
      recipesOff: p.recipesOff,
      index: p.index,
      shopEpoch: p.shopEpoch,
      shopSalt: p.shopSalt,
      bought,
      task: p.task,
      stats: this.progress.stats(chef),
      boosts: p.boosts,
      rank: this.progress.breakdown(chef),
      rating: chef.restaurant?.state.rating ?? p.restaurant.rating,
      boards: chef.boards,
      likedSlots,
      carry: chef.carry,
      dailyClaimed: p.dailyDay === today,
      pets: p.pets,
      petsEquipped: p.petsEquipped,
      fishIndex: p.fishIndex,
      bestFish: p.bestFish,
      fishing: chef.fishing ? { state: chef.fishing.state, water: chef.fishing.water, biteAt: chef.fishing.biteAt, until: chef.fishing.until } : null,
    };
  }

  /** Re-asks about tokens Bloxity was unavailable for, and polls for purchases. */
  private tickSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (session.switching) continue;
      if (session.status === 'unavailable' && session.token && now >= session.reverifyAt) {
        session.reverifyAt = now + session.reverifyDelay;
        const client = this.clientOf(sessionId);
        if (client) void this.switchAuth(client, { token: session.token }, true);
      }
      if (session.accountKey && now >= session.grantPollAt) {
        session.grantPollAt = now + GRANT_POLL_MS;
        void this.applyGrants(sessionId);
      }
    }
  }

  // ---------------------------------------------------------------- grants

  /**
   * Pay out what the webhook recorded for this account: CLAIM (atomic per
   * grant, so no other pod pays the same one), add the Cash and Diamonds,
   * SAVE the profile, and only then mark the grants applied.
   */
  private async applyGrants(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    const chef = this.chefs.get(sessionId);
    if (!session || !chef || !session.accountKey || session.switching || session.granting) return;
    const accountKey = session.accountKey;
    session.granting = true;
    try {
      const grants = await buxGrants.claim(accountKey);
      if (grants.length === 0) return;
      if (this.sessions.get(sessionId) !== session || session.accountKey !== accountKey || session.switching) {
        logger.warn(SCOPE, `left ${grants.length} claimed grant(s) for ${accountKey} to a later session`);
        return;
      }
      for (const grant of grants) {
        const pack = BUX_PACKS[grant.sku];
        if (grant.coins > 0) addCash(chef, grant.coins, false);
        if (pack && pack.diamonds > 0) addDiamonds(chef, pack.diamonds);
        if (pack) this.ctx.notify(chef, 'gold', `Thanks for your purchase! ${pack.name} added.`);
        logger.info(SCOPE, `granted ${grant.sku} to ${sessionId} [${grant.transactionId}]`);
      }
      await profileStore.save(accountKey, this.fieldsOf(chef));
      await buxGrants.settle(grants.map((grant) => grant.transactionId));
    } catch (error) {
      logger.warn(SCOPE, `could not pay grants for ${accountKey}: ${String(error)}`);
    } finally {
      session.granting = false;
    }
  }

  // ------------------------------------------------------------- placement

  /** THE one way a player is placed. */
  private placeAt(client: Client, placement: Placement, reason: RespawnReason): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    this.movement.teleport(client.sessionId, player, placement.x, placement.y, placement.z, placement.yaw);
    const message: RespawnMessage = { x: placement.x, y: placement.y, z: placement.z, rotationY: placement.yaw, reason };
    client.send(MessageType.Respawn, message);
  }

  /** Anyone a new wall or table appeared round is moved to that plot's door. */
  private unstick(slot: number): void {
    const r = this.restaurants.restaurants[slot];
    if (!r) return;
    for (const chef of this.chefs.values()) {
      const p = chef.player;
      if (!this.movement.collision.occupied(p.x, p.z, PLAYER_RADIUS * 0.9, p.y)) continue;
      const client = this.clientOf(chef.sessionId);
      if (client) this.placeAt(client, plotEntrance(r.slot, DOOR.x), 'teleport');
    }
  }

  // ----------------------------------------------------------------- saves

  /** Everything a save writes for a live owner: their profile with their restaurant folded back in. */
  private fieldsOf(chef: Chef): ProfileFields {
    const progress: ProgressFields = { ...chef.profile, restaurant: this.restaurants.snapshot(chef) };
    return { ...progress, displayName: chef.player.displayName, avatarUrl: chef.player.avatarUrl, updatedAt: Date.now() };
  }

  /** A routine save. Held while the session is changing login. */
  private persist(chef: Chef): void {
    const session = this.sessions.get(chef.sessionId);
    if (!session || !session.key || session.switching) return;
    void this.saveQuietly(session.key, this.fieldsOf(chef));
  }

  private async saveQuietly(key: string, fields: ProfileFields): Promise<void> {
    try {
      await profileStore.save(key, fields);
    } catch (error) {
      logger.error(SCOPE, `save of ${key} failed:`, error);
    }
  }

  /** A save that is waited for only so long; it stays queued and retried regardless. */
  private async saveBounded(key: string, fields: ProfileFields): Promise<void> {
    const landed = await withTimeout(this.saveQuietly(key, fields), LEAVE_SAVE_TIMEOUT_MS);
    if (!landed) logger.warn(SCOPE, `save of ${key} is queued; it lands when storage is back`);
  }
}

interface DevMessage {
  cash?: number;
  diamonds?: number;
  xp?: number;
  items?: number;
  ingredients?: number;
  tutorial?: boolean;
  customer?: number;
  away?: number;
  ripen?: boolean;
  bite?: boolean;
  tp?: number[];
}

/** The account id inside an account key, or null. */
const accountIdOf = (accountKey: string | null): string | null => (accountKey && isAccountKey(accountKey) ? accountKey.slice('bloxity:'.length) : null);

/** A guest key from a join option: valid, or empty when none was sent. Refuses the account prefix. */
const readGuestKey = (raw: unknown): string => {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw === 'string' && isAccountKey(raw)) {
    logger.warn(SCOPE, `refused a join: browser id carries the account prefix`);
    throw new ServerError(JOIN_ERROR.BAD_PLAYER_ID, 'invalid player id');
  }
  if (!isValidGuestId(raw)) {
    logger.warn(SCOPE, `refused a join: malformed browser id`);
    throw new ServerError(JOIN_ERROR.BAD_PLAYER_ID, 'invalid player id');
  }
  return raw;
};

const readToken = (raw: unknown): string | null =>
  typeof raw === 'string' && raw.length > 0 && raw.length <= MAX_TOKEN_LENGTH ? raw : null;

const describe = (resolved: ResolvedProfile): string => {
  if (resolved.accountKey) return `account ${resolved.accountKey}`;
  const key = resolved.guestKey || '(no id)';
  return resolved.status === 'unavailable' ? `guest ${key} (bloxity unavailable, will re-ask)` : `guest ${key}`;
};

/** True if the promise settled within the deadline; it keeps running either way. */
const withTimeout = (promise: Promise<unknown>, ms: number): Promise<boolean> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
