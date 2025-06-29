// src/components/layout/viewport.ts
import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export type LayoutType = 'border' | 'flex' | 'grid' | 'dock' | 'fit' | 'card';

/**
 * Main viewport container that manages the application layout
 */
export class NXViewport extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['layout', 'padding', 'gap'];
  }

  protected initializeState(): void {
    this[ComponentState].set('layout', 'fit');
    this[ComponentState].set('resizeObserver', null);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setupResizeObserver();
    this.setAttribute('role', 'application');
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    const observer = this.getState('resizeObserver');
    if (observer) {
      observer.disconnect();
    }
  }

  protected render(): string {
    const layout = this.getProp('layout', 'fit') as LayoutType;
    const padding = this.getProp('padding', '0');
    const gap = this.getProp('gap', '0');

    return `
      <div class="nx-viewport nx-layout-${layout}" 
           part="viewport"
           style="padding: ${padding}; gap: ${gap};">
        ${this.renderLayout(layout)}
      </div>
    `;
  }

  private renderLayout(layout: LayoutType): string {
    switch (layout) {
      case 'border':
        return this.renderBorderLayout();
      case 'flex':
        return this.renderFlexLayout();
      case 'grid':
        return this.renderGridLayout();
      case 'dock':
        return this.renderDockLayout();
      case 'card':
        return this.renderCardLayout();
      case 'fit':
      default:
        return '<slot></slot>';
    }
  }

  private renderBorderLayout(): string {
    return `
      <div class="nx-border-layout">
        <div class="nx-region nx-north" part="north">
          <slot name="north"></slot>
        </div>
        <div class="nx-border-center">
          <div class="nx-region nx-west" part="west">
            <slot name="west"></slot>
          </div>
          <div class="nx-region nx-center" part="center">
            <slot name="center"></slot>
            <slot></slot>
          </div>
          <div class="nx-region nx-east" part="east">
            <slot name="east"></slot>
          </div>
        </div>
        <div class="nx-region nx-south" part="south">
          <slot name="south"></slot>
        </div>
      </div>
    `;
  }

  private renderFlexLayout(): string {
    const direction = this.getProp('direction', 'row');
    const wrap = this.getProp('wrap', 'nowrap');
    const justify = this.getProp('justify', 'start');
    const align = this.getProp('align', 'stretch');

    return `
      <div class="nx-flex-layout"
           style="flex-direction: ${direction}; 
                  flex-wrap: ${wrap};
                  justify-content: ${justify};
                  align-items: ${align};">
        <slot></slot>
      </div>
    `;
  }

  private renderGridLayout(): string {
    const columns = this.getProp('columns', '1fr');
    const rows = this.getProp('rows', 'auto');
    const gap = this.getProp('gap', '1rem');

    return `
      <div class="nx-grid-layout"
           style="grid-template-columns: ${columns};
                  grid-template-rows: ${rows};
                  gap: ${gap};">
        <slot></slot>
      </div>
    `;
  }

  private renderDockLayout(): string {
    return `
      <div class="nx-dock-layout">
        <div class="nx-dock-top" part="dock-top">
          <slot name="top"></slot>
        </div>
        <div class="nx-dock-middle">
          <div class="nx-dock-left" part="dock-left">
            <slot name="left"></slot>
          </div>
          <div class="nx-dock-center" part="dock-center">
            <slot></slot>
          </div>
          <div class="nx-dock-right" part="dock-right">
            <slot name="right"></slot>
          </div>
        </div>
        <div class="nx-dock-bottom" part="dock-bottom">
          <slot name="bottom"></slot>
        </div>
      </div>
    `;
  }

  private renderCardLayout(): string {
    return `
      <div class="nx-card-layout">
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
        position: relative;
        overflow: hidden;
      }

      .nx-viewport {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      /* Fit Layout */
      .nx-layout-fit {
        position: relative;
      }

      .nx-layout-fit ::slotted(*) {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }

      /* Border Layout */
      .nx-border-layout {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .nx-border-center {
        flex: 1;
        display: flex;
        overflow: hidden;
      }

      .nx-region {
        position: relative;
        overflow: auto;
      }

      .nx-north, .nx-south {
        flex-shrink: 0;
      }

      .nx-west, .nx-east {
        flex-shrink: 0;
      }

      .nx-center {
        flex: 1;
      }

      .nx-region:empty {
        display: none;
      }

      /* Flex Layout */
      .nx-flex-layout {
        display: flex;
        height: 100%;
      }

      /* Grid Layout */
      .nx-grid-layout {
        display: grid;
        height: 100%;
      }

      /* Dock Layout */
      .nx-dock-layout {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .nx-dock-middle {
        flex: 1;
        display: flex;
        overflow: hidden;
      }

      .nx-dock-top, .nx-dock-bottom {
        flex-shrink: 0;
      }

      .nx-dock-left, .nx-dock-right {
        flex-shrink: 0;
      }

      .nx-dock-center {
        flex: 1;
        overflow: auto;
      }

      /* Card Layout */
      .nx-card-layout {
        position: relative;
        height: 100%;
      }

      .nx-card-layout ::slotted(*) {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        visibility: hidden;
      }

      .nx-card-layout ::slotted([active]) {
        visibility: visible;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .nx-border-center {
          flex-direction: column;
        }

        .nx-west, .nx-east {
          width: 100% !important;
        }
      }
    `;
  }

  protected afterRender(): void {
    this.setupSlotListeners();
    this.handleLayoutSpecific();
  }

  private setupSlotListeners(): void {
    const slots = this.shadowRoot?.querySelectorAll('slot');
    slots?.forEach(slot => {
      slot.addEventListener('slotchange', () => {
        this.handleSlotChange(slot);
      });
    });
  }

  private handleSlotChange(slot: HTMLSlotElement): void {
    const name = slot.getAttribute('name');
    const elements = slot.assignedElements();
    
    // Apply region-specific attributes
    elements.forEach(el => {
      if (name && el instanceof HTMLElement) {
        el.setAttribute('data-region', name);
      }
    });

    this.dispatchEvent(new CustomEvent('layoutchange', {
      detail: { region: name, elements }
    }));
  }

  private handleLayoutSpecific(): void {
    const layout = this.getProp('layout') as LayoutType;

    switch (layout) {
      case 'border':
        this.setupBorderLayout();
        break;
      case 'card':
        this.setupCardLayout();
        break;
      case 'dock':
        this.setupDockLayout();
        break;
    }
  }

  private setupBorderLayout(): void {
    // Set default sizes for regions
    const regions = ['north', 'south', 'east', 'west'];
    regions.forEach(region => {
      const slot = this.shadowRoot?.querySelector(`slot[name="${region}"]`);
      const elements = slot?.assignedElements() || [];
      
      elements.forEach(el => {
        if (el instanceof HTMLElement) {
          const size = el.getAttribute(`${region}-size`) || el.getAttribute('size');
          if (size) {
            const regionEl = this.shadowRoot?.querySelector(`.nx-${region}`) as HTMLElement;
            if (regionEl) {
              if (region === 'north' || region === 'south') {
                regionEl.style.height = size;
              } else {
                regionEl.style.width = size;
              }
            }
          }
        }
      });
    });
  }

  private setupCardLayout(): void {
    const slot = this.shadowRoot?.querySelector('slot:not([name])');
    const cards = slot?.assignedElements() || [];
    
    // Activate first card if none active
    if (cards.length > 0 && !cards.find(card => card.hasAttribute('active'))) {
      cards[0].setAttribute('active', '');
    }
  }

  private setupDockLayout(): void {
    // Similar to border layout but with different semantics
    const docks = ['top', 'bottom', 'left', 'right'];
    docks.forEach(dock => {
      const slot = this.shadowRoot?.querySelector(`slot[name="${dock}"]`);
      const elements = slot?.assignedElements() || [];
      
      elements.forEach(el => {
        if (el instanceof HTMLElement) {
          const size = el.getAttribute('dock-size') || el.getAttribute('size');
          if (size) {
            const dockEl = this.shadowRoot?.querySelector(`.nx-dock-${dock}`) as HTMLElement;
            if (dockEl) {
              if (dock === 'top' || dock === 'bottom') {
                dockEl.style.height = size;
              } else {
                dockEl.style.width = size;
              }
            }
          }
        }
      });
    });
  }

  private setupResizeObserver(): void {
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          this.dispatchEvent(new CustomEvent('resize', {
            detail: {
              width: entry.contentRect.width,
              height: entry.contentRect.height
            }
          }));
        }
      });
      
      observer.observe(this);
      this.setState('resizeObserver', observer);
    }
  }

  // Public API

  /**
   * Set active card in card layout
   */
  setActiveCard(index: number | string): void {
    if (this.getProp('layout') !== 'card') return;

    const slot = this.shadowRoot?.querySelector('slot:not([name])');
    const cards = slot?.assignedElements() || [];

    // Remove active from all
    cards.forEach(card => card.removeAttribute('active'));

    // Set new active
    if (typeof index === 'number' && cards[index]) {
      cards[index].setAttribute('active', '');
    } else if (typeof index === 'string') {
      const card = cards.find(c => c.id === index);
      if (card) {
        card.setAttribute('active', '');
      }
    }
  }

  /**
   * Get layout type
   */
  getLayout(): LayoutType {
    return this.getProp('layout', 'fit') as LayoutType;
  }

  /**
   * Update layout
   */
  setLayout(layout: LayoutType): void {
    this.setAttribute('layout', layout);
  }
}

customElements.define('nx-viewport', NXViewport);

/**
 * Region component for border layouts
 */
export class NXRegion extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['region', 'size', 'collapsible', 'collapsed', 'resizable', 'split'];
  }

  protected render(): string {
    const region = this.getProp('region', 'center');
    const collapsible = this.getProp('collapsible', false);
    const collapsed = this.getState('collapsed', false);

    return `
      <div class="nx-region-container ${collapsed ? 'collapsed' : ''}" part="container">
        ${collapsible ? this.renderCollapseButton() : ''}
        <div class="nx-region-content" part="content">
          <slot></slot>
        </div>
        ${this.getProp('resizable') ? this.renderResizeHandle() : ''}
      </div>
    `;
  }

  private renderCollapseButton(): string {
    const region = this.getProp('region');
    const collapsed = this.getState('collapsed', false);
    
    return `
      <button class="nx-collapse-button" 
              part="collapse-button"
              aria-label="${collapsed ? 'Expand' : 'Collapse'} ${region} region">
        <svg class="nx-collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    `;
  }

  private renderResizeHandle(): string {
    const region = this.getProp('region');
    const orientation = region === 'north' || region === 'south' ? 'horizontal' : 'vertical';
    
    return `
      <div class="nx-resize-handle nx-resize-${orientation}" 
           part="resize-handle"
           data-orientation="${orientation}">
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        display: block;
        position: relative;
        height: 100%;
        overflow: hidden;
      }

      .nx-region-container {
        height: 100%;
        display: flex;
        position: relative;
      }

      .nx-region-content {
        flex: 1;
        overflow: auto;
      }

      .nx-region-container.collapsed .nx-region-content {
        display: none;
      }

      .nx-collapse-button {
        position: absolute;
        z-index: 10;
        width: 24px;
        height: 24px;
        padding: 4px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .nx-collapse-icon {
        width: 12px;
        height: 12px;
        transition: transform 0.2s;
      }

      /* Position collapse buttons based on region */
      :host([region="north"]) .nx-collapse-button {
        bottom: 4px;
        left: 50%;
        transform: translateX(-50%) rotate(90deg);
      }

      :host([region="south"]) .nx-collapse-button {
        top: 4px;
        left: 50%;
        transform: translateX(-50%) rotate(-90deg);
      }

      :host([region="west"]) .nx-collapse-button {
        right: 4px;
        top: 50%;
        transform: translateY(-50%);
      }

      :host([region="east"]) .nx-collapse-button {
        left: 4px;
        top: 50%;
        transform: translateY(-50%) rotate(180deg);
      }

      .nx-region-container.collapsed .nx-collapse-icon {
        transform: rotate(180deg);
      }

      /* Resize handles */
      .nx-resize-handle {
        position: absolute;
        background: transparent;
        z-index: 10;
      }

      .nx-resize-handle:hover {
        background: var(--color-primary);
        opacity: 0.3;
      }

      .nx-resize-horizontal {
        left: 0;
        right: 0;
        height: 4px;
        cursor: ns-resize;
      }

      :host([region="north"]) .nx-resize-horizontal {
        bottom: 0;
      }

      :host([region="south"]) .nx-resize-horizontal {
        top: 0;
      }

      .nx-resize-vertical {
        top: 0;
        bottom: 0;
        width: 4px;
        cursor: ew-resize;
      }

      :host([region="west"]) .nx-resize-vertical {
        right: 0;
      }

      :host([region="east"]) .nx-resize-vertical {
        left: 0;
      }
    `;
  }

  protected afterRender(): void {
    // Collapse button handler
    this.on('.nx-collapse-button', 'click', () => {
      const collapsed = !this.getState('collapsed', false);
      this.setState('collapsed', collapsed);
      this.dispatchEvent(new CustomEvent('collapse', { detail: { collapsed } }));
    });

    // Resize handle
    if (this.getProp('resizable')) {
      this.setupResize();
    }
  }

  private setupResize(): void {
    const handle = this.$('.nx-resize-handle') as HTMLElement;
    if (!handle) return;

    let startPos = 0;
    let startSize = 0;

    const startResize = (e: MouseEvent) => {
      e.preventDefault();
      const orientation = handle.dataset.orientation;
      startPos = orientation === 'horizontal' ? e.clientY : e.clientX;
      startSize = orientation === 'horizontal' ? this.offsetHeight : this.offsetWidth;

      document.addEventListener('mousemove', doResize);
      document.addEventListener('mouseup', stopResize);
      document.body.style.cursor = handle.style.cursor;
      this.classList.add('resizing');
    };

    const doResize = (e: MouseEvent) => {
      const orientation = handle.dataset.orientation;
      const currentPos = orientation === 'horizontal' ? e.clientY : e.clientX;
      const diff = currentPos - startPos;
      const region = this.getProp('region');
      
      let newSize = startSize;
      if (region === 'north' || region === 'west') {
        newSize = startSize + diff;
      } else {
        newSize = startSize - diff;
      }

      newSize = Math.max(50, newSize); // Min size
      
      if (orientation === 'horizontal') {
        this.style.height = `${newSize}px`;
      } else {
        this.style.width = `${newSize}px`;
      }

      this.dispatchEvent(new CustomEvent('resize', {
        detail: { size: newSize, region }
      }));
    };

    const stopResize = () => {
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
      document.body.style.cursor = '';
      this.classList.remove('resizing');
    };

    handle.addEventListener('mousedown', startResize);
  }
}

customElements.define('nx-region', NXRegion);
