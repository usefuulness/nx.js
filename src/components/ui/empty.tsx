import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';

export interface EmptyConfig {
  /** Icon above the title */
  icon?: string;
  /** What is missing ("No orders yet") */
  title?: string;
  /** What to do about it */
  description?: string;
}

/**
 * Empty state: an icon, what is missing, what to do next, and the actions for it (in the default slot).
 *
 * ```tsx
 * <Empty icon="inbox" title="No orders yet" description="Orders appear here as soon as a customer checks out."><Button>Create order</Button></Empty>
 * ```
 */
export class NXEmpty extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['icon', 'title', 'description'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  protected render(): Node {
    const icon = this.getProp<string>('icon');
    const title = this.getProp<string>('title');
    const description = this.getProp<string>('description');
    return (
      <div class="empty" part="empty">
        {icon && <div class="icon" part="icon" aria-hidden="true" html={Icons.get(icon) || undefined}>{Icons.get(icon) ? undefined : icon}</div>}
        {title && <div class="title" part="title">{title}</div>}
        {description && <p class="description" part="description">{description}</p>}
        <div class="actions"><slot /></div>
      </div>
    );
  }

  protected styles(): string {
    return `
      :host { display: block; }
      .empty { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 2.5rem 1rem; text-align: center; }
      .icon { display: inline-flex; align-items: center; justify-content: center; width: 3rem; height: 3rem; font-size: 1.5rem; border-radius: 9999px; background: var(--color-accent); color: var(--color-text-secondary); }
      .title { font-weight: 600; font-size: 1rem; }
      .description { margin: 0; max-width: 40ch; color: var(--color-text-secondary); font-size: 0.875rem; }
      .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; margin-top: 0.5rem; }
      .actions:not(:has(::slotted(*))) { display: none; }
    `;
  }
}

define('nx-empty', NXEmpty);
