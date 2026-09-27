/**
 * @file @/components/ui/breadcrumb.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';

export interface BreadcrumbItem {
  text: string;
  href?: string;
  icon?: string;
}

export interface BreadcrumbConfig {
  items?: BreadcrumbItem[];
  /** Separator text, or an icon name (default: chevron-right) */
  separator?: string;
}

/**
 * Breadcrumb trail. The last item is the current page.
 *
 * ```tsx
 * <Breadcrumb items={[{ text: 'Home', href: '#/' }, { text: 'Users', href: '#/users' }, { text: 'Ada' }]} />
 * ```
 *
 * Links navigate normally. To route them yourself, listen to `navigate`
 * (detail: `{ href, item }`) and call `preventDefault()` on the event.
 */
export class NXBreadcrumb extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['separator'];
  }

  private items: BreadcrumbItem[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  setItems(items: BreadcrumbItem[]): void {
    this.items = items;
    this.scheduleUpdate();
  }

  private navigate(e: MouseEvent, item: BreadcrumbItem): void {
    const event = new CustomEvent('navigate', { detail: { href: item.href, item }, bubbles: true, composed: true, cancelable: true });
    if (!this.dispatchEvent(event)) e.preventDefault();
  }

  protected render(): Node {
    const separator = this.getProp<string>('separator', 'chevron-right');
    const sep = Icons.has(separator) ? <span class="sep" part="separator" aria-hidden="true" html={Icons.get(separator)} />
      : <span class="sep" part="separator" aria-hidden="true">{separator}</span>;

    return (
      <nav part="container" aria-label="Breadcrumb">
        <ol part="list">
          {this.items.map((item, i) => {
            const last = i === this.items.length - 1;
            const content = [item.icon && <span class="icon" html={Icons.get(item.icon)} />, item.text];
            return (
              <li part="item">
                {item.href && !last
                  ? <a part="link" href={item.href} onClick={(e: MouseEvent) => this.navigate(e, item)}>{content}</a>
                  : <span part="text" class={{ current: last }} aria-current={last ? 'page' : undefined}>{content}</span>}
                {!last && sep.cloneNode(true)}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  protected styles(): string {
    return `
      :host { display: block; font-size: 0.875rem; }

      ol {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.375rem;
        margin: 0;
        padding: 0;
        list-style: none;
        color: var(--color-text-secondary);
      }

      li { display: inline-flex; align-items: center; gap: 0.375rem; }

      a, span[part="text"] { display: inline-flex; align-items: center; gap: 0.375rem; }

      a {
        color: inherit;
        text-decoration: none;
        border-radius: var(--radius-sm);
        transition: color var(--transition-duration);
      }

      a:hover { color: var(--color-text); }
      .current { color: var(--color-text); font-weight: 500; }
      .icon, .sep { display: inline-flex; font-size: 0.875rem; }
    `;
  }
}

define('nx-breadcrumb', NXBreadcrumb);
