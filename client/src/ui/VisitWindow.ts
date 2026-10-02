import { BOARDS, RANKS, formatAmount, formatFull, type BoardId } from '@restaurant/shared';
import type { NetLeaderEntry } from '../net/netTypes.js';
import type { IconFactory } from './IconFactory.js';
import { GameWindow, button, el } from './Modal.js';

export interface RestaurantListing {
  readonly slot: number;
  readonly name: string;
  readonly avatar: string;
  readonly rank: number;
  readonly served: number;
  readonly rating: number;
  readonly likes: number;
  readonly staff: number;
  readonly mine: boolean;
  readonly liked: boolean;
}

/**
 * VISIT: every restaurant open in this server - its owner, rank, rating and
 * customers served - with a button to walk straight to its door, and the
 * town's leaderboards, as rows like the reference's group ranking.
 */
export class VisitWindow extends GameWindow {
  private listings: RestaurantListing[] = [];
  private boards: Partial<Record<BoardId, NetLeaderEntry[]>> = {};
  private board: BoardId = 'cash';
  private myBoards: Partial<Record<BoardId, number>> = {};

  constructor(
    container: HTMLElement,
    icons: IconFactory,
    private readonly visit: (slot: number) => void,
  ) {
    super(container, 'Restaurants', 'large', [
      { id: 'restaurants', label: 'Visit', art: icons.art('restaurant') },
      { id: 'leaderboard', label: 'Leaderboard', art: icons.art('leaderboard') },
    ]);
  }

  setState(listings: RestaurantListing[], boards: Partial<Record<BoardId, NetLeaderEntry[]>>, mine: Partial<Record<BoardId, number>>): void {
    this.listings = listings;
    this.boards = boards;
    this.myBoards = mine;
    if (this.isOpen) this.refresh();
  }

  override refresh(): void {
    if (this.tab === 'restaurants') this.drawRestaurants();
    else this.drawBoards();
  }

  private face(url: string): HTMLDivElement {
    const face = el('div', 'rr-entry__face');
    if (url) face.style.backgroundImage = `url("${url}")`;
    return face;
  }

  private drawRestaurants(): void {
    this.setTitle('Restaurants');
    const sorted = [...this.listings].sort((a, b) => b.rank - a.rank || b.served - a.served);
    const list = el('div', 'rr-list');
    sorted.forEach((r, i) => {
      const row = el('div', `rr-entry rr-entry--${i + 1}${r.mine ? ' rr-entry--me' : ''}`);
      const words = el('div', '');
      const rank = RANKS[r.rank] ?? RANKS[0]!;
      words.append(el('div', 'rr-entry__name', `${r.name}'s Restaurant`), el('div', 'rr-entry__meta', `${rank.name}  -  ★ ${r.rating.toFixed(1)}  -  ${formatAmount(r.served)} served  -  ♥ ${r.likes}  -  ${r.staff} staff`));
      row.append(el('div', 'rr-entry__place rr-outline', ['1st', '2nd', '3rd'][i] ?? `${i + 1}th`), this.face(r.avatar), words, el('span', 'rr-spacer'));
      row.appendChild(button(`rr-btn rr-btn--small ${r.mine ? 'rr-btn--blue' : ''}`, r.mine ? 'Go Home' : 'Visit', () => this.visit(r.slot)));
      list.appendChild(row);
    });
    if (sorted.length === 0) list.appendChild(el('div', 'rr-card__sub', 'Nobody else is here yet.'));
    const scroll = el('div', 'rr-scroll');
    scroll.appendChild(list);
    this.body.replaceChildren(el('div', 'rr-hint', '☛ Visit a restaurant to see how others run theirs - and leave a like!'), scroll);
  }

  private drawBoards(): void {
    this.setTitle('Leaderboard');
    const tabs = el('div', 'rr-tabs');
    for (const spot of BOARDS) {
      tabs.appendChild(button(`rr-tab${spot.id === this.board ? ' is-on' : ''}`, spot.title.replace(' Leaderboard', ''), () => {
        this.board = spot.id;
        this.refresh();
      }));
    }
    const rows = this.boards[this.board] ?? [];
    const list = el('div', 'rr-list');
    rows.forEach((row, i) => {
      const entry = el('div', `rr-entry rr-entry--${i + 1}`);
      entry.append(el('div', 'rr-entry__place rr-outline', ['1st', '2nd', '3rd'][i] ?? `${i + 1}th`), this.face(row.avatarUrl), el('div', 'rr-entry__name', row.name || 'Chef'), el('div', 'rr-entry__value', formatValue(this.board, row.value)));
      list.appendChild(entry);
    });
    if (rows.length === 0) list.appendChild(el('div', 'rr-card__sub', 'No one is on this board yet.'));
    const mine = this.myBoards[this.board] ?? 0;
    const me = el('div', 'rr-hint', mine > 0 ? `Your place: #${mine}` : 'Play more to get on this board!');
    const scroll = el('div', 'rr-scroll');
    scroll.appendChild(list);
    this.body.replaceChildren(tabs, me, scroll);
  }
}

export const formatValue = (board: BoardId, value: number): string => {
  switch (board) {
    case 'cash':
      return `$${formatAmount(value)}`;
    case 'playtime': {
      const h = Math.floor(value / 3600);
      const m = Math.floor((value % 3600) / 60);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    case 'rank':
      return `${formatFull(value)} pts`;
    case 'fish':
      return `${(value / 100).toFixed(2)} kg`;
    default:
      return formatFull(value);
  }
};
