import {
  MAX_STAFF_LEVEL,
  MAX_TIER,
  RATING,
  RECIPES,
  SKILLS,
  STARTER_INVENTORY,
  STARTING_CASH,
  STARTING_DIAMONDS,
  STYLE_DEFAULT,
  TUTORIAL,
  customerById,
  fishById,
  PET_LIMIT,
  EQUIP_LIMIT,
  petById,
  ingredientById,
  itemById,
  staffById,
  type StackItem,
} from '@restaurant/shared';

/**
 * THE SAVED OWNER: everything a session is rebuilt from.
 *
 * Crops and animal pens keep ABSOLUTE wall-clock timestamps, so a farm keeps
 * growing while its owner is away. Item positions are PLOT-LOCAL, so a
 * returning owner's restaurant is the same whichever of the fifteen plots they
 * are given.
 */
export interface ItemRecord {
  kind: number;
  x: number;
  z: number;
  rot: number;
  /** Crop ripe-at / animal next-produce-at (ms). */
  a: number;
  /** Animal produce waiting. */
  b: number;
}

export interface HiredRecord {
  member: number;
  level: number;
}

export interface RestaurantRecord {
  tier: number;
  floor: number;
  wall: number;
  items: ItemRecord[];
  staff: HiredRecord[];
  register: number;
  rating: number;
  likes: number;
}

export interface Counters {
  cooked: number;
  harvested: number;
  collected: number;
  washed: number;
  rare: number;
  fish: number;
}

export interface PetRecord {
  uid: number;
  type: number;
}

export interface ProgressFields {
  cash: number;
  diamonds: number;
  earned: number;
  served: number;
  playSeconds: number;
  tutorial: number;

  inventory: StackItem[];
  styles: number[];
  ingredients: StackItem[];
  xp: number[];
  recipesOff: number[];
  index: StackItem[];
  counters: Counters;
  task: number;

  shopEpoch: number;
  shopSalt: number;
  bought: StackItem[];

  boosts: { cash: number; cook: number; rush: number };
  restaurant: RestaurantRecord;

  /** Highest rank reached (rank-up rewards pay once) and the last computed points, for the boards. */
  bestRank: number;
  rankPoints: number;

  likedDay: number;
  likedKeys: string[];
  dailyDay: number;

  pets: PetRecord[];
  petsEquipped: number[];
  nextPetUid: number;
  fishIndex: StackItem[];
  bestFish: { fish: number; weight: number };
}

/** What one save writes. */
export interface ProfileFields extends ProgressFields {
  /** The portal's display name and portrait as last seen. Cleared when empty. */
  displayName: string;
  avatarUrl: string;
  /** Wall clock of the save: also when the owner was last here, for offline income. */
  updatedAt: number;
}

/** The first-login migration's bookkeeping (see GameRoom.resolveProfile). */
export interface MigrationFields {
  migratedFrom?: string;
  migratedTo?: string;
  migratedAt?: number;
  migratedSnapshot?: ProgressFields;
}

/**
 * A profile as READ from storage. Beyond the fields this build knows, it may
 * carry any field a newer or older build wrote: those are kept and written
 * back untouched, never dropped.
 */
export type StoredProfile = ProfileFields & MigrationFields & { [field: string]: unknown };

/** Optional string fields a save may CLEAR. The only fields ever $unset. */
export const CLEARABLE_FIELDS = ['displayName', 'avatarUrl'] as const;

// ------------------------------------------------------------- coercion

const numeric = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback);
const signed = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const int = (value: unknown, fallback = 0): number => Math.floor(numeric(value, fallback));
const list = (value: unknown, limit: number): unknown[] => (Array.isArray(value) ? value.slice(0, limit) : []);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

/** Stacks keyed by id, merged, only ids that exist, counts positive. */
const stacks = (value: unknown, exists: (id: number) => boolean, limit = 300): StackItem[] => {
  const byId = new Map<number, number>();
  for (const entry of list(value, limit)) {
    const r = record(entry);
    const id = int(r['id']);
    const count = int(r['count']);
    if (id <= 0 || count <= 0 || !exists(id)) continue;
    byId.set(id, Math.min(1_000_000_000, (byId.get(id) ?? 0) + count));
  }
  return [...byId.entries()].map(([id, count]) => ({ id, count }));
};

const ids = (value: unknown, exists: (id: number) => boolean, limit = 200): number[] => [...new Set(list(value, limit).map((v) => int(v)).filter((id) => id > 0 && exists(id)))];

const items = (value: unknown): ItemRecord[] => {
  const out: ItemRecord[] = [];
  for (const entry of list(value, 400)) {
    const r = record(entry);
    const kind = int(r['kind']);
    const def = itemById(kind);
    if (!def || def.zone === 'none') continue;
    out.push({ kind, x: signed(r['x']), z: signed(r['z']), rot: int(r['rot']) & 3, a: numeric(r['a']), b: Math.min(1000, int(r['b'])) });
  }
  return out;
};

const hired = (value: unknown): HiredRecord[] => {
  const out: HiredRecord[] = [];
  for (const entry of list(value, 40)) {
    const r = record(entry);
    const member = int(r['member']);
    if (!staffById(member)) continue;
    out.push({ member, level: Math.max(1, Math.min(MAX_STAFF_LEVEL, int(r['level'], 1))) });
  }
  return out;
};

const exists = {
  item: (id: number) => itemById(id) !== undefined,
  ingredient: (id: number) => ingredientById(id) !== undefined,
  recipe: (id: number) => RECIPES.some((r) => r.id === id),
  customer: (id: number) => customerById(id) !== undefined,
};

export const emptyRestaurant = (): RestaurantRecord => ({
  tier: 0,
  floor: STYLE_DEFAULT.floor,
  wall: STYLE_DEFAULT.wall,
  items: [],
  staff: [],
  register: 0,
  rating: RATING.start,
  likes: 0,
});

export const emptyProgress = (): ProgressFields => ({
  cash: STARTING_CASH,
  diamonds: STARTING_DIAMONDS,
  earned: 0,
  served: 0,
  playSeconds: 0,
  tutorial: TUTORIAL.enter,
  inventory: STARTER_INVENTORY.map((s) => ({ ...s })),
  styles: [STYLE_DEFAULT.floor, STYLE_DEFAULT.wall],
  ingredients: [],
  xp: SKILLS.map(() => 0),
  recipesOff: [],
  index: [],
  counters: { cooked: 0, harvested: 0, collected: 0, washed: 0, rare: 0, fish: 0 },
  task: 0,
  shopEpoch: 0,
  shopSalt: 0,
  bought: [],
  boosts: { cash: 0, cook: 0, rush: 0 },
  // An empty restaurant record: `RestaurantService.load` lays out the starter kitchen for a profile with no items.
  restaurant: emptyRestaurant(),
  bestRank: 0,
  rankPoints: 0,
  likedDay: 0,
  likedKeys: [],
  dailyDay: 0,
  pets: [],
  petsEquipped: [],
  nextPetUid: 1,
  fishIndex: [],
  bestFish: { fish: 0, weight: 0 },
});

/** Just the progression of a profile, coerced. A missing field is the fresh owner's. */
export const progressOf = (raw: Partial<ProgressFields> | Record<string, unknown>): ProgressFields => {
  const source = record(raw);
  const fresh = emptyProgress();
  const r = record(source['restaurant']);
  const counters = record(source['counters']);
  const boosts = record(source['boosts']);
  const xp = list(source['xp'], SKILLS.length).map((v) => numeric(v));
  while (xp.length < SKILLS.length) xp.push(0);
  // Things owned once: structure styles and fishing rods.
  const styles = ids(source['styles'], (id) => itemById(id)?.zone === 'none', 40);
  for (const id of [STYLE_DEFAULT.floor, STYLE_DEFAULT.wall]) if (!styles.includes(id)) styles.push(id);
  const floor = int(r['floor'], STYLE_DEFAULT.floor);
  const wall = int(r['wall'], STYLE_DEFAULT.wall);
  return {
    cash: 'cash' in source ? numeric(source['cash']) : fresh.cash,
    diamonds: 'diamonds' in source ? int(source['diamonds']) : fresh.diamonds,
    earned: numeric(source['earned']),
    served: int(source['served']),
    playSeconds: numeric(source['playSeconds']),
    tutorial: Math.min(TUTORIAL.done, int(source['tutorial'], fresh.tutorial)),
    inventory: 'inventory' in source ? stacks(source['inventory'], exists.item) : fresh.inventory,
    styles,
    ingredients: stacks(source['ingredients'], exists.ingredient),
    xp,
    recipesOff: ids(source['recipesOff'], exists.recipe),
    index: stacks(source['index'], exists.customer),
    counters: {
      cooked: int(counters['cooked']),
      harvested: int(counters['harvested']),
      collected: int(counters['collected']),
      washed: int(counters['washed']),
      rare: int(counters['rare']),
      fish: int(counters['fish']),
    },
    task: int(source['task']),
    shopEpoch: int(source['shopEpoch']),
    shopSalt: int(source['shopSalt']),
    bought: stacks(source['bought'], exists.item),
    boosts: { cash: numeric(boosts['cash']), cook: numeric(boosts['cook']), rush: numeric(boosts['rush']) },
    restaurant: {
      tier: Math.min(MAX_TIER, int(r['tier'])),
      floor: itemById(floor)?.role === 'floor' && styles.includes(floor) ? floor : STYLE_DEFAULT.floor,
      wall: itemById(wall)?.role === 'wall' && styles.includes(wall) ? wall : STYLE_DEFAULT.wall,
      items: items(r['items']),
      staff: hired(r['staff']),
      register: numeric(r['register']),
      rating: Math.min(5, numeric(r['rating'], RATING.start)),
      likes: int(r['likes']),
    },
    bestRank: int(source['bestRank']),
    rankPoints: int(source['rankPoints']),
    likedDay: int(source['likedDay']),
    likedKeys: list(source['likedKeys'], 100).filter((key): key is string => typeof key === 'string').map((key) => key.slice(0, 96)),
    dailyDay: int(source['dailyDay']),
    ...pets(source),
    fishIndex: stacks(source['fishIndex'], (id) => fishById(id) !== undefined),
    bestFish: (() => {
      const b = record(source['bestFish']);
      const fish = int(b['fish']);
      return fishById(fish) ? { fish, weight: numeric(b['weight']) } : { fish: 0, weight: 0 };
    })(),
  };
};

/** The pet inventory: known types, unique uids, at most the limit; equipped only what is owned. */
const pets = (source: Record<string, unknown>): Pick<ProgressFields, 'pets' | 'petsEquipped' | 'nextPetUid'> => {
  const out: PetRecord[] = [];
  const seen = new Set<number>();
  let next = int(source['nextPetUid'], 1);
  for (const entry of list(source['pets'], PET_LIMIT)) {
    const r = record(entry);
    const uid = int(r['uid']);
    const type = int(r['type']);
    if (uid <= 0 || seen.has(uid) || !petById(type)) continue;
    seen.add(uid);
    out.push({ uid, type });
    if (uid >= next) next = uid + 1;
  }
  const equipped = ids(source['petsEquipped'], (uid) => seen.has(uid), EQUIP_LIMIT);
  return { pets: out, petsEquipped: equipped, nextPetUid: Math.max(1, next) };
};

/** Coerce whatever storage held into a profile, KEEPING every unknown field. */
export const coerceProfile = (raw: unknown): StoredProfile | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const profile: StoredProfile = {
    ...source,
    ...progressOf(source),
    displayName: typeof source['displayName'] === 'string' ? source['displayName'] : '',
    avatarUrl: typeof source['avatarUrl'] === 'string' ? source['avatarUrl'] : '',
    updatedAt: numeric(source['updatedAt']),
  };
  if (typeof source['migratedFrom'] !== 'string') delete profile.migratedFrom;
  if (typeof source['migratedTo'] !== 'string') delete profile.migratedTo;
  if (typeof source['migratedAt'] !== 'number') delete profile.migratedAt;
  if (source['migratedSnapshot'] && typeof source['migratedSnapshot'] === 'object') {
    profile.migratedSnapshot = progressOf(source['migratedSnapshot'] as Record<string, unknown>);
  } else {
    delete profile.migratedSnapshot;
  }
  return profile;
};

/**
 * Whether a profile holds anything worth carrying into an account. A player
 * who opened the game and stood still has nothing to migrate.
 */
export const hasProgress = (p: ProgressFields): boolean =>
  p.earned > 0 || p.served > 0 || p.tutorial > TUTORIAL.enter || p.cash !== STARTING_CASH || p.restaurant.tier > 0 || p.restaurant.staff.length > 0;
