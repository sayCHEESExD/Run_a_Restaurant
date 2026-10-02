import {
  CUSTOMERS,
  EQUIP_LIMIT,
  PERK_TEXT,
  PET_LIMIT,
  petById,
  CUSTOMER_RARITIES,
  CUSTOMER_RARITY_ORDER,
  INGREDIENTS,
  MAX_STAFF_LEVEL,
  MAX_TIER,
  RANKS,
  RARITIES,
  RECIPES,
  ROLES,
  SKILL,
  STAFF,
  TIERS,
  canAfford,
  formatAmount,
  formatPrice,
  itemById,
  levelOf,
  missingText,
  recipeById,
  staffSpeed,
  upgradeCost,
  type SelfState,
} from '@restaurant/shared';
import type { IconFactory } from './IconFactory.js';
import { GameWindow, button, el, icon } from './Modal.js';

export interface ManageActions {
  hire(member: number): void;
  staff(index: number, action: 'upgrade' | 'fire'): void;
  recipe(id: number, on: boolean): void;
  expand(): void;
  style(id: number): void;
  petEquip(uid: number, on: boolean): void;
  petSell(uid: number): void;
  buyPet(): void;
}

export interface RestaurantSummary {
  readonly tier: number;
  readonly served: number;
  readonly rating: number;
  readonly likes: number;
  readonly floor: number;
  readonly wall: number;
  readonly staff: readonly { member: number; level: number }[];
}

type RecipeFilter = 'locked' | 'unlocked' | 'enabled' | 'disabled' | '';

/**
 * MANAGE: the restaurant's back office, with the reference's round tab
 * buttons down its side - Staff (hire, train and let go, by role), Recipes
 * (the menu: what is unlocked, what is on, what it needs), Customers (every
 * guest who has eaten here) and the Restaurant itself (its size, styles,
 * fridge and numbers).
 */
export class ManageWindow extends GameWindow {
  private self: SelfState | null = null;
  private rank = 0;
  private summary: RestaurantSummary | null = null;
  private recipeFilter: RecipeFilter = '';
  private customerFilter: 'locked' | 'unlocked' | '' = '';
  private query = '';
  private viewing = 0;
  private petView = 0;
  private selling = false;

  constructor(container: HTMLElement, private readonly icons: IconFactory, private readonly actions: ManageActions) {
    super(container, 'Employees', 'large', [
      { id: 'staff', label: 'Staff', art: icons.art('staff') },
      { id: 'recipes', label: 'Recipes', art: icons.art('recipes') },
      { id: 'customers', label: 'Customers', art: icons.art('customers') },
      { id: 'pets', label: 'Pets', art: icons.art('pets') },
      { id: 'restaurant', label: 'Restaurant', art: icons.art('restaurant') },
    ]);
  }

  setState(self: SelfState | null, rank: number, summary: RestaurantSummary | null): void {
    this.self = self;
    this.rank = rank;
    this.summary = summary;
    if (this.isOpen) this.refresh();
  }

  override select(id: string): void {
    this.viewing = 0;
    this.petView = 0;
    this.selling = false;
    this.query = '';
    super.select(id);
  }

  override refresh(): void {
    const keep = this.body.querySelector('.rr-scroll')?.scrollTop ?? 0;
    switch (this.tab) {
      case 'staff':
        this.setTitle('Employees');
        this.drawStaff();
        break;
      case 'recipes':
        this.setTitle('Recipes');
        this.drawRecipes();
        break;
      case 'customers':
        this.setTitle('Customers');
        this.drawCustomers();
        break;
      case 'pets':
        this.setTitle('Pet Inventory');
        this.drawPets();
        break;
      default:
        this.setTitle('Restaurant');
        this.drawRestaurant();
    }
    const scroll = this.body.querySelector('.rr-scroll');
    if (scroll) scroll.scrollTop = keep;
  }

  // ----------------------------------------------------------------- staff

  private drawStaff(): void {
    const self = this.self;
    const hired = this.summary?.staff ?? [];
    const cap = TIERS[this.summary?.tier ?? 0]!.staff;
    const head = el('div', 'rr-row');
    head.append(el('span', 'rr-hint', `Staff: ${hired.length}/${cap}`), el('span', 'rr-spacer'));
    if (hired.length >= cap && (this.summary?.tier ?? 0) < MAX_TIER) head.appendChild(el('span', 'rr-card__sub', 'Expand your restaurant to hire more'));
    const scroll = el('div', 'rr-scroll');
    for (const role of ROLES) {
      scroll.appendChild(el('div', 'rr-section', role.plural));
      scroll.appendChild(el('div', 'rr-card__sub', this.rank < role.rank ? `Unlocks at ${RANKS[role.rank]!.name} rank. ${role.job}.` : role.job));
      const grid = el('div', 'rr-grid');
      for (const def of STAFF.filter((s) => s.role === role.id)) {
        const at = hired.findIndex((h) => h.member === def.id);
        const level = role.skill >= 0 ? levelOf(self?.xp[role.skill] ?? 0) : 99;
        const needRank = Math.max(role.rank, def.rank ?? 0);
        const lockedBy = needRank > this.rank ? RANKS[needRank]!.name : def.level > level ? `${role.skillName} Lvl. ${def.level}` : '';
        const card = el('div', `rr-card${lockedBy ? ' is-locked' : ''}`);
        card.style.cursor = 'default';
        if (lockedBy) {
          card.append(el('div', 'rr-card__lock rr-outline-thin', '\u{1f512} Locked'), icon(this.icons.staff(def.id), 'rr-card__art'), el('div', 'rr-card__req', `Requires:\n${lockedBy}`));
        } else if (at >= 0) {
          const record = hired[at]!;
          card.append(icon(this.icons.staff(def.id), 'rr-card__art'), el('div', 'rr-card__name rr-outline-thin', def.name), el('div', 'rr-card__sub', `Lv ${record.level} - speed x${staffSpeed(def, record.level).toFixed(2)}`));
          card.appendChild(el('span', 'rr-card__badge', 'Hired'));
          const row = el('div', 'rr-row');
          if (record.level < MAX_STAFF_LEVEL) {
            const cost = upgradeCost(def, record.level);
            row.appendChild(button(`rr-btn rr-btn--small ${(self?.cash ?? 0) >= cost ? '' : 'rr-btn--gray'}`, `Train $${formatPrice(cost)}`, () => this.actions.staff(at, 'upgrade')));
          }
          row.appendChild(button('rr-btn rr-btn--small rr-btn--red', 'Fire', () => this.actions.staff(at, 'fire')));
          card.appendChild(row);
        } else {
          card.append(icon(this.icons.staff(def.id), 'rr-card__art'), el('div', 'rr-card__name rr-outline-thin', def.name), el('div', 'rr-card__sub', `speed x${def.speed}`));
          card.appendChild(button(`rr-btn rr-btn--small ${(self?.cash ?? 0) >= def.price ? '' : 'rr-btn--gray'}`, `$${formatPrice(def.price)}`, () => this.actions.hire(def.id)));
        }
        grid.appendChild(card);
      }
      scroll.appendChild(grid);
    }
    this.body.replaceChildren(head, scroll);
  }

  // --------------------------------------------------------------- recipes

  private drawRecipes(): void {
    const self = this.self;
    if (this.viewing) {
      this.drawRecipe(this.viewing);
      return;
    }
    const cooking = levelOf(self?.xp[SKILL.cooking] ?? 0);
    const stock = (id: number): number => self?.ingredients.find((s) => s.id === id)?.count ?? 0;
    const top = el('div', 'rr-row');
    top.append(el('span', 'rr-hint', '☛ Tap Recipe to View'), el('span', 'rr-spacer'));
    for (const f of ['locked', 'unlocked', 'enabled', 'disabled'] as const) {
      top.appendChild(button(`rr-filter${this.recipeFilter === f ? ' is-on' : ''}`, f[0]!.toUpperCase() + f.slice(1), () => {
        this.recipeFilter = this.recipeFilter === f ? '' : f;
        this.refresh();
      }));
    }
    const search = el('input', 'rr-search');
    search.placeholder = 'Search recipes...';
    search.value = this.query;
    search.addEventListener('input', () => {
      this.query = search.value.trim().toLowerCase();
      const pos = search.selectionStart;
      this.refresh();
      const again = this.body.querySelector('input');
      again?.focus();
      if (again && pos !== null) again.setSelectionRange(pos, pos);
    });
    search.addEventListener('keydown', (event) => event.stopPropagation());
    const scroll = el('div', 'rr-scroll');
    scroll.appendChild(el('div', 'rr-section', 'Food'));
    const grid = el('div', 'rr-grid');
    for (const recipe of RECIPES) {
      const unlocked = recipe.level <= cooking;
      const enabled = !(self?.recipesOff.includes(recipe.id) ?? false);
      if (this.query && !recipe.name.toLowerCase().includes(this.query)) continue;
      if (this.recipeFilter === 'locked' && unlocked) continue;
      if (this.recipeFilter === 'unlocked' && !unlocked) continue;
      if (this.recipeFilter === 'enabled' && (!unlocked || !enabled)) continue;
      if (this.recipeFilter === 'disabled' && (!unlocked || enabled)) continue;
      const card = el('div', `rr-card${unlocked ? '' : ' is-locked'}`);
      card.append(el('div', 'rr-card__name rr-outline-thin', recipe.name), el('div', 'rr-card__price rr-outline-thin', `$${recipe.price}`), icon(this.icons.dish(recipe.id), 'rr-card__art'));
      if (unlocked && !enabled) card.appendChild(el('span', 'rr-card__badge', 'Off'));
      if (!unlocked) card.appendChild(el('div', 'rr-card__req', `Cooking Lvl. ${recipe.level}`));
      if (recipe.needs.length > 0) {
        const needs = el('div', 'rr-needs');
        needs.appendChild(el('div', '', 'Requires:'));
        const row = el('div', 'rr-needs__row');
        for (const [id, n] of recipe.needs) {
          const slot = el('div', `rr-needs__item${unlocked && stock(id) < n ? ' is-short' : ''}`);
          slot.append(icon(this.icons.ingredient(id)), el('span', 'rr-outline-thin', `x${n}`));
          row.appendChild(slot);
        }
        needs.appendChild(row);
        card.appendChild(needs);
      }
      card.addEventListener('click', () => {
        this.viewing = recipe.id;
        this.refresh();
      });
      grid.appendChild(card);
    }
    scroll.appendChild(grid);
    this.body.replaceChildren(top, search, scroll);
  }

  private drawRecipe(id: number): void {
    const recipe = recipeById(id);
    const self = this.self;
    if (!recipe) return;
    const cooking = levelOf(self?.xp[SKILL.cooking] ?? 0);
    const unlocked = recipe.level <= cooking;
    const enabled = !(self?.recipesOff.includes(recipe.id) ?? false);
    const stock = (i: number): number => self?.ingredients.find((s) => s.id === i)?.count ?? 0;
    const back = button('rr-btn rr-btn--gray rr-btn--small', '< Back', () => {
      this.viewing = 0;
      this.refresh();
    });
    const box = el('div', 'rr-dialog');
    const rarity = RARITIES[recipe.rarity];
    const name = el('div', 'rr-dialog__big rr-outline', recipe.name);
    name.style.color = rarity.color;
    const art = icon(this.icons.dish(recipe.id), '');
    art.style.width = 'calc(200 * var(--u))';
    art.style.minWidth = '90px';
    box.append(name, art, el('div', '', `"${recipe.desc}"`));
    box.appendChild(el('div', '', `Sells for $${recipe.price}  -  ${recipe.cook}s on a basic stove  -  ${rarity.name}`));
    if (recipe.needs.length === 0) box.appendChild(el('div', 'rr-card__sub', 'Needs nothing but the pantry - always cookable.'));
    else {
      const row = el('div', 'rr-needs__row');
      for (const [ing, n] of recipe.needs) {
        const slot = el('div', `rr-needs__item${stock(ing) < n ? ' is-short' : ''}`);
        slot.style.width = 'calc(70 * var(--u))';
        slot.style.height = 'calc(70 * var(--u))';
        slot.append(icon(this.icons.ingredient(ing)), el('span', 'rr-outline-thin', `${stock(ing)}/${n}`));
        row.appendChild(slot);
      }
      box.appendChild(row);
      const missing = missingText(recipe, stock);
      box.appendChild(el('div', missing ? 'rr-card__req' : 'rr-card__sub', missing ? `Missing: ${missing}. Customers will not order it until your fridge has enough.` : canAfford(recipe, stock) ? 'Your fridge has everything for it.' : ''));
    }
    if (!unlocked) box.appendChild(el('div', 'rr-card__req', `Unlocks at Cooking level ${recipe.level} (you are level ${cooking}). Cook more dishes to level up!`));
    else box.appendChild(button(`rr-btn ${enabled ? 'rr-btn--red' : ''}`, enabled ? 'Take off the menu' : 'Put on the menu', () => this.actions.recipe(recipe.id, !enabled)));
    const scroll = el('div', 'rr-scroll');
    scroll.appendChild(box);
    this.body.replaceChildren(back, scroll);
  }

  // ------------------------------------------------------------- customers

  private drawCustomers(): void {
    const index = new Map((this.self?.index ?? []).map((s) => [s.id, s.count]));
    const top = el('div', 'rr-row');
    top.append(el('span', 'rr-hint', `☛ Customers met: ${index.size}/${CUSTOMERS.length}`), el('span', 'rr-spacer'));
    for (const f of ['locked', 'unlocked'] as const) {
      top.appendChild(button(`rr-filter${this.customerFilter === f ? ' is-on' : ''}`, f === 'locked' ? 'Locked' : 'Unlocked', () => {
        this.customerFilter = this.customerFilter === f ? '' : f;
        this.refresh();
      }));
    }
    const scroll = el('div', 'rr-scroll');
    for (const rarityId of CUSTOMER_RARITY_ORDER) {
      const rarity = CUSTOMER_RARITIES[rarityId];
      const list = CUSTOMERS.filter((c) => c.rarity === rarityId).filter((c) => {
        const met = index.has(c.id);
        return this.customerFilter === '' || (this.customerFilter === 'unlocked') === met;
      });
      if (list.length === 0) continue;
      scroll.appendChild(el('div', 'rr-section', rarity.name));
      const grid = el('div', 'rr-grid rr-grid--wide');
      for (const c of list) {
        const served = index.get(c.id) ?? 0;
        const card = el('div', `rr-card${served ? '' : ' is-locked'}`);
        card.style.flexDirection = 'row';
        card.style.alignItems = 'stretch';
        card.style.cursor = 'default';
        const words = el('div', '');
        words.style.flex = '1';
        words.style.textAlign = 'left';
        const rarityText = el('div', 'rr-outline-thin', rarity.name);
        rarityText.style.color = rarity.color;
        words.append(el('div', 'rr-card__name rr-outline-thin', served ? c.name : '???'), rarityText);
        if (c.perk !== 'none') words.appendChild(el('div', 'rr-card__sub', c.perkText));
        words.appendChild(el('div', 'rr-card__sub', `Served ${served} Times`));
        const face = icon(this.icons.customer(c.id), 'rr-card__art');
        face.style.width = '42%';
        card.append(words, face);
        grid.appendChild(card);
      }
      scroll.appendChild(grid);
    }
    this.body.replaceChildren(top, scroll);
  }

  // ------------------------------------------------------------------ pets

  private drawPets(): void {
    const self = this.self;
    const pets = self?.pets ?? [];
    const equipped = new Set(self?.petsEquipped ?? []);
    if (this.petView && !pets.some((p) => p.uid === this.petView)) this.petView = 0;
    if (this.petView) {
      this.drawPet(this.petView, equipped.has(this.petView));
      return;
    }
    const top = el('div', 'rr-row');
    top.append(el('span', 'rr-hint', this.selling ? '\u261b Tap a Pet to Sell it' : '\u261b Tap Pet to View'), el('span', 'rr-spacer'), el('span', 'rr-hint', `Pets: ${pets.length}/${PET_LIMIT}`));
    const trash = button(`rr-btn rr-btn--small ${this.selling ? 'rr-btn--red' : 'rr-btn--gray'}`, '', () => {
      this.selling = !this.selling;
      this.refresh();
    });
    // A drawn bin: emoji fonts are not on every device.
    trash.innerHTML = '<svg viewBox="0 0 16 16" width="1.1em" height="1.1em" fill="currentColor" style="display:block"><rect x="2" y="3" width="12" height="2" rx="1"/><rect x="6" y="1" width="4" height="2" rx="1"/><path d="M3.5 6h9l-.8 8.2a1 1 0 0 1-1 .8H5.3a1 1 0 0 1-1-.8z"/></svg>';
    trash.title = 'Sell pets';
    top.appendChild(trash);
    const grid = el('div', 'rr-grid');
    const sorted = [...pets].sort((a, b) => Number(equipped.has(b.uid)) - Number(equipped.has(a.uid)) || b.type - a.type);
    for (const pet of sorted) {
      const def = petById(pet.type);
      if (!def) continue;
      const rarity = RARITIES[def.rarity];
      const card = el('div', `rr-card${equipped.has(pet.uid) ? ' is-selected' : ''}`);
      const label = el('div', 'rr-card__sub rr-outline-thin', rarity.name);
      label.style.color = rarity.color;
      card.append(icon(this.icons.pet(pet.type), 'rr-card__art'), el('div', 'rr-card__name rr-outline-thin', def.name), label);
      if (equipped.has(pet.uid)) card.appendChild(el('span', 'rr-card__badge', 'Equipped'));
      if (this.selling) card.appendChild(el('div', 'rr-card__price rr-outline-thin', `Sell $${formatPrice(def.sell)}`));
      card.addEventListener('click', () => {
        if (this.selling) this.actions.petSell(pet.uid);
        else {
          this.petView = pet.uid;
          this.refresh();
        }
      });
      grid.appendChild(card);
    }
    // The reference's last tile: a pet silhouette and the green Buy a Pet button.
    const buy = el('div', 'rr-card');
    const ghost = icon(this.icons.pet(1), 'rr-card__art');
    ghost.style.filter = 'brightness(0.35)';
    buy.append(ghost, button('rr-btn rr-btn--small', 'Buy a Pet', () => this.actions.buyPet()));
    grid.appendChild(buy);
    const scroll = el('div', 'rr-scroll');
    scroll.appendChild(grid);
    const note = el('div', 'rr-card__sub', `Up to ${EQUIP_LIMIT} pets follow you and help: tips, cooking, walk speed, skill XP, rare customers or fishing luck.`);
    this.body.replaceChildren(top, scroll, note);
  }

  private drawPet(uid: number, isEquipped: boolean): void {
    const pet = this.self?.pets.find((p) => p.uid === uid);
    const def = pet ? petById(pet.type) : undefined;
    if (!pet || !def) return;
    const rarity = RARITIES[def.rarity];
    const box = el('div', 'rr-dialog');
    const name = el('div', 'rr-dialog__big rr-outline', def.name);
    name.style.color = rarity.color;
    const art = icon(this.icons.pet(def.id), '');
    art.style.width = 'calc(220 * var(--u))';
    art.style.minWidth = '100px';
    box.append(name, el('div', '', rarity.name), art, el('div', '', `+${Math.round(def.value * 100)}% ${PERK_TEXT[def.perk]} while it follows you`));
    const row = el('div', 'rr-dialog__buttons');
    row.append(
      button(`rr-btn ${isEquipped ? 'rr-btn--gray' : 'rr-btn--blue'}`, isEquipped ? 'Unequip' : 'Equip', () => this.actions.petEquip(uid, !isEquipped)),
      button('rr-btn rr-btn--red', `Sell $${formatPrice(def.sell)}`, () => this.actions.petSell(uid)),
    );
    box.appendChild(row);
    const back = button('rr-btn rr-btn--gray rr-btn--small', '< Back', () => {
      this.petView = 0;
      this.refresh();
    });
    const scroll = el('div', 'rr-scroll');
    scroll.appendChild(box);
    this.body.replaceChildren(back, scroll);
  }

  // ------------------------------------------------------------ restaurant

  private drawRestaurant(): void {
    const self = this.self;
    const s = this.summary;
    const scroll = el('div', 'rr-scroll');
    const tier = s?.tier ?? 0;
    const current = TIERS[tier]!;
    scroll.appendChild(el('div', 'rr-section', 'Your Restaurant'));
    const stats = el('div', 'rr-grid');
    const stat = (label: string, value: string): HTMLDivElement => {
      const card = el('div', 'rr-card');
      card.style.cursor = 'default';
      card.append(el('div', 'rr-card__sub', label), el('div', 'rr-card__name rr-outline-thin', value));
      return card;
    };
    stats.append(
      stat('Size', `${current.name} (${current.w}x${current.d})`),
      stat('Customers served', formatAmount(self?.served ?? 0)),
      stat('Rating', `★ ${(s?.rating ?? 0).toFixed(2)}`),
      stat('Likes', `${s?.likes ?? 0}`),
      stat('Cash earned', `$${formatAmount(self?.earned ?? 0)}`),
      stat('Staff room', `${s?.staff.length ?? 0}/${current.staff}`),
    );
    scroll.appendChild(stats);

    scroll.appendChild(el('div', 'rr-section', 'Expand'));
    const next = TIERS[tier + 1];
    if (!next) scroll.appendChild(el('div', 'rr-card__sub', 'Your restaurant is as grand as it gets!'));
    else {
      const row = el('div', 'rr-row');
      const ok = this.rank >= next.rank;
      row.append(
        el('div', '', `${next.name}: ${next.w}x${next.d} floor, room for ${next.staff} staff.${ok ? '' : ` Needs ${RANKS[next.rank]!.name} rank.`}`),
        el('span', 'rr-spacer'),
        button(`rr-btn ${ok && (self?.cash ?? 0) >= next.price ? '' : 'rr-btn--gray'}`, `Expand $${formatPrice(next.price)}`, () => this.actions.expand()),
      );
      scroll.appendChild(row);
    }

    scroll.appendChild(el('div', 'rr-section', `Fridge (${(self?.ingredients ?? []).reduce((n, i) => n + i.count, 0)}/${self?.fridgeCap ?? 0})`));
    const fridge = el('div', 'rr-grid');
    for (const ing of INGREDIENTS) {
      const count = self?.ingredients.find((i) => i.id === ing.id)?.count ?? 0;
      const card = el('div', `rr-card${count ? '' : ' is-locked'}`);
      card.style.cursor = 'default';
      card.append(icon(this.icons.ingredient(ing.id), 'rr-card__art'), el('div', 'rr-card__name rr-outline-thin', ing.name), el('div', 'rr-card__sub', `x${count}`));
      fridge.appendChild(card);
    }
    scroll.appendChild(fridge);
    if ((self?.fridgeCap ?? 0) === 0) scroll.appendChild(el('div', 'rr-card__req', 'Place a fridge to store ingredients from your farm and ranch!'));

    scroll.appendChild(el('div', 'rr-section', 'Styles'));
    const styles = el('div', 'rr-grid');
    for (const id of self?.styles ?? []) {
      const def = itemById(id);
      if (!def || (def.role !== 'floor' && def.role !== 'wall')) continue;
      const applied = id === s?.floor || id === s?.wall;
      const card = el('div', `rr-card${applied ? ' is-selected' : ''}`);
      card.style.cursor = 'default';
      card.append(icon(this.icons.item(id), 'rr-card__art'), el('div', 'rr-card__name rr-outline-thin', def.name));
      card.appendChild(applied ? el('div', 'rr-card__sub', 'Applied') : button('rr-btn rr-btn--small rr-btn--blue', 'Apply', () => this.actions.style(id)));
      styles.appendChild(card);
    }
    scroll.appendChild(styles);
    scroll.appendChild(el('div', 'rr-card__sub', 'Buy more floors and walls in the Shop\'s Structure section.'));
    this.body.replaceChildren(scroll);
  }
}
