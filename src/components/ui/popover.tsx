/**
 * @file @/components/ui/popover.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { place, type Placement } from '@/core/position';

export interface PopoverConfig {
  placement?: Placement;
  /** Accessible name of the panel (defaults to the trigger's text) */
  label?: string;
  /** Panel width, e.g. `320` or `'20rem'` (default 18rem) */
  width?: number | string;
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), nx-button, nx-input, nx-textfield, nx-select, nx-checkbox, nx-switch, nx-combobox';

/**
 * Popover: a panel of rich content anchored to a trigger. Click the trigger to
 * toggle; Escape, clicking outside or opening another popover closes it.
 *
 * ```html
 * <nx-popover>
 *   <nx-button slot="trigger" variant="outline">Dimensions</nx-button>
 *   <nx-input label="Width" value="100%"></nx-input>
 * </nx-popover>
 * ```
 *
 * Events: `open`, `close`.
 */
export class NXPopover extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['placement', 'label', 'width'];
  }

  private isOpen = false;
  /** Open state when the pointer went down on the trigger (light dismiss runs before click). */
  private openAtPointerDown: boolean | null = null;

  protected initializeState(): void {}

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  get opened(): boolean {
    return this.isOpen;
  }

  /** The slotted trigger element. */
  get trigger(): HTMLElement | null {
    return this.querySelector(':scope > [slot="trigger"]') as HTMLElement | null;
  }

  private panel(): HTMLElement | null {
    return this.$('.content') as HTMLElement | null;
  }

  open(): void {
    const panel = this.panel();
    if (!panel || this.isOpen) return;
    try {
      (panel as any).showPopover();
    } catch {
      return;
    }
    this.isOpen = true;
    this.position();
    this.trigger?.setAttribute('aria-expanded', 'true');
    window.addEventListener('resize', this.onViewportChange);
    window.addEventListener('scroll', this.onViewportChange, true);

    // Focus the first control inside, else the panel itself
    const first = Array.from(this.children)
      .filter(el => el.slot !== 'trigger')
      .flatMap(el => [el, ...Array.from(el.querySelectorAll(FOCUSABLE))])
      .find(el => el.matches(FOCUSABLE)) as HTMLElement | undefined;
    (first ?? panel).focus({ preventScroll: true });
    this.emit('open');
  }

  close(): void {
    if (!this.isOpen) return;
    try {
      (this.panel() as any)?.hidePopover();
    } catch {
      // already closed: the toggle handler below did the rest
    }
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** The panel closed (our close(), Escape, or a click outside). */
  private onClosed(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.trigger?.setAttribute('aria-expanded', 'false');
    window.removeEventListener('resize', this.onViewportChange);
    window.removeEventListener('scroll', this.onViewportChange, true);
    // Return focus to the trigger if it was inside the panel (or dropped to <body>)
    const active = document.activeElement;
    if (!active || active === document.body || this.contains(active)) this.trigger?.focus({ preventScroll: true });
    this.emit('close');
  }

  private onViewportChange = (): void => this.position();

  private position(): void {
    const panel = this.panel();
    const trigger = this.trigger ?? this;
    if (panel && this.isOpen) place(panel, trigger, this.getProp<Placement>('placement', 'bottom-start'), 6);
  }

  protected afterConnect(): void {
    const trigger = this.trigger;
    trigger?.setAttribute('aria-haspopup', 'dialog');
    trigger?.setAttribute('aria-expanded', String(this.isOpen));
  }

  protected beforeDisconnect(): void {
    this.close();
  }

  protected render(): Node {
    const width = this.getProp<number | string>('width');
    const label = this.getProp<string>('label') || this.trigger?.textContent?.trim() || undefined;
    return (
      <>
        <span part="trigger" class="trigger"
              onPointerDown={() => (this.openAtPointerDown = this.isOpen)}
              onClick={() => {
                const wasOpen = this.openAtPointerDown ?? this.isOpen;
                this.openAtPointerDown = null;
                if (wasOpen) this.close();
                else this.open();
              }}>
          <slot name="trigger" />
        </span>
        <div part="content" class="content" popover="auto" role="dialog" aria-label={label} tabindex={-1}
             style={width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : undefined}
             onToggle={(e: Event) => {
               if ((e as ToggleEvent).newState === 'closed') this.onClosed();
             }}>
          <slot />
        </div>
      </>
    );
  }

  protected styles(): string {
    return `
      :host { display: inline-block; }

      .trigger { display: contents; }

      .content {
        position: fixed;
        inset: auto;
        margin: 0;
        width: 18rem;
        max-width: calc(100vw - 1rem);
        padding: 1rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        box-shadow: var(--shadow-lg);
        font-size: 0.875rem;
      }

      .content:focus { outline: none; }

      .content:popover-open {
        animation: nx-popover-in 140ms var(--transition-easing);
      }

      @keyframes nx-popover-in {
        from { opacity: 0; transform: translateY(-4px) scale(0.98); }
      }
    `;
  }
}

define('nx-popover', NXPopover);
