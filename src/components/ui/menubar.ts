import { BaseComponent, ComponentState } from "@/components/abstracts/base";
import type { MenuItem, NXMenu } from "@/components/ui/menu";

export interface MenuBarItem extends MenuItem {
  menu?: MenuItem[];
}

export interface MenuBarConfig {
  items?: MenuBarItem[];
  variant?: 'default' | 'minimal' | 'rounded';
  onSelect?: (item: MenuItem) => void;
}

/**
 * Horizontal menu bar component
 */
export class NXMenuBar extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['variant'];
  }

  private items: MenuBarItem[] = [];
  private activeMenu: string | null = null;

  protected initializeState(): void {
    this[ComponentState].set('activeMenu', null);
  }

  constructor(config?: MenuBarConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    
    if (config) {
      this.configure(config);
    }
  }

  configure(config: MenuBarConfig): void {
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

  setItems(items: MenuBarItem[]): void {
    this.items = items.map((item, index) => ({
      ...item,
      id: item.id || `menu-${index}`
    }));
    this.update();
  }

  protected render(): string {
    const variant = this.getProp('variant', 'default');
    const activeMenu = this.getState('activeMenu');

    return `
      <nav class="nx-menubar nx-menubar-${variant}" 
           part="menubar"
           role="menubar">
        ${this.items.map(item => {
          const hasMenu = item.menu && item.menu.length > 0;
          const isActive = activeMenu === item.id;

          return `
            <div class="nx-menubar-item ${item.disabled ? 'disabled' : ''} ${isActive ? 'active' : ''}"
                 part="item">
              <button class="nx-menubar-button"
                      role="menuitem"
                      aria-haspopup="${hasMenu}"
                      aria-expanded="${isActive}"
                      ${item.disabled ? 'disabled' : ''}
                      data-item-id="${item.id}">
                ${item.icon ? `
                  <span class="nx-menubar-icon">${this.renderIcon(item.icon)}</span>
                ` : ''}
                <span class="nx-menubar-text">${item.text}</span>
              </button>
              ${hasMenu ? `
                <nx-menu class="nx-menubar-menu ${isActive ? 'open' : ''}">
                  <div slot="trigger"></div>
                </nx-menu>
              ` : ''}
            </div>
          `;
        }).join('')}
      </nav>
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

  protected styles(): string {
    return `
      :host {
        --menubar-height: 2.5rem;
        --menubar-bg: var(--color-surface);
        --menubar-border: var(--color-border);
        --button-hover: var(--color-background);
        --button-active: var(--color-primary);
        display: block;
      }

      .nx-menubar {
        display: flex;
        align-items: center;
        height: var(--menubar-height);
        background: var(--menubar-bg);
        border-bottom: 1px solid var(--menubar-border);
      }

      /* Variants */
      .nx-menubar-minimal {
        background: transparent;
        border-bottom: none;
      }

      .nx-menubar-rounded {
        border-radius: var(--radius-lg);
        border: 1px solid var(--menubar-border);
        overflow: hidden;
      }

      /* Items */
      .nx-menubar-item {
        position: relative;
        height: 100%;
      }

      .nx-menubar-button {
        height: 100%;
        padding: 0 1rem;
        background: none;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        font-family: inherit;
        color: var(--color-text);
        transition: all 0.2s;
        position: relative;
      }

      .nx-menubar-button:hover:not(:disabled) {
        background: var(--button-hover);
      }

      .nx-menubar-item.active .nx-menubar-button {
        background: var(--button-hover);
      }

      .nx-menubar-button:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
      }

      .nx-menubar-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nx-menubar-icon {
        width: 1.25rem;
        height: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .nx-menubar-text {
        white-space: nowrap;
      }

      /* Menu positioning */
      .nx-menubar-menu {
        position: absolute;
        top: 100%;
        left: 0;
        display: none;
      }

      .nx-menubar-menu.open {
        display: block;
      }
    `;
  }

  protected afterRender(): void {
    // Button clicks
    this.$$('.nx-menubar-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemId = (button as HTMLElement).dataset.itemId;
        const item = this.items.find(i => i.id === itemId);
        
        if (item && !item.disabled) {
          if (item.menu) {
            this.toggleMenu(itemId!);
          } else {
            if (item.handler) {
              item.handler();
            }
            
            const onSelect = this.getState('onSelect');
            if (onSelect) onSelect(item);
            
            this.dispatchEvent(new CustomEvent('select', { detail: { item } }));
          }
        }
      });
    });

    // Setup menus
    this.items.forEach(item => {
      if (item.menu) {
        const menu = this.$(`.nx-menubar-item nx-menu`) as NXMenu;
        if (menu) {
          menu.setItems(item.menu);
          menu.addEventListener('select', (e: any) => {
            this.closeAllMenus();
            
            const onSelect = this.getState('onSelect');
            if (onSelect) onSelect(e.detail.item);
            
            this.dispatchEvent(new CustomEvent('select', { 
              detail: { item: e.detail.item, parent: item } 
            }));
          });
        }
      }
    });

    // Close menus on outside click
    document.addEventListener('click', () => this.closeAllMenus());

    // Keyboard navigation
    this.setupKeyboardNavigation();
  }

  private setupKeyboardNavigation(): void {
    const buttons = this.$$('.nx-menubar-button');
    
    buttons.forEach((button, index) => {
      button.addEventListener('keydown', (e) => {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            const prevIndex = index > 0 ? index - 1 : buttons.length - 1;
            (buttons[prevIndex] as HTMLElement).focus();
            break;
            
          case 'ArrowRight':
            e.preventDefault();
            const nextIndex = index < buttons.length - 1 ? index + 1 : 0;
            (buttons[nextIndex] as HTMLElement).focus();
            break;
            
          case 'ArrowDown':
            e.preventDefault();
            const itemId = (button as HTMLElement).dataset.itemId;
            const item = this.items.find(i => i.id === itemId);
            if (item?.menu) {
              this.openMenu(itemId!);
              // Focus first menu item
              setTimeout(() => {
                const menu = this.$(`.nx-menubar-menu.open .nx-menu`);
                const firstItem = menu?.querySelector('.nx-menu-item:not(.disabled)') as HTMLElement;
                firstItem?.focus();
              }, 100);
            }
            break;
            
          case 'Escape':
            e.preventDefault();
            this.closeAllMenus();
            break;
        }
      });
    });
  }

  private toggleMenu(itemId: string): void {
    const currentActive = this.getState('activeMenu');
    
    if (currentActive === itemId) {
      this.closeAllMenus();
    } else {
      this.openMenu(itemId);
    }
  }

  private openMenu(itemId: string): void {
    this.setState('activeMenu', itemId);
    
    // Open the corresponding menu
    const menuEl = this.$(`.nx-menubar-item nx-menu`) as NXMenu;
    if (menuEl) {
      menuEl.open();
    }
  }

  private closeAllMenus(): void {
    this.setState('activeMenu', null);
    
    // Close all menus
    this.$$('nx-menu').forEach(menu => {
      (menu as NXMenu).close();
    });
  }

  // Public API
  getItems(): MenuBarItem[] {
    return [...this.items];
  }

  setActiveItem(itemId: string): void {
    const item = this.items.find(i => i.id === itemId);
    if (item && item.menu) {
      this.openMenu(itemId);
    }
  }
}

customElements.define('nx-menubar', NXMenuBar);
