import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface AccordionItem {
  id?: string;
  title: string;
  content?: string;
  expanded?: boolean;
  disabled?: boolean;
}

export interface AccordionConfig {
  items?: AccordionItem[];
  multiple?: boolean;
  collapsible?: boolean;
}

export class NXAccordion extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['multiple', 'collapsible'];
  }

  protected initializeState(): void {
    this[ComponentState].set('items', []);
    this[ComponentState].set('expandedItems', new Set());
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setItems(items: AccordionItem[]): void {
    this.setState('items', items);
    const expanded = new Set<string>();
    items.forEach((item, index) => {
      if (item.expanded) {
        expanded.add(item.id || String(index));
      }
    });
    this.setState('expandedItems', expanded);
  }

  protected render(): string {
    const items = this.getState<AccordionItem[]>('items', []);
    const expandedItems = this.getState<Set<string>>('expandedItems', new Set());

    return `
      <div class="nx-accordion" part="container" role="region">
        ${items.map((item, index) => {
          const itemId = item.id || String(index);
          const isExpanded = expandedItems.has(itemId);
          
          return `
            <div class="nx-accordion-item ${item.disabled ? 'disabled' : ''}" 
                 part="item"
                 data-item-id="${itemId}">
              <button class="nx-accordion-header ${isExpanded ? 'expanded' : ''}" 
                      part="header"
                      aria-expanded="${isExpanded}"
                      aria-controls="content-${itemId}"
                      ${item.disabled ? 'disabled' : ''}>
                <span class="nx-accordion-title">${item.title}</span>
                <svg class="nx-accordion-icon" viewBox="0 0 24 24">
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </button>
              <div id="content-${itemId}"
                   class="nx-accordion-content ${isExpanded ? 'expanded' : ''}" 
                   part="content"
                   role="region"
                   aria-labelledby="header-${itemId}">
                <div class="nx-accordion-body" part="body">
                  ${item.content || ''}
                  <slot name="item-${itemId}"></slot>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        display: block;
      }

      .nx-accordion {
        border: 1px solid var(--border-color);
        border-radius: 0.25rem;
        overflow: hidden;
      }

      .nx-accordion-item {
        border-bottom: 1px solid var(--border-color);
      }

      .nx-accordion-item:last-child {
        border-bottom: none;
      }

      .nx-accordion-item.disabled {
        opacity: 0.5;
      }

      .nx-accordion-header {
        width: 100%;
        padding: 1rem;
        border: none;
        background: var(--surface-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        text-align: left;
        font-family: inherit;
        font-size: 1rem;
        transition: background-color 0.2s;
      }

      .nx-accordion-header:hover:not(:disabled) {
        background-color: var(--hover-bg, rgba(0, 0, 0, 0.04));
      }

      .nx-accordion-header:disabled {
        cursor: not-allowed;
      }

      .nx-accordion-title {
        flex: 1;
      }

      .nx-accordion-icon {
        width: 1.5rem;
        height: 1.5rem;
        fill: currentColor;
        transition: transform 0.3s;
      }

      .nx-accordion-header.expanded .nx-accordion-icon {
        transform: rotate(180deg);
      }

      .nx-accordion-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease-out;
      }

      .nx-accordion-content.expanded {
        max-height: none;
      }

      .nx-accordion-body {
        padding: 1rem;
        background: var(--bg-color);
      }
    `;
  }

  protected afterRender(): void {
    this.on(this.shadow!, 'click', (e: Event) => {
      const header = (e.target as Element).closest('.nx-accordion-header');
      if (header && !header.hasAttribute('disabled')) {
        this.handleToggle(e);
      }
    });

    this.on(this.shadow!, 'keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        const header = (e.target as Element).closest('.nx-accordion-header');
        if (header && !header.hasAttribute('disabled')) {
          e.preventDefault();
          this.handleToggle(e);
        }
      }
    });
  }

  private handleToggle(e: Event): void {
    const header = (e.target as Element).closest('.nx-accordion-header') as HTMLElement;
    const item = header.closest('.nx-accordion-item') as HTMLElement;
    const itemId = item.dataset.itemId!;
    const multiple = this.getProp('multiple', false);
    const collapsible = this.getProp('collapsible', true);
    const expandedItems = this.getState<Set<string>>('expandedItems', new Set());

    if (expandedItems.has(itemId)) {
      if (collapsible) {
        expandedItems.delete(itemId);
      }
    } else {
      if (!multiple) {
        expandedItems.clear();
      }
      expandedItems.add(itemId);
    }

    this.setState('expandedItems', new Set(expandedItems));
    this.emit('toggle', { itemId, expanded: expandedItems.has(itemId) });
  }

  expand(itemId: string): void {
    const expandedItems = this.getState<Set<string>>('expandedItems', new Set());
    expandedItems.add(itemId);
    this.setState('expandedItems', new Set(expandedItems));
  }

  collapse(itemId: string): void {
    const expandedItems = this.getState<Set<string>>('expandedItems', new Set());
    expandedItems.delete(itemId);
    this.setState('expandedItems', new Set(expandedItems));
  }

  expandAll(): void {
    const items = this.getState<AccordionItem[]>('items', []);
    const expandedItems = new Set<string>();
    items.forEach((_item, index) => {
      expandedItems.add(String(index));
    });
    this.setState('expandedItems', expandedItems);
  }

  collapseAll(): void {
    this.setState('expandedItems', new Set());
  }
}

customElements.define('nx-accordion', NXAccordion);
