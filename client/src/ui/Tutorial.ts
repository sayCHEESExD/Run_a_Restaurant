import { button, el, icon } from './Modal.js';
import { injectStyles } from './styles.js';

/**
 * THE TUTORIAL'S VOICE: a big speech bubble over the guide chef who walks
 * beside the new owner (as in the reference: "Welcome! Interact to seat your
 * first customer!"), an arrow that points at the button to press, and the
 * SKIP TUTORIAL button. What to do, and where, comes from the game; this only
 * draws it.
 */
export class TutorialOverlay {
  private readonly root: HTMLDivElement;
  private readonly speech: HTMLDivElement;
  private readonly pointer: HTMLImageElement;
  private readonly skip: HTMLButtonElement;
  private text = '';

  constructor(container: HTMLElement, arrowArt: string, onSkip: () => void) {
    injectStyles();
    this.root = el('div', 'rr-tut');
    this.root.hidden = true;
    this.speech = el('div', 'rr-tut__speech rr-outline');
    this.pointer = icon(arrowArt, 'rr-tut__pointer');
    this.pointer.hidden = true;
    this.skip = button('rr-skip rr-outline', 'SKIP TUTORIAL', onSkip);
    this.root.append(this.speech, this.pointer);
    container.append(this.root, this.skip);
    this.skip.hidden = true;
  }

  setActive(active: boolean, building = false): void {
    this.root.hidden = !active;
    this.skip.hidden = !active || building;
  }

  /** The bubble's words, and where on screen the guide's head is (null: pinned near the top). */
  say(text: string, at: { x: number; y: number } | null): void {
    if (text !== this.text) {
      this.text = text;
      this.speech.textContent = text;
    }
    this.speech.hidden = !text;
    const x = at ? Math.max(180, Math.min(window.innerWidth - 180, at.x)) : window.innerWidth / 2;
    const y = at ? Math.max(140, at.y) : window.innerHeight * 0.3;
    this.speech.style.left = `${x}px`;
    this.speech.style.top = `${y}px`;
  }

  /** Point at a HUD button (its screen rect), or hide the pointer. */
  pointAt(rect: DOMRect | null, side: 'right' | 'above' = 'right'): void {
    this.pointer.hidden = !rect;
    if (!rect) return;
    if (side === 'right') {
      this.pointer.style.left = `${rect.right + 8}px`;
      this.pointer.style.top = `${rect.top + rect.height / 2 - this.pointer.offsetHeight / 2}px`;
      this.pointer.style.transform = 'scaleX(-1)';
    } else {
      this.pointer.style.left = `${rect.left + rect.width / 2 - this.pointer.offsetWidth / 2}px`;
      this.pointer.style.top = `${rect.top - this.pointer.offsetHeight - 6}px`;
      this.pointer.style.transform = 'rotate(90deg)';
    }
  }

  dispose(): void {
    this.root.remove();
    this.skip.remove();
  }
}
