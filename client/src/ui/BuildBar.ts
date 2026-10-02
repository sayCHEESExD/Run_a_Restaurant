import { itemById, placeable, type SelfState } from '@restaurant/shared';
import type { IconFactory } from './IconFactory.js';
import { button, el, icon } from './Modal.js';
import { injectStyles } from './styles.js';

export interface BuildHandlers {
  done(): void;
  changed(): void;
  /** Touch: put the ghost down where it is. */
  confirm(): void;
  shop(): void;
}

/**
 * BUILD MODE'S BAR, opened by the Items button (or B): the owner's unplaced
 * items as a strip of tiles with their counts, and the tools - Rotate (R),
 * Move (pick something up and put it somewhere else), Place (for touch) and
 * Done. The ghost in the world follows the pointer; the rules it is checked
 * against are the server's own (`placeProblem`).
 */
export class BuildBar {
  readonly root: HTMLDivElement;
  selected = 0;
  rot = 0;
  /** Move mode: clicking a placed item picks it up to move. */
  moving = false;
  /** The placed item being moved (its id), 0 when none. */
  movingId = 0;
  private readonly strip: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly moveButton: HTMLButtonElement;
  private readonly placeButton: HTMLButtonElement;
  private self: SelfState | null = null;
  private signature = '';

  constructor(container: HTMLElement, private readonly icons: IconFactory, private readonly handlers: BuildHandlers) {
    injectStyles();
    this.root = el('div', 'rr-build');
    this.root.hidden = true;
    this.hint = el('div', 'rr-build__hint rr-outline-thin', '');
    const tools = el('div', 'rr-build__tools');
    tools.appendChild(button('rr-btn rr-btn--blue', 'Rotate (R)', () => this.rotate()));
    this.moveButton = button('rr-btn rr-btn--gold', 'Move / Pick Up', () => {
      this.moving = !this.moving;
      this.movingId = 0;
      if (this.moving) this.selected = 0;
      this.draw(true);
      this.handlers.changed();
    });
    this.placeButton = button('rr-btn', 'Place', () => this.handlers.confirm());
    tools.append(this.moveButton, this.placeButton, button('rr-btn rr-btn--gray', 'Shop', () => this.handlers.shop()), button('rr-btn rr-btn--red', 'Done', () => this.handlers.done()));
    this.strip = el('div', 'rr-build__strip');
    this.root.append(this.hint, tools, this.strip);
    container.appendChild(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  setOpen(open: boolean): void {
    this.root.hidden = !open;
    if (!open) {
      this.selected = 0;
      this.moving = false;
      this.movingId = 0;
    }
    this.draw(true);
  }

  setState(self: SelfState | null): void {
    this.self = self;
    if (this.selected && !(self?.inventory.some((s) => s.id === this.selected && s.count > 0) ?? false)) this.selected = 0;
    this.draw(false);
  }

  setHint(text: string): void {
    if (this.hint.textContent !== text) this.hint.textContent = text;
    this.hint.hidden = !text;
  }

  setTouch(touch: boolean): void {
    this.placeButton.hidden = !touch;
  }

  rotate(): void {
    this.rot = (this.rot + 1) & 3;
    this.handlers.changed();
  }

  /** The kind being placed: a fresh item, or the one being moved. */
  select(kind: number): void {
    this.selected = this.selected === kind ? 0 : kind;
    this.moving = false;
    this.movingId = 0;
    this.draw(true);
    this.handlers.changed();
  }

  private draw(force: boolean): void {
    const stacks = (this.self?.inventory ?? []).filter((s) => s.count > 0 && placeable(itemById(s.id)!));
    const signature = `${stacks.map((s) => `${s.id}:${s.count}`).join(',')}|${this.selected}|${this.moving}`;
    if (!force && signature === this.signature) return;
    this.signature = signature;
    this.moveButton.classList.toggle('rr-btn--blue', this.moving);
    if (stacks.length === 0) {
      this.strip.replaceChildren(el('div', 'rr-build__empty', 'No items to place. Buy furniture at the Shop, or use Move to rearrange.'));
      return;
    }
    this.strip.replaceChildren(
      ...stacks.map((stack) => {
        const def = itemById(stack.id)!;
        const slot = button(`rr-build__slot${stack.id === this.selected ? ' is-selected' : ''}`, '', () => this.select(stack.id));
        slot.title = def.name;
        slot.append(icon(this.icons.item(stack.id)), el('span', 'rr-build__count rr-outline-thin', `x${stack.count}`));
        return slot;
      }),
    );
  }

  dispose(): void {
    this.root.remove();
  }
}
