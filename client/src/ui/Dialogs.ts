import { BOOSTS, DAILY_DIAMONDS, formatAmount, formatTimer, type AwayMessage, type BoostDef, type SelfState } from '@restaurant/shared';
import type { IconFactory } from './IconFactory.js';
import { GameWindow, button, el, icon } from './Modal.js';

/** A yes/no question in the game's window style. */
export class ConfirmDialog extends GameWindow {
  private text = '';
  private yes = 'OK';
  private onYes: (() => void) | null = null;

  constructor(container: HTMLElement) {
    super(container, 'Are you sure?', 'small');
  }

  ask(text: string, yes: string, onYes: () => void, title = 'Are you sure?'): void {
    this.text = text;
    this.yes = yes;
    this.onYes = onYes;
    this.setTitle(title);
    this.open();
  }

  override refresh(): void {
    const box = el('div', 'rr-dialog');
    box.appendChild(el('div', '', this.text));
    const buttons = el('div', 'rr-dialog__buttons');
    buttons.append(
      button('rr-btn rr-btn--gray', 'Cancel', () => this.close()),
      button('rr-btn', this.yes, () => {
        this.close();
        this.onYes?.();
      }),
    );
    box.appendChild(buttons);
    this.body.replaceChildren(box);
  }
}

/** WHILE YOU WERE AWAY: what the restaurant made, shown on return. */
export class AwayDialog extends GameWindow {
  private report: AwayMessage | null = null;

  constructor(container: HTMLElement, private readonly icons: IconFactory) {
    super(container, 'While You Were Away', 'small');
  }

  show(report: AwayMessage): void {
    this.report = report;
    this.open();
  }

  override refresh(): void {
    const r = this.report;
    if (!r) return;
    const box = el('div', 'rr-dialog');
    const h = Math.floor(r.seconds / 3600);
    const m = Math.floor((r.seconds % 3600) / 60);
    box.appendChild(el('div', '', `You were away for ${h > 0 ? `${h}h ` : ''}${m}m.`));
    if (r.cash > 0) {
      const art = icon(this.icons.art('cash'), '');
      art.style.width = 'calc(120 * var(--u))';
      box.append(art, el('div', 'rr-dialog__big rr-outline', `+$${formatAmount(r.cash)}`), el('div', '', `Your staff served about ${formatAmount(r.served)} customers.`));
    } else {
      box.appendChild(el('div', '', 'Your restaurant was closed - hire a Waiter and a Cook to keep it open while you are away!'));
    }
    if (r.crops > 0) box.appendChild(el('div', 'rr-card__sub', `${r.crops} crop${r.crops === 1 ? ' is' : 's are'} ripe and waiting on your farm.`));
    box.appendChild(button('rr-btn', 'Collect!', () => this.close()));
    this.body.replaceChildren(box);
  }
}

export interface PremiumActions {
  boost(id: BoostDef['id']): void;
  daily(): void;
  store(): void;
}

/** PREMIUM: Diamond boosts, the daily Diamonds, and the Bloxity store. */
export class PremiumWindow extends GameWindow {
  private self: SelfState | null = null;
  private now = Date.now();

  constructor(container: HTMLElement, private readonly icons: IconFactory, private readonly actions: PremiumActions) {
    super(container, 'Premium', 'medium');
  }

  setState(self: SelfState | null, now: number): void {
    this.self = self;
    this.now = now;
    if (this.isOpen) this.refresh();
  }

  override refresh(): void {
    const self = this.self;
    const scroll = el('div', 'rr-scroll');
    const top = el('div', 'rr-row');
    const gem = icon(this.icons.art('diamond'), '');
    gem.style.width = 'calc(60 * var(--u))';
    top.append(gem, el('div', 'rr-dialog__big rr-outline', `${formatAmount(self?.diamonds ?? 0)}`), el('span', 'rr-spacer'));
    top.appendChild(button(`rr-btn ${self?.dailyClaimed ? 'rr-btn--gray' : 'rr-btn--gold'}`, self?.dailyClaimed ? 'Daily claimed' : `Daily +${DAILY_DIAMONDS} ◆`, () => this.actions.daily()));
    scroll.appendChild(top);
    scroll.appendChild(el('div', 'rr-section', 'Boosts'));
    const grid = el('div', 'rr-grid rr-grid--wide');
    for (const boost of BOOSTS) {
      const until = self?.boosts[boost.id] ?? 0;
      const left = (until - this.now) / 1000;
      const card = el('div', 'rr-card');
      card.style.cursor = 'default';
      card.append(icon(this.icons.art('boost'), 'rr-card__art'), el('div', 'rr-card__name rr-outline-thin', boost.name), el('div', 'rr-card__sub', `${boost.desc} for ${boost.minutes} minutes`));
      if (left > 0) card.appendChild(el('div', 'rr-card__price rr-outline-thin', `Active ${formatTimer(left)}`));
      card.appendChild(button(`rr-btn rr-btn--small ${(self?.diamonds ?? 0) >= boost.diamonds ? 'rr-btn--blue' : 'rr-btn--gray'}`, `◆ ${boost.diamonds}`, () => this.actions.boost(boost.id)));
      grid.appendChild(card);
    }
    scroll.appendChild(grid);
    scroll.appendChild(el('div', 'rr-section', 'Get Diamonds'));
    const row = el('div', 'rr-row');
    row.append(el('div', 'rr-card__sub', 'Earn Diamonds from milestones, ranking up, the daily gift and royal customers - or pick up a pack in the Bloxity store.'), button('rr-btn rr-btn--gold', 'Store', () => this.actions.store()));
    scroll.appendChild(row);
    this.body.replaceChildren(scroll);
  }
}
