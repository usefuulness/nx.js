// src/components/ui/accordion.ts
import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface AccordionPanel {
  id?: string;
  title: string;
  content?: string;
  icon?: string;
  disabled?: boolean;
  expanded?: boolean;
}

export interface AccordionConfig {
  panels?: AccordionPanel[];
  multiple?: boolean;
  collapsible?: boolean;
  animated?: boolean;
  variant?: 'default' | 'filled' | 'separated';
  expandIcon?: string;
  onExpand?: (panel: AccordionPanel, index: number) => void;
  onCollapse?: (panel: AccordionPanel, index: number) => void;
}

/**
 * Accordion component for collapsible content panels
 */
export class NXAccordion extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['multiple', 'collapsible', 'animated', 'variant'];
  }

  private panels: AccordionPanel[] = [];

  protected initializeState(): void {
    this[ComponentState].set('expandedPanels', new Set<string>());
  }

  constructor(config?: AccordionConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    
    if (config) {
      this.configure(config);
    }
  }

  configure(config: AccordionConfig): void {
    if (config.panels) {
      this.setPanels(config.panels);
    }
    
    Object.entries(config).forEach(([key, value]) => {
      if (['onExpand', 'onCollapse'].includes(key)) {
        this[ComponentState].set(key, value);
      } else if (key !== 'panels') {
        const attrName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        this.setAttribute(attrName, String(value));
      }
    });
  }

  setPanels(panels: AccordionPanel[]): void {
    this.panels = panels.map((panel, index) => ({
      ...panel,
      id: panel.id || `panel-${index}`
    }));
    
    // Set initially expanded panels
    const expandedPanels = new Set<string>();
    this.panels.forEach(panel => {
      if (panel.expanded) {
        expandedPanels.add(panel.id!);
      }
    });
    this.setState('expandedPanels', expandedPanels);
    
    this.update();
  }

  protected render(): string {
    const variant = this.getProp('variant', 'default');
    const animated = this.getProp('animated', true);
    const expandedPanels = this.getState('expandedPanels', new Set<string>());

    return `
      <div class="nx-accordion nx-accordion-${variant} ${animated ? 'animated' : ''}" 
           part="accordion"
           role="presentation">
        ${this.panels.map((panel, index) => {
          const isExpanded = expandedPanels.has(panel.id!);
          
          return `
            <div class="nx-accordion-item ${isExpanded ? 'expanded' : ''} ${panel.disabled ? 'disabled' : ''}"
                 part="item">
              <button class="nx-accordion-header"
                      part="header"
                      type="button"
                      role="button"
                      aria-expanded="${isExpanded}"
                      aria-controls="content-${panel.id}"
                      ${panel.disabled ? 'disabled' : ''}
                      data-panel-id="${panel.id}"
                      data-index="${index}">
                ${panel.icon ? `
                  <span class="nx-accordion-icon" part="icon">
                    ${this.renderIcon(panel.icon)}
                  </span>
                ` : ''}
                <span class="nx-accordion-title" part="title">${panel.title}</span>
                <span class="nx-accordion-expand-icon ${isExpanded ? 'expanded' : ''}" part="expand-icon">
                  ${this.renderExpandIcon()}
                </span>
              </button>
              <div class="nx-accordion-content ${isExpanded ? 'expanded' : ''}"
                   part="content"
                   id="content-${panel.id}"
                   role="region"
                   aria-labelledby="header-${panel.id}">
                <div class="nx-accordion-body" part="body">
                  ${panel.content || `<slot name="${panel.id}"></slot>`}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderIcon(icon: string): string {
    if (icon.startsWith('<svg')) {
      return icon;
    } else if (icon.startsWith('icon-')) {
      return `<i class="${icon}"></i>`;
    } else {
      return icon;
    }
  }

  private renderExpandIcon(): string {
    const customIcon = this.getProp('expand-icon');
    if (customIcon) {
      return this.renderIcon(customIcon);
    }
    
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    `;
  }

  protected styles(): string {
    return `
      :host {
        --accordion-gap: 0;
        --header-height: 3rem;
        --header-padding: 1rem;
        --content-padding: 1rem;
        --border-color: var(--color-border);
        --header-bg: transparent;
        --header-hover-bg: var(--color-background);
        --content-bg: var(--color-surface);
        display: block;
      }

      .nx-accordion {
        display: flex;
        flex-direction: column;
        gap: var(--accordion-gap);
      }

      /* Variants */
      .nx-accordion-default .nx-accordion-item {
        border: 1px solid var(--border-color);
      }

      .nx-accordion-default .nx-accordion-item:not(:last-child) {
        border-bottom: none;
      }

      .nx-accordion-default .nx-accordion-item:first-child {
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      }

      .nx-accordion-default .nx-accordion-item:last-child {
        border-radius: 0 0 var(--radius-lg) var(--radius-lg);
      }

      .nx-accordion-default .nx-accordion-item:only-child {
        border-radius: var(--radius-lg);
      }

      .nx-accordion-filled {
        --header-bg: var(--color-background);
        --content-bg: var(--color-surface);
      }

      .nx-accordion-separated {
        --accordion-gap: 0.75rem;
      }

      .nx-accordion-separated .nx-accordion-item {
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }

      /* Item */
      .nx-accordion-item {
        overflow: hidden;
      }

      .nx-accordion-item.disabled {
        opacity: 0.6;
      }

      /* Header */
      .nx-accordion-header {
        width: 100%;
        height: var(--header-height);
        padding: 0 var(--header-padding);
        background: var(--header-bg);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.875rem;
        font-family: inherit;
        font-weight: 500;
        color: var(--color-text);
        text-align: left;
        transition: background-color 0.2s;
      }

      .nx-accordion-header:hover:not(:disabled) {
        background: var(--header-hover-bg);
      }

      .nx-accordion-header:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
      }

      .nx-accordion-header:disabled {
        cursor: not-allowed;
      }

      .nx-accordion-icon {
        width: 1.25rem;
        height: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .nx-accordion-title {
        flex: 1;
      }

      .nx-accordion-expand-icon {
        width: 1.25rem;
        height: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: transform 0.2s;
      }

      .nx-accordion-expand-icon.expanded {
        transform: rotate(180deg);
      }

      .nx-accordion-expand-icon svg {
        width: 100%;
        height: 100%;
      }

      /* Content */
      .nx-accordion-content {
        max-height: 0;
        overflow: hidden;
        background: var(--content-bg);
      }

      .nx-accordion.animated .nx-accordion-content {
        transition: max-height 0.3s ease-out;
      }

      .nx-accordion-content.expanded {
        max-height: var(--content-height, 500px);
      }

      .nx-accordion-body {
        padding: var(--content-padding);
      }

      /* Filled variant specific */
      .nx-accordion-filled .nx-accordion-header {
        border-bottom: 1px solid var(--border-color);
      }

      .nx-accordion-filled .nx-accordion-item.expanded .nx-accordion-header {
        background: var(--color-surface);
      }

      /* Focus within */
      .nx-accordion-item:focus-within {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
    `;
  }

  protected afterRender(): void {
    // Header clicks
    this.$$('.nx-accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const panelId = (header as HTMLElement).dataset.panelId!;
        const index = parseInt((header as HTMLElement).dataset.index!);
        this.togglePanel(panelId, index);
      });
    });

    // Measure content heights for smooth animation
    if (this.getProp('animated', true)) {
      this.measureContentHeights();
    }

    // Keyboard navigation
    this.setupKeyboardNavigation();
  }

  private measureContentHeights(): void {
    this.$$('.nx-accordion-content').forEach(content => {
      const body = content.querySelector('.nx-accordion-body') as HTMLElement;
      if (body) {
        const height = body.scrollHeight;
        (content as HTMLElement).style.setProperty('--content-height', `${height}px`);
      }
    });
  }

  private togglePanel(panelId: string, index: number): void {
    const panel = this.panels[index];
    if (!panel || panel.disabled) return;

    const expandedPanels = new Set(this.getState('expandedPanels', new Set<string>()));
    const isExpanded = expandedPanels.has(panelId);
    const multiple = this.getProp('multiple', false);
    const collapsible = this.getProp('collapsible', true);

    if (isExpanded && collapsible) {
      // Collapse
      expandedPanels.delete(panelId);
      const onCollapse = this.getState('onCollapse');
      if (onCollapse) onCollapse(panel, index);
      this.dispatchEvent(new CustomEvent('collapse', { detail: { panel, index } }));
    } else if (!isExpanded) {
      // Expand
      if (!multiple) {
        expandedPanels.clear();
      }
      expandedPanels.add(panelId);
      const onExpand = this.getState('onExpand');
      if (onExpand) onExpand(panel, index);
      this.dispatchEvent(new CustomEvent('expand', { detail: { panel, index } }));
    }

    this.setState('expandedPanels', expandedPanels);
  }

  private setupKeyboardNavigation(): void {
    const headers = this.$$('.nx-accordion-header');
    
    headers.forEach((header, index) => {
      header.addEventListener('keydown', (e) => {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            const prevIndex = index > 0 ? index - 1 : headers.length - 1;
            (headers[prevIndex] as HTMLElement).focus();
            break;
            
          case 'ArrowDown':
            e.preventDefault();
            const nextIndex = index < headers.length - 1 ? index + 1 : 0;
            (headers[nextIndex] as HTMLElement).focus();
            break;
            
          case 'Home':
            e.preventDefault();
            (headers[0] as HTMLElement).focus();
            break;
            
          case 'End':
            e.preventDefault();
            (headers[headers.length - 1] as HTMLElement).focus();
            break;
        }
      });
    });
  }

  // Public API
  expandAll(): void {
    const expandedPanels = new Set<string>();
    this.panels.forEach(panel => {
      if (!panel.disabled) {
        expandedPanels.add(panel.id!);
      }
    });
    this.setState('expandedPanels', expandedPanels);
  }

  collapseAll(): void {
    this.setState('expandedPanels', new Set<string>());
  }

  expandPanel(panelId: string): void {
    const panel = this.panels.find(p => p.id === panelId);
    if (panel && !panel.disabled) {
      const index = this.panels.indexOf(panel);
      const expandedPanels = new Set(this.getState('expandedPanels', new Set<string>()));
      
      if (!expandedPanels.has(panelId)) {
        if (!this.getProp('multiple', false)) {
          expandedPanels.clear();
        }
        expandedPanels.add(panelId);
        this.setState('expandedPanels', expandedPanels);
      }
    }
  }

  collapsePanel(panelId: string): void {
    const expandedPanels = new Set(this.getState('expandedPanels', new Set<string>()));
    expandedPanels.delete(panelId);
    this.setState('expandedPanels', expandedPanels);
  }
}

customElements.define('nx-accordion', NXAccordion);
