import {
  DISPLAYS,
  RANKS,
  REFRESH_DIAMONDS,
  SHOP,
  SHOP_REACH,
  SKILLS,
  TUTORIAL,
  formatPrice,
  itemById,
  levelOf,
  restockEpoch,
  stockOf,
  type ItemDef,
} from '@restaurant/shared';
import { addStack, countOf, spendCash, spendDiamonds, type Chef } from './Chef.js';
import type { RoomContext } from './RoomContext.js';

/** Most of one item bought in one request. */
const MAX_BATCH = 10;

/**
 * THE SHOP. A purchase is only made standing at the keeper's counter or at
 * the plinth the item is displayed on; the item must be on this restock's
 * shelves (and not already bought out by this player), their rank and skills
 * must allow it, and they must be able to pay - all checked here, against the
 * server's own position of the player.
 */
export class ShopService {
  constructor(private readonly ctx: RoomContext) {}

  /** Forget last restock's purchases when the shelves have turned over. */
  roll(chef: Chef): void {
    const epoch = restockEpoch(this.ctx.now());
    if (chef.profile.shopEpoch === epoch) return;
    chef.profile.shopEpoch = epoch;
    chef.profile.shopSalt = 0;
    chef.profile.bought = [];
    chef.dirty = true;
  }

  /** Where the player stands lets them buy this item: at the keeper, or at its plinth. */
  private inReach(chef: Chef, def: ItemDef): boolean {
    const p = chef.player;
    if (Math.hypot(p.x - SHOP.keeper.x, p.z - SHOP.keeper.z) <= SHOP_REACH.keeper) return true;
    const display = DISPLAYS.find((d) => d.item === def.id);
    return !!display && Math.hypot(p.x - display.x, p.z - display.z) <= SHOP_REACH.plinth;
  }

  /** Why this owner may not buy an item at all (rank, skill), or null. */
  lockedBecause(chef: Chef, def: ItemDef): string | null {
    if ((def.rank ?? 0) > chef.player.rank) return `Requires ${RANKS[def.rank ?? 0]!.name} rank.`;
    if (def.skill) {
      const [skill, level] = def.skill;
      if (levelOf(chef.profile.xp[skill] ?? 0) < level) return `Requires ${SKILLS[skill]!.name} level ${level}.`;
    }
    return null;
  }

  buy(chef: Chef, id: number, count: number): void {
    const def = itemById(Math.floor(id));
    if (!def || (def.category === 'structure' && def.price === 0)) return;
    if (!this.inReach(chef, def)) {
      this.ctx.notify(chef, 'bad', 'Walk up to the shopkeeper (or the item) to buy it.');
      return;
    }
    const locked = this.lockedBecause(chef, def);
    if (locked) {
      this.ctx.notify(chef, 'bad', locked);
      return;
    }
    if (def.zone === 'none' && chef.profile.styles.includes(def.id)) {
      this.ctx.notify(chef, 'info', def.role === 'rod' ? `You already own the ${def.name}.` : `You already own ${def.name}. Apply it from Manage > Restaurant.`);
      return;
    }
    this.roll(chef);
    const stock = stockOf(chef.profile.shopEpoch, def, chef.profile.shopSalt);
    const left = stock - countOf(chef.profile.bought, def.id);
    if (left <= 0) {
      this.ctx.notify(chef, 'bad', stock > 0 ? `You bought every ${def.name} - wait for the restock!` : `${def.name} is out of stock!`);
      return;
    }
    const wanted = Math.max(1, Math.min(MAX_BATCH, Math.floor(Number.isFinite(count) ? count : 1)));
    const premium = !def.price && !!def.diamonds;
    const unit = premium ? def.diamonds! : def.price;
    const purse = premium ? chef.profile.diamonds : chef.profile.cash;
    const n = Math.min(wanted, left, def.zone === 'none' ? 1 : MAX_BATCH, unit > 0 ? Math.floor(purse / unit) : wanted);
    if (n <= 0) {
      this.ctx.notify(chef, 'bad', premium ? `Not enough Diamonds! ${def.name} costs ${unit} Diamonds.` : `Not enough Cash! ${def.name} costs $${formatPrice(unit)}.`);
      return;
    }
    if (!(premium ? spendDiamonds(chef, unit * n) : spendCash(chef, unit * n))) return;
    addStack(chef.profile.bought, def.id, n);
    if (def.zone === 'none') chef.profile.styles.push(def.id);
    else addStack(chef.profile.inventory, def.id, n);
    chef.dirty = true;
    const where = def.role === 'rod' ? 'Head to the pier or the pond and press E to fish!' : def.zone === 'none' ? 'Apply it from Manage > Restaurant!' : 'Place it from Items [B]!';
    this.ctx.notify(chef, 'good', `Bought ${n > 1 ? `${n}x ` : ''}${def.name}! ${where}`);
    this.ctx.fx({ kind: 'buy', slot: -1, x: chef.player.x, z: chef.player.z, value: def.id });
    this.ctx.tutorial(chef, TUTORIAL.buy);
  }

  /** Spend Diamonds to roll fresh shelves for this player now. */
  refresh(chef: Chef): void {
    this.roll(chef);
    if (!spendDiamonds(chef, REFRESH_DIAMONDS)) {
      this.ctx.notify(chef, 'bad', `Refreshing the shop costs ${REFRESH_DIAMONDS} Diamonds.`);
      return;
    }
    chef.profile.shopSalt += 1;
    chef.profile.bought = [];
    chef.dirty = true;
    this.ctx.notify(chef, 'good', 'The shelves have been restocked just for you!');
  }
}
