import {
  CATEGORIES,
  RANKS,
  RARITIES,
  REFRESH_DIAMONDS,
  SHOP_ORDER,
  SKILLS,
  formatPrice,
  formatTimer,
  itemById,
  levelOf,
  nextRestockAt,
  restockEpoch,
  stockOf,
  type Category,
  type ItemDef,
  type SelfState,
} from '@restaurant/shared';
import type { IconFactory } from './IconFactory.js';
import { GameWindow, button, el, icon } from './Modal.js';
import { fitText } from './scaleUi.js';

export interface ShopActions {
  buy(id: number): void;
  refresh(): void;
}

/**
 * THE SHOP MENU, as the reference shows it: a rail of categories (Furniture,
 * Appliances, Decor, Farming, Ranching, Structure) beside the window; a grid
 * of item cards with their green prices; on the right the chosen item - its
 * rarity, name, description, picture, what is left in stock - and a big green
 * price button; and under it all the restock countdown and a Diamond refresh.
 */
export class ShopWindow extends GameWindow {
  private self: SelfState | null = null;
  private rank = 0;
  private now = Date.now();
  private selected = 1;
  private query = '';
  private readonly grid: HTMLDivElement;
  private readonly detail: HTMLDivElement;
  private readonly heading: HTMLSpanElement;
  private readonly search: HTMLInputElement;
  private readonly restock: HTMLSpanElement;
  private shownEpoch = -1;

  constructor(container: HTMLElement, private readonly icons: IconFactory, private readonly actions: ShopActions) {
    super(
      container,
      'Shop',
      'large',
      CATEGORIES.map((c) => ({ id: c.id, label: c.name, art: categoryArt(icons, c.id) })),
    );
    const top = el('div', 'rr-row');
    this.heading = el('span', 'rr-section', 'Furniture');
    this.heading.style.border = 'none';
    this.heading.style.margin = '0';
    this.search = el('input', 'rr-search');
    this.search.placeholder = 'Search...';
    this.search.addEventListener('input', () => {
      this.query = this.search.value.trim().toLowerCase();
      this.refresh();
    });
    this.search.addEventListener('keydown', (event) => event.stopPropagation());
    top.append(this.heading, this.search);
    const shop = el('div', 'rr-shop');
    const list = el('div', 'rr-shop__list');
    const scroll = el('div', 'rr-scroll');
    this.grid = el('div', 'rr-grid');
    scroll.appendChild(this.grid);
    list.append(top, scroll);
    this.detail = el('div', 'rr-shop__detail');
    shop.append(list, this.detail);
    const foot = el('div', 'rr-shop__foot rr-outline');
    this.restock = el('span', '', 'Restock: 3:00');
    const refresh = button('rr-btn rr-btn--blue', `◆ Refresh (${REFRESH_DIAMONDS})`, () => this.actions.refresh());
    foot.append(this.restock, refresh);
    this.body.append(shop, foot);
  }

  setState(self: SelfState | null, rank: number, now: number): void {
    this.self = self;
    this.rank = rank;
    this.now = now;
    if (this.isOpen) this.refresh();
  }

  /** Open on one item (walking up to its plinth). */
  showItem(id: number): void {
    const def = itemById(id);
    if (!def) return;
    this.selected = id;
    this.tab = def.category;
    this.select(def.category);
    this.open();
  }

  tick(now: number): void {
    this.now = now;
    if (!this.isOpen) return;
    this.restock.textContent = `Restock: ${formatTimer((nextRestockAt(now) - now) / 1000)}`;
    if (restockEpoch(now) !== this.shownEpoch) this.refresh();
  }

  private stockLeft(def: ItemDef): number {
    const self = this.self;
    const epoch = restockEpoch(this.now);
    const salt = self && self.shopEpoch === epoch ? self.shopSalt : 0;
    const bought = self && self.shopEpoch === epoch ? (self.bought[def.id] ?? 0) : 0;
    return stockOf(epoch, def, salt) - bought;
  }

  private lockReason(def: ItemDef): string | null {
    if ((def.rank ?? 0) > this.rank) return `Requires ${RANKS[def.rank ?? 0]!.name}`;
    if (def.skill) {
      const [skill, level] = def.skill;
      if (levelOf(this.self?.xp[skill] ?? 0) < level) return `Requires ${SKILLS[skill]!.name} Lvl. ${level}`;
    }
    return null;
  }

  override refresh(): void {
    this.shownEpoch = restockEpoch(this.now);
    const category = this.tab as Category;
    this.heading.textContent = CATEGORIES.find((c) => c.id === category)?.name ?? '';
    const items = SHOP_ORDER.filter((def) => (this.query ? def.name.toLowerCase().includes(this.query) : def.category === category));
    if (!items.some((d) => d.id === this.selected) && items[0]) this.selected = items[0].id;
    this.grid.replaceChildren(
      ...items.map((def) => {
        const left = this.stockLeft(def);
        const locked = this.lockReason(def);
        const owned = def.zone === 'none' && (this.self?.styles.includes(def.id) ?? false);
        const card = el('div', `rr-card${def.id === this.selected ? ' is-selected' : ''}${locked ? ' is-locked' : ''}`);
        card.appendChild(icon(this.icons.item(def.id), 'rr-card__art'));
        card.appendChild(el('div', 'rr-card__name rr-outline-thin', def.name));
        const price = def.diamonds && !def.price ? `◆ ${def.diamonds}` : `$${formatPrice(def.price)}`;
        card.appendChild(el('div', `rr-card__price${def.diamonds && !def.price ? ' rr-card__price--gem' : ''} rr-outline-thin`, owned ? 'Owned' : left > 0 ? price : 'No Stock'));
        if (locked) card.appendChild(el('div', 'rr-card__lock rr-outline-thin', '\u{1f512}'));
        card.addEventListener('click', () => {
          this.selected = def.id;
          this.refresh();
        });
        return card;
      }),
    );
    this.drawDetail();
    this.restock.textContent = `Restock: ${formatTimer((nextRestockAt(this.now) - this.now) / 1000)}`;
  }

  private drawDetail(): void {
    const def = itemById(this.selected);
    if (!def) {
      this.detail.replaceChildren();
      return;
    }
    const rarity = RARITIES[def.rarity];
    const left = this.stockLeft(def);
    const locked = this.lockReason(def);
    const owned = def.zone === 'none' && (this.self?.styles.includes(def.id) ?? false);
    const premium = !def.price && !!def.diamonds;
    const afford = premium ? (this.self?.diamonds ?? 0) >= (def.diamonds ?? 0) : (this.self?.cash ?? 0) >= def.price;
    const head = el('div', '');
    head.appendChild(icon(this.icons.item(def.id), 'rr-shop__thumb'));
    const rarityNode = el('div', 'rr-shop__rarity rr-outline', rarity.name);
    rarityNode.style.color = rarity.color;
    head.append(rarityNode, el('div', 'rr-shop__name', def.name), el('div', 'rr-shop__desc', `"${def.desc}"`));
    const stats = el('div', '');
    stats.style.clear = 'both';
    const stat = (label: string, value: string): HTMLDivElement => {
      const row = el('div', 'rr-shop__stat');
      row.append(el('span', '', label), el('span', 'rr-outline-thin', value));
      return row;
    };
    stats.appendChild(stat('Stock:', def.zone === 'none' ? (owned ? 'Owned' : 'Available') : left > 0 ? `${left} Left` : 'Sold out'));
    if (def.speed && (def.role === 'stove' || def.role === 'sink')) stats.appendChild(stat('Speed:', `x${def.speed}`));
    if (def.capacity) stats.appendChild(stat(def.role === 'register' ? 'Holds:' : 'Capacity:', def.role === 'register' ? `$${formatPrice(def.capacity)}` : `${def.capacity}`));
    if (def.quality) stats.appendChild(stat('Rank points:', `+${def.quality}`));
    stats.appendChild(stat('Size:', def.role === 'rod' ? 'Used when you fish' : def.zone === 'none' ? 'Restaurant-wide' : `${def.w} x ${def.d}`));
    const label = owned ? 'Owned' : locked ? locked : left <= 0 ? 'Out of stock' : premium ? `◆ ${def.diamonds}` : `$${formatPrice(def.price)}`;
    const buy = button(`rr-btn rr-shop__buy rr-outline ${owned || locked || left <= 0 || !afford ? 'rr-btn--gray' : ''}`, label, () => this.actions.buy(def.id));
    this.detail.replaceChildren(head, stats, buy);
    requestAnimationFrame(() => fitText(buy));
  }
}

const categoryArt = (icons: IconFactory, category: Category): string => {
  switch (category) {
    case 'furniture':
      return icons.item(1);
    case 'appliances':
      return icons.item(21);
    case 'decor':
      return icons.item(40);
    case 'farming':
      return icons.art('farming');
    case 'ranching':
      return icons.art('ranching');
    case 'fishing':
      return icons.art('fishing');
    case 'structure':
      return icons.item(86);
  }
};
