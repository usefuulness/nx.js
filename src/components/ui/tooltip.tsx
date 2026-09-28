/**
 * @file @/components/ui/tooltip.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { hideTopLayer, place, showTopLayer, type Placement } from '@/core/position';

export interface TooltipConfig {
  /** Tooltip text (or put rich content in a `slot="tooltip"` child) */
  content?: string;
  placement?: Placement;
  /** Hover delay in ms (default 400). Moving between tooltips skips it. */
  delay?: number;
  disabled?: boolean;
}

let tooltipSeq = 0;
/** When the last tooltip closed — moving straight to the next one shows it at once. */
let lastHidden = 0;

/** The bubble's look, shared by `<nx-tooltip>` and `<nx-button tooltip="…">`. */
export const TOOLTIP_CSS = `
  .nx-tip {
    position: fixed;
    inset: auto;
    margin: 0;
    max-width: min(20rem, calc(100vw - 1rem));
    padding: 0.375rem 0.625rem;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--color-primary);
    color: var(--color-primary-foreground);
    box-shadow: var(--shadow-md);
    font-size: 0.75rem;
    font-weight: 400;
    line-height: 1.4;
    white-space: normal;
    pointer-events: none;
    overflow: visible;
  }

  .nx-tip:popover-open {
    animation: nx-tooltip-in 120ms var(--transition-easing);
  }

  @keyframes nx-tooltip-in {
    from { opacity: 0; transform: scale(0.96); }
  }
`;

export interface TooltipTarget {
  /** Element the bubble is placed against */
  anchor(): HTMLElement | null;
  /** The bubble (in a shadow root, shown in the top layer) */
  surface(): HTMLElement | null;
  placement(): Placement;
  delay(): number;
  enabled(): boolean;
}

/**
 * Tooltip behaviour: shows on hover (after a delay, skipped when moving between
 * tooltips) and on keyboard focus; hides on leave, blur, press, scroll and Escape.
 */
export class TooltipController {
  private timer = 0;
  private shown = false;
  private readonly target: TooltipTarget;

  constructor(host: HTMLElement, target: TooltipTarget) {
    this.target = target;
    host.addEventListener('pointerover', () => this.schedule());
    host.addEventListener('pointerout', (e) => {
      if (!host.contains(e.relatedTarget as Node | null)) this.hide();
    });
    host.addEventListener('focusin', () => {
      if (focusVisible()) this.schedule(0);
    });
    host.addEventListener('focusout', () => this.hide());
    host.addEventListener('pointerdown', () => this.hide());
  }

  private schedule(delay?: number): void {
    if (this.shown || !this.target.enabled()) return;
    clearTimeout(this.timer);
    const wait = delay ?? (Date.now() - lastHidden < 300 ? 0 : this.target.delay());
    this.timer = window.setTimeout(() => this.show(), wait);
  }

  show(): void {
    const anchor = this.target.anchor();
    const surface = this.target.surface();
    if (!anchor || !surface || !this.target.enabled()) return;
    showTopLayer(surface);
    place(surface, anchor, this.target.placement(), 6);
    this.shown = true;
    document.addEventListener('keydown', this.onKey, true);
    window.addEventListener('scroll', this.hideNow, true);
  }

  hide(): void {
    clearTimeout(this.timer);
    if (!this.shown) return;
    this.shown = false;
    lastHidden = Date.now();
    const surface = this.target.surface();
    if (surface) hideTopLayer(surface);
    document.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('scroll', this.hideNow, true);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.hide();
  };

  private hideNow = (): void => this.hide();
}

function focusVisible(): boolean {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return !!active?.matches(':focus-visible');
}

/**
 * Tooltip: a short hint shown on hover and keyboard focus. Wrap the trigger:
 * `<nx-tooltip content="Save changes"><nx-button icon="save" aria-label="Save"></nx-button></nx-tooltip>`
 * (buttons also take `tooltip="…"` directly).
 *
 * The hint is linked to the trigger with `aria-describedby`, dismisses with
 * Escape, and renders in the top layer, so it is never clipped. (The text is a
 * light-DOM child, so ids resolve; it is drawn inside the shadow root, so page
 * CSS resets can't restyle it.)
 */
export class NXTooltip extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['content', 'placement', 'delay', 'disabled'];
  }

  private bubble: HTMLElement | null = null;
  private ownBubble = false;
  private controller: TooltipController;

  protected initializeState(): void {}

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.controller = new TooltipController(this, {
      anchor: () => this.trigger,
      surface: () => this.$('.nx-tip') as HTMLElement | null,
      placement: () => this.getProp<Placement>('placement', 'top'),
      delay: () => Number(this.getProp('delay', 400)),
      enabled: () => !this.getProp('disabled', false) && !!this.bubble && (!!this.bubble.textContent?.trim() || !!this.bubble.children.length)
    });
  }

  /** The element that shows the tooltip (the first child that isn't the bubble). */
  get trigger(): HTMLElement | null {
    return (Array.from(this.children).find(el => el.slot !== 'tooltip' && el.localName !== 'script') as HTMLElement) ?? null;
  }

  protected afterConnect(): void {
    this.ensureBubble();
  }

  protected beforeDisconnect(): void {
    this.hide();
  }

  protected onAttributeChange(name: string): void {
    if (name === 'content') this.ensureBubble();
  }

  /** Reuse a server-rendered or authored bubble, or create one. */
  private ensureBubble(): void {
    let bubble = this.querySelector(':scope > [slot="tooltip"]') as HTMLElement | null;
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.slot = 'tooltip';
      bubble.setAttribute('data-nx-generated', '');
      this.ownBubble = true;
      this.appendChild(bubble);
    }
    bubble.id ||= `nx-tooltip-${++tooltipSeq}`;
    bubble.setAttribute('role', 'tooltip');
    const content = this.getProp<string>('content');
    if (this.ownBubble || (content && !bubble.children.length)) bubble.textContent = content ?? '';
    this.bubble = bubble;

    const trigger = this.trigger;
    if (trigger) {
      const ids = new Set((trigger.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
      ids.add(bubble.id);
      trigger.setAttribute('aria-describedby', Array.from(ids).join(' '));
    }
  }

  /** Show now. */
  show(): void {
    this.controller.show();
  }

  /** Hide now. */
  hide(): void {
    this.controller.hide();
  }

  protected render(): Node {
    return (
      <>
        <slot />
        <div class="nx-tip" part="tooltip" popover="manual"><slot name="tooltip" /></div>
      </>
    );
  }

  protected styles(): string {
    return `
      :host { display: contents; }
      ${TOOLTIP_CSS}
    `;
  }
}

define('nx-tooltip', NXTooltip);
