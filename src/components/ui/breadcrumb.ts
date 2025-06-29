import { BaseComponent, ComponentState } from "@/components/abstracts/base";

export interface BreadcrumbItem {
  text: string;
  href?: string;
  icon?: string;
  active?: boolean;
  handler?: () => void;
}

export interface BreadcrumbConfig {
  items?: BreadcrumbItem[];
  separator?: string;
  maxItems?: number;
  onNavigate?: (item: BreadcrumbItem, index: number) => void;
}

/**
 * Breadcrumb navigation component
 */
export class NXBreadcrumb extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['separator', 'max-items'];
  }

  private items: BreadcrumbItem[] = [];

  constructor(config?: BreadcrumbConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    
    if (config) {
      this.configure(config);
    }
  }

  configure(config: BreadcrumbConfig): void {
    if (config.items) {
      this.setItems(config.items);
    }
    
    Object.entries(config).forEach(([key, value]) => {
      if (key === 'onNavigate') {
        this[ComponentState].set(key, value);
      } else if (key !== 'items') {
        const attrName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        this.setAttribute(attrName, String(value));
      }
    });
  }

  setItems(items: BreadcrumbItem[]): void {
    this.items = items;
    this.update();
  }

  protected render(): string {
    const separator = this.getProp('separator', '/');
    const maxItems = parseInt(this.getProp('max-items', '0') || '0');
    
    let displayItems = [...this.items];
    let collapsed = false;

    if (maxItems > 0 && this.items.length > maxItems) {
      const firstItems = this.items.slice(0, Math.floor(maxItems / 2));
      const lastItems = this.items.slice(-(Math.ceil(maxItems / 2) - 1));
      displayItems = [...firstItems, { text: '...', active: false }, ...lastItems];
      collapsed = true;
    }

    return `
      <nav class="nx-breadcrumb" part="nav" aria-label="Breadcrumb">
        <ol class="nx-breadcrumb-list" part="list">
          ${displayItems.map((item, index) => {
            const isLast = index === displayItems.length - 1;
            const isEllipsis = item.text === '...';
            const originalIndex = collapsed && index > Math.floor(maxItems / 2) ? 
              this.items.length - (displayItems.length - index) : 
              index;

            return `
              <li class="nx-breadcrumb-item ${isLast || item.active ? 'active' : ''}"
                  part="item">
                ${isEllipsis ? `
                  <button class="nx-breadcrumb-ellipsis" 
                          aria-label="Show all items"
                          type="button">
                    ⋯
                  </button>
                ` : `
                  ${item.href && !isLast ? `
                    <a href="${item.href}" 
                       class="nx-breadcrumb-link"
                       data-index="${originalIndex}">
                      ${item.icon ? `<span class="nx-breadcrumb-icon">${this.renderIcon(item.icon)}</span>` : ''}
                      <span>${item.text}</span>
                    </a>
                  ` : `
                    <span class="nx-breadcrumb-text" 
                          ${!isLast ? `role="button" tabindex="0" data-index="${originalIndex}"` : ''}>
                      ${item.icon ? `<span class="nx-breadcrumb-icon">${this.renderIcon(item.icon)}</span>` : ''}
                      <span>${item.text}</span>
                    </span>
                  `}
                `}
                ${!isLast ? `
                  <span class="nx-breadcrumb-separator" aria-hidden="true">
                    ${separator}
                  </span>
                ` : ''}
              </li>
            `;
          }).join('')}
        </ol>
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
        --breadcrumb-gap: 0.5rem;
        --breadcrumb-color: var(--color-text-secondary);
        --breadcrumb-hover: var(--color-primary);
        --breadcrumb-active: var(--color-text);
        --breadcrumb-separator: var(--color-text-secondary);
        display: block;
      }

      .nx-breadcrumb {
        font-size: 0.875rem;
      }

      .nx-breadcrumb-list {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--breadcrumb-gap);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .nx-breadcrumb-item {
        display: flex;
        align-items: center;
        gap: var(--breadcrumb-gap);
        color: var(--breadcrumb-color);
      }

      .nx-breadcrumb-item.active {
        color: var(--breadcrumb-active);
      }

      .nx-breadcrumb-link,
      .nx-breadcrumb-text[role="button"] {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        color: inherit;
        text-decoration: none;
        transition: color 0.2s;
        cursor: pointer;
      }

      .nx-breadcrumb-link:hover,
      .nx-breadcrumb-text[role="button"]:hover {
        color: var(--breadcrumb-hover);
      }

      .nx-breadcrumb-link:focus,
      .nx-breadcrumb-text[role="button"]:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
        border-radius: var(--radius-sm);
      }

      .nx-breadcrumb-text:not([role="button"]) {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .nx-breadcrumb-icon {
        width: 1rem;
        height: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .nx-breadcrumb-separator {
        color: var(--breadcrumb-separator);
        user-select: none;
      }

      .nx-breadcrumb-ellipsis {
        background: none;
        border: none;
        color: var(--breadcrumb-color);
        cursor: pointer;
        padding: 0.25rem;
        font-size: 1.25rem;
        line-height: 1;
        transition: color 0.2s;
      }

      .nx-breadcrumb-ellipsis:hover {
        color: var(--breadcrumb-hover);
      }

      .nx-breadcrumb-ellipsis:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
        border-radius: var(--radius-sm);
      }

      /* Mobile */
      @media (max-width: 640px) {
        .nx-breadcrumb {
          font-size: 0.8125rem;
        }

        .nx-breadcrumb-list {
          gap: 0.375rem;
        }
      }
    `;
  }

  protected afterRender(): void {
    // Link clicks
    this.$$('.nx-breadcrumb-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const index = parseInt((link as HTMLElement).dataset.index!);
        const item = this.items[index];
        
        if (item.handler) {
          e.preventDefault();
          item.handler();
        }
        
        const onNavigate = this.getState('onNavigate');
        if (onNavigate) {
          e.preventDefault();
          onNavigate(item, index);
        }
        
        this.dispatchEvent(new CustomEvent('navigate', { 
          detail: { item, index } 
        }));
      });
    });

    // Text clicks (non-link items)
    this.$$('.nx-breadcrumb-text[role="button"]').forEach(text => {
      text.addEventListener('click', () => {
        const index = parseInt((text as HTMLElement).dataset.index!);
        const item = this.items[index];
        
        if (item.handler) {
          item.handler();
        }
        
        const onNavigate = this.getState('onNavigate');
        if (onNavigate) {
          onNavigate(item, index);
        }
        
        this.dispatchEvent(new CustomEvent('navigate', { 
          detail: { item, index } 
        }));
      });
    });

    // Ellipsis click
    this.on('.nx-breadcrumb-ellipsis', 'click', () => {
      this.removeAttribute('max-items');
      this.dispatchEvent(new CustomEvent('expand'));
    });
  }

  // Public API
  addItem(item: BreadcrumbItem): void {
    this.items.push(item);
    this.update();
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
    this.update();
  }

  clear(): void {
    this.items = [];
    this.update();
  }

  getItems(): BreadcrumbItem[] {
    return [...this.items];
  }
}

customElements.define('nx-breadcrumb', NXBreadcrumb);
