import { ITEMS, type Category, type ItemDef } from './items.js';
import { RARITIES } from './rarity.js';
import { hashInts, randInt, rng } from '../util/random.js';
import { PLINTH_SPOTS } from './town.js';

/**
 * THE SHOP'S ROTATING STOCK. Every few minutes the shelves turn over: common
 * things are nearly always in, rare things only sometimes and in ones and
 * twos. Stock is a pure function of (restock number, item) - so every room on
 * every pod has the same shelves at the same moment and the "Restock: 2:15"
 * timer is exact - and what each player bought from THIS restock is kept on
 * their profile, so fifteen owners never fight over one Golden Oven.
 */
export const RESTOCK_SECONDS = 180;

export const restockEpoch = (nowMs: number): number => Math.floor(nowMs / 1000 / RESTOCK_SECONDS);

export const nextRestockAt = (nowMs: number): number => (restockEpoch(nowMs) + 1) * RESTOCK_SECONDS * 1000;

/** Diamonds to restock your own shelves right now. */
export const REFRESH_DIAMONDS = 5;

/** Items every restock carries plenty of, so a new owner is never stuck. */
const ALWAYS: ReadonlySet<number> = new Set([1, 2, 3, 14, 20, 25, 29, 40, 60, 61]);

/**
 * How many of an item a restock holds (0 = out of stock). `salt` is a
 * player's own refresh count, so a paid refresh rolls new shelves for them.
 */
export const stockOf = (epoch: number, def: ItemDef, salt = 0): number => {
  // Owned once (styles, rods): always one on the shelf.
  if (def.zone === 'none') return def.price === 0 ? 0 : 1;
  if (def.diamonds) return 3;
  const random = rng(hashInts(0x5409, epoch, def.id, salt));
  if (ALWAYS.has(def.id)) return randInt(random, 4, 8);
  const rarity = RARITIES[def.rarity];
  if (random() >= rarity.stockChance) return 0;
  return randInt(random, rarity.stockMin + 1, rarity.stockMax + 2);
};

/** Shop listing order: by category, then price. */
export const SHOP_ORDER: readonly ItemDef[] = [...ITEMS]
  .filter((def) => !(def.category === 'structure' && def.price === 0))
  .sort((a, b) => {
    const order: readonly Category[] = ['furniture', 'appliances', 'decor', 'farming', 'ranching', 'fishing', 'structure'];
    return order.indexOf(a.category) - order.indexOf(b.category) || (a.price || a.diamonds! * 1000) - (b.price || b.diamonds! * 1000);
  });

/** The items standing on the Shop's plinths, in order (structure styles live only in the menu). */
export const DISPLAYS: readonly { item: number; x: number; z: number }[] = (() => {
  const placeables = SHOP_ORDER.filter((def) => def.category !== 'structure');
  const out: { item: number; x: number; z: number }[] = [];
  for (let i = 0; i < Math.min(placeables.length, PLINTH_SPOTS.length); i += 1) {
    const spot = PLINTH_SPOTS[i]!;
    out.push({ item: placeables[i]!.id, x: spot.x, z: spot.z });
  }
  return out;
})();

/** How close to the keeper (or a plinth) a purchase may be made from. */
export const SHOP_REACH = { keeper: 14, plinth: 6.5 } as const;
