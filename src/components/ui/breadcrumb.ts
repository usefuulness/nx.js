import { BaseComponent, ComponentState } from '@/components/abstracts/base';
import { define } from '@/core/registry';

export interface BreadcrumbItem {
  text: string;
  href?: string;
  icon?: string;
}

export interface BreadcrumbConfig {
  items?: BreadcrumbItem[];
  separator?: string;
}

export class NXBreadcrumb extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['separator'];
  }

  protected initializeState(): void {
    this[ComponentState].set('items', []);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setItems(items: BreadcrumbItem[]): void {
    this.setState('items', items);
  }

  protected render(): string {
    const items = this.getState<BreadcrumbItem[]>('items', []);
    const separator = this.getProp('separator', '/');

    return `
      <nav class="nx-breadcrumb" part="container" aria-label="Breadcrumb">
        <ol class="nx-breadcrumb-list" part="list">
          ${items.map((item, index) => `
            <li class="nx-breadcrumb-item" part="item">
              ${item.href ? `
                <a href="${item.href}" class="nx-breadcrumb-link" part="link">
                  ${item.icon ? `<span class="nx-breadcrumb-icon">${item.icon}</span>` : ''}
                  ${item.text}
                </a>
              ` : `
                <span class="nx-breadcrumb-text" part="text">
                  ${item.icon ? `<span class="nx-breadcrumb-icon">${item.icon}</span>` : ''}
                  ${item.text}
                </span>
              `}
              ${index < items.length - 1 ? `
                <span class="nx-breadcrumb-separator" part="separator" aria-hidden="true">
                  ${separator}
                </span>
              ` : ''}
            </li>
          `).join('')}
        </ol>
      </nav>
    `;
  }

  protected styles(): string {
    return `
      :host {
        display: block;
      }

      .nx-breadcrumb-list {
        display: flex;
        align-items: center;
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .nx-breadcrumb-item {
        display: flex;
        align-items: center;
      }

      .nx-breadcrumb-link {
        color: var(--color-primary);
        text-decoration: none;
        transition: color 0.2s;
      }

      .nx-breadcrumb-link:hover {
        color: var(--color-primary-dark);
        text-decoration: underline;
      }

      .nx-breadcrumb-text {
        color: var(--text-color);
      }

      .nx-breadcrumb-separator {
        margin: 0 0.5rem;
        color: var(--text-color-secondary);
      }
    `;
  }

  protected afterRender(): void {
    // Add click handler for navigation
    const links = this.shadowRoot?.querySelectorAll('.nx-breadcrumb-link');
    if (links) {
      links.forEach(link => {
        this.on(link, 'click', (e: Event) => {
          const anchor = e.target as HTMLAnchorElement;
          const href = anchor.getAttribute('href');
          if (href) {
            e.preventDefault();
            this.emit('navigate', { href });
          }
        });
      });
    }
  }
}

define('nx-breadcrumb', NXBreadcrumb);
