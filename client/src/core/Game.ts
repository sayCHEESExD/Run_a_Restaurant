import {
  BOARDS,
  BOOSTS,
  CARRY,
  CUSTOMER,
  DISPLAYS,
  DOOR,
  EGGS,
  PET_MERCHANT,
  bestRod,
  castFrom,
  fishById,
  RARITIES,
  BUILDING,
  MAX_TIER,
  PHASE,
  PLACES,
  PLOT_SLOTS,
  RANKS,
  RECIPES,
  SHOP,
  SHOP_REACH,
  SKILLS,
  STAGE,
  TASKS,
  TIERS,
  TUTORIAL,
  WorldCollision,
  buildStaticSolids,
  contentsOf,
  decodePath,
  formatAmount,
  formatPrice,
  formatTimer,
  insideBuilding,
  insideShop,
  itemAt,
  itemById,
  itemRect,
  itemSolidBoxes,
  placeProblem,
  plotAt,
  plotSolids,
  pointAlong,
  recipeById,
  restockEpoch,
  snapCentre,
  stockOf,
  toLocal,
  toWorld,
  toWorldBox,
  visibleName,
  type Aabb,
  type AwayMessage,
  type CatchMessage,
  type HatchMessage,
  type BoardId,
  type FxMessage,
  type LevelUpMessage,
  type NoticeMessage,
  type PlacedItem,
  type Point,
  type RankUpMessage,
  type SelfState,
} from '@restaurant/shared';
import { Group, Mesh, MeshBasicMaterial, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { AudioManager, type SoundName } from '../audio/AudioManager.js';
import { PlayerAudio } from '../audio/PlayerAudio.js';
import { AvatarDresser } from '../bloxity/AvatarDresser.js';
import { Bloxity } from '../bloxity/Bloxity.js';
import { lookFromLegion } from '../bloxity/avatarLook.js';
import { identityFromLegion } from '../bloxity/identity.js';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera.js';
import { clientConfig } from '../config/clientConfig.js';
import { InputManager } from '../input/InputManager.js';
import { buildIngredient } from '../models/food.js';
import { buildItem } from '../models/items.js';
import { NetworkClient } from '../net/NetworkClient.js';
import type { ConnectionStatus, NetCustomer, NetItem, NetLeaderEntry, NetRestaurant } from '../net/netTypes.js';
import { buildHeldModel, buildHeldRod, heldKeyOf } from '../player/held.js';
import { buildFish } from '../models/pets.js';
import { isEmoteId, loadEmotes } from '../animation/Emotes.js';
import { Companions, type CompanionOwner } from '../world/Companions.js';
import { HatchDialog, PetShopWindow } from '../ui/PetWindows.js';
import { LocalPlayer } from '../player/LocalPlayer.js';
import { GUIDE_LOOK, NpcCharacter } from '../player/NpcCharacter.js';
import { playerModelLoader } from '../player/PlayerModelLoader.js';
import { RemotePlayerManager } from '../player/RemotePlayerManager.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { RendererManager } from '../rendering/RendererManager.js';
import { SceneManager } from '../rendering/SceneManager.js';
import { BloxityPanel } from '../ui/BloxityPanel.js';
import { BuildBar } from '../ui/BuildBar.js';
import { AwayDialog, ConfirmDialog, PremiumWindow } from '../ui/Dialogs.js';
import { Hud } from '../ui/Hud.js';
import { IconFactory } from '../ui/IconFactory.js';
import { ManageWindow, type RestaurantSummary } from '../ui/ManageWindow.js';
import { anyModalOpen, closeAllModals, closeTopModal, el, icon } from '../ui/Modal.js';
import { ShopWindow } from '../ui/ShopWindow.js';
import { SkillsWindow } from '../ui/SkillsWindow.js';
import { TutorialOverlay } from '../ui/Tutorial.js';
import { VisitWindow, formatValue, type RestaurantListing } from '../ui/VisitWindow.js';
import { WorldOverlay, type PromptSpec } from '../ui/WorldOverlay.js';
import { logger } from '../util/logger.js';
import { Chevrons } from '../world/Chevrons.js';
import { Effects } from '../world/Effects.js';
import { RestaurantView, resetNpcBudget } from '../world/RestaurantView.js';
import { Sea } from '../world/Sea.js';
import { Sky } from '../world/Sky.js';
import { tickWater } from '../world/Terrain.js';
import { TownWorld } from '../world/TownWorld.js';

const SCOPE = 'Game';

const isTyping = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.isContentEditable || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT';
};

/** Where a ray first enters a box (distance along the ray), or null. */
const rayBox = (o: Vector3, d: Vector3, b: Aabb): number | null => {
  let near = -Infinity;
  let far = Infinity;
  for (const [origin, dir, min, max] of [
    [o.x, d.x, b.minX, b.maxX],
    [o.y, d.y, b.minY, b.maxY],
    [o.z, d.z, b.minZ, b.maxZ],
  ] as const) {
    if (Math.abs(dir) < 1e-9) {
      if (origin < min || origin > max) return null;
      continue;
    }
    let t1 = (min - origin) / dir;
    let t2 = (max - origin) / dir;
    if (t1 > t2) [t1, t2] = [t2, t1];
    near = Math.max(near, t1);
    far = Math.min(far, t2);
    if (near > far) return null;
  }
  return far < 0 ? null : Math.max(0, near);
};

/** How close (units) to get the prompt of each kind of thing. */
const REACH = { customer: 5.5, item: 2.6, sign: 5.5, keeper: 11, plinth: 5 } as const;
/** Restaurants within this camera distance draw their NPCs and live details. */
const DETAIL_RANGE = 150;
/** Overlays (bubbles, progress) show for restaurants this close to the player. */
const LABEL_RANGE = 70;

interface Target {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly distance: number;
  readonly prompts: PromptSpec[];
}

/**
 * THE COMPOSITION ROOT. Owns every subsystem and the per-frame order - input,
 * prediction, the replicated restaurants, prompts and labels, the HUD, build
 * mode, the tutorial, the render - and no gameplay rules: every customer,
 * order, purchase and dollar is the server's. The client asks, and draws what
 * the server says.
 */
export class Game {
  private readonly renderer: RendererManager;
  private readonly sceneManager = new SceneManager();
  private readonly camera = new ThirdPersonCamera();
  private readonly input = new InputManager();
  private readonly collision = new WorldCollision();
  private readonly network: NetworkClient;
  private readonly remotePlayers: RemotePlayerManager;
  private readonly sky = new Sky();
  private readonly sea = new Sea();
  private town!: TownWorld;
  private readonly views: RestaurantView[] = [];
  private readonly effects = new Effects();
  private readonly chevrons = new Chevrons();
  private readonly companions = new Companions((x, z) => this.effects.bubbles(x, 0.1, z));
  private readonly audio = new AudioManager();
  private readonly playerAudio: PlayerAudio;
  private readonly bloxity: Bloxity;
  private readonly bloxityPanel: BloxityPanel;
  private readonly fpsReadout: HTMLDivElement;
  private readonly occluders: Aabb[];

  private readonly icons: IconFactory;
  private readonly hud: Hud;
  private readonly overlay: WorldOverlay;
  private readonly shop: ShopWindow;
  private readonly manage: ManageWindow;
  private readonly skills: SkillsWindow;
  private readonly visit: VisitWindow;
  private readonly premium: PremiumWindow;
  private readonly confirm: ConfirmDialog;
  private readonly away: AwayDialog;
  private readonly build: BuildBar;
  private readonly petShop: PetShopWindow;
  private readonly hatch: HatchDialog;
  private lastBite = 0;
  /** Remote players already announced to the portal, by session, with their name. */
  private readonly announced = new Map<string, string>();
  /** False until the room's first roster has been read (those players were already here). */
  private rosterSeeded = false;
  private readonly tutorial: TutorialOverlay;

  private localPlayer: LocalPlayer | null = null;
  private dresser: AvatarDresser | null = null;
  private pendingAvatar: (() => void) | null = null;
  private guide: NpcCharacter | null = null;
  private localSessionId: string | null = null;
  private self: SelfState | null = null;
  private patched = false;
  /** The newest customer seen in your own restaurant, for the door chime. */
  private lastCustomer = 0;
  private building = false;
  private ghost: Group | null = null;
  private ghostKey = '';
  private ghostSpot: { x: number; z: number } | null = null;
  private readonly ghostMaterial = new MeshBasicMaterial({ color: 0x5aff7a, transparent: true, opacity: 0.5, depthWrite: false });
  private time = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private lastTutorial = -1;
  private readonly collisionKeys: string[] = [];
  private readonly pathCache = new Map<string, Point[]>();
  private readonly timers = new Map<string, { key: string; start: number }>();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly plane = new Plane(new Vector3(0, 1, 0), 0);
  private readonly hit = new Vector3();
  private readonly occludeFrom = new Vector3();
  private readonly occludeDir = new Vector3();
  private readonly handPosition = new Vector3();

  constructor(container: HTMLElement) {
    this.renderer = new RendererManager(container);
    this.icons = new IconFactory(this.renderer.renderer);
    this.remotePlayers = new RemotePlayerManager(this.sceneManager.scene, buildHeldModel);
    this.playerAudio = new PlayerAudio(this.audio);
    this.occluders = buildStaticSolids().filter((b) => b.maxY - b.minY >= 3.5 && (b.maxX - b.minX >= 2 || b.maxZ - b.minZ >= 2));

    this.overlay = new WorldOverlay(container);
    this.hud = new Hud(container, this.icons, {
      premium: () => this.openWindow(() => this.premium.open()),
      shopOrHome: () => this.shopOrHome(),
      manage: () => this.openWindow(() => this.manage.openTab('staff')),
      visit: () => this.openWindow(() => {
        this.refreshVisit();
        this.visit.openTab('restaurants');
      }),
      skills: () => this.openWindow(() => this.skills.openTab('skills')),
      items: () => this.toggleBuild(),
      rewards: () => this.pressRewards(),
      rank: () => this.openWindow(() => this.skills.openTab('rank')),
      like: () => this.likeHere(),
    });
    this.shop = new ShopWindow(container, this.icons, {
      buy: (id) => {
        this.audio.play('click');
        this.network.buy(id, 1);
      },
      refresh: () => this.network.refreshShop(),
    });
    this.manage = new ManageWindow(container, this.icons, {
      hire: (member) => this.network.hire(member),
      staff: (index, action) => {
        if (action === 'fire') this.confirm.ask('Let this staff member go? You will not get their hiring cost back.', 'Fire', () => this.network.staff(index, 'fire'));
        else this.network.staff(index, action);
      },
      recipe: (id, on) => this.network.recipe(id, on),
      expand: () => this.askExpand(),
      style: (id) => this.network.style(id),
      petEquip: (uid, on) => {
        this.audio.play('click');
        this.network.pet(on ? 'equip' : 'unequip', { uid });
      },
      petSell: (uid) => this.confirm.ask('Sell this pet back to the Pet Merchant?', 'Sell', () => this.network.pet('sell', { uid })),
      buyPet: () => this.goPetShop(),
    });
    this.petShop = new PetShopWindow(
      container,
      this.icons,
      (egg) => {
        this.audio.play('click');
        this.network.pet('buy', { egg });
      },
      () => {
        this.petShop.close();
        this.openWindow(() => this.manage.openTab('pets'));
      },
    );
    this.hatch = new HatchDialog(container, this.icons);
    this.skills = new SkillsWindow(container, this.icons, () => this.network.claimTask(), () => {
      closeAllModals();
      this.network.teleport('pier');
    });
    this.visit = new VisitWindow(container, this.icons, (slot) => {
      this.audio.play('click');
      closeAllModals();
      this.network.teleport(slot === this.mySlot() ? 'home' : `visit:${slot}`);
    });
    this.premium = new PremiumWindow(container, this.icons, {
      boost: (id) => this.network.boost(id),
      daily: () => this.network.claimDaily(),
      store: () => void this.bloxityPanel.openBux(),
    });
    this.confirm = new ConfirmDialog(container);
    this.away = new AwayDialog(container, this.icons);
    this.build = new BuildBar(container, this.icons, {
      done: () => this.setBuilding(false),
      changed: () => {
        this.ghostKey = '';
      },
      confirm: () => this.placeGhost(),
      shop: () => {
        this.setBuilding(false);
        this.shopOrHome(true);
      },
    });
    this.tutorial = new TutorialOverlay(container, this.icons.art('arrow'), () => {
      this.confirm.ask('Skip the tutorial? You can always find help in Manage and Skills.', 'Skip', () => {
        this.network.tutorial(true);
        this.hud.toast('Tutorial skipped. Good luck, chef!', 'info');
      });
    });

    this.bloxity = new Bloxity({
      setMasterVolume: (level) => this.audio.setMasterVolume(level),
      setMusicVolume: (level) => this.audio.setMusicVolume(level),
      setGraphicsQuality: (level) => this.renderer.setQuality(level),
      setShowFps: (show) => {
        this.fpsReadout.hidden = !show;
      },
      setCameraSensitivity: (scale) => this.input.look.setSensitivityScale(scale),
      respawn: () => this.network.requestRespawn(),
      pointerLockChanged: () => undefined,
      playEmote: (id) => this.playEmote(id),
      avatarChanged: (equipped, proportions) => {
        const look = lookFromLegion(equipped, proportions);
        this.network.sendAvatar(look);
        const apply = (): void => this.dresser?.setLook(look.appearance, look.proportions);
        if (this.dresser) apply();
        else this.pendingAvatar = apply;
      },
    });
    this.bloxityPanel = new BloxityPanel(container, this.bloxity);
    // The emote catalogue, once, at startup (the clips arrive long before anyone picks one).
    void loadEmotes();

    this.fpsReadout = el('div', 'aoe-fps aoe-font');
    this.fpsReadout.hidden = true;
    container.appendChild(this.fpsReadout);

    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keydown', this.onGesture);
    window.addEventListener('pointerdown', this.onGesture);
    this.renderer.onResize((width, height) => this.camera.setViewport(width, height));

    this.network = new NetworkClient({
      onStatusChange: (status) => this.onStatusChange(status),
      onSelfJoined: (sessionId) => {
        this.localSessionId = sessionId;
        // A new room: whoever is in it was already here.
        this.announced.clear();
        this.rosterSeeded = false;
        this.bloxity.updateRoom(this.network.roomId);
        void this.sendFriends();
      },
      onPatch: () => {
        this.patched = true;
      },
      onRespawn: (message) => {
        const player = this.localPlayer;
        if (!player) return;
        player.teleport(message.x, message.y, message.z, message.rotationY);
        this.input.look.setYaw(message.rotationY);
        if (message.reason === 'teleport') this.setBuilding(false);
      },
      onSelf: (state) => this.onSelf(state),
      onNotice: (message) => this.onNotice(message),
      onFx: (message) => this.onFx(message),
      onLevelUp: (message) => this.onLevelUp(message),
      onRankUp: (message) => this.onRankUp(message),
      onAway: (message) => this.onAway(message),
      onHatch: (message) => this.onHatch(message),
      onCatch: (message) => this.onCatch(message),
    });
    this.network.setTokenProvider(() => this.bloxity.getToken());
    this.network.setLookProvider(() => lookFromLegion(this.bloxity.getEquipped(), this.bloxity.getProportions()));
    this.network.setDisplayProvider(() => identityFromLegion(this.bloxity.getUser(), this.bloxity.getGuest()));
    this.bloxity.onUserChanged((user) => {
      this.network.sendAuth(this.bloxity.getToken());
      this.network.sendIdentity(identityFromLegion(user, this.bloxity.getGuest()));
      void this.sendFriends();
    });
  }

  // ------------------------------------------------------------- lifecycle

  /**
   * A Bloxity emote, chosen in the portal's picker: played on the local body at
   * once and replicated through the server. Cosmetic, so it can never break a
   * frame: an unknown id, a player mid-air or a catalogue that failed to load is
   * simply ignored. No ownership check - the portal only sends owned emotes.
   */
  private playEmote(id: string): void {
    try {
      if (!isEmoteId(id) || !this.localPlayer) return;
      const key = id.toLowerCase();
      void loadEmotes().then(() => {
        if (this.localPlayer?.character.playEmote(key)) this.network.emote(key);
      });
    } catch (error) {
      logger.warn(SCOPE, `emote ${id} failed: ${String(error)}`);
    }
  }

  startBloxity(): void {
    this.bloxity.start();
    document.body.classList.toggle('aoe-portal-embedded', this.bloxity.embedded);
  }

  loadingStep(text: string): void {
    this.bloxity.loadingStep(text);
  }

  async initialise(): Promise<void> {
    const scene = this.sceneManager.scene;
    await playerModelLoader.load();
    this.town = new TownWorld();
    for (const slot of PLOT_SLOTS) {
      const view = new RestaurantView(slot, {
        effect: (kind, x, y, z) => {
          if (kind === 'steam') this.effects.steam(x, y, z);
          else if (kind === 'sizzle') this.effects.sizzle(x, y, z);
          else this.effects.bubbles(x, y, z);
        },
      });
      this.views.push(view);
      scene.add(view.root);
    }
    scene.add(this.sky.root, this.sea.root, this.town.root, this.effects.root, this.chevrons.root, this.companions.root);

    this.localPlayer = new LocalPlayer(this.collision);
    this.dresser = new AvatarDresser(this.localPlayer.character);
    this.pendingAvatar?.();
    this.pendingAvatar = null;
    scene.add(this.localPlayer.character.root);
    this.camera.setMountHeight(this.localPlayer.character.height);
    this.localPlayer.teleport(PLACES.spawn.x, 0, PLACES.spawn.z, PLACES.spawn.yaw);
    this.camera.snapTo(this.localPlayer.position);
    this.guide = new NpcCharacter(GUIDE_LOOK);
    this.guide.root.visible = false;
    scene.add(this.guide.root);
    logger.info(SCOPE, 'world ready');
  }

  async connect(): Promise<void> {
    await this.network.connect();
  }

  start(): void {
    this.input.attach(this.renderer.renderer.domElement);
    this.bloxity.loadingEnd();
    this.bloxity.gameplayStart();
  }

  stop(): void {
    this.input.detach();
    this.bloxity.gameplayEnd();
    this.bloxity.updateRoom('');
    void this.network.disconnect();
  }

  private async sendFriends(): Promise<void> {
    if (!this.bloxity.isLoggedIn()) return;
    const friends = await this.bloxity.getFriends();
    this.network.friends(friends.map((friend) => friend._id).filter(Boolean));
  }

  /** The dev console's handle on the game (dev builds only). */
  get debug(): { network: NetworkClient; self: SelfState | null; player: LocalPlayer | null } {
    return { network: this.network, self: this.self, player: this.localPlayer };
  }

  // ----------------------------------------------------------------- frame

  update(delta: number, _now: number): void {
    const now = this.network.now();
    this.time += delta;
    const modal = anyModalOpen();
    this.input.setSuppressed(modal);
    const input = this.input.sample();
    const player = this.localPlayer;

    this.camera.setOrbit(this.input.look.yaw, this.input.look.pitch);
    this.camera.setZoom(this.input.look.zoom);

    if (this.patched) {
      this.patched = false;
      this.syncPlayers();
      this.syncCollision();
    }

    if (player) {
      player.update(delta, input, this.input.look.yaw);
      const placement = player.consumePlacement();
      if (placement !== 'none') this.camera.snapTo(player.position, false);
      this.camera.setTarget(player.position);
      this.sceneManager.followShadow(player.position.x, player.position.y, player.position.z);
      for (const message of player.drainOutgoing()) this.network.sendInput(message);
      this.playerAudio.update(delta, {
        horizontalSpeed: player.horizontalSpeed,
        isGrounded: player.isGrounded,
        jumpedEdge: player.jumpedEdge,
        landedEdge: player.landedEdge,
        hip: 1.5,
      });
      const carry = this.self?.carry ?? { kind: 0, recipe: 0 };
      if (this.self?.fishing) player.character.setHeld('rod', buildHeldRod);
      else player.character.setHeld(heldKeyOf(carry.kind, carry.recipe), () => buildHeldModel(carry.kind, carry.recipe));
      player.character.motion.tray = carry.kind === CARRY.plate || carry.kind === CARRY.dish;
    }

    const px = player?.position.x ?? 0;
    const pz = player?.position.z ?? 0;
    resetNpcBudget();
    this.syncRestaurants(now, delta);
    this.remotePlayers.advance(delta, player?.position ?? null);
    this.syncCompanions(delta);
    this.sky.follow(this.camera.camera.position.x, this.camera.camera.position.z);
    this.sky.update(delta);
    this.sea.update(delta);
    tickWater(delta);
    this.town.update(delta, px, pz);
    this.effects.update(delta);
    this.camera.update(delta, player?.horizontalSpeed ?? 0);
    this.occludeCamera();
    this.cutaway();

    this.overlay.begin(this.camera.camera, this.renderer.width, this.renderer.height);
    if (player) {
      if (!modal) this.handlePicks();
      this.updatePrompts(now, px, pz, modal);
      this.updateLabels(now, px, pz);
    }
    this.updateHud(now, px, pz);
    this.updateTutorial(now, delta);
    this.overlay.end();
    this.updateGhost();
    this.icons.pump();
    this.tickFps(delta);

    this.renderer.renderer.render(this.sceneManager.scene, this.camera.camera);
  }

  // ------------------------------------------------------------ replication

  private syncPlayers(): void {
    const players = this.network.players;
    if (!players) return;
    const seen = new Set<string>();
    players.forEach((state, sessionId) => {
      seen.add(sessionId);
      if (sessionId === this.localSessionId) {
        const player = this.localPlayer;
        if (!player) return;
        player.setParams(state.moveSpeed, state.jumpVelocity);
        player.setDisplayName(state.displayName, state.avatarUrl);
        if (state.ready) {
          player.reconcile({
            x: state.x,
            y: state.y,
            z: state.z,
            rotationY: state.rotationY,
            velocityX: state.velocityX,
            velocityY: state.velocityY,
            velocityZ: state.velocityZ,
            grounded: state.grounded,
            jumpLatched: state.jumpLatched,
            jumpCount: state.jumpCount,
            lastInputSeq: state.lastInputSeq,
          });
        }
        return;
      }
      if (this.remotePlayers.has(sessionId)) this.remotePlayers.update(sessionId, state);
      else this.remotePlayers.add(sessionId, state);
      this.announce(sessionId, state.displayName);
    });
    this.remotePlayers.retain(seen);
    for (const id of this.announced.keys()) if (!seen.has(id)) this.announced.delete(id);
    this.rosterSeeded = true;
  }

  /**
   * Tell the portal who is here, BY NAME (it matches its friends list on username or
   * display name, and toasts the friends it finds): everyone already in the room when we
   * arrive is `playerInRoom`, anyone after that `playerJoined`. Once per player, as soon
   * as their name is known.
   */
  private announce(sessionId: string, name: string): void {
    if (!name || this.announced.get(sessionId) === name) return;
    const first = !this.announced.has(sessionId);
    this.announced.set(sessionId, name);
    if (!first) return;
    if (this.rosterSeeded) this.bloxity.playerJoined(name);
    else this.bloxity.playerInRoom(name);
  }

  /** Pets after every player, and anyone's fishing line. */
  private syncCompanions(delta: number): void {
    const players = this.network.players;
    if (!players) return;
    const owners: CompanionOwner[] = [];
    players.forEach((state, id) => {
      const local = id === this.localSessionId && this.localPlayer;
      const p = local ? this.localPlayer!.position : state;
      const yaw = local ? this.localPlayer!.character.root.rotation.y : state.rotationY;
      owners.push({ id, x: p.x, y: p.y, z: p.z, yaw, pets: state.pets, fishing: state.fishing, fishX: state.fishX, fishZ: state.fishZ });
    });
    this.companions.update(owners, delta);
  }

  /** The walls and furniture into the local collision, so prediction agrees with the server. */
  private syncCollision(): void {
    const states = this.network.restaurants;
    if (!states) return;
    for (let i = 0; i < PLOT_SLOTS.length; i += 1) {
      const state = states[i];
      if (!state) continue;
      let sum = 0;
      state.items.forEach((item) => {
        sum += item.x * 7.1 + item.z * 3.3 + item.rot + item.kind * 0.37;
      });
      const key = state.owner ? `${state.tier}:${state.items.size}:${sum.toFixed(2)}` : '';
      if (key === this.collisionKeys[i]) continue;
      this.collisionKeys[i] = key;
      const slot = PLOT_SLOTS[i]!;
      this.collision.setGroup(`plot:${i}`, state.owner ? plotSolids(state.tier).map((b) => toWorldBox(slot, b)) : []);
      this.collision.setGroup(`items:${i}`, state.owner ? itemSolidBoxes(slot, state.items) : []);
    }
  }

  private mySlot(): number {
    if (!this.localSessionId) return -1;
    return this.network.player(this.localSessionId)?.slot ?? -1;
  }

  private myRank(): number {
    if (!this.localSessionId) return 0;
    return this.network.player(this.localSessionId)?.rank ?? 0;
  }

  private myRestaurant(): NetRestaurant | null {
    const slot = this.mySlot();
    return slot >= 0 ? this.network.restaurant(slot) : null;
  }

  private syncRestaurants(now: number, delta: number): void {
    const states = this.network.restaurants;
    const cam = this.camera.camera.position;
    for (let i = 0; i < this.views.length; i += 1) {
      const state = states?.[i];
      if (!state) continue;
      const view = this.views[i]!;
      const slot = PLOT_SLOTS[i]!;
      const centre = toWorld(slot, -10, 24);
      const detail = Math.hypot(cam.x - centre.x, cam.z - centre.z) < DETAIL_RANGE;
      view.update(state, now, delta, detail);
      if (i === this.mySlot()) this.chime(state);
    }
  }

  /** A door chime when a new customer walks in to your restaurant (while you are near it). */
  private chime(state: NetRestaurant): void {
    let newest = 0;
    state.customers.forEach((c) => {
      if (c.id > newest) newest = c.id;
    });
    if (newest > this.lastCustomer) {
      const p = this.localPlayer?.position;
      const door = this.world(this.mySlot(), DOOR.x, 0);
      if (this.lastCustomer > 0 && p && Math.hypot(p.x - door.x, p.z - door.z) < 60) this.audio.play('customer');
      this.lastCustomer = newest;
    }
  }

  /** The restaurant (slot) the local player is standing inside, or -1. */
  private insideSlot(): number {
    const p = this.localPlayer?.position;
    const states = this.network.restaurants;
    if (!p || !states) return -1;
    const slot = plotAt(p.x, p.z);
    if (slot < 0) return -1;
    const state = states[slot];
    if (!state?.owner) return -1;
    const l = toLocal(PLOT_SLOTS[slot]!, p.x, p.z);
    return insideBuilding(state.tier, l.x, l.z, 0.6) ? slot : -1;
  }

  /** Lift the roof and drop the near wall of the restaurant the player is in. */
  private cutaway(): void {
    const inside = this.insideSlot();
    const cam = this.camera.camera.position;
    const states = this.network.restaurants;
    this.views.forEach((view, i) => {
      const state = states?.[i];
      if (!state) return;
      const local = i === inside ? toLocal(PLOT_SLOTS[i]!, cam.x, cam.z) : null;
      view.setCutaway(i === inside || (this.building && i === this.mySlot()), local, state.tier);
    });
  }

  /**
   * THE CAMERA NEVER HIDES BEHIND A WALL: when the Shop's walls or a town
   * building stand between the player and the camera, it slides in along its
   * line of sight to just in front of them. Inside a restaurant the cutaway
   * does that job instead.
   */
  private occludeCamera(): void {
    const player = this.localPlayer;
    if (!player || this.insideSlot() >= 0) return;
    const cam = this.camera.camera.position;
    const from = this.occludeFrom.set(player.position.x, player.position.y + 2.6, player.position.z);
    const dir = this.occludeDir.subVectors(cam, from);
    const length = dir.length();
    if (length < 1) return;
    dir.divideScalar(length);
    let nearest = length;
    for (const b of this.occluders) {
      const t = rayBox(from, dir, b);
      if (t !== null && t > 0.5 && t < nearest) nearest = t;
    }
    if (nearest < length) cam.copy(from).addScaledVector(dir, Math.max(1.2, nearest - 0.5));
  }

  // ---------------------------------------------------------- positions

  private points(path: string): Point[] {
    let points = this.pathCache.get(path);
    if (!points) {
      if (this.pathCache.size > 600) this.pathCache.clear();
      points = decodePath(path);
      this.pathCache.set(path, points);
    }
    return points;
  }

  /** A customer's plot-local position now. */
  private customerAt(c: NetCustomer, now: number): Point {
    const at = pointAlong(this.points(c.path), (Math.max(0, now - c.t0) / 1000) * c.speed);
    return { x: at.x, z: at.z };
  }

  private world(slot: number, x: number, z: number): { x: number; z: number } {
    return toWorld(PLOT_SLOTS[slot]!, x, z);
  }

  /** Distance from a world point to an item's footprint. */
  private itemDistance(slot: number, item: NetItem, px: number, pz: number): number {
    const def = itemById(item.kind);
    if (!def) return Infinity;
    const l = toLocal(PLOT_SLOTS[slot]!, px, pz);
    const r = itemRect(def, item.x, item.z, item.rot);
    return Math.hypot(Math.max(r.minX - l.x, 0, l.x - r.maxX), Math.max(r.minZ - l.z, 0, l.z - r.maxZ));
  }

  // ------------------------------------------------------------- prompts

  private act(verb: Parameters<NetworkClient['act']>[0], id: number, sound: SoundName = 'pop', x?: number, z?: number): void {
    this.network.act(verb, id);
    this.audio.play(sound);
    this.localPlayer?.character.act('pick');
    if (x !== undefined && z !== undefined) this.localPlayer?.faceToward(x, z);
  }

  private nearestTarget(now: number, px: number, pz: number): Target | null {
    let best: Target | null = null;
    const offer = (target: Target): void => {
      if (target.prompts.length === 0) return;
      if (!best || target.distance < best.distance) best = target;
    };
    const self = this.self;
    const mine = this.mySlot();
    const carry = self?.carry ?? { kind: CARRY.none, order: 0, recipe: 0 };
    const free = carry.kind === CARRY.none;
    const state = mine >= 0 ? this.network.restaurant(mine) : null;
    const here = plotAt(px, pz, 8);

    // Your own restaurant.
    if (state?.owner && here === mine) {
      state.customers.forEach((c) => {
        const at = this.customerAt(c, now);
        const w = this.world(mine, at.x, at.z);
        const d = Math.hypot(w.x - px, w.z - pz);
        if (d > REACH.customer) return;
        const prompts: PromptSpec[] = [];
        const name = 'Customer';
        if (c.phase === PHASE.queued || c.phase === PHASE.arriving) prompts.push({ object: name, action: 'Seat', activate: () => this.act('seat', c.id, 'seat', w.x, w.z) });
        else if (c.phase === PHASE.ready) prompts.push({ object: name, action: 'Take Order', activate: () => this.act('order', c.id, 'order', w.x, w.z) });
        else if (c.phase === PHASE.waiting && carry.kind === CARRY.plate) {
          const order = state.orders.get(String(carry.order));
          if (order?.customer === c.id) prompts.push({ object: recipeById(order.recipe)?.name ?? '', action: 'Serve', activate: () => this.act('serve', c.id, 'serve', w.x, w.z) });
        }
        offer({ x: w.x, y: 4.4, z: w.z, distance: d, prompts });
      });
      let posted = 0;
      let ready = 0;
      state.orders.forEach((o) => {
        if (o.stage === STAGE.posted) posted += 1;
        if (o.stage === STAGE.ready) ready += 1;
      });
      state.items.forEach((item) => {
        const def = itemById(item.kind);
        if (!def) return;
        const d = this.itemDistance(mine, item, px, pz);
        if (d > REACH.item) return;
        const w = this.world(mine, item.x, item.z);
        const prompts: PromptSpec[] = [];
        switch (def.role) {
          case 'stand':
            if (free && posted > 0) prompts.push({ object: `${posted} ticket${posted === 1 ? '' : 's'}`, action: 'Grab Ticket', activate: () => this.act('ticket', item.id, 'pickup', w.x, w.z) });
            if (free && ready > 0) prompts.push({ object: `${ready} plate${ready === 1 ? '' : 's'}`, action: 'Grab Food', activate: () => this.act('plate', item.id, 'pickup', w.x, w.z) });
            break;
          case 'stove':
            if (carry.kind === CARRY.ticket && item.c === 0) prompts.push({ object: def.name, action: `Cook ${recipeById(carry.recipe)?.name ?? ''}`, activate: () => this.act('cook', item.id, 'sizzle', w.x, w.z) });
            break;
          case 'chair':
            if (item.b === 1 && free) prompts.push({ object: 'Dirty Dish', action: 'Pick Up', activate: () => this.act('dish', item.id, 'pickup', w.x, w.z) });
            break;
          case 'sink':
            if (carry.kind === CARRY.dish) prompts.push({ object: `${item.b}/${def.capacity ?? 0}`, action: 'Wash', activate: () => this.act('wash', item.id, 'wash', w.x, w.z) });
            break;
          case 'register':
            if (state.register >= 1) prompts.push({ object: `$${formatPrice(state.register)}`, action: 'Claim', activate: () => this.act('cash', item.id, 'cash', w.x, w.z) });
            break;
          case 'crop':
            if (now >= item.a) prompts.push({ object: def.name.replace(' Plot', ''), action: 'Harvest', activate: () => this.act('harvest', item.id, 'pop', w.x, w.z) });
            break;
          case 'animal':
            if (item.b > 0) prompts.push({ object: `${item.b} ready`, action: 'Collect', activate: () => this.act('collect', item.id, 'pop', w.x, w.z) });
            break;
        }
        offer({ x: w.x, y: Math.min(3.5, def.h + 1.6), z: w.z, distance: d + 0.2, prompts });
      });
      if (state.tier < MAX_TIER) {
        const sign = this.world(mine, -3, 2.5);
        const d = Math.hypot(sign.x - px, sign.z - pz);
        if (d <= REACH.sign) offer({ x: sign.x, y: 3.4, z: sign.z, distance: d + 1, prompts: [{ object: TIERS[state.tier + 1]!.name, action: 'Expand', activate: () => this.askExpand() }] });
      }
    }

    // Somebody else's restaurant: a like at their sign.
    if (here >= 0 && here !== mine) {
      const other = this.network.restaurant(here);
      if (other?.owner) {
        const sign = this.world(here, -33, 2);
        const d = Math.hypot(sign.x - px, sign.z - pz);
        const liked = self?.likedSlots.includes(here) ?? false;
        if (d <= REACH.sign) offer({ x: sign.x, y: 4.4, z: sign.z, distance: d, prompts: [{ object: `${visibleName(other.ownerName)}'s Restaurant`, action: liked ? 'Liked!' : 'Like', activate: () => this.likeHere() }] });
      }
    }

    // The Pet Merchant.
    const dm = Math.hypot(PET_MERCHANT.x + 3 - px, PET_MERCHANT.z - pz);
    if (dm <= 8) offer({ x: PET_MERCHANT.x, y: 4.4, z: PET_MERCHANT.z, distance: dm, prompts: [{ object: 'Pet Merchant', action: 'Buy Pets', activate: () => this.openPetShop() }] });

    // Fishing: the pier's end and the pond.
    const fishing = self?.fishing ?? null;
    if (fishing) {
      const bite = fishing.state === 2;
      offer({ x: px, y: 5.2, z: pz, distance: 0, prompts: [{ object: bite ? 'A fish is biting!' : 'Wait for the bobber to dip', action: bite ? 'Reel!' : 'Reel In', activate: () => {
        this.network.fish(bite ? 'reel' : 'stop');
        this.localPlayer?.character.act('pick');
      } }] });
    } else {
      const spot = castFrom(px, pz);
      if (spot) {
        const rod = bestRod(self?.styles ?? []);
        offer({ x: px, y: 4.4, z: pz, distance: 1.5, prompts: [{ object: spot.water === 'sea' ? 'Fishing Pier' : 'Park Pond', action: rod ? 'Cast' : 'Need a Rod', activate: () => {
          if (!rod) {
            this.hud.toast('Buy a fishing rod in the Shop (Fishing) - unlocks at Silver I.', 'info');
            return;
          }
          this.localPlayer?.faceToward(spot.x, spot.z);
          this.localPlayer?.character.act('pour');
          this.audio.play('water');
          this.network.fish('cast');
        } }] });
      }
    }

    // The Shop: the keeper and the display plinths.
    if (insideShop(px, pz, 2)) {
      const dk = Math.hypot(SHOP.keeper.x - px, SHOP.keeper.z - pz);
      if (dk <= REACH.keeper) offer({ x: SHOP.keeper.x, y: 4.6, z: SHOP.keeper.z, distance: dk - 3, prompts: [{ object: 'Shopkeeper', action: 'Shop', activate: () => this.openShop() }] });
      for (const display of DISPLAYS) {
        const d = Math.hypot(display.x - px, display.z - pz);
        if (d > REACH.plinth) continue;
        const def = itemById(display.item)!;
        const price = def.diamonds && !def.price ? `◆ ${def.diamonds}` : `$${formatPrice(def.price)}`;
        offer({
          x: display.x,
          y: 2.2,
          z: display.z,
          distance: d,
          prompts: [
            { object: def.name, action: `Buy ${price}`, activate: () => this.buyFromPlinth(def.id) },
            { object: def.name, action: 'Details', activate: () => this.openShop(def.id) },
          ],
        });
      }
    }
    return best;
  }

  private updatePrompts(now: number, px: number, pz: number, modal: boolean): void {
    if (modal || this.building) return;
    const target = this.nearestTarget(now, px, pz);
    const touch = document.body.classList.contains('aoe-touch-mode');
    if (target) this.overlay.setPrompts(target.prompts, target.x, target.y, target.z, touch);
  }

  private buyFromPlinth(id: number): void {
    this.audio.play('click');
    this.network.buy(id, 1);
  }

  // -------------------------------------------------------------- labels

  /** Order bubbles over waiting customers, progress over stoves and sinks, cash over the register, tags in the Shop. */
  private updateLabels(now: number, px: number, pz: number): void {
    const states = this.network.restaurants;
    const mine = this.mySlot();
    if (states) {
      for (let i = 0; i < states.length; i += 1) {
        const state = states[i];
        if (!state?.owner) continue;
        const centre = this.world(i, -10, 20);
        if (Math.hypot(centre.x - px, centre.z - pz) > LABEL_RANGE) continue;
        this.restaurantLabels(i, state, now, i === mine);
      }
    }
    // A price tag over the nearest display in the Shop.
    if (insideShop(px, pz, 2)) {
      let nearest: (typeof DISPLAYS)[number] | null = null;
      let best = 8;
      for (const display of DISPLAYS) {
        const d = Math.hypot(display.x - px, display.z - pz);
        if (d < best) {
          best = d;
          nearest = display;
        }
      }
      if (nearest) this.displayTag(nearest.item, nearest.x, nearest.z, now);
    }
  }

  private displayTag(id: number, x: number, z: number, now: number): void {
    const def = itemById(id);
    if (!def) return;
    const self = this.self;
    const epoch = restockEpoch(now);
    const left = stockOf(epoch, def, self && self.shopEpoch === epoch ? self.shopSalt : 0) - (self && self.shopEpoch === epoch ? (self.bought[id] ?? 0) : 0);
    const price = def.diamonds && !def.price ? `◆ ${def.diamonds}` : `$${formatPrice(def.price)}`;
    this.overlay.card(`display:${id}`, x, 4.6, z, `${id}:${left}`, () => {
      const card = el('div', 'rr-bubble rr-progress');
      const top = el('div', 'rr-progress__top');
      const words = el('div', 'rr-bubble__col');
      const name = el('div', 'rr-outline-thin', def.name);
      name.style.fontSize = 'max(12px, calc(24 * var(--u)))';
      words.append(name, el('div', 'rr-bubble__timer', def.desc), el('div', 'rr-bubble__timer', left > 0 ? `${left} remaining` : 'Sold out'), el('div', 'rr-bubble__price', price));
      top.append(words, icon(this.icons.item(id), 'rr-bubble__icon'));
      card.appendChild(top);
      return card;
    });
  }

  /** How far through a timed thing (a stove, a sink) is, from when it was first seen. */
  private progress(id: string, key: string, end: number, now: number): number {
    let timer = this.timers.get(id);
    if (!timer || timer.key !== key) {
      timer = { key, start: now };
      this.timers.set(id, timer);
    }
    const span = Math.max(1, end - timer.start);
    return Math.max(0, Math.min(1, (now - timer.start) / span));
  }

  private bar(fraction: number): HTMLDivElement {
    const bar = el('div', 'rr-bar rr-bubble__bar');
    const fill = el('div', 'rr-bar__fill');
    fill.style.width = `${Math.round(fraction * 100)}%`;
    bar.appendChild(fill);
    return bar;
  }

  private restaurantLabels(slot: number, state: NetRestaurant, now: number, mine: boolean): void {
    // Order bubbles: the dish, its price, and how patient they still are.
    state.customers.forEach((c) => {
      if (c.phase !== PHASE.waiting) return;
      const at = this.customerAt(c, now);
      const w = this.world(slot, at.x, at.z);
      const left = Math.max(0, (c.until - now) / 1000);
      const patience = left / CUSTOMER.foodPatience;
      const recipe = recipeById(c.recipe);
      this.overlay.card(`order:${slot}:${c.id}`, w.x, 4.2, w.z, `${c.recipe}:${Math.ceil(patience * 10)}`, () => {
        const card = el('div', 'rr-bubble');
        card.style.borderColor = RestaurantView.rarityColor(c.type);
        const col = el('div', 'rr-bubble__col');
        col.append(el('div', 'rr-bubble__price', `$${recipe?.price ?? 0}`), this.bar(patience));
        card.append(icon(this.icons.dish(c.recipe), 'rr-bubble__icon'), col);
        return card;
      });
    });
    state.items.forEach((item) => {
      const def = itemById(item.kind);
      if (!def) return;
      const w = this.world(slot, item.x, item.z);
      if (def.role === 'stove' && item.c !== 0) {
        const recipe = state.orders.get(String(item.c))?.recipe ?? 0;
        const fraction = this.progress(`stove:${item.id}`, `${item.c}`, item.a, now);
        const left = Math.max(0, (item.a - now) / 1000);
        this.overlay.card(`stove:${slot}:${item.id}`, w.x, 3.8, w.z, `${recipe}:${Math.round(fraction * 20)}:${Math.ceil(left)}`, () => {
          const card = el('div', 'rr-bubble rr-progress');
          const top = el('div', 'rr-progress__top');
          top.append(icon(this.icons.dish(recipe), 'rr-bubble__icon'), el('span', '', formatTimer(left)));
          card.append(top, this.bar(fraction));
          return card;
        });
      } else if (def.role === 'sink' && item.b > 0) {
        const fraction = this.progress(`sink:${item.id}`, `${item.b}:${item.a}`, item.a, now);
        const left = Math.max(0, (item.a - now) / 1000);
        this.overlay.card(`sink:${slot}:${item.id}`, w.x, 3.4, w.z, `${item.b}:${Math.round(fraction * 20)}:${Math.ceil(left)}`, () => {
          const card = el('div', 'rr-bubble rr-progress');
          const top = el('div', 'rr-progress__top');
          top.append(el('span', '', `${item.b}/${def.capacity ?? 0}`), el('span', '', formatTimer(left)));
          card.append(top, this.bar(fraction));
          return card;
        });
      } else if (def.role === 'register' && mine && state.register >= 1) {
        const amount = Math.floor(state.register);
        this.overlay.card(`register:${slot}`, w.x, 3.6 + Math.sin(now / 300) * 0.15, w.z, `${amount}`, () => {
          const box = el('div', 'rr-collect');
          box.append(el('div', 'rr-collect__label rr-outline', 'Collect:'), el('div', 'rr-collect__amount rr-outline', `$${formatAmount(amount)}`), el('div', 'rr-collect__arrow'));
          return box;
        });
      } else if (mine && def.role === 'crop' && now >= item.a) {
        this.overlay.card(`crop:${slot}:${item.id}`, w.x, 2.4, w.z, 'ripe', () => el('div', 'rr-ready rr-outline', 'Ready!'));
      } else if (mine && def.role === 'animal' && item.b > 0) {
        this.overlay.card(`pen:${slot}:${item.id}`, w.x, 3, w.z, `${item.b}`, () => {
          const tag = el('div', 'rr-bubble');
          tag.append(icon(this.icons.ingredient(def.produces ?? 7), 'rr-bubble__icon'), el('span', 'rr-bubble__price', `x${item.b}`));
          return tag;
        });
      }
    });
  }

  // ---------------------------------------------------------------- picks

  private rayFrom(x: number, y: number): void {
    this.pointer.set((x / this.renderer.width) * 2 - 1, -(y / this.renderer.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera.camera);
  }

  private groundHit(): Vector3 | null {
    this.plane.constant = 0;
    return this.raycaster.ray.intersectPlane(this.plane, this.hit) ? this.hit : null;
  }

  private handlePicks(): void {
    for (const pick of this.input.look.consumePicks()) {
      if (!this.building) continue;
      this.rayFrom(pick.x, pick.y);
      const touch = document.body.classList.contains('aoe-touch-mode');
      const local = this.buildPoint();
      if (!local) continue;
      if (touch) {
        // A tap moves the ghost; the Place button puts it down.
        this.ghostSpot = local;
        if (!this.build.selected && !this.build.movingId) this.pickItemAt(local);
        continue;
      }
      this.ghostSpot = local;
      if (this.build.selected || this.build.movingId) this.placeGhost();
      else this.pickItemAt(local);
    }
  }

  // ----------------------------------------------------------- build mode

  private toggleBuild(): void {
    this.setBuilding(!this.building);
  }

  private setBuilding(on: boolean): void {
    if (on === this.building) return;
    if (on && !this.myRestaurant()?.owner) {
      this.hud.toast('You do not have a restaurant yet.', 'bad');
      return;
    }
    this.building = on;
    this.build.setOpen(on);
    this.build.setState(this.self);
    this.build.setTouch(document.body.classList.contains('aoe-touch-mode'));
    this.hud.setItemsActive(on);
    this.ghostKey = '';
    this.ghostSpot = null;
    if (on) {
      closeAllModals();
      this.audio.play('open');
      const p = this.localPlayer?.position;
      const mine = this.mySlot();
      if (p && mine >= 0 && plotAt(p.x, p.z, 6) !== mine) this.network.teleport('home');
    }
  }

  /** Where the current ray meets your own plot (plot-local), or null. */
  private buildPoint(): { x: number; z: number } | null {
    const mine = this.mySlot();
    if (mine < 0) return null;
    const hit = this.groundHit();
    if (!hit) return null;
    return toLocal(PLOT_SLOTS[mine]!, hit.x, hit.z);
  }

  /** The kind the ghost shows: a fresh item, or the one being moved. */
  private ghostKind(): number {
    if (this.build.selected) return this.build.selected;
    if (this.build.movingId) return this.myRestaurant()?.items.get(String(this.build.movingId))?.kind ?? 0;
    return 0;
  }

  private pickItemAt(local: { x: number; z: number }): void {
    const state = this.myRestaurant();
    if (!state) return;
    const item = itemAt(contentsOf(state as unknown as { tier: number; items: { forEach(v: (i: PlacedItem) => void): void } }), local.x, local.z);
    if (!item) return;
    const def = itemById(item.kind);
    if (this.build.moving) {
      this.build.movingId = item.id;
      this.build.rot = item.rot;
      this.ghostKey = '';
      this.audio.play('pickup');
      this.hud.toast(`Moving the ${def?.name}. Click where it should go.`, 'info');
    } else {
      this.confirm.ask(`Pick up the ${def?.name ?? 'item'}? It goes back to your Items.`, 'Pick Up', () => {
        this.audio.play('pickup');
        this.network.pickup(item.id);
      });
    }
  }

  private placeGhost(): void {
    const state = this.myRestaurant();
    const spot = this.ghostSpot;
    const kind = this.ghostKind();
    if (!state || !spot || !kind) return;
    const x = snapCentre(spot.x);
    const z = snapCentre(spot.z);
    const contents = contentsOf(state as unknown as { tier: number; items: { forEach(v: (i: PlacedItem) => void): void } });
    const problem = placeProblem(contents, kind, x, z, this.build.rot, this.build.movingId);
    if (problem) {
      this.hud.toast(problem, 'bad');
      this.audio.play('refuse');
      return;
    }
    this.audio.play('place');
    if (this.build.movingId) {
      this.network.moveItem(this.build.movingId, x, z, this.build.rot);
      this.build.movingId = 0;
      this.ghostKey = '';
    } else this.network.place(kind, x, z, this.build.rot);
  }

  /** The placement preview: the item under the pointer, green when it fits, red when not. */
  private updateGhost(): void {
    const kind = this.building ? this.ghostKind() : 0;
    const touch = document.body.classList.contains('aoe-touch-mode');
    const pointer = this.input.look.pointer;
    if (this.building) {
      const hint = this.build.moving
        ? this.build.movingId
          ? `${touch ? 'Tap' : 'Click'} where it should go - R rotates`
          : `${touch ? 'Tap' : 'Click'} an item to pick it up and move it`
        : kind
          ? `${touch ? 'Tap a spot, then Place' : 'Click to place'} - R rotates${itemById(kind)?.role === 'chair' ? ' - chairs must touch a table' : ''}`
          : `Pick an item below, or ${touch ? 'tap' : 'click'} a placed item to pick it up`;
      this.build.setHint(hint);
    }
    if (!kind) {
      if (this.ghost) this.ghost.visible = false;
      return;
    }
    if (!touch && pointer && !this.input.look.dragging) {
      this.rayFrom(pointer.x, pointer.y);
      const local = this.buildPoint();
      if (local) this.ghostSpot = local;
    }
    const spot = this.ghostSpot;
    const mine = this.mySlot();
    const state = this.myRestaurant();
    if (!spot || mine < 0 || !state) {
      if (this.ghost) this.ghost.visible = false;
      return;
    }
    const key = `${kind}:${this.build.rot}`;
    if (key !== this.ghostKey) {
      this.ghostKey = key;
      this.ghost?.removeFromParent();
      const b = new PartBuilder();
      buildItem(b, kind);
      const group = b.build('ghost', false);
      group.traverse((child) => {
        const mesh = child as Mesh;
        if (mesh.isMesh) mesh.material = this.ghostMaterial;
      });
      group.rotation.y = this.build.rot * (Math.PI / 2);
      this.ghost = group;
      this.views[mine]!.root.add(group);
    }
    if (!this.ghost) return;
    const x = snapCentre(spot.x);
    const z = snapCentre(spot.z);
    this.ghost.visible = true;
    this.ghost.position.set(x, 0.04, z);
    const contents = contentsOf(state as unknown as { tier: number; items: { forEach(v: (i: PlacedItem) => void): void } });
    const ok = placeProblem(contents, kind, x, z, this.build.rot, this.build.movingId) === null;
    this.ghostMaterial.color.setHex(ok ? 0x5aff7a : 0xff5a5a);
  }

  // ------------------------------------------------------------- windows

  private openWindow(open: () => void): void {
    this.audio.play('open');
    this.setBuilding(false);
    this.pushWindowState();
    open();
  }

  private openShop(item = 0): void {
    this.audio.play('open');
    this.setBuilding(false);
    this.pushWindowState();
    if (item) this.shop.showItem(item);
    else this.shop.open();
  }

private openPetShop(): void {
    this.audio.play('open');
    this.setBuilding(false);
    this.pushWindowState();
    this.petShop.open();
  }

  /** Walk over to the Pet Merchant (from the pet inventory's Buy a Pet). */
  private goPetShop(): void {
    closeAllModals();
    this.network.teleport('pets');
    window.setTimeout(() => this.openPetShop(), 250);
  }

  /** The rail's Shop button takes you to the Shop (and opens it); near the Shop it takes you home. */
  private shopOrHome(forceShop = false): void {
    const p = this.localPlayer?.position;
    const atShop = !!p && insideShop(p.x, p.z, 30);
    this.audio.play('click');
    closeAllModals();
    if (atShop && !forceShop) {
      this.network.teleport('home');
      return;
    }
    this.network.teleport('shop');
    window.setTimeout(() => this.openShop(), 250);
  }

  private askExpand(): void {
    const state = this.myRestaurant();
    const next = state ? TIERS[state.tier + 1] : undefined;
    if (!state || !next) return;
    const ok = this.myRank() >= next.rank;
    if (!ok) {
      this.hud.toast(`The ${next.name} needs ${RANKS[next.rank]!.name} rank.`, 'bad');
      return;
    }
    this.confirm.ask(`Expand to the ${next.name} for $${formatPrice(next.price)}? Your restaurant grows to ${next.w}x${next.d} with room for ${next.staff} staff.`, 'Expand!', () => this.network.expand(), 'Expand Restaurant');
  }

  private pressRewards(): void {
    const self = this.self;
    const task = self ? TASKS[self.task] : undefined;
    if (self && task && (self.stats[task.stat] ?? 0) >= task.target) {
      this.network.claimTask();
      this.audio.play('claim');
      return;
    }
    this.openWindow(() => this.skills.openTab('milestones'));
  }

  private likeHere(): void {
    const p = this.localPlayer?.position;
    if (!p) return;
    const slot = plotAt(p.x, p.z, 8);
    if (slot < 0 || slot === this.mySlot()) return;
    if (this.self?.likedSlots.includes(slot)) {
      this.hud.toast('You already liked this restaurant today!', 'info');
      return;
    }
    this.audio.play('claim');
    this.network.like(slot);
  }

  /** Everything the windows show comes from the latest state. */
  private pushWindowState(): void {
    const self = this.self;
    const rank = this.myRank();
    const now = this.network.now();
    this.shop.setState(self, rank, now);
    const state = this.myRestaurant();
    const summary: RestaurantSummary | null = state
      ? {
          tier: state.tier,
          served: state.served,
          rating: state.rating,
          likes: state.likes,
          floor: state.floor,
          wall: state.wall,
          staff: [...state.staff.values()].map((s) => ({ member: s.member, level: s.level })),
        }
      : null;
    // Staff order in the profile is the hire order: the server's index is the roster order.
    this.manage.setState(self, rank, summary);
    this.skills.setState(self, rank);
    this.premium.setState(self, now);
    this.petShop.setState(self, rank);
  }

  private refreshVisit(): void {
    const states = this.network.restaurants;
    const listings: RestaurantListing[] = [];
    if (states) {
      for (let i = 0; i < states.length; i += 1) {
        const s = states[i];
        if (!s?.owner) continue;
        listings.push({
          slot: i,
          name: visibleName(s.ownerName),
          avatar: s.ownerAvatar,
          rank: s.rank,
          served: s.served,
          rating: s.rating,
          likes: s.likes,
          staff: s.staff.size,
          mine: s.owner === this.localSessionId,
          liked: this.self?.likedSlots.includes(i) ?? false,
        });
      }
    }
    const boards: Partial<Record<BoardId, NetLeaderEntry[]>> = {};
    for (const spot of BOARDS) boards[spot.id] = this.network.board(spot.id);
    this.visit.setState(listings, boards, this.self?.boards ?? {});
  }

  // -------------------------------------------------------------- the HUD

  private hudTimer = 0;

  private updateHud(now: number, px: number, pz: number): void {
    const self = this.self;
    this.hud.setShopHome(insideShop(px, pz, 30));
    if (!self) return;
    this.hud.setMoney(self.cash, self.diamonds);
    const state = this.myRestaurant();
    this.hud.setRank(this.myRank(), state?.rating ?? self.rating);
    this.hud.setCarry(self.carry.kind, self.carry.recipe);
    const task = TASKS[self.task];
    if (task) {
      const value = self.stats[task.stat] ?? 0;
      this.hud.setTask(task.text, value, task.target, value >= task.target, false);
      this.hud.setBadge('skills', value >= task.target ? '!' : '');
    } else this.hud.setTask('All milestones complete!', 1, 1, false, true);
    this.hud.setBadge('premium', self.dailyClaimed ? '' : '!');
    this.hud.setBoosts(
      BOOSTS.map((b) => ({ name: b.name, seconds: (self.boosts[b.id] - now) / 1000 })).filter((b) => b.seconds > 0),
    );
    // Visiting someone: their banner and a Like.
    const here = plotAt(px, pz, 6);
    const other = here >= 0 && here !== this.mySlot() ? this.network.restaurant(here) : null;
    if (other?.owner) {
      const rank = RANKS[other.rank] ?? RANKS[0]!;
      this.hud.setVisiting({
        name: `${visibleName(other.ownerName)}'s Restaurant`,
        avatar: other.ownerAvatar,
        meta: `${rank.name}  -  ★ ${other.rating.toFixed(1)}  -  ${formatAmount(other.served)} served  -  ♥ ${other.likes}`,
        liked: self.likedSlots.includes(here),
      });
    } else this.hud.setVisiting(null);
    this.shop.tick(now);
    this.hudTimer += 1;
    if (this.hudTimer % 30 === 0) {
      // The plaza's boards, a few times a second.
      for (const spot of BOARDS) {
        this.town.setBoard(spot.id, this.network.board(spot.id).map((row) => ({ name: row.name || 'Chef', value: formatValue(spot.id, row.value) })));
      }
      if (this.visit.isOpen) this.refreshVisit();
      if (this.manage.isOpen || this.premium.isOpen) this.pushWindowState();
    }
  }

  // ------------------------------------------------------------ tutorial

  private updateTutorial(now: number, delta: number): void {
    const self = this.self;
    const player = this.localPlayer;
    const guide = this.guide;
    const step = self?.tutorial ?? TUTORIAL.done;
    const active = !!self && step < TUTORIAL.done && !!player;
    this.tutorial.setActive(active, this.building);
    if (guide) guide.root.visible = active;
    if (!active || !player || !self || !guide) {
      this.chevrons.update(null, null, this.time);
      this.lastTutorial = step;
      return;
    }
    if (step !== this.lastTutorial) {
      if (this.lastTutorial >= 0 && step > this.lastTutorial) this.audio.play('claim');
      this.lastTutorial = step;
    }
    const mine = this.mySlot();
    const state = this.myRestaurant();
    const p = player.position;
    let text = '';
    let target: { x: number; z: number } | null = null;
    let point: DOMRect | null = null;
    let side: 'right' | 'above' = 'right';
    const local = (x: number, z: number): { x: number; z: number } => this.world(mine, x, z);
    const firstOf = (role: string): NetItem | undefined => {
      let found: NetItem | undefined;
      state?.items.forEach((item) => {
        if (!found && itemById(item.kind)?.role === role) found = item;
      });
      return found;
    };
    const guest = (): NetCustomer | undefined => {
      let found: NetCustomer | undefined;
      state?.customers.forEach((c) => {
        if (!found && c.phase !== PHASE.leaving) found = c;
      });
      return found;
    };
    const at = (item: NetItem | undefined): { x: number; z: number } | null => (item ? local(item.x, item.z) : null);
    switch (step) {
      case TUTORIAL.enter:
        text = 'Welcome to your restaurant! Walk inside.';
        if (mine >= 0) target = local(DOOR.x, BUILDING.frontZ + 3);
        break;
      case TUTORIAL.place:
        text = this.building ? 'Place your table, then two chairs touching it!' : 'Press Items [B] to place your new table and chairs!';
        if (!this.building) {
          point = this.hud.itemsRect();
          side = 'above';
        }
        break;
      case TUTORIAL.seat: {
        const c = guest();
        text = c && (c.phase === PHASE.queued || c.phase === PHASE.arriving) ? 'Welcome! Interact to seat your first customer!' : 'Your first customer is on the way...';
        if (c) {
          const pos = this.customerAt(c, now);
          target = local(pos.x, pos.z);
        }
        break;
      }
      case TUTORIAL.order: {
        const c = guest();
        text = c?.phase === PHASE.ready ? 'They are ready! Take their order.' : 'They are reading the menu...';
        if (c) {
          const pos = this.customerAt(c, now);
          target = local(pos.x, pos.z);
        }
        break;
      }
      case TUTORIAL.ticket:
        text = "The order's in! Grab the ticket from the order stand.";
        target = at(firstOf('stand'));
        break;
      case TUTORIAL.cook:
        text = 'Now take the ticket to the stove to cook it!';
        target = at(firstOf('stove'));
        break;
      case TUTORIAL.plate: {
        let ready = false;
        state?.orders.forEach((o) => {
          if (o.stage === STAGE.ready) ready = true;
        });
        text = ready ? 'The food is ready! Go grab it from the order stand!' : 'Nice work! Now wait for the stove to finish cooking.';
        target = at(ready ? firstOf('stand') : firstOf('stove'));
        break;
      }
      case TUTORIAL.serve: {
        const c = guest();
        text = 'Serve the food to your customer!';
        if (c) {
          const pos = this.customerAt(c, now);
          target = local(pos.x, pos.z);
        }
        break;
      }
      case TUTORIAL.dish: {
        let dirty: NetItem | undefined;
        state?.items.forEach((item) => {
          if (!dirty && itemById(item.kind)?.role === 'chair' && item.b === 1) dirty = item;
        });
        text = dirty ? "They're done! Clean up the dirty dish!" : 'They are enjoying their meal...';
        target = at(dirty);
        break;
      }
      case TUTORIAL.wash:
        text = 'Put the dirty dish in the sink to wash it!';
        target = at(firstOf('sink'));
        break;
      case TUTORIAL.cash:
        text = 'Nice work! Go collect your cash!';
        target = at(firstOf('register'));
        break;
      case TUTORIAL.shop:
        text = 'Time to upgrade! Press Shop to visit the town Shop.';
        point = this.hud.railRect('shop');
        target = { x: 0, z: SHOP.minZ + 2 };
        break;
      case TUTORIAL.buy:
        text = this.shop.isOpen ? 'Buy something! A Wooden Chair is a great start.' : 'Talk to the shopkeeper, or walk up to an item and press E to buy it!';
        target = this.shop.isOpen ? null : { x: SHOP.keeper.x, z: SHOP.keeper.z - 4 };
        break;
      case TUTORIAL.placeNew:
        text = insideShop(p.x, p.z, 30) ? 'Great buy! Press Home to go back to your restaurant.' : 'Now place it! Press Items [B].';
        if (insideShop(p.x, p.z, 30)) point = this.hud.railRect('shop');
        else if (!this.building) {
          point = this.hud.itemsRect();
          side = 'above';
        }
        break;
    }
    // The guide chef walks beside the player.
    const offset = new Vector3(2.4, 0, 1.2).applyAxisAngle(new Vector3(0, 1, 0), this.input.look.yaw);
    const want = new Vector3(p.x + offset.x, p.y, p.z + offset.z);
    const g = guide.root.position;
    const gap = Math.hypot(want.x - g.x, want.z - g.z);
    if (gap > 30) g.copy(want);
    else {
      const k = Math.min(1, delta * 4);
      g.x += (want.x - g.x) * k;
      g.z += (want.z - g.z) * k;
      g.y = p.y;
    }
    guide.root.rotation.y = gap > 0.4 ? Math.atan2(want.x - g.x, want.z - g.z) : Math.atan2(p.x - g.x, p.z - g.z);
    guide.character.motion.speed = Math.min(14, gap * 4);
    guide.update(delta);
    const head = this.overlay.project(g.x, g.y + 5, g.z);
    this.tutorial.say(anyModalOpen() ? '' : text, head);
    this.tutorial.pointAt(point && !anyModalOpen() ? point : null, side);
    this.chevrons.update(target && !anyModalOpen() ? { x: p.x, y: p.y, z: p.z } : null, target, this.time, 0.1);
  }

  // -------------------------------------------------------- server events

  private onSelf(state: SelfState): void {
    const before = this.self;
    // The bobber dipped: a bite!
    if (state.fishing?.state === 2 && this.lastBite !== state.fishing.biteAt) {
      this.lastBite = state.fishing.biteAt;
      this.audio.play('ding');
      this.overlay.pop('!', '#ffe066', null, { x: window.innerWidth / 2, y: window.innerHeight * 0.2 });
    }
    this.self = state;
    this.build.setState(state);
    this.pushWindowState();
    if (before && state.cash < before.cash) this.audio.play('buy');
    if (before && before.tutorial < TUTORIAL.done && state.tutorial >= TUTORIAL.done) {
      this.effects.confetti(this.localPlayer?.position.x ?? 0, 0, this.localPlayer?.position.z ?? 0);
      this.audio.play('win');
    }
  }

  private onNotice(message: NoticeMessage): void {
    this.hud.toast(message.text, message.kind);
    if (message.kind === 'bad') this.audio.play('refuse');
    else if (message.kind === 'gold') this.audio.play('claim');
  }

  private onLevelUp(message: LevelUpMessage): void {
    const skill = SKILLS[message.skill];
    this.audio.play('levelup');
    this.hud.toast(`${skill?.name ?? 'Skill'} level ${message.level}!`, 'gold');
    const money = this.hud.moneyRect();
    this.overlay.pop(`${skill?.name} Lvl ${message.level}!`, '#ffe066', null, { x: window.innerWidth / 2, y: money.top - 120 });
    const unlocked = message.skill === 1 ? RECIPES.filter((r) => r.level === message.level) : [];
    for (const recipe of unlocked) this.hud.toast(`New recipe unlocked: ${recipe.name}! Turn it on in Manage > Recipes.`, 'gold');
    this.localPlayer?.character.cheer();
  }

  private onRankUp(message: RankUpMessage): void {
    const rank = RANKS[message.rank];
    this.audio.play('win');
    const p = this.localPlayer?.position;
    if (p) this.effects.confetti(p.x, p.y, p.z);
    this.overlay.pop(`${rank?.name ?? 'Rank up'}!`, rank?.color ?? '#ffe066', null, { x: window.innerWidth / 2, y: window.innerHeight * 0.35 });
  }

private onHatch(message: HatchMessage): void {
    this.audio.play('unlock');
    this.petShop.close();
    this.hatch.show(message.pet, message.egg);
    this.localPlayer?.character.cheer();
  }

  private onCatch(message: CatchMessage): void {
    const fish = fishById(message.fish);
    if (!fish) return;
    const rarity = RARITIES[fish.rarity];
    this.audio.play(fish.rarity === 'legendary' || fish.rarity === 'epic' ? 'win' : 'claim');
    const p = this.localPlayer?.position;
    const from = this.network.player(this.localSessionId ?? '');
    if (from && p) this.effects.fly((b) => buildFish(b, fish.color), from.fishX, 0.2, from.fishZ, this.handTarget, 0x9ae4ff);
    this.overlay.pop(`${fish.name}! ${message.weight.toFixed(2)} kg`, rarity.color, null, { x: window.innerWidth / 2, y: window.innerHeight * 0.32 });
    this.hud.toast(`Caught a ${rarity.name} ${fish.name} (${message.weight.toFixed(2)} kg) - +${message.stored} Fish${message.record ? '  NEW PERSONAL BEST!' : ''}`, message.record ? 'gold' : 'good');
    this.localPlayer?.character.cheer();
  }

  private onAway(message: AwayMessage): void {
    this.away.show(message);
  }

  private handTarget = (): Vector3 => {
    const p = this.localPlayer?.position;
    return p ? this.handPosition.set(p.x, p.y + 2.2, p.z) : this.handPosition.set(0, 0, 0);
  };

  private onFx(message: FxMessage): void {
    const p = this.localPlayer?.position;
    const w = message.slot >= 0 ? this.world(message.slot, message.x, message.z) : { x: message.x, z: message.z };
    const near = !!p && Math.hypot(w.x - p.x, w.z - p.z) < 45;
    const mine = message.slot >= 0 && message.slot === this.mySlot();
    switch (message.kind) {
      case 'pay':
        if ((message.value ?? 0) > 0) {
          this.effects.coins(w.x, 2, w.z, 8);
          if (near) this.overlay.pop(`+$${formatAmount(message.value ?? 0)}`, '#9dff7a', { x: w.x, y: 3.8, z: w.z });
          if (mine && near) this.audio.play('cash');
        } else {
          this.effects.coins(w.x, 2.2, w.z, 22);
          if (mine) {
            const money = this.hud.moneyRect();
            this.overlay.pop(`+$${formatAmount(-(message.value ?? 0))}`, '#9dff7a', null, { x: money.right + 70, y: money.top });
            this.audio.play('cash');
          }
        }
        break;
      case 'cook':
        if (near) this.audio.play('sizzle');
        this.effects.sizzle(w.x, 2.4, w.z);
        break;
      case 'ready':
        if (mine) this.audio.play('ding');
        this.effects.sparkle(w.x, 1.6, w.z, 0xffffff);
        break;
      case 'serve':
        if (near) this.audio.play('serve');
        this.effects.sparkle(w.x, 1.4, w.z, 0xffe066);
        break;
      case 'clean':
        this.effects.bubbles(w.x, 2.2, w.z);
        break;
      case 'harvest':
      case 'collect': {
        const id = message.value ?? 1;
        if (mine && near) {
          this.effects.fly((b) => buildIngredient(b, id), w.x, 0.6, w.z, this.handTarget);
          this.audio.play('pop', 1, 0, 1.3);
        }
        break;
      }
      case 'sparkle':
        this.effects.sparkle(w.x, 3, w.z);
        if (near) this.audio.play('like');
        break;
      case 'confetti':
        this.effects.confetti(w.x, 0, w.z);
        if (near) this.audio.play('win');
        break;
      case 'buy':
        if (p && Math.hypot(message.x - p.x, message.z - p.z) < 3) {
          this.effects.confetti(message.x, 0, message.z);
          this.localPlayer?.character.cheer();
        }
        break;
      case 'place':
        if (near) this.effects.sparkle(w.x, 0.4, w.z, 0xffffff);
        break;
      case 'angry':
        this.effects.angry(w.x, 3.6, w.z);
        if (mine && near) this.audio.play('angry');
        break;
    }
  }

  private onStatusChange(status: ConnectionStatus): void {
    if (clientConfig.debug) logger.info(SCOPE, `connection: ${status}`);
    if (status === 'disconnected' || status === 'error') this.hud.toast('Disconnected from the server. Reload to rejoin.', 'bad');
  }

  // ------------------------------------------------------------- keyboard

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || isTyping(event.target)) return;
    const code = event.code;
    if (code === 'Escape') {
      if (closeTopModal()) return;
      if (this.building) this.setBuilding(false);
      else this.bloxity.showPortalMenu(false);
      return;
    }
    if (anyModalOpen()) return;
    switch (code) {
      case 'KeyE':
        this.overlay.activate(0);
        break;
      case 'KeyF':
        this.overlay.activate(1);
        break;
      case 'KeyB':
        this.toggleBuild();
        break;
      case 'KeyR':
        if (this.building) this.build.rotate();
        break;
      case 'KeyM':
        this.audio.toggleMuted();
        break;
      default:
        break;
    }
  };

  private readonly onGesture = (): void => {
    this.audio.resume();
  };

  private tickFps(delta: number): void {
    if (this.fpsReadout.hidden) return;
    this.fpsAccum += delta;
    this.fpsFrames += 1;
    if (this.fpsAccum < 0.5) return;
    this.fpsReadout.textContent = `${Math.round(this.fpsFrames / this.fpsAccum)} FPS`;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keydown', this.onGesture);
    window.removeEventListener('pointerdown', this.onGesture);
    this.hud.dispose();
    this.overlay.dispose();
    this.shop.dispose();
    this.manage.dispose();
    this.skills.dispose();
    this.visit.dispose();
    this.premium.dispose();
    this.confirm.dispose();
    this.away.dispose();
    this.build.dispose();
    this.tutorial.dispose();
    this.icons.dispose();
    this.dresser?.dispose();
    this.guide?.dispose();
    this.bloxity.dispose();
    this.bloxityPanel.dispose();
    this.fpsReadout.remove();
    this.audio.dispose();
    this.remotePlayers.dispose();
    this.effects.dispose();
    this.chevrons.dispose();
    this.companions.dispose();
    this.petShop.dispose();
    this.hatch.dispose();
    for (const view of this.views) view.dispose();
    this.town?.dispose();
    this.sea.dispose();
    this.sky.dispose();
    this.renderer.dispose();
  }
}
