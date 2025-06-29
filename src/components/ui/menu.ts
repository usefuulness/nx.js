// src/components/ui/menu.ts
import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface MenuItem {
  id?: string;
  text: string;
  icon?: string;
  href?: string;
  disabled?: boolean;
  divider?: boolean;
  checked?: boolean;
  group?: string;
  shortcut?: string;
  submenu?: MenuItem[];
  handler?: () => void;
}

export interface MenuConfig {
  items?: MenuItem[];
  trigger?: 'click' | 'hover' | 'contextmenu';
  position?: 'auto' | 'bottom' | 'top' | 'left' | 'right';
  closeOnClick?: boolean;
  showIcons?: boolean;
  showShortcuts?: boolean;
  width?: string | number;
  onSelect?: (item: MenuItem) => void;
}

/**
 * Dropdown menu component
 */
export class NXMenu extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['trigger', 'position', 'close-on-click', 'show-icons', 'show-shortcuts', 'width', 'open'];
  }

  private items: MenuItem[] = [];
  private activeSubmenu: string | null = null;

  protected initializeState(): void {
    this[ComponentState].set('open', false);
    this[ComponentState].set('position', { top: 0, left: 0 });
  }

  constructor(config?: MenuConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    
    if (config) {
      this.configure(config);
    }
  }

  configure(config: MenuConfig): void {
    if (config.items) {
      this.setItems(config.items);
    }
    
    Object.entries(config).forEach(([key, value]) => {
      if (key === 'onSelect') {
        this[ComponentState].set(key, value);
      } else if (key !== 'items') {
        const attrName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        this.setAttribute(attrName, String(value));
      }
    });
  }

  setItems(items: MenuItem[]): void {
    this.items = items.map((item, index) => ({
      ...item,
      id: item.id || `item-${index}`
    }));
    this.update();
  }

  protected render(): string {
    const open = this.getState('open', false);
    const showIcons = this.getProp('show-icons', true) ?? true;
    const showShortcuts = this.getProp('show-shortcuts', true) ?? true;
    const width = this.getProp('width');
    const position = this.getState('position', { top: 0, left: 0 }) ?? { top: 0, left: 0 };

    const style = `
      ${width ? `width: ${typeof width === 'number' ? width + 'px' : width};` : ''}
      top: ${(position?.top ?? 0)}px;
      left: ${(position?.left ?? 0)}px;
    `;

    return `
      <div class="nx-menu-container ${open ? 'open' : ''}" part="container">
        <slot name="trigger"></slot>
        <div class="nx-menu ${open ? 'open' : ''}" 
             part="menu"
             role="menu"
             style="${style}">
          ${this.renderItems(this.items, showIcons, showShortcuts)}
        </div>
      </div>
    `;
  }

  private renderItems(items: MenuItem[], showIcons: boolean, showShortcuts: boolean): string {
    return items.map(item => {
      if (item.divider) {
        return '<div class="nx-menu-divider" role="separator"></div>';
      }

      const hasSubmenu = item.submenu && item.submenu.length > 0;
      const isActive = this.activeSubmenu === item.id;

      return `
        <div class="nx-menu-item ${item.disabled ? 'disabled' : ''} ${hasSubmenu ? 'has-submenu' : ''}"
             role="menuitem"
             aria-disabled="${item.disabled}"
             ${hasSubmenu ? 'aria-haspopup="true" aria-expanded="' + isActive + '"' : ''}
             data-item-id="${item.id}"
             tabindex="${item.disabled ? -1 : 0}">
          ${showIcons ? `
            <span class="nx-menu-icon">
              ${item.icon ? this.renderIcon(item.icon) : ''}
              ${item.checked !== undefined ? this.renderCheckbox(item.checked) : ''}
            </span>
          ` : ''}
          <span class="nx-menu-text">${item.text}</span>
          ${showShortcuts && item.shortcut ? `
            <span class="nx-menu-shortcut">${item.shortcut}</span>
          ` : ''}
          ${hasSubmenu ? `
            <span class="nx-menu-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
            <div class="nx-submenu ${isActive ? 'open' : ''}">
              ${this.renderItems(item.submenu!, showIcons, showShortcuts)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
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

  private renderCheckbox(checked: boolean): string {
    if (!checked) return '';
    
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    `;
  }

  protected styles(): string {
    return `
      :host {
        --menu-bg: var(--color-surface);
        --menu-border: var(--color-border);
        --menu-shadow: var(--shadow-lg);
        --menu-radius: var(--radius-md);
        --item-height: 2rem;
        --item-padding: 0.5rem 1rem;
        --item-hover: var(--color-background);
        display: inline-block;
      }

      .nx-menu-container {
        position: relative;
      }

      .nx-menu {
        position: fixed;
        background: var(--menu-bg);
        border: 1px solid var(--menu-border);
        border-radius: var(--menu-radius);
        box-shadow: var(--menu-shadow);
        min-width: 180px;
        max-width: 320px;
        padding: 0.5rem 0;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-0.5rem);
        transition: all 0.2s;
        z-index: 1000;
      }

      .nx-menu.open {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      /* Menu items */
      .nx-menu-item {
        display: flex;
        align-items: center;
        min-height: var(--item-height);
        padding: var(--item-padding);
        cursor: pointer;
        transition: background-color 0.15s;
        position: relative;
        color: var(--color-text);
        text-decoration: none;
      }

      .nx-menu-item:hover:not(.disabled) {
        background: var(--item-hover);
      }

      .nx-menu-item:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
      }

      .nx-menu-item.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nx-menu-icon {
        width: 1.25rem;
        height: 1.25rem;
        margin-right: 0.75rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .nx-menu-icon:empty {
        visibility: hidden;
      }

      .nx-menu-icon svg {
        width: 100%;
        height: 100%;
      }

      .nx-menu-text {
        flex: 1;
        font-size: 0.875rem;
      }

      .nx-menu-shortcut {
        margin-left: 2rem;
        font-size: 0.75rem;
        color: var(--color-text-secondary);
      }

      .nx-menu-arrow {
        width: 1rem;
        height: 1rem;
        margin-left: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .nx-menu-arrow svg {
        width: 100%;
        height: 100%;
      }

      /* Divider */
      .nx-menu-divider {
        height: 1px;
        background: var(--menu-border);
        margin: 0.5rem 0;
      }

      /* Submenu */
      .nx-submenu {
        position: absolute;
        top: -0.5rem;
        left: 100%;
        background: var(--menu-bg);
        border: 1px solid var(--menu-border);
        border-radius: var(--menu-radius);
        box-shadow: var(--menu-shadow);
        min-width: 180px;
        padding: 0.5rem 0;
        opacity: 0;
        visibility: hidden;
        transform: translateX(-0.5rem);
        transition: all 0.2s;
      }

      .nx-submenu.open {
        opacity: 1;
        visibility: visible;
        transform: translateX(0.25rem);
      }

      /* Position adjustments */
      .nx-menu-item:hover > .nx-submenu {
        opacity: 1;
        visibility: visible;
        transform: translateX(0.25rem);
      }

      /* Mobile */
      @media (max-width: 640px) {
        .nx-menu {
          position: absolute;
          max-width: calc(100vw - 2rem);
        }
        
        .nx-submenu {
          position: static;
          margin-left: 1rem;
          margin-top: 0.25rem;
          transform: none;
        }
      }
    `;
  }

  protected afterRender(): void {
    const trigger = this.getProp('trigger', 'click');
    const closeOnClick = this.getProp('close-on-click', true);
    
    // Setup trigger
    const triggerEl = this.querySelector('[slot="trigger"]');
    if (triggerEl) {
      if (trigger === 'click') {
        triggerEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggle();
        });
      } else if (trigger === 'hover') {
        triggerEl.addEventListener('mouseenter', () => this.open());
        this.addEventListener('mouseleave', () => this.close());
      } else if (trigger === 'contextmenu') {
        triggerEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const mouseEvent = e as MouseEvent;
          this.openAt(mouseEvent.clientX, mouseEvent.clientY);
        });
      }
    }

    // Menu item clicks
    this.$$('.nx-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemId = (item as HTMLElement).dataset.itemId;
        const menuItem = this.findItem(itemId!);
        
        if (menuItem && !menuItem.disabled) {
          if (menuItem.handler) {
            menuItem.handler();
          }
          
          if (menuItem.href) {
            window.location.href = menuItem.href;
          }
          
          const onSelect = this.getState('onSelect');
          if (onSelect) onSelect(menuItem);
          
          this.dispatchEvent(new CustomEvent('select', { detail: { item: menuItem } }));
          
          if (closeOnClick && !menuItem.submenu) {
            this.close();
          }
        }
      });

      // Submenu handling
      if (item.classList.contains('has-submenu')) {
        item.addEventListener('mouseenter', () => {
          const itemId = (item as HTMLElement).dataset.itemId;
          this.activeSubmenu = itemId!;
          this.update();
        });
      }
    });

    // Close on outside click
    document.addEventListener('click', () => this.close());
    
    // Keyboard navigation
    this.setupKeyboardNavigation();
  }

  private setupKeyboardNavigation(): void {
    const menu = this.$('.nx-menu');
    if (!menu) return;

    menu.addEventListener('keydown', (e) => {
      const items = Array.from(this.$$('.nx-menu-item:not(.disabled)'));
      const currentIndex = items.findIndex(item => item === document.activeElement);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          (items[nextIndex] as HTMLElement).focus();
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          (items[prevIndex] as HTMLElement).focus();
          break;
          
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (currentIndex >= 0) {
            items[currentIndex].dispatchEvent(new Event('click'));
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          this.close();
          break;
      }
    });
  }

  private findItem(id: string): MenuItem | null {
    const search = (items: MenuItem[]): MenuItem | null => {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.submenu) {
          const found = search(item.submenu);
          if (found) return found;
        }
      }
      return null;
    };
    
    return search(this.items);
  }

  // Public API
  open(): void {
    this.setState('open', true);
    this.dispatchEvent(new CustomEvent('open'));
  }

  close(): void {
    this.setState('open', false);
    this.activeSubmenu = null;
    this.dispatchEvent(new CustomEvent('close'));
  }

  toggle(): void {
    if (this.getState('open')) {
      this.close();
    } else {
      this.open();
    }
  }

  openAt(x: number, y: number): void {
    this.setState('position', { top: y, left: x });
    this.open();
  }

  isOpen(): boolean {
    return this.getState('open', false) || false;
  }
}

customElements.define('nx-menu', NXMenu);
