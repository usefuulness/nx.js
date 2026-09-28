import { BaseComponent, ComponentState } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';

export interface ViewportConfig {
  /** `border` (default, also accepts `viewport`) | `card` | `fit` */
  layout?: 'border' | 'viewport' | 'card' | 'fit';
  /** Width in px below which side regions turn into drawers (default 768) */
  breakpoint?: number;
}

/**
 * Full-page app shell. Children go into regions with `region="north|south|east|west|center"`;
 * side regions collapse into a drawer on small screens.
 */
export class NXViewport extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['layout', 'breakpoint'];
  }

  protected initializeState(): void {
    this[ComponentState].set('regions', new Map());
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected render(): Node {
    let layout = this.getProp<string>('layout', 'border');
    if (!['border', 'card', 'fit'].includes(layout)) layout = 'border';

    return (
      <div class={['nx-viewport', `nx-viewport-${layout}`]} part="container">
        {layout === 'border' && this.renderBorderLayout()}
        {layout === 'card' && <div class="nx-card-container"><slot /></div>}
        {layout === 'fit' && <div class="nx-fit-container"><slot /></div>}
      </div>
    );
  }

  private renderBorderLayout(): Node {
    // Picking something in an off-canvas nav closes it
    const closeOnSelect = () => this.closeRegions();
    return (
      <>
        <div class="nx-region-backdrop" part="backdrop" onClick={() => this.closeRegions()} />
        <div class="nx-region-north" part="north"><slot name="north" /></div>
        <div class="nx-region-center-container">
          <div class="nx-region-west" part="west" onSelect={closeOnSelect}><slot name="west" /></div>
          <div class="nx-region-center" part="center"><slot name="center" /><slot /></div>
          <div class="nx-region-east" part="east" onSelect={closeOnSelect}><slot name="east" /></div>
        </div>
        <div class="nx-region-south" part="south"><slot name="south" /></div>
      </>
    );
  }

  protected styles(): string {
    return `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: var(--color-background);
        color: var(--color-text);
      }

      .nx-viewport {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      /* Border Layout */
      .nx-viewport-border {
        overflow: hidden;
      }

      .nx-region-north,
      .nx-region-south {
        flex-shrink: 0;
      }

      .nx-region-center-container {
        flex: 1;
        display: flex;
        min-height: 0;
        overflow: hidden;
      }

      .nx-region-west,
      .nx-region-east {
        flex-shrink: 0;
        display: flex;
        min-height: 0;
      }

      .nx-region-west ::slotted(*),
      .nx-region-east ::slotted(*) {
        height: 100%;
      }

      .nx-region-center {
        flex: 1;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: auto;
      }

      .nx-region-center ::slotted(*) {
        flex: 1;
        min-height: 0;
      }

      /* Narrow screens: side regions become off-canvas drawers (see toggleRegion) */
      .nx-region-backdrop { display: none; }

      @media (max-width: ${this.getProp('breakpoint', 768)}px) {
        .nx-region-west,
        .nx-region-east {
          position: fixed;
          top: 0;
          bottom: 0;
          z-index: 60;
          max-width: 85vw;
          background: var(--color-surface);
          box-shadow: var(--shadow-xl);
          visibility: hidden;
          transition: transform 250ms var(--transition-easing), visibility 0s linear 250ms;
        }

        .nx-region-west { left: 0; transform: translateX(-100%); }
        .nx-region-east { right: 0; transform: translateX(100%); }

        .nx-region-west.open,
        .nx-region-east.open {
          transform: none;
          visibility: visible;
          transition: transform 250ms var(--transition-easing), visibility 0s;
        }

        .nx-region-backdrop {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 59;
          background: var(--backdrop-bg);
          opacity: 0;
          pointer-events: none;
          transition: opacity 250ms var(--transition-easing);
        }

        .nx-region-backdrop.open {
          opacity: 1;
          pointer-events: auto;
        }
      }

      /* Card Layout */
      .nx-card-container {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 1rem;
        overflow: auto;
      }

      /* Fit Layout */
      .nx-fit-container {
        width: 100%;
        height: 100%;
        position: relative;
      }

      .nx-fit-container ::slotted(*) {
        position: absolute;
        inset: 0;
      }
    `;
  }

  protected afterRender(): void {
    // Set up region management
    this.setupRegions();

    this.on(document, 'keydown', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Escape') this.closeRegions();
    });
  }

  /** True when side regions are rendered as off-canvas drawers. */
  isNarrow(): boolean {
    return window.matchMedia(`(max-width: ${this.getProp('breakpoint', 768)}px)`).matches;
  }

  /**
   * Show/hide a side region. On narrow screens it slides in as a drawer;
   * on wide screens a collapsible panel in that region is toggled instead.
   */
  toggleRegion(region: 'west' | 'east' = 'west', force?: boolean): void {
    if (!this.isNarrow()) {
      const panel = this.getRegion(region)[0] as (Element & { toggle?: () => void }) | undefined;
      panel?.toggle?.();
      return;
    }
    const el = this.$(`.nx-region-${region}`);
    const open = force ?? !el?.classList.contains('open');
    this.closeRegions();
    if (open) {
      el?.classList.add('open');
      this.$('.nx-region-backdrop')?.classList.add('open');
    }
  }

  closeRegions(): void {
    this.$$('.open').forEach(el => el.classList.remove('open'));
  }

  private setupRegions(): void {
    const slots = this.shadowRoot?.querySelectorAll('slot') || [];
    
    slots.forEach(slot => {
      const name = slot.getAttribute('name') || 'default';
      const assignedElements = (slot as HTMLSlotElement).assignedElements?.() || [];
      
      assignedElements.forEach((el: Element) => {
        if (el.hasAttribute('region')) {
          const region = el.getAttribute('region');
          if (region && region !== name) {
            el.setAttribute('slot', region);
          }
        }
      });
    });
  }

  addRegion(region: string, element: HTMLElement): void {
    element.setAttribute('slot', region);
    this.appendChild(element);
  }

  removeRegion(region: string): void {
    const slot = this.shadowRoot?.querySelector(`slot[name="${region}"]`) as HTMLSlotElement;
    const assignedElements = slot?.assignedElements?.() || [];
    
    assignedElements.forEach((el: Element) => {
      el.remove();
    });
  }

  getRegion(region: string): Element[] {
    const slot = this.shadowRoot?.querySelector(`slot[name="${region}"]`) as HTMLSlotElement;
    return slot?.assignedElements?.() || [];
  }
}

/** A region of `<nx-viewport>` with its own title, size and collapse state. */
export class NXRegion extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['region', 'title', 'collapsible', 'collapsed', 'split', 'size'];
  }

  protected initializeState(): void {
    this[ComponentState].set('collapsed', false);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected render(): Node {
    const title = this.getProp<string>('title');
    const collapsed = this.getState('collapsed', false);

    return (
      <div class={['nx-region', { collapsed }]} part="container">
        {title && (
          <div class="nx-region-header" part="header">
            <h3 class="nx-region-title" part="title">{title}</h3>
            {this.getProp('collapsible', false) && (
              <button class="nx-region-toggle" part="toggle" aria-label="Toggle region" aria-expanded={String(!collapsed)}
                      html={Icons.get('chevron-down')} onClick={() => this.toggle()} />
            )}
          </div>
        )}
        <div class="nx-region-body" part="body"><slot /></div>
      </div>
    );
  }

  protected styles(): string {
    return `
      :host { display: block; width: 100%; height: 100%; }

      .nx-region {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        background: var(--color-surface);
        color: var(--color-text);
      }

      .nx-region-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 3rem;
        padding: 0 0.5rem 0 1rem;
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .nx-region-title { flex: 1; margin: 0; font-size: 0.875rem; font-weight: 600; }

      .nx-region-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: transform var(--transition-duration) var(--transition-easing);
      }

      .nx-region-toggle:hover { background: var(--color-accent); color: var(--color-text); }
      .collapsed .nx-region-toggle { transform: rotate(-90deg); }

      .nx-region-body { flex: 1; min-height: 0; overflow: auto; }
      .collapsed .nx-region-body { display: none; }
    `;
  }

  toggle(): void {
    const collapsed = !this.getState('collapsed', false);
    this.setState('collapsed', collapsed);
    this.emit('toggle', { collapsed });
  }

  collapse(): void {
    this.setState('collapsed', true);
    this.emit('collapse');
  }

  expand(): void {
    this.setState('collapsed', false);
    this.emit('expand');
  }
}

define('nx-viewport', NXViewport);
define('nx-region', NXRegion);
