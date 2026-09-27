import { BaseComponent, ComponentState } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import type { MenuItem } from '@/components/ui/menu';

export interface MenuBarConfig {
  items?: MenuItem[];
}

export class NXMenuBar extends BaseComponent {
  static get observedAttributes(): string[] {
    return [];
  }

  protected initializeState(): void {
    this[ComponentState].set('items', []);
    this[ComponentState].set('activeMenu', null);
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
    const activeMenu = this.getState('activeMenu');

    return `
      <nav class="nx-menubar" part="container" role="menubar">
        ${items.map((item, index) => {
          const itemId = item.id || String(index);
          const isActive = activeMenu === itemId;
          const hasSubmenu = item.submenu && item.submenu.length > 0;

          return `
            <div class="nx-menubar-item ${item.disabled ? 'disabled' : ''} ${isActive ? 'active' : ''}"
                 part="item"
                 role="menuitem"
                 data-item-id="${itemId}"
                 ${item.disabled ? 'aria-disabled="true"' : ''}
                 tabindex="${item.disabled ? -1 : 0}">
              ${item.icon ? `<span class="nx-menubar-icon" part="icon">${item.icon}</span>` : ''}
              <span class="nx-menubar-text" part="text">${item.text}</span>
              ${hasSubmenu ? `
                <div class="nx-menubar-dropdown ${isActive ? 'open' : ''}" part="dropdown">
                  ${this.renderSubmenu(item.submenu!)}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </nav>
    `;
  }

  private renderSubmenu(items: MenuItem[]): string {
    return `
      <div class="nx-menubar-submenu" role="menu">
        ${items.map((item, index) => {
          if (item.divider) {
            return '<div class="nx-menubar-divider" role="separator"></div>';
          }

          return `
            <div class="nx-menubar-submenu-item ${item.disabled ? 'disabled' : ''}"
                 role="menuitem"
                 data-item-id="${item.id || index}"
                 ${item.disabled ? 'aria-disabled="true"' : ''}
                 tabindex="${item.disabled ? -1 : 0}">
              ${item.icon ? `<span class="nx-menubar-submenu-icon">${item.icon}</span>` : ''}
              <span class="nx-menubar-submenu-text">${item.text}</span>
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

      .nx-menubar {
        display: flex;
        align-items: center;
        background: var(--surface-color);
        border-bottom: 1px solid var(--border-color);
      }

      .nx-menubar-item {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .nx-menubar-item:hover:not(.disabled),
      .nx-menubar-item.active {
        background: var(--hover-bg);
      }

      .nx-menubar-item.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nx-menubar-icon {
        width: 1.25rem;
        height: 1.25rem;
      }

      .nx-menubar-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        min-width: 200px;
        background: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 0 0 0.25rem 0.25rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        opacity: 0;
        visibility: hidden;
        transform: translateY(-0.5rem);
        transition: all 0.2s;
      }

      .nx-menubar-dropdown.open {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      .nx-menubar-submenu {
        padding: 0.25rem;
      }

      .nx-menubar-submenu-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        border-radius: 0.25rem;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .nx-menubar-submenu-item:hover:not(.disabled) {
        background: var(--hover-bg);
      }

      .nx-menubar-submenu-item.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nx-menubar-submenu-icon {
        width: 1.25rem;
        height: 1.25rem;
      }

      .nx-menubar-divider {
        height: 1px;
        background: var(--border-color);
        margin: 0.25rem 0;
      }
    `;
  }

  protected afterRender(): void {
    // Menu bar items
    this.$$('.nx-menubar-item:not(.disabled)').forEach(item => {
      this.on(item, 'click', (e: Event) => {
        const itemEl = e.currentTarget as HTMLElement;
        const itemId = itemEl.dataset.itemId;
        const activeMenu = this.getState('activeMenu');

        if (activeMenu === itemId) {
          this.closeMenu();
        } else {
          this.openMenu(itemId!);
        }
      });

      this.on(item, 'keydown', (e: Event) => {
        this.handleKeyboard(e as KeyboardEvent);
      });
    });

    // Submenu items
    this.$$('.nx-menubar-submenu-item:not(.disabled)').forEach(item => {
      this.on(item, 'click', (e: Event) => {
        e.stopPropagation();
        const itemEl = e.currentTarget as HTMLElement;
        const itemId = itemEl.dataset.itemId;
        const menuItem = this.findMenuItem(itemId!);

        if (menuItem) {
          menuItem.action?.();
          this.closeMenu();
          this.emit('select', { item: menuItem });
        }
      });
    });

    // Close on outside click
    this.on(document, 'click', (e: Event) => {
      if (!this.contains(e.target as Node)) {
        this.closeMenu();
      }
    });
  }

  private handleKeyboard(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    const isMenuItem = target.classList.contains('nx-menubar-item');

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isMenuItem) {
          target.click();
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.closeMenu();
        if (isMenuItem) {
          target.focus();
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (isMenuItem) {
          this.focusNextItem(target);
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (isMenuItem) {
          this.focusPreviousItem(target);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (isMenuItem) {
          const itemId = target.dataset.itemId;
          this.openMenu(itemId!);
          this.focusFirstSubmenuItem();
        }
        break;
    }
  }

  private focusNextItem(current: HTMLElement): void {
    const items = Array.from(this.$$('.nx-menubar-item:not(.disabled)'));
    const index = items.indexOf(current);
    const next = items[index + 1] || items[0];
    (next as HTMLElement).focus();
  }

  private focusPreviousItem(current: HTMLElement): void {
    const items = Array.from(this.$$('.nx-menubar-item:not(.disabled)'));
    const index = items.indexOf(current);
    const prev = items[index - 1] || items[items.length - 1];
    (prev as HTMLElement).focus();
  }

  private focusFirstSubmenuItem(): void {
    const activeMenu = this.getState('activeMenu');
    const submenuItem = this.$(`.nx-menubar-item[data-item-id="${activeMenu}"] .nx-menubar-submenu-item:not(.disabled)`);
    (submenuItem as HTMLElement)?.focus();
  }

  private openMenu(itemId: string): void {
    this.setState('activeMenu', itemId);
  }

  private closeMenu(): void {
    this.setState('activeMenu', null);
  }

  private findMenuItem(id: string): MenuItem | null {
    const items = this.getState<MenuItem[]>('items', []);
    
    for (const item of items) {
      if (item.submenu) {
        const found = item.submenu.find(sub => 
          (sub.id || item.submenu!.indexOf(sub).toString()) === id
        );
        if (found) return found;
      }
    }
    
    return null;
  }
}

define('nx-menubar', NXMenuBar);