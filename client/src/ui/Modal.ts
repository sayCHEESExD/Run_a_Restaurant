import { fitToViewport, installUiScale, onUiResize } from './scaleUi.js';
import { injectStyles } from './styles.js';

const open = new Set<Modal>();

/** True while any window owns the screen: movement and world clicks pause. */
export const anyModalOpen = (): boolean => open.size > 0;

/** Close the most recently opened window (Escape). True if one closed. */
export const closeTopModal = (): boolean => {
  const last = [...open].pop();
  if (!last) return false;
  last.close();
  return true;
};

/** Close every window (a teleport, the tutorial moving on). */
export const closeAllModals = (): void => {
  for (const modal of [...open]) modal.close();
};

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
};

/** A button that does not let its click fall through to the world. */
export const button = (className: string, label: string, onClick: () => void): HTMLButtonElement => {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return b;
};

/** An <img> of an icon data URL. */
export const icon = (src: string, className = 'rr-icon'): HTMLImageElement => {
  const img = el('img', className);
  img.alt = '';
  img.draggable = false;
  if (src.startsWith('pending:')) img.dataset['icon'] = src.slice('pending:'.length);
  else if (src) img.src = src;
  return img;
};

/**
 * A WINDOW over the game: a faint shade that swallows clicks, and a box the
 * subclass dresses. Clicking the shade outside the box closes it.
 */
export class Modal {
  readonly shade: HTMLDivElement;
  onClose: (() => void) | null = null;
  private readonly stopResize: () => void;

  constructor(container: HTMLElement, closeOnShade = true) {
    injectStyles();
    installUiScale();
    this.shade = el('div', 'rr-shade rr-font');
    this.shade.hidden = true;
    if (closeOnShade) {
      this.shade.addEventListener('pointerdown', (event) => {
        if (event.target === this.shade) this.close();
      });
    }
    container.appendChild(this.shade);
    const draw = this.refresh.bind(this);
    this.refresh = (): void => {
      draw();
      this.fit();
    };
    this.stopResize = onUiResize(() => this.fit());
  }

  /** Shrink the panel to fit a small window. */
  fit(): void {
    if (!this.isOpen) return;
    const panel = this.shade.firstElementChild as HTMLElement | null;
    if (panel) fitToViewport(panel);
  }

  get isOpen(): boolean {
    return !this.shade.hidden;
  }

  open(): void {
    if (this.isOpen) {
      this.refresh();
      return;
    }
    this.shade.hidden = false;
    open.add(this);
    this.refresh();
  }

  close(): void {
    if (!this.isOpen) return;
    this.shade.hidden = true;
    open.delete(this);
    this.onClose?.();
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Redraw from current state. Called on open; subclasses call it on change. */
  refresh(): void {}

  dispose(): void {
    this.stopResize();
    open.delete(this);
    this.shade.remove();
  }
}

export interface Tab {
  readonly id: string;
  readonly label: string;
  readonly art: string;
}

/**
 * THE GAME'S WINDOW, as the reference draws it: a blue patterned header with
 * the title and a red square X, a cream body, and (optionally) a white pill of
 * round tab buttons down its left side.
 */
export class GameWindow extends Modal {
  protected readonly window: HTMLDivElement;
  protected readonly body: HTMLDivElement;
  protected readonly titleNode: HTMLSpanElement;
  protected tab = '';
  private readonly tabButtons = new Map<string, HTMLButtonElement>();

  constructor(container: HTMLElement, title: string, size: 'large' | 'medium' | 'small' = 'large', tabs: readonly Tab[] = []) {
    super(container);
    const wrap = el('div', 'rr-wrap');
    if (tabs.length > 0) {
      const rail = el('div', 'rr-siderail');
      for (const tab of tabs) {
        const b = button('rr-rail__btn', '', () => this.select(tab.id));
        b.appendChild(icon(tab.art, 'rr-rail__art'));
        b.appendChild(el('span', 'rr-rail__label rr-outline-thin', tab.label));
        rail.appendChild(b);
        this.tabButtons.set(tab.id, b);
      }
      wrap.appendChild(rail);
      this.tab = tabs[0]!.id;
    }
    this.window = el('div', `rr-window ${size === 'large' ? '' : `rr-window--${size}`}`);
    const head = el('div', 'rr-window__head');
    this.titleNode = el('span', 'rr-window__title', title);
    head.append(this.titleNode, button('rr-x', 'X', () => this.close()));
    this.body = el('div', 'rr-window__body');
    this.window.append(head, this.body);
    wrap.appendChild(this.window);
    this.shade.appendChild(wrap);
    this.markTab();
  }

  setTitle(title: string): void {
    this.titleNode.textContent = title;
  }

  select(id: string): void {
    this.tab = id;
    this.markTab();
    this.refresh();
  }

  /** Open straight onto a tab. */
  openTab(id: string): void {
    this.tab = id;
    this.markTab();
    this.open();
  }

  private markTab(): void {
    for (const [id, b] of this.tabButtons) b.classList.toggle('is-active', id === this.tab);
  }
}
