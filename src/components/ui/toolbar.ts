// src/components/ui/toolbar.ts
import { BaseComponent, ComponentState } from '@/components/abstracts/base';
import { ComponentRegistry } from '@/core/registry';

export interface ToolbarItem {
  xtype?: string;
  text?: string;
  icon?: string;
  tooltip?: string;
  handler?: () => void;
  menu?: ToolbarItem[];
  disabled?: boolean;
  hidden?: boolean;
  align?: 'left' | 'right';
  separator?: boolean;
  spacer?: boolean;
  [key: string]: any;
}

/**
 * Toolbar component for actions and navigation
 */
export class NXToolbar extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['orientation', 'size', 'variant', 'sticky', 'shadow'];
  }

  private items: ToolbarItem[] = [];

  protected initializeState(): void {
    this[ComponentState].set('items', []);
    this[ComponentState].set('overflowItems', []);
    this[ComponentState].set('showOverflow', false);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /**
   * Set toolbar items
   */
  setItems(items: ToolbarItem[]): void {
    this.items = items;
    this.setState('items', items);
    this.checkOverflow();
  }

  /**
   * Add an item to the toolbar
   */
  addItem(item: ToolbarItem, index?: number): void {
    if (index !== undefined) {
      this.items.splice(index, 0, item);
    } else {
      this.items.push(item);
    }
    this.setState('items', [...this.items]);
    this.checkOverflow();
  }

  /**
   * Remove an item from the toolbar
   */
  removeItem(index: number): void {
    this.items.splice(index, 1);
    this.setState('items', [...this.items]);
    this.checkOverflow();
  }

  protected render(): string {
    const orientation = this.getProp('orientation', 'horizontal');
    const size = this.getProp('size', 'md');
    const variant = this.getProp('variant', 'default');
    const sticky = this.getProp('sticky', false);
    const shadow = this.getProp('shadow', true);
    const items = this.getState('items', []) as ToolbarItem[];
    const showOverflow = this.getState('showOverflow', false);

    return `
      <div class="nx-toolbar 
                  nx-toolbar-${orientation} 
                  nx-toolbar-${size}
                  nx-toolbar-${variant}
                  ${sticky ? 'sticky' : ''}
                  ${shadow ? 'shadow' : ''}"
           part="toolbar"
           role="toolbar">
        <div class="nx-toolbar-content" part="content">
          <div class="nx-toolbar-start" part="start">
            ${this.renderItems(items.filter(item => item.align !== 'right'))}
          </div>
          <div class="nx-toolbar-end" part="end">
            ${this.renderItems(items.filter(item => item.align === 'right'))}
            ${showOverflow ? this.renderOverflowMenu() : ''}
          </div>
        </div>
      </div>
    `;
  }

  private renderItems(items: ToolbarItem[]): string {
    return items.map((item, index) => {
      if (item.hidden) return '';
      
      if (item.separator) {
        return '<div class="nx-toolbar-separator" part="separator"></div>';
      }
      
      if (item.spacer || item.text === '->') {
        return '<div class="nx-toolbar-spacer" part="spacer"></div>';
      }

      if (item.xtype) {
        return `<div class="nx-toolbar-item" data-index="${index}"></div>`;
      }

      return this.renderToolbarItem(item, index);
    }).join('');
  }

  private renderToolbarItem(item: ToolbarItem, index: number): string {
    const hasMenu = item.menu && item.menu.length > 0;
    
    return `
      <button class="nx-toolbar-button ${item.disabled ? 'disabled' : ''}"
              part="button"
              type="button"
              data-index="${index}"
              ${item.disabled ? 'disabled' : ''}
              ${item.tooltip ? `title="${item.tooltip}"` : ''}
              ${hasMenu ? 'aria-haspopup="true"' : ''}>
        ${item.icon ? `<span class="nx-toolbar-icon">${this.renderIcon(item.icon)}</span>` : ''}
        ${item.text ? `<span class="nx-toolbar-text">${item.text}</span>` : ''}
        ${hasMenu ? '<span class="nx-toolbar-dropdown-icon">▼</span>' : ''}
      </button>
      ${hasMenu ? this.renderDropdownMenu(item.menu!, index) : ''}
    `;
  }

  private renderIcon(icon: string): string {
    // Support for icon fonts, SVG sprites, or inline SVG
    if (icon.startsWith('<svg')) {
      return icon;
    } else if (icon.startsWith('icon-')) {
      return `<i class="${icon}"></i>`;
    } else {
      // Default to material icons style
      return `<span class="material-icons">${icon}</span>`;
    }
  }

  private renderDropdownMenu(items: ToolbarItem[], parentIndex: number): string {
    return `
      <div class="nx-toolbar-dropdown" 
           part="dropdown"
           data-parent="${parentIndex}"
           hidden>
        ${items.map((item, index) => {
          if (item.separator) {
            return '<div class="nx-dropdown-separator"></div>';
          }
          
          return `
            <button class="nx-dropdown-item ${item.disabled ? 'disabled' : ''}"
                    type="button"
                    data-parent="${parentIndex}"
                    data-index="${index}"
                    ${item.disabled ? 'disabled' : ''}>
              ${item.icon ? `<span class="nx-dropdown-icon">${this.renderIcon(item.icon)}</span>` : ''}
              <span class="nx-dropdown-text">${item.text || ''}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderOverflowMenu(): string {
    const overflowItems = this.getState('overflowItems', []) as ToolbarItem[];
    
    return `
      <button class="nx-toolbar-overflow" 
              part="overflow"
              aria-label="More options">
        <span class="nx-toolbar-icon">⋮</span>
      </button>
      <div class="nx-toolbar-dropdown nx-overflow-menu" hidden>
        ${overflowItems.map((item, index) => {
          if (item.separator) {
            return '<div class="nx-dropdown-separator"></div>';
          }
          
          return `
            <button class="nx-dropdown-item"
                    type="button"
                    data-overflow-index="${index}">
              ${item.icon ? `<span class="nx-dropdown-icon">${this.renderIcon(item.icon)}</span>` : ''}
              <span class="nx-dropdown-text">${item.text || ''}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        --toolbar-height: 48px;
        --toolbar-bg: var(--color-surface);
        --toolbar-border: var(--color-border);
        --toolbar-shadow: var(--shadow-sm);
        --button-hover: var(--color-background);
        display: block;
      }

      .nx-toolbar {
        background: var(--toolbar-bg);
        border: 1px solid var(--toolbar-border);
        min-height: var(--toolbar-height);
        display: flex;
        align-items: center;
        position: relative;
      }

      .nx-toolbar.shadow {
        box-shadow: var(--toolbar-shadow);
      }

      .nx-toolbar.sticky {
        position: sticky;
        top: 0;
        z-index: 100;
      }

      /* Orientation */
      .nx-toolbar-horizontal .nx-toolbar-content {
        flex-direction: row;
        width: 100%;
      }

      .nx-toolbar-vertical {
        flex-direction: column;
        width: var(--toolbar-height);
        height: auto;
      }

      .nx-toolbar-vertical .nx-toolbar-content {
        flex-direction: column;
        width: 100%;
      }

      /* Content layout */
      .nx-toolbar-content {
        display: flex;
        align-items: center;
        padding: 0 0.5rem;
        width: 100%;
        height: 100%;
      }

      .nx-toolbar-start {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        flex: 1;
      }

      .nx-toolbar-end {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        position: relative;
      }

      /* Sizes */
      .nx-toolbar-sm {
        --toolbar-height: 36px;
        font-size: 0.875rem;
      }

      .nx-toolbar-md {
        --toolbar-height: 48px;
        font-size: 1rem;
      }

      .nx-toolbar-lg {
        --toolbar-height: 64px;
        font-size: 1.125rem;
      }

      /* Variants */
      .nx-toolbar-primary {
        --toolbar-bg: var(--color-primary);
        --toolbar-border: var(--color-primary-dark);
        --button-hover: rgba(255, 255, 255, 0.1);
        color: white;
      }

      .nx-toolbar-dark {
        --toolbar-bg: var(--color-text);
        --toolbar-border: var(--color-text);
        --button-hover: rgba(255, 255, 255, 0.1);
        color: white;
      }

      /* Toolbar items */
      .nx-toolbar-item {
        display: inline-flex;
        align-items: center;
      }

      .nx-toolbar-button,
      .nx-toolbar-overflow {
        background: none;
        border: none;
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        color: inherit;
        font-size: inherit;
        font-family: inherit;
        border-radius: var(--radius-sm);
        transition: background-color 0.2s;
        position: relative;
        height: calc(var(--toolbar-height) - 1rem);
      }

      .nx-toolbar-button:hover:not(:disabled),
      .nx-toolbar-overflow:hover {
        background: var(--button-hover);
      }

      .nx-toolbar-button:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
      }

      .nx-toolbar-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nx-toolbar-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.25em;
        height: 1.25em;
      }

      .nx-toolbar-text {
        white-space: nowrap;
      }

      .nx-toolbar-dropdown-icon {
        font-size: 0.75em;
        margin-left: 0.25rem;
      }

      /* Separator */
      .nx-toolbar-separator {
        width: 1px;
        height: calc(var(--toolbar-height) - 1.5rem);
        background: var(--toolbar-border);
        margin: 0 0.5rem;
      }

      .nx-toolbar-vertical .nx-toolbar-separator {
        width: calc(var(--toolbar-height) - 1.5rem);
        height: 1px;
        margin: 0.5rem 0;
      }

      /* Spacer */
      .nx-toolbar-spacer {
        flex: 1;
      }

      /* Dropdown menu */
      .nx-toolbar-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 0.25rem;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        min-width: 180px;
        z-index: 1000;
        overflow: hidden;
      }

      .nx-toolbar-dropdown[hidden] {
        display: none;
      }

      .nx-dropdown-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.5rem 1rem;
        background: none;
        border: none;
        text-align: left;
        cursor: pointer;
        color: var(--color-text);
        font-size: 0.875rem;
        transition: background-color 0.15s;
      }

      .nx-dropdown-item:hover:not(:disabled) {
        background: var(--color-background);
      }

      .nx-dropdown-item:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nx-dropdown-icon {
        width: 1.25rem;
        height: 1.25rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .nx-dropdown-text {
        flex: 1;
      }

      .nx-dropdown-separator {
        height: 1px;
        background: var(--color-border);
        margin: 0.25rem 0;
      }

      /* Overflow menu */
      .nx-overflow-menu {
        right: 0;
        left: auto;
      }

      /* Mobile responsive */
      @media (max-width: 768px) {
        .nx-toolbar-text {
          display: none;
        }

        .nx-toolbar-button {
          padding: 0.5rem;
        }
      }
    `;
  }

  protected afterRender(): void {
    // Handle button clicks
    this.$$('.nx-toolbar-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const index = parseInt((button as HTMLElement).dataset.index || '0');
        const item = this.items[index];
        
        if (item.menu) {
          this.toggleDropdown(index);
        } else if (item.handler) {
          item.handler();
        }
        
        this.dispatchEvent(new CustomEvent('itemclick', {
          detail: { item, index }
        }));
      });
    });

    // Handle dropdown item clicks
    this.$$('.nx-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const parentIndex = parseInt((item as HTMLElement).dataset.parent || '0');
        const index = parseInt((item as HTMLElement).dataset.index || '0');
        const parentItem = this.items[parentIndex];
        const menuItem = parentItem.menu?.[index];
        
        if (menuItem?.handler) {
          menuItem.handler();
        }
        
        this.hideAllDropdowns();
        
        this.dispatchEvent(new CustomEvent('menuitemclick', {
          detail: { item: menuItem, parentItem, index }
        }));
      });
    });

    // Handle overflow menu
    this.on('.nx-toolbar-overflow', 'click', () => {
      this.toggleOverflowMenu();
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!this.contains(e.target as Node)) {
        this.hideAllDropdowns();
      }
    });

    // Create custom components
    this.createCustomComponents();

    // Check for overflow on resize
    this.checkOverflow();
    window.addEventListener('resize', this.debounce(() => this.checkOverflow(), 100));
  }

  private createCustomComponents(): void {
    this.$$('.nx-toolbar-item').forEach(container => {
      const index = parseInt((container as HTMLElement).dataset.index || '0');
      const item = this.items[index];
      
      if (item.xtype) {
        const component = ComponentRegistry.create(item.xtype, item);
        if (component) {
          container.appendChild(component);
        }
      }
    });
  }

  private toggleDropdown(index: number): void {
    const dropdown = this.$(`[data-parent="${index}"]`) as HTMLElement;
    const isHidden = dropdown?.hasAttribute('hidden');
    
    this.hideAllDropdowns();
    
    if (dropdown && isHidden) {
      dropdown.removeAttribute('hidden');
      this.positionDropdown(dropdown);
    }
  }

  private toggleOverflowMenu(): void {
    const menu = this.$('.nx-overflow-menu') as HTMLElement;
    if (menu) {
      if (menu.hasAttribute('hidden')) {
        menu.removeAttribute('hidden');
      } else {
        menu.setAttribute('hidden', '');
      }
    }
  }

  private hideAllDropdowns(): void {
    this.$$('.nx-toolbar-dropdown').forEach(dropdown => {
      dropdown.setAttribute('hidden', '');
    });
  }

  private positionDropdown(dropdown: HTMLElement): void {
    const rect = dropdown.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    // Adjust position if dropdown would overflow viewport
    if (rect.right > viewportWidth) {
      dropdown.style.left = 'auto';
      dropdown.style.right = '0';
    }
  }

  private checkOverflow(): void {
    // This is a simplified overflow check
    // In a production implementation, you would measure actual widths
    const toolbar = this.$('.nx-toolbar');
    if (!toolbar) return;
    
    const toolbarWidth = toolbar.clientWidth;
    const contentWidth = this.calculateContentWidth();
    
    if (contentWidth > toolbarWidth) {
      this.setState('showOverflow', true);
      // Move some items to overflow menu
      this.calculateOverflowItems();
    } else {
      this.setState('showOverflow', false);
      this.setState('overflowItems', []);
    }
  }

  private calculateContentWidth(): number {
    // Simplified calculation
    let width = 0;
    this.$$('.nx-toolbar-button, .nx-toolbar-separator').forEach(el => {
      width += (el as HTMLElement).offsetWidth;
    });
    return width;
  }

  private calculateOverflowItems(): void {
    // Simplified - in production, this would be more sophisticated
    const visibleCount = Math.floor(this.items.length * 0.7);
    const overflowItems = this.items.slice(visibleCount);
    this.setState('overflowItems', overflowItems);
  }

  private debounce(fn: Function, delay: number): EventListener {
    let timeout: number;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => fn.apply(this, args), delay);
    };
  }
}

customElements.define('nx-toolbar', NXToolbar);

/**
 * Toolbar separator component
 */
export class NXToolbarSeparator extends HTMLElement {
  connectedCallback(): void {
    this.setAttribute('role', 'separator');
  }
}

customElements.define('nx-toolbar-separator', NXToolbarSeparator);

/**
 * Toolbar spacer component
 */
export class NXToolbarSpacer extends HTMLElement {
  connectedCallback(): void {
    this.style.flex = '1';
  }
}

customElements.define('nx-toolbar-spacer', NXToolbarSpacer);
