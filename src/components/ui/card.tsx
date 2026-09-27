/**
 * @file @/components/ui/card.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { variants } from '@/core/variants';

export interface CardConfig {
  title?: string;
  subtitle?: string;
  /** Icon shown in a tile next to the title */
  icon?: string;
  /** Shadow depth 0–3 (default 1) */
  elevation?: 0 | 1 | 2 | 3;
  /** Pad the body (default true) */
  padding?: boolean;
}

const card = variants({
  base: 'card',
  variants: { elevation: { 0: 'e0', 1: 'e1', 2: 'e2', 3: 'e3' } },
  defaultVariants: { elevation: 1 }
});

/**
 * Card with optional header, body and footer.
 *
 * ```tsx
 * <Card title="Revenue" subtitle="Last 30 days" icon="chart">
 *   <CardActions><Button variant="ghost" icon="more" /></CardActions>
 *   …body…
 *   <CardFooter><Button>Open</Button></CardFooter>
 * </Card>
 * ```
 * Slots: default (body), `header-actions`, `footer`.
 */
export class NXCard extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['title', 'subtitle', 'icon', 'elevation', 'padding'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  private hasSlotted(name: string): boolean {
    return !!this.querySelector(`:scope > [slot="${name}"]`);
  }

  protected render(): Node {
    const title = this.getProp<string>('title');
    const subtitle = this.getProp<string>('subtitle');
    const icon = this.getProp<string>('icon');
    const hasHeader = title || subtitle || icon || this.hasSlotted('header-actions');

    return (
      <div part="container" class={card({ elevation: this.getProp('elevation') })}>
        {hasHeader && (
          <div class="header" part="header">
            {icon && <span class="icon" part="icon" html={Icons.get(icon)} />}
            <div class="heading">
              {title && <h3 class="title" part="title">{title}</h3>}
              {subtitle && <p class="subtitle" part="subtitle">{subtitle}</p>}
            </div>
            <div class="actions" part="header-actions"><slot name="header-actions" /></div>
          </div>
        )}
        <div part="content" class={['content', { padded: this.getProp('padding', true) }]}>
          <slot />
        </div>
        {this.hasSlotted('footer') && (
          <div class="footer" part="footer"><slot name="footer" /></div>
        )}
      </div>
    );
  }

  protected styles(): string {
    return `
      :host { display: block; min-width: 0; }

      .card {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-surface);
        color: var(--color-text);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }

      .e0 { box-shadow: none; }
      .e1 { box-shadow: var(--shadow-sm); }
      .e2 { box-shadow: var(--shadow-md); }
      .e3 { box-shadow: var(--shadow-lg); }

      .header {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 1.25rem 1.25rem 0;
      }

      .icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 2.25rem;
        flex-shrink: 0;
        border-radius: var(--radius-md);
        background: var(--color-muted);
        font-size: 1.125rem;
      }

      .heading { flex: 1; min-width: 0; }

      .title {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.4;
      }

      .subtitle {
        margin: 0.125rem 0 0;
        color: var(--color-text-secondary);
        font-size: 0.875rem;
      }

      .actions { display: flex; gap: 0.25rem; }

      .content { flex: 1; min-height: 0; font-size: 0.875rem; }
      .padded { padding: 1.25rem; }

      .footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 0 1.25rem 1.25rem;
      }
    `;
  }
}

define('nx-card', NXCard);
