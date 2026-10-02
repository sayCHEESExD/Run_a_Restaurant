import { CARRY, RANKS, formatAmount, formatTimer, recipeById } from '@restaurant/shared';
import type { IconFactory } from './IconFactory.js';
import { button, el, icon } from './Modal.js';
import { injectStyles } from './styles.js';

export type RailId = 'premium' | 'shop' | 'manage' | 'visit' | 'skills';

export interface HudHandlers {
  premium(): void;
  shopOrHome(): void;
  manage(): void;
  visit(): void;
  skills(): void;
  items(): void;
  rewards(): void;
  rank(): void;
  like(): void;
}

export interface VisitingInfo {
  readonly name: string;
  readonly avatar: string;
  readonly meta: string;
  readonly liked: boolean;
}

/**
 * THE SCREEN'S FURNITURE, laid out like the reference: the white pill of
 * round buttons down the left (Premium, Shop/Home, Manage, Visit, Skills);
 * Cash, Diamonds and the rank bottom left; the Items hammer bottom middle
 * with what you are carrying above it; the current milestone and its green
 * Rewards button on the right; boosts and the version top right; toasts
 * under the top; and a banner while visiting someone's restaurant.
 */
export class Hud {
  readonly root: HTMLDivElement;
  private readonly rail = new Map<RailId, { button: HTMLButtonElement; art: HTMLImageElement; label: HTMLSpanElement; badge: HTMLSpanElement }>();
  private readonly cash: HTMLSpanElement;
  private readonly gems: HTMLSpanElement;
  private readonly moneyBox: HTMLDivElement;
  private readonly rankBadge: HTMLSpanElement;
  private readonly rankText: HTMLSpanElement;
  private readonly itemsButton: HTMLButtonElement;
  private readonly carry: HTMLDivElement;
  private readonly carryIcon: HTMLImageElement;
  private readonly carryText: HTMLSpanElement;
  private readonly taskText: HTMLSpanElement;
  private readonly taskCount: HTMLSpanElement;
  private readonly taskFill: HTMLDivElement;
  private readonly rewards: HTMLButtonElement;
  private readonly corner: HTMLDivElement;
  private readonly boosts: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private readonly visiting: HTMLDivElement;
  private readonly visitFace: HTMLDivElement;
  private readonly visitName: HTMLDivElement;
  private readonly visitMeta: HTMLDivElement;
  private readonly visitLike: HTMLButtonElement;
  private lastCash = -1;
  private atShop = false;
  private carrySignature = '';

  constructor(container: HTMLElement, private readonly icons: IconFactory, handlers: HudHandlers) {
    injectStyles();
    this.root = el('div', 'rr-hud rr-font');
    container.appendChild(this.root);

    // ---- left rail
    const rail = el('div', 'rr-rail');
    const add = (id: RailId, label: string, onClick: () => void): void => {
      const b = button('rr-rail__btn', '', onClick);
      const art = icon(this.icons.art(id === 'shop' ? 'shop' : id), 'rr-rail__art');
      const text = el('span', 'rr-rail__label rr-outline-thin', label);
      const badge = el('span', 'rr-rail__badge');
      b.append(art, text, badge);
      rail.appendChild(b);
      this.rail.set(id, { button: b, art, label: text, badge });
    };
    add('premium', 'Premium', () => handlers.premium());
    add('shop', 'Shop', () => handlers.shopOrHome());
    add('manage', 'Manage', () => handlers.manage());
    add('visit', 'Visit', () => handlers.visit());
    add('skills', 'Skills', () => handlers.skills());
    this.root.appendChild(rail);

    // ---- money and rank, bottom left
    this.moneyBox = el('div', 'rr-money');
    const rank = el('div', 'rr-rankchip rr-outline-thin');
    this.rankBadge = el('span', 'rr-rankchip__badge');
    this.rankText = el('span', '', 'Bronze I');
    rank.append(this.rankBadge, this.rankText);
    rank.addEventListener('click', (event) => {
      event.stopPropagation();
      handlers.rank();
    });
    const gemRow = el('div', 'rr-money__row');
    gemRow.append(icon(this.icons.art('diamond'), 'rr-money__gems-icon'));
    this.gems = el('span', 'rr-money__gems rr-outline', '0');
    gemRow.appendChild(this.gems);
    const cashRow = el('div', 'rr-money__row');
    cashRow.append(icon(this.icons.art('cash'), 'rr-money__icon'));
    this.cash = el('span', 'rr-money__cash rr-outline', '$0');
    cashRow.appendChild(this.cash);
    this.moneyBox.append(rank, gemRow, cashRow);
    this.root.appendChild(this.moneyBox);

    // ---- the Items hammer, and what is in your hands
    this.itemsButton = button('rr-items', '', () => handlers.items());
    this.itemsButton.append(icon(this.icons.art('items'), 'rr-items__art'), el('span', 'rr-items__key rr-outline-thin', '[B]'), el('span', 'rr-items__label rr-outline-thin', 'Items'));
    this.root.appendChild(this.itemsButton);
    this.carry = el('div', 'rr-carry');
    this.carryIcon = icon('', 'rr-carry__icon');
    this.carryText = el('span', '', '');
    this.carry.append(this.carryIcon, this.carryText);
    this.carry.hidden = true;
    this.root.appendChild(this.carry);

    // ---- the milestone card
    const task = el('div', 'rr-task');
    const card = el('div', 'rr-task__card');
    const line = el('div', 'rr-task__line');
    this.taskText = el('span', 'rr-task__text rr-outline-thin', '');
    this.taskCount = el('span', 'rr-task__count rr-outline-thin', '');
    line.append(this.taskText, this.taskCount);
    const bar = el('div', 'rr-task__bar');
    this.taskFill = el('div', 'rr-task__fill');
    bar.appendChild(this.taskFill);
    card.append(line, bar);
    this.rewards = button('rr-task__rewards rr-outline', 'Rewards', () => handlers.rewards());
    task.append(card, this.rewards);
    this.root.appendChild(task);

    // ---- corner: boosts and the version
    this.corner = el('div', 'rr-corner');
    this.boosts = el('div', 'rr-corner');
    this.boosts.style.position = 'static';
    this.corner.append(el('div', 'rr-version', '1.0.0'), this.boosts);
    this.root.appendChild(this.corner);

    this.toasts = el('div', 'rr-toasts');
    this.root.appendChild(this.toasts);

    // ---- visiting banner
    this.visiting = el('div', 'rr-visiting');
    this.visitFace = el('div', 'rr-visiting__face');
    const words = el('div', '');
    this.visitName = el('div', 'rr-visiting__name', '');
    this.visitMeta = el('div', 'rr-visiting__meta', '');
    words.append(this.visitName, this.visitMeta);
    this.visitLike = button('rr-visiting__like', 'Like', () => handlers.like());
    this.visiting.append(this.visitFace, words, this.visitLike);
    this.visiting.hidden = true;
    this.root.appendChild(this.visiting);
  }

  // ---------------------------------------------------------------- state

  setMoney(cash: number, diamonds: number): void {
    const text = `$${formatAmount(cash)}`;
    if (this.cash.textContent !== text) this.cash.textContent = text;
    const gems = formatAmount(diamonds);
    if (this.gems.textContent !== gems) this.gems.textContent = gems;
    if (this.lastCash >= 0 && cash > this.lastCash) {
      this.moneyBox.classList.remove('rr-money--pop');
      void this.moneyBox.offsetWidth;
      this.moneyBox.classList.add('rr-money--pop');
    }
    this.lastCash = cash;
  }

  setRank(rank: number, rating: number): void {
    const def = RANKS[rank] ?? RANKS[0]!;
    const text = `${def.name}  ★ ${rating.toFixed(1)}`;
    if (this.rankText.textContent !== text) {
      this.rankText.textContent = text;
      this.rankBadge.style.background = `radial-gradient(circle at 40% 35%, ${def.color}, ${def.dark})`;
    }
  }

  /** Near the Shop, the rail's second button takes you home instead. */
  setShopHome(atShop: boolean): void {
    if (atShop === this.atShop) return;
    this.atShop = atShop;
    const entry = this.rail.get('shop')!;
    entry.label.textContent = atShop ? 'Home' : 'Shop';
    entry.art.src = this.icons.art(atShop ? 'home' : 'shop');
  }

  setBadge(id: RailId, text: string): void {
    const badge = this.rail.get(id)?.badge;
    if (badge && badge.textContent !== text) badge.textContent = text;
  }

  setTask(text: string, value: number, target: number, ready: boolean, done: boolean): void {
    if (this.taskText.textContent !== text) this.taskText.textContent = text;
    const count = done ? '' : `${Math.min(value, target).toLocaleString('en-US')}/${target.toLocaleString('en-US')}`;
    if (this.taskCount.textContent !== count) this.taskCount.textContent = count;
    this.taskFill.style.width = `${done ? 100 : Math.min(100, (value / Math.max(1, target)) * 100)}%`;
    this.rewards.classList.toggle('is-ready', ready);
  }

  setCarry(kind: number, recipe: number): void {
    const signature = `${kind}:${recipe}`;
    if (signature === this.carrySignature) return;
    this.carrySignature = signature;
    this.carry.hidden = kind === CARRY.none;
    if (kind === CARRY.none) return;
    const name = recipeById(recipe)?.name ?? '';
    if (kind === CARRY.ticket) {
      this.carryIcon.src = this.icons.dish(recipe);
      this.carryText.textContent = `Ticket: ${name} - take it to a stove`;
    } else if (kind === CARRY.plate) {
      this.carryIcon.src = this.icons.dish(recipe);
      this.carryText.textContent = `${name} - serve it to its customer`;
    } else {
      this.carryIcon.src = this.icons.art('cleaning');
      this.carryText.textContent = 'Dirty dish - take it to the sink';
    }
  }

  setBoosts(boosts: readonly { name: string; seconds: number }[]): void {
    const signature = boosts.map((b) => `${b.name} ${formatTimer(b.seconds)}`).join('|');
    if (this.boosts.dataset['s'] === signature) return;
    this.boosts.dataset['s'] = signature;
    this.boosts.replaceChildren(...boosts.map((b) => el('div', 'rr-boost rr-outline-thin', `⚡ ${b.name} ${formatTimer(b.seconds)}`)));
  }

  setItemsActive(active: boolean): void {
    this.itemsButton.classList.toggle('is-active', active);
  }

  setVisiting(info: VisitingInfo | null): void {
    this.visiting.hidden = !info;
    if (!info) return;
    if (this.visitName.textContent !== info.name) this.visitName.textContent = info.name;
    if (this.visitMeta.textContent !== info.meta) this.visitMeta.textContent = info.meta;
    const bg = info.avatar ? `url("${info.avatar}")` : '';
    if (this.visitFace.style.backgroundImage !== bg) this.visitFace.style.backgroundImage = bg;
    this.visitLike.classList.toggle('is-done', info.liked);
    this.visitLike.textContent = info.liked ? 'Liked!' : '♥ Like';
  }

  /** Hide the gameplay HUD (the tutorial's first moments, build mode keeps it). */
  setVisible(visible: boolean): void {
    this.root.style.visibility = visible ? '' : 'hidden';
  }

  toast(text: string, kind: 'good' | 'bad' | 'info' | 'gold' = 'info'): void {
    const node = el('div', `rr-toast rr-toast--${kind} rr-outline-thin`, text);
    this.toasts.appendChild(node);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => node.remove(), 3300);
  }

  // ---------------------------------------------------------------- rects

  railRect(id: RailId): DOMRect | null {
    return this.rail.get(id)?.button.getBoundingClientRect() ?? null;
  }

  itemsRect(): DOMRect {
    return this.itemsButton.getBoundingClientRect();
  }

  moneyRect(): DOMRect {
    return this.cash.getBoundingClientRect();
  }

  rewardsRect(): DOMRect {
    return this.rewards.getBoundingClientRect();
  }

  dispose(): void {
    this.root.remove();
  }
}
