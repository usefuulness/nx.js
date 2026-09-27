/**
 * @file @/components/ui/badge.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * Reference component for the house style — copy this file to start a new one:
 *   1. extend BaseComponent, attach a shadow root
 *   2. describe the look with `variants()`
 *   3. render JSX (inline `onClick` etc.; no afterRender wiring needed)
 *   4. style with the design tokens in `styles()`
 *   5. `define()` the tag, then add a PascalCase wrapper in `@/jsx/components`
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { variants } from '@/core/variants';

export interface BadgeConfig {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info';
  icon?: string;
  /** Show an × that emits `remove` */
  removable?: boolean;
}

const badge = variants({
  base: 'badge',
  variants: {
    variant: {
      default: 'default',
      secondary: 'secondary',
      outline: 'outline',
      destructive: 'destructive',
      success: 'success',
      warning: 'warning',
      info: 'info'
    }
  },
  defaultVariants: { variant: 'default' }
});

/**
 * Small status label.
 *
 * ```tsx
 * <Badge variant="success" icon="check">Paid</Badge>
 * <Badge variant="outline" removable onRemove={() => …}>react</Badge>
 * ```
 */
export class NXBadge extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['variant', 'icon', 'removable'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  protected render(): Node {
    const icon = this.getProp<string>('icon');
    return (
      <span part="badge" class={badge({ variant: this.getProp('variant') })}>
        {icon && <span class="icon" html={Icons.get(icon)} />}
        <slot />
        {this.getProp('removable', false) && (
          <button class="remove" aria-label="Remove" html={Icons.get('close')} onClick={() => this.emit('remove')} />
        )}
      </span>
    );
  }

  protected styles(): string {
    return `
      :host { display: inline-flex; vertical-align: middle; }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        height: 1.375rem;
        padding: 0 0.5rem;
        border: 1px solid transparent;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        line-height: 1;
        white-space: nowrap;
      }

      .default { background: var(--color-primary); color: var(--color-primary-foreground); }
      .secondary { background: var(--color-secondary); color: var(--color-secondary-foreground); }
      .outline { border-color: var(--color-border); color: var(--color-text); }
      .destructive { background: color-mix(in srgb, var(--color-error) 14%, transparent); color: var(--color-error); }
      .success { background: color-mix(in srgb, var(--color-success) 14%, transparent); color: var(--color-success); }
      .warning { background: color-mix(in srgb, var(--color-warning) 16%, transparent); color: var(--color-warning); }
      .info { background: color-mix(in srgb, var(--color-info) 14%, transparent); color: var(--color-info); }

      .icon { display: inline-flex; font-size: 0.875rem; margin-left: -0.125rem; }

      .remove {
        display: inline-flex;
        margin: 0 -0.25rem 0 0;
        padding: 0.125rem;
        border: none;
        border-radius: 9999px;
        background: transparent;
        color: inherit;
        opacity: 0.7;
        cursor: pointer;
      }

      .remove:hover { opacity: 1; background: color-mix(in srgb, currentColor 15%, transparent); }
    `;
  }
}

define('nx-badge', NXBadge);
