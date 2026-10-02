import { Vector3, type PerspectiveCamera } from 'three';
import { el } from './Modal.js';
import { injectStyles } from './styles.js';

export interface PromptSpec {
  readonly object: string;
  readonly action: string;
  readonly activate: () => void;
}

const V = new Vector3();
const KEYS = ['E', 'F'] as const;

/**
 * INTERFACE IN THE WORLD, drawn as HTML over the canvas: the proximity
 * prompts ("[E] Take Order", "[F] Grab Food"), the order bubbles over
 * customers, the progress cards over stoves and sinks, "Collect: $100" over
 * the register, and the little "+$30" pops. Nodes are pooled per id and only
 * moved each frame; a node's contents are rebuilt only when they change.
 */
export class WorldOverlay {
  private readonly root: HTMLDivElement;
  private readonly cards = new Map<string, { node: HTMLDivElement; signature: string; used: boolean }>();
  private readonly promptBox: HTMLDivElement;
  private readonly prompts: { node: HTMLDivElement; key: HTMLSpanElement; object: HTMLSpanElement; action: HTMLSpanElement; activate: (() => void) | null }[] = [];
  private promptCount = 0;
  private camera: PerspectiveCamera | null = null;
  private width = 1;
  private height = 1;

  constructor(container: HTMLElement) {
    injectStyles();
    this.root = el('div', 'rr-world rr-font');
    container.appendChild(this.root);
    this.promptBox = el('div', 'rr-prompts');
    this.promptBox.hidden = true;
    for (let i = 0; i < 2; i += 1) {
      const node = el('div', 'rr-prompt');
      const keyBox = el('span', 'rr-prompt__key');
      const key = el('span', '', KEYS[i]);
      keyBox.appendChild(key);
      const text = el('span', '');
      const action = el('span', '', '');
      const object = el('span', 'rr-prompt__object', '');
      text.append(action, object);
      node.append(keyBox, text);
      const slot = { node, key, object, action, activate: null as (() => void) | null };
      node.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        event.preventDefault();
        slot.activate?.();
      });
      this.prompts.push(slot);
      this.promptBox.appendChild(node);
    }
    this.root.appendChild(this.promptBox);
  }

  begin(camera: PerspectiveCamera, width: number, height: number): void {
    this.camera = camera;
    this.width = width;
    this.height = height;
    for (const card of this.cards.values()) card.used = false;
    this.promptCount = 0;
  }

  /** Screen position of a world point, or null when it is behind the camera or well off screen. */
  project(x: number, y: number, z: number): { x: number; y: number; depth: number } | null {
    const camera = this.camera;
    if (!camera) return null;
    V.set(x, y, z).project(camera);
    if (V.z > 1 || V.z < -1) return null;
    const sx = (V.x * 0.5 + 0.5) * this.width;
    const sy = (-V.y * 0.5 + 0.5) * this.height;
    if (sx < -120 || sy < -120 || sx > this.width + 120 || sy > this.height + 120) return null;
    return { x: sx, y: sy, depth: V.z };
  }

  /** The prompts this frame (the nearest thing to do, and one more at the same spot). */
  setPrompts(specs: readonly PromptSpec[], x: number, y: number, z: number, touch: boolean): void {
    const at = this.project(x, y, z);
    if (!at || specs.length === 0) return;
    this.promptCount = Math.min(2, specs.length);
    this.prompts.forEach((slot, i) => {
      const spec = specs[i];
      slot.node.hidden = !spec;
      slot.activate = spec ? spec.activate : null;
      if (!spec) return;
      const key = touch ? '☝' : KEYS[i]!;
      if (slot.key.textContent !== key) slot.key.textContent = key;
      if (slot.action.textContent !== spec.action) slot.action.textContent = spec.action;
      if (slot.object.textContent !== spec.object) slot.object.textContent = spec.object;
    });
    this.promptBox.hidden = false;
    this.promptBox.style.left = `${at.x}px`;
    this.promptBox.style.top = `${at.y}px`;
  }

  /** Press a prompt (E is 0, F is 1). True if there was one. */
  activate(index: number): boolean {
    if (index >= this.promptCount) return false;
    const slot = this.prompts[index];
    if (!slot?.activate) return false;
    slot.activate();
    return true;
  }

  get hasPrompt(): boolean {
    return this.promptCount > 0;
  }

  /** A card over a world point, rebuilt only when its signature changes. */
  card(id: string, x: number, y: number, z: number, signature: string, build: () => HTMLElement): void {
    const at = this.project(x, y, z);
    if (!at) return;
    let card = this.cards.get(id);
    if (!card) {
      card = { node: el('div', 'rr-label'), signature: '', used: true };
      this.root.appendChild(card.node);
      this.cards.set(id, card);
    }
    card.used = true;
    if (card.signature !== signature) {
      card.signature = signature;
      card.node.replaceChildren(build());
    }
    card.node.hidden = false;
    card.node.style.left = `${at.x}px`;
    card.node.style.top = `${at.y}px`;
    card.node.style.zIndex = String(Math.round((1 - at.depth) * 1000));
  }

  /** A little rising "+$30" at a world point (or at a screen point). */
  pop(text: string, color: string, world: { x: number; y: number; z: number } | null, screen?: { x: number; y: number }): void {
    const at = world ? this.project(world.x, world.y, world.z) : screen ?? null;
    if (!at) return;
    const node = el('div', 'rr-popup rr-outline', text);
    node.style.color = color;
    node.style.left = `${at.x}px`;
    node.style.top = `${at.y}px`;
    this.root.appendChild(node);
    window.setTimeout(() => node.remove(), 1250);
  }

  end(): void {
    for (const [id, card] of this.cards) {
      if (card.used) continue;
      card.node.remove();
      this.cards.delete(id);
    }
    if (this.promptCount === 0) {
      this.promptBox.hidden = true;
      for (const slot of this.prompts) slot.activate = null;
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
