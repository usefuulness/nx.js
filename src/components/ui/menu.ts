import { BaseComponent, ComponentState } from '@/components/abstracts/base';
import { define } from '@/core/registry';

export interface MenuItem {
  id?: string;
  text: string;
  icon?: string;
  disabled?: boolean;
  divider?: boolean;
  submenu?: MenuItem[];
  action?: () => void;
}

export interface MenuConfig {
  items?: MenuItem[];
  trigger?: 'click' | 'hover';
}

export class NXMenu extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['trigger'];
  }

  protected initializeState(): void {
    this[ComponentState].set('items', []);
    this[ComponentState].set('open', false);
    this[ComponentState].set('activeSubmenu', null);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setItems(items: MenuItem[]): void {
    this.setState('items', items);
  }

  protected render(): string {
    const items = this.getState<MenuItem[]>('items', []);
    const open = this.getState('open', false);

    return `
      <div class="nx-menu ${open ? 'open' : ''}" part="container">
        <slot name="trigger"></slot>
        <div class="nx-menu-dropdown" part="dropdown" role="menu">
          ${this.renderMenuItems(items)}
        </div>
      </div>
    `;
  }

  private renderMenuItems(items: MenuItem[]): string {
    return items.map((item, index) => {
      if (item.divider) {
        return '<div class="nx-menu-divider" part="divider" role="separator"></div>';
      }

      const hasSubmenu = item.submenu && item.submenu.length > 0;
      const isActive = this.getState('activeSubmenu') === item.id;

      return `
        <div class="nx-menu-item ${item.disabled ? 'disabled' : ''} ${hasSubmenu ? 'has-submenu' : ''}"
             part="item"
             role="menuitem"
             data-item-id="${item.id || index}"
             ${item.disabled ? 'aria-disabled="true"' : ''}
             tabindex="${item.disabled ? -1 : 0}">
          ${item.icon ? `<span class="nx-menu-icon" part="icon">${item.icon}</span>` : ''}
          <span class="nx-menu-text" part="text">${item.text}</span>
          ${hasSubmenu ? `
            <svg class="nx-menu-submenu-icon" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7"/>
            </svg>
            <div class="nx-menu-submenu ${isActive ? 'active' : ''}" part="submenu">
              ${this.renderMenuItems(item.submenu!)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  protected styles(): string {
    return `
      :host {
        display: inline-block;
        position: relative;
      }

      .nx-menu {
        position: relative;
      }

      .nx-menu-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        min-width: 200px;
        background: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 0.25rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        padding: 0.25rem;
        z-index: 1000;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-0.5rem);
        transition: all 0.2s;
      }

      .nx-menu.open .nx-menu-dropdown {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      .nx-menu-item {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        border-radius: 0.25rem;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .nx-menu-item:hover:not(.disabled) {
        background: var(--hover-bg);
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
        flex-shrink: 0;
        width: 1.25rem;
        height: 1.25rem;
      }

      .nx-menu-text {
        flex: 1;
      }

      .nx-menu-divider {
        height: 1px;
        background: var(--border-color);
        margin: 0.25rem 0;
      }

      .nx-menu-submenu-icon {
        width: 1rem;
        height: 1rem;
        fill: currentColor;
        margin-left: auto;
      }

      .nx-menu-submenu {
        position: absolute;
        top: 0;
        left: 100%;
        min-width: 200px;
        background: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 0.25rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        padding: 0.25rem;
        margin-left: 0.25rem;
        opacity: 0;
        visibility: hidden;
        transform: translateX(-0.5rem);
        transition: all 0.2s;
      }

      .nx-menu-item:hover .nx-menu-submenu,
      .nx-menu-submenu.active {
        opacity: 1;
        visibility: visible;
        transform: translateX(0);
      }
    `;
  }

  protected afterRender(): void {
    const trigger = this.getProp('trigger', 'click');
    
    // Trigger handling
    const triggerSlot = this.$('slot[name="trigger"]') as HTMLSlotElement;
    const triggerElements = triggerSlot?.assignedElements() || [];
    
    triggerElements.forEach(el => {
      if (trigger === 'click') {
        this.on(el, 'click', () => this.toggle());
      } else {
        this.on(el, 'mouseenter', () => this.open());
        this.on(el, 'mouseleave', () => this.close());
      }
    });

    // Menu items
    this.$$('.nx-menu-item:not(.disabled)').forEach(item => {
      this.on(item, 'click', (e: Event) => {
        const itemEl = e.currentTarget as HTMLElement;
        const itemId = itemEl.dataset.itemId;
        const menuItem = this.findMenuItem(itemId!);
        
        if (menuItem && !menuItem.submenu) {
          menuItem.action?.();
          this.close();
          this.emit('select', { item: menuItem });
        }
      });

      this.on(item, 'keydown', (e: Event) => {
        this.handleKeyboard(e as KeyboardEvent);
      });
    });

    // Close on outside click
    this.on(document, 'click', (e: Event) => {
      if (!this.contains(e.target as Node)) {
        this.close();
      }
    });
  }

  private handleKeyboard(e: KeyboardEvent): void {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        (e.target as HTMLElement).click();
        break;

      case 'Escape':
        e.preventDefault();
        this.close();
        break;

      case 'ArrowDown':
        e.preventDefault();
        this.focusNext(e.target as HTMLElement);
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.focusPrevious(e.target as HTMLElement);
        break;

      case 'ArrowRight':
        e.preventDefault();
        this.openSubmenu(e.target as HTMLElement);
        break;

      case 'ArrowLeft':
        e.preventDefault();
        this.closeSubmenu();
        break;
    }
  }

  private focusNext(current: HTMLElement): void {
    const items = Array.from(this.$$('.nx-menu-item:not(.disabled)'));
    const index = items.indexOf(current);
    const next = items[index + 1] || items[0];
    (next as HTMLElement).focus();
  }

  private focusPrevious(current: HTMLElement): void {
    const items = Array.from(this.$$('.nx-menu-item:not(.disabled)'));
    const index = items.indexOf(current);
    const prev = items[index - 1] || items[items.length - 1];
    (prev as HTMLElement).focus();
  }

  private openSubmenu(item: HTMLElement): void {
    const itemId = item.dataset.itemId;
    const menuItem = this.findMenuItem(itemId!);
    if (menuItem?.submenu) {
      this.setState('activeSubmenu', itemId);
    }
  }

  private closeSubmenu(): void {
    this.setState('activeSubmenu', null);
  }

  private findMenuItem(id: string): MenuItem | null {
    const items = this.getState<MenuItem[]>('items', []);
    
    const find = (items: MenuItem[]): MenuItem | null => {
      for (const item of items) {
        if ((item.id || items.indexOf(item).toString()) === id) {
          return item;
        }
        if (item.submenu) {
          const found = find(item.submenu);
          if (found) return found;
        }
      }
      return null;
    };
    
    return find(items);
  }

  open(): void {
    this.setState('open', true);
    this.emit('open');
  }

  close(): void {
    this.setState('open', false);
    this.setState('activeSubmenu', null);
    this.emit('close');
  }

  toggle(): void {
    if (this.getState('open', false)) {
      this.close();
    } else {
      this.open();
    }
  }
}

define('nx-menu', NXMenu);
