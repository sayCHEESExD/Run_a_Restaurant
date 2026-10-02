import { EGGS, PERK_TEXT, PET_LIMIT, RANKS, RARITIES, eggById, eggChance, formatPrice, petById, type SelfState } from '@restaurant/shared';
import type { IconFactory } from './IconFactory.js';
import { GameWindow, button, el, icon } from './Modal.js';

/**
 * THE PET MERCHANT: three eggs - each with what can hatch from it and the
 * odds - and a Buy button. What hatches is rolled by the server.
 */
export class PetShopWindow extends GameWindow {
  private self: SelfState | null = null;
  private rank = 0;

  constructor(container: HTMLElement, private readonly icons: IconFactory, private readonly buy: (egg: number) => void, private readonly inventory: () => void) {
    super(container, 'Pet Merchant', 'large');
  }

  setState(self: SelfState | null, rank: number): void {
    this.self = self;
    this.rank = rank;
    if (this.isOpen) this.refresh();
  }

  override refresh(): void {
    const self = this.self;
    const top = el('div', 'rr-row');
    top.append(el('span', 'rr-hint', '☛ Buy an egg to hatch a pet!'), el('span', 'rr-spacer'), el('span', 'rr-hint', `Pets: ${self?.pets.length ?? 0}/${PET_LIMIT}`), button('rr-btn rr-btn--small rr-btn--blue', 'My Pets', () => this.inventory()));
    const grid = el('div', 'rr-grid rr-grid--wide');
    for (const egg of EGGS) {
      const locked = egg.rank > this.rank;
      const card = el('div', `rr-card${locked ? ' is-locked' : ''}`);
      card.style.cursor = 'default';
      card.append(icon(this.icons.egg(egg.id), 'rr-card__art'), el('div', 'rr-card__name rr-outline-thin', egg.name));
      const odds = el('div', 'rr-needs__row');
      for (const [pet] of egg.odds) {
        const def = petById(pet)!;
        const slot = el('div', 'rr-needs__item');
        slot.style.width = 'calc(56 * var(--u))';
        slot.style.height = 'calc(56 * var(--u))';
        slot.style.boxShadow = `0 0 0 2px ${RARITIES[def.rarity].color}`;
        slot.title = `${def.name} - ${PERK_TEXT[def.perk]}`;
        slot.append(icon(this.icons.pet(pet)), el('span', 'rr-outline-thin', `${Math.round(eggChance(egg, pet) * 100)}%`));
        odds.appendChild(slot);
      }
      card.appendChild(odds);
      const price = egg.diamonds ? `◆ ${egg.diamonds}` : `$${formatPrice(egg.price)}`;
      const afford = egg.diamonds ? (self?.diamonds ?? 0) >= egg.diamonds : (self?.cash ?? 0) >= egg.price;
      if (locked) card.appendChild(el('div', 'rr-card__req', `Requires ${RANKS[egg.rank]!.name}`));
      else card.appendChild(button(`rr-btn ${afford ? (egg.diamonds ? 'rr-btn--blue' : '') : 'rr-btn--gray'}`, `Buy ${price}`, () => this.buy(egg.id)));
      grid.appendChild(card);
    }
    const scroll = el('div', 'rr-scroll');
    scroll.appendChild(grid);
    this.body.replaceChildren(top, scroll, el('div', 'rr-card__sub', 'Sell pets back from your Pet Inventory (Manage > Pets) with the bin button.'));
  }
}

/** A freshly hatched pet, presented. */
export class HatchDialog extends GameWindow {
  private pet = 0;
  private egg = 0;

  constructor(container: HTMLElement, private readonly icons: IconFactory) {
    super(container, 'You hatched...', 'small');
  }

  show(pet: number, egg: number): void {
    this.pet = pet;
    this.egg = egg;
    this.open();
  }

  override refresh(): void {
    const def = petById(this.pet);
    if (!def) return;
    const rarity = RARITIES[def.rarity];
    const box = el('div', 'rr-dialog');
    const art = icon(this.icons.pet(def.id), '');
    art.style.width = 'calc(240 * var(--u))';
    art.style.minWidth = '110px';
    const name = el('div', 'rr-dialog__big rr-outline', `${def.name}!`);
    name.style.color = rarity.color;
    box.append(el('div', '', `From your ${eggById(this.egg)?.name ?? 'egg'}:`), art, name, el('div', 'rr-outline-thin', rarity.name), el('div', '', `+${Math.round(def.value * 100)}% ${PERK_TEXT[def.perk]}`));
    box.appendChild(button('rr-btn', 'Awesome!', () => this.close()));
    this.body.replaceChildren(box);
  }
}
