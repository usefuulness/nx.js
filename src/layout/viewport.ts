import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface ViewportConfig {
  layout?: 'border' | 'card' | 'fit';
}

export class NXViewport extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['layout'];
  }

  protected initializeState(): void {
    this[ComponentState].set('regions', new Map());
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected render(): string {
    const layout = this.getProp<string>('layout', 'border');

    return `
      <div class="nx-viewport nx-viewport-${layout}" part="container">
        ${layout === 'border' ? this.renderBorderLayout() : ''}
        ${layout === 'card' ? this.renderCardLayout() : ''}
        ${layout === 'fit' ? this.renderFitLayout() : ''}
      </div>
    `;
  }

  private renderBorderLayout(): string {
    return `
      <div class="nx-region-north" part="north">
        <slot name="north"></slot>
      </div>
      <div class="nx-region-center-container">
        <div class="nx-region-west" part="west">
          <slot name="west"></slot>
        </div>
        <div class="nx-region-center" part="center">
          <slot name="center"></slot>
          <slot></slot>
        </div>
        <div class="nx-region-east" part="east">
          <slot name="east"></slot>
        </div>
      </div>
      <div class="nx-region-south" part="south">
        <slot name="south"></slot>
      </div>
    `;
  }

  private renderCardLayout(): string {
    return `
      <div class="nx-card-container">
        <slot></slot>
      </div>
    `;
  }

  private renderFitLayout(): string {
    return `
      <div class="nx-fit-container">
        <slot></slot>
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        display: block;
        width: 100%;
        height: 100%;
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

      .nx-region-north:not(:empty),
      .nx-region-south:not(:empty) {
        flex-shrink: 0;
      }

      .nx-region-center-container {
        flex: 1;
        display: flex;
        overflow: hidden;
      }

      .nx-region-west:not(:empty),
      .nx-region-east:not(:empty) {
        flex-shrink: 0;
      }

      .nx-region-center {
        flex: 1;
        overflow: auto;
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

      .nx-fit-container > ::slotted(*) {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }

      /* Handle slotted panels */
      ::slotted([slot="north"]),
      ::slotted([slot="south"]) {
        width: 100%;
      }

      ::slotted([slot="west"]),
      ::slotted([slot="east"]) {
        height: 100%;
      }

      ::slotted([slot="center"]) {
        width: 100%;
        height: 100%;
      }
    `;
  }

  protected afterRender(): void {
    // Set up region management
    this.setupRegions();
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

  protected render(): string {
    const title = this.getProp('title');
    const collapsible = this.getProp('collapsible', false);
    const collapsed = this.getState('collapsed', false);

    return `
      <div class="nx-region ${collapsed ? 'collapsed' : ''}" part="container">
        ${title ? `
          <div class="nx-region-header" part="header">
            <h3 class="nx-region-title" part="title">${title}</h3>
            ${collapsible ? `
              <button class="nx-region-toggle" part="toggle" aria-label="Toggle region">
                <svg viewBox="0 0 24 24">
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </button>
            ` : ''}
          </div>
        ` : ''}
        <div class="nx-region-body" part="body">
          <slot></slot>
        </div>
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }

      .nx-region {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }

      .nx-region-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: var(--surface-color);
        border-bottom: 1px solid var(--border-color);
        flex-shrink: 0;
      }

      .nx-region-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 500;
      }

      .nx-region-toggle {
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        transition: transform 0.2s;
      }

      .nx-region-toggle svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }

      .collapsed .nx-region-toggle {
        transform: rotate(-90deg);
      }

      .nx-region-body {
        flex: 1;
        overflow: auto;
      }

      .collapsed .nx-region-body {
        display: none;
      }
    `;
  }

  protected afterRender(): void {
    const toggle = this.$('.nx-region-toggle');
    if (toggle) {
      this.on(toggle, 'click', () => this.toggle());
    }
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

customElements.define('nx-viewport', NXViewport);
customElements.define('nx-region', NXRegion);
