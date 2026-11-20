import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';

export interface PageHeaderConfig {
  /** The page's title (the page's `<h1>`) */
  title?: string;
  /** One line under the title */
  description?: string;
  /** Heading level of the title (default 1) */
  level?: 1 | 2 | 3 | 4;
}

/**
 * The top of an admin page: breadcrumb, title with status badges, a description, actions on the end,
 * and tabs or filters underneath. Content goes in slots: `breadcrumb`, `meta`, `actions`, `footer`.
 *
 * ```tsx
 * <PageHeader title="Orders" description="Everything customers bought this week.">
 *   <Breadcrumb slot="breadcrumb" items={[…]} />
 *   <Badge slot="meta" variant="success">Live</Badge>
 *   <Button slot="actions">New order</Button>
 * </PageHeader>
 * ```
 */
export class NXPageHeader extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['title', 'description', 'level'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  protected render(): Node {
    const level = Math.min(4, Math.max(1, Number(this.getProp('level', 1)) || 1));
    const title = this.getProp<string>('title', '');
    const description = this.getProp<string>('description', '');
    const heading = title ? (level === 1 ? <h1 class="title" part="title">{title}</h1> : level === 2 ? <h2 class="title" part="title">{title}</h2> : level === 3 ? <h3 class="title" part="title">{title}</h3> : <h4 class="title" part="title">{title}</h4>) : null;
    return (
      <header class="header" part="header">
        <div class="crumbs"><slot name="breadcrumb" /></div>
        <div class="row">
          <div class="main">
            <div class="titleline">
              {heading}
              <slot name="meta" />
            </div>
            {description && <p class="description" part="description">{description}</p>}
            <slot name="description" />
          </div>
          <div class="actions" part="actions"><slot name="actions" /></div>
        </div>
        <div class="footer"><slot name="footer" /></div>
      </header>
    );
  }

  protected styles(): string {
    return `
      :host { display: block; }
      .header { display: flex; flex-direction: column; gap: 0.75rem; }
      .crumbs:not(:has(::slotted(*))) { display: none; }
      .row { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 0.75rem 1.5rem; }
      .main { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; flex: 1 1 16rem; }
      .titleline { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; }
      .title { margin: 0; font-size: 1.5rem; font-weight: 600; line-height: 1.2; letter-spacing: -0.01em; overflow-wrap: anywhere; }
      .description { margin: 0; color: var(--color-text-secondary); font-size: 0.875rem; max-width: 65ch; }
      .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
    `;
  }
}

define('nx-page-header', NXPageHeader);
