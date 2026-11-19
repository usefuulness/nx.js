/**
 * @file @/layout/splitter.tsx
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { inlineStep, isRtl } from '@/core/dom-utils';
import { StateProvider } from '@/core/state';

/** Where sizes are remembered: under the key the app gave, with nothing added to it */
const layoutState = new StateProvider({ prefix: '' });

export interface SplitterConfig {
  /** `horizontal` puts panes side by side (default); `vertical` stacks them */
  orientation?: 'horizontal' | 'vertical';
  /** Remember the sizes in localStorage under this key */
  stateKey?: string;
}

const GENERATED = 'data-nx-generated';

/**
 * Resizable panes: put two or more elements inside, and a draggable divider appears between each pair.
 * A pane's starting share comes from its `size` attribute (any number: shares are relative) and its
 * smallest size, in pixels, from `min-size` (default 48).
 *
 * ```html
 * <nx-splitter style="height: 24rem">
 *   <nav size="25" min-size="160">Files</nav>
 *   <main size="75">Editor</main>
 * </nx-splitter>
 * ```
 *
 * Keyboard (each divider is a focusable `separator`): **←** **→** (or **↑** **↓** when vertical) move it
 * by 2%, **Shift** by 10%; **Home** and **End** collapse the pane before it to its minimum or grow it
 * to the most the next pane allows; **Enter** collapses it, or restores it if it is collapsed.
 *
 * Events: `resize` (detail: `{ sizes }`, each pane's percentage), fired when a drag or key press ends.
 */
export class NXSplitter extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['orientation', 'state-key'];
  }

  /** Relative size of each pane, in the order of the panes */
  private weights: number[] = [];
  private restore = new Map<number, number>();
  /** The sizes the markup asked for: what a collapsed pane returns to when nothing else is remembered */
  private initial: number[] = [];
  private observer: MutationObserver | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  private vertical(): boolean {
    return this.getProp<string>('orientation', 'horizontal') === 'vertical';
  }

  private panes(): HTMLElement[] {
    return Array.from(this.children).filter(el => !el.hasAttribute(GENERATED)) as HTMLElement[];
  }

  private gutters(): HTMLElement[] {
    return Array.from(this.children).filter(el => el.hasAttribute(GENERATED)) as HTMLElement[];
  }

  private minSize(pane: HTMLElement): number {
    const n = Number(pane.getAttribute('min-size'));
    return Number.isFinite(n) && pane.hasAttribute('min-size') ? n : 48;
  }

  /** Percentage sizes of the panes. */
  getSizes(): number[] {
    const total = this.weights.reduce((a, b) => a + b, 0) || 1;
    return this.weights.map(w => Math.round((w / total) * 1000) / 10);
  }

  /** Set the panes' relative sizes (any numbers; `[30, 70]`). */
  setSizes(sizes: number[]): void {
    const panes = this.panes();
    if (sizes.length !== panes.length || sizes.some(s => !(s >= 0))) return;
    this.weights = sizes.slice();
    this.apply();
  }

  // ────────── Setting up the panes and dividers ──────────

  protected afterConnect(): void {
    this.sync();
    // Panes may be added or removed later (and parsers add children after the element exists)
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => this.sync());
    this.observer.observe(this, { childList: true });
  }

  protected cleanup(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  protected onAttributeChange(): void {
    if (this.isConnected) this.sync();
  }

  /** Make exactly one divider between each pair of panes, keeping the ones the server already wrote. */
  private sync(): void {
    const panes = this.panes();
    const gutters = this.gutters();
    // Remove dividers that are no longer between two panes, then add the missing ones
    gutters.forEach(g => {
      const before = g.previousElementSibling;
      const after = g.nextElementSibling;
      if (!before || !after || before.hasAttribute(GENERATED) || after.hasAttribute(GENERATED)) g.remove();
    });
    panes.slice(1).forEach(pane => {
      const before = pane.previousElementSibling;
      if (before?.hasAttribute(GENERATED)) return;
      this.insertBefore(this.createGutter(), pane);
    });

    // Sizes: remembered, else each pane's `size`, else an equal share of what is left
    if (this.weights.length !== panes.length) {
      const saved = this.load();
      if (saved && saved.length === panes.length) this.weights = saved;
      else {
        const given = panes.map(p => Number(p.getAttribute('size')));
        const left = panes.filter((_, i) => !(given[i] > 0)).length;
        const used = given.reduce((a, b) => a + (b > 0 ? b : 0), 0);
        const share = left ? Math.max(0, 100 - used) / left : 0;
        this.weights = given.map(g => (g > 0 ? g : share || 1));
        this.initial = this.weights.slice();
      }
      if (!this.initial.length) this.initial = this.weights.slice();
    }
    this.apply();
  }

  private createGutter(): HTMLElement {
    const gutter = document.createElement('div');
    gutter.setAttribute(GENERATED, '');
    gutter.setAttribute('role', 'separator');
    gutter.setAttribute('tabindex', '0');
    gutter.className = 'nx-gutter';
    return gutter;
  }

  /** Write the sizes onto the panes and the dividers' ARIA values. */
  private apply(): void {
    const panes = this.panes();
    const vertical = this.vertical();
    this.setAttribute('data-orientation', vertical ? 'vertical' : 'horizontal');
    // Each pane is its share of what the dividers leave. (`flex: W 1 0` would split the space *after*
    // counting each pane's padding, so padding on a pane would skew the sizes.)
    const sum = this.weights.reduce((a, b) => a + b, 0) || 1;
    const dividers = Math.max(0, panes.length - 1);
    panes.forEach((pane, i) => {
      pane.style.flex = `0 0 calc((100% - ${dividers} * var(--nx-gutter, 0.5rem)) * ${(this.weights[i] ?? 1) / sum})`;
      pane.style.boxSizing = 'border-box';
      pane.style.minWidth = vertical ? '' : `${this.minSize(pane)}px`;
      pane.style.minHeight = vertical ? `${this.minSize(pane)}px` : '';
    });
    const sizes = this.getSizes();
    this.gutters().forEach((gutter, i) => {
      const before = panes[i];
      if (!before) return;
      gutter.setAttribute('aria-orientation', vertical ? 'horizontal' : 'vertical'); // the line runs across the panes
      gutter.setAttribute('aria-valuenow', String(Math.round(sizes[i])));
      gutter.setAttribute('aria-valuemin', String(Math.round(this.limits(i).min)));
      gutter.setAttribute('aria-valuemax', String(Math.round(this.limits(i).max)));
      if (!before.id) before.id = `nx-pane-${Math.random().toString(36).slice(2, 8)}`;
      gutter.setAttribute('aria-controls', before.id);
      gutter.setAttribute('aria-label', this.t('splitter.resize'));
    });
  }

  /** How small and how large (as a percentage) the pane before divider `i` can get, given both neighbours' minimums. */
  private limits(i: number): { min: number; max: number } {
    const panes = this.panes();
    const total = this.available() || 1;
    const pair = this.weights[i] + this.weights[i + 1];
    const sum = this.weights.reduce((a, b) => a + b, 0) || 1;
    const toWeight = (px: number) => (px / total) * sum;
    const minBefore = toWeight(this.minSize(panes[i]));
    const minAfter = toWeight(this.minSize(panes[i + 1]));
    const pct = (w: number) => (w / sum) * 100;
    return { min: pct(Math.min(minBefore, pair)), max: pct(Math.max(pair - minAfter, 0)) };
  }

  /** Pixels the panes share (the container minus its dividers). */
  private available(): number {
    const box = this.getBoundingClientRect();
    const length = this.vertical() ? box.height : box.width;
    const thickness = this.gutters().reduce((n, g) => n + (this.vertical() ? g.getBoundingClientRect().height : g.getBoundingClientRect().width), 0);
    return Math.max(0, length - thickness);
  }

  // ────────── Moving a divider ──────────

  /** Move divider `i` by `percent` of the panes' total, within both neighbours' limits. */
  private move(i: number, percent: number): void {
    const sum = this.weights.reduce((a, b) => a + b, 0) || 1;
    const pair = this.weights[i] + this.weights[i + 1];
    const { min, max } = this.limits(i);
    const current = (this.weights[i] / sum) * 100;
    const next = Math.min(max, Math.max(min, current + percent));
    this.weights[i] = (next / 100) * sum;
    this.weights[i + 1] = pair - this.weights[i];
    this.apply();
  }

  private finish(): void {
    this.save();
    this.emit('resize', { sizes: this.getSizes() });
  }

  private onKey(e: KeyboardEvent, i: number): void {
    const vertical = this.vertical();
    const step = e.shiftKey ? 10 : 2;
    let delta = 0;
    if (vertical) delta = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
    else delta = inlineStep(e.key, this) * step;
    if (!delta && e.key !== 'Home' && e.key !== 'End' && e.key !== 'Enter') return;
    e.preventDefault();

    const { min, max } = this.limits(i);
    const sum = this.weights.reduce((a, b) => a + b, 0) || 1;
    const current = (this.weights[i] / sum) * 100;
    if (e.key === 'Home') this.move(i, min - current);
    else if (e.key === 'End') this.move(i, max - current);
    else if (e.key === 'Enter') {
      // Collapse the pane before the divider, or bring it back
      if (current <= min + 0.5) {
        // Already collapsed: back to the remembered size, or the one the markup asked for
        const initialSum = this.initial.reduce((a, b) => a + b, 0) || 1;
        const target = this.restore.get(i) ?? ((this.initial[i] ?? this.weights[i]) / initialSum) * 100;
        this.move(i, target - current);
        this.restore.delete(i);
      } else {
        this.restore.set(i, current);
        this.move(i, min - current);
      }
    } else this.move(i, delta);
    this.finish();
  }

  private onPointerDown(e: PointerEvent, gutter: HTMLElement, i: number): void {
    if (e.button !== 0) return;
    const vertical = this.vertical();
    const direction = !vertical && isRtl(this) ? -1 : 1; // a right-to-left row grows toward the left
    const total = this.available() || 1;
    let last = vertical ? e.clientY : e.clientX;
    e.preventDefault();
    gutter.setPointerCapture?.(e.pointerId);
    gutter.setAttribute('data-dragging', '');
    const move = (ev: PointerEvent) => {
      const now = vertical ? ev.clientY : ev.clientX;
      this.move(i, (((now - last) * direction) / total) * 100); // pixels moved, as a percentage of the panes' space
      last = now;
    };
    const up = () => {
      gutter.removeAttribute('data-dragging');
      gutter.removeEventListener('pointermove', move);
      gutter.removeEventListener('pointerup', up);
      gutter.removeEventListener('pointercancel', up);
      this.finish();
    };
    gutter.addEventListener('pointermove', move);
    gutter.addEventListener('pointerup', up);
    gutter.addEventListener('pointercancel', up);
  }

  // The dividers live in the light DOM, so one set of listeners on the host serves them all
  protected afterRender(): void {
    this.on(this, 'keydown', (e: Event) => {
      const gutter = (e.target as HTMLElement).closest?.(`[${GENERATED}]`) as HTMLElement | null;
      if (gutter?.parentElement === this) this.onKey(e as KeyboardEvent, this.gutters().indexOf(gutter));
    });
    this.on(this, 'pointerdown', (e: Event) => {
      const gutter = (e.target as HTMLElement).closest?.(`[${GENERATED}]`) as HTMLElement | null;
      if (gutter?.parentElement === this) this.onPointerDown(e as PointerEvent, gutter, this.gutters().indexOf(gutter));
    });
    this.on(this, 'dblclick', (e: Event) => {
      const gutter = (e.target as HTMLElement).closest?.(`[${GENERATED}]`) as HTMLElement | null;
      // Double-click: back to the sizes the markup asked for
      if (gutter?.parentElement === this) {
        this.weights = [];
        this.initial = [];
        this.sync();
        this.finish();
      }
    });
  }

  // ────────── Remembering sizes ──────────

  private storageKey(): string | null {
    const key = this.getProp<string>('state-key');
    return key ? `nx-splitter:${key}` : null;
  }

  private load(): number[] | null {
    const key = this.storageKey();
    if (!key) return null;
    try {
      const saved = layoutState.get<unknown>(key, null);
      return Array.isArray(saved) && saved.every(n => typeof n === 'number' && n >= 0) ? saved : null;
    } catch {
      return null;
    }
  }

  private save(): void {
    const key = this.storageKey();
    if (!key) return;
    layoutState.set(key, this.weights); // never throws: if storage is blocked the splitter still works
  }

  protected render(): Node {
    return <slot />;
  }

  protected styles(): string {
    return `
      :host { display: flex; flex-direction: row; min-width: 0; min-height: 0; --nx-gutter: 0.5rem; }
      :host([data-orientation="vertical"]) { flex-direction: column; }

      ::slotted(:not([${GENERATED}])) { overflow: auto; min-width: 0; min-height: 0; }

      ::slotted([${GENERATED}]) {
        position: relative;
        flex: 0 0 auto;
        width: var(--nx-gutter);
        background: transparent;
        touch-action: none;
        cursor: col-resize;
        outline: none;
      }

      :host([data-orientation="vertical"]) ::slotted([${GENERATED}]) { width: auto; height: var(--nx-gutter); cursor: row-resize; }

      /* A thin line, thicker while hovered, focused or dragged */
      ::slotted([${GENERATED}])::after {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline-start: calc(50% - 0.5px);
        width: 1px;
        background: var(--color-border);
        transition: background-color var(--transition-duration), width var(--transition-duration);
      }

      :host([data-orientation="vertical"]) ::slotted([${GENERATED}])::after { inset-block: calc(50% - 0.5px) auto; inset-inline: 0; width: auto; height: 1px; }

      ::slotted([${GENERATED}]:hover)::after,
      ::slotted([${GENERATED}]:focus-visible)::after,
      ::slotted([${GENERATED}][data-dragging])::after { background: var(--color-ring); width: 3px; inset-inline-start: calc(50% - 1.5px); }

      :host([data-orientation="vertical"]) ::slotted([${GENERATED}]:hover)::after,
      :host([data-orientation="vertical"]) ::slotted([${GENERATED}]:focus-visible)::after,
      :host([data-orientation="vertical"]) ::slotted([${GENERATED}][data-dragging])::after { width: auto; height: 3px; inset-block: calc(50% - 1.5px) auto; inset-inline-start: 0; }
    `;
  }
}

define('nx-splitter', NXSplitter);
