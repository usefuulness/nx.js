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

/**
 * Tooltip: a short hint shown on hover and keyboard focus. Wrap the trigger:
 * `<nx-tooltip content="Save changes"><nx-button icon="save" aria-label="Save"></nx-button></nx-tooltip>`
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
  private timer = 0;
  private shown = false;

  protected initializeState(): void {}

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.addEventListener('pointerover', () => this.schedule());
    this.addEventListener('pointerout', (e) => {
      if (!this.contains(e.relatedTarget as Node | null)) this.hide();
    });
    this.addEventListener('focusin', () => {
      if (this.focusVisible()) this.schedule(0);
    });
    this.addEventListener('focusout', () => this.hide());
    this.addEventListener('pointerdown', () => this.hide());
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

  private focusVisible(): boolean {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return !!active?.matches(':focus-visible');
  }

  private schedule(delay?: number): void {
    if (this.shown || this.getProp('disabled', false)) return;
    clearTimeout(this.timer);
    const wait = delay ?? (Date.now() - lastHidden < 300 ? 0 : Number(this.getProp('delay', 400)));
    this.timer = window.setTimeout(() => this.show(), wait);
  }

  private surface(): HTMLElement | null {
    return this.$('.bubble') as HTMLElement | null;
  }

  /** Show now. */
  show(): void {
    const trigger = this.trigger;
    const surface = this.surface();
    if (!this.bubble || !surface || !trigger || (!this.bubble.textContent?.trim() && !this.bubble.children.length)) return;
    showTopLayer(surface);
    place(surface, trigger, this.getProp<Placement>('placement', 'top'), 6);
    this.shown = true;
    document.addEventListener('keydown', this.onKey, true);
    window.addEventListener('scroll', this.onScroll, true);
  }

  /** Hide now. */
  hide(): void {
    clearTimeout(this.timer);
    if (!this.shown) return;
    this.shown = false;
    lastHidden = Date.now();
    const surface = this.surface();
    if (surface) hideTopLayer(surface);
    document.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('scroll', this.onScroll, true);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.hide();
  };

  private onScroll = (): void => this.hide();

  protected render(): Node {
    return (
      <>
        <slot />
        <div class="bubble" part="tooltip" popover="manual"><slot name="tooltip" /></div>
      </>
    );
  }

  protected styles(): string {
    return `
      :host { display: contents; }

      .bubble {
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
        line-height: 1.4;
        pointer-events: none;
        overflow: visible;
      }

      .bubble:popover-open {
        animation: nx-tooltip-in 120ms var(--transition-easing);
      }

      @keyframes nx-tooltip-in {
        from { opacity: 0; transform: scale(0.96); }
      }
    `;
  }
}

define('nx-tooltip', NXTooltip);
