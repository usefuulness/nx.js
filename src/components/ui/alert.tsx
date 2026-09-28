/**
 * @file @/components/ui/alert.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { variants } from '@/core/variants';

export interface AlertConfig {
  variant?: 'default' | 'info' | 'success' | 'warning' | 'destructive';
  title?: string;
  /** Icon name; each variant has a default (`false`/`"none"` hides it) */
  icon?: string;
  /** Show an × that removes the alert and emits `dismiss` */
  dismissible?: boolean;
}

const alert = variants({
  base: 'alert',
  variants: {
    variant: { default: 'default', info: 'info', success: 'success', warning: 'warning', destructive: 'destructive' }
  },
  defaultVariants: { variant: 'default' }
});

const DEFAULT_ICONS: Record<string, string> = {
  default: 'info',
  info: 'info',
  success: 'success',
  warning: 'warning',
  destructive: 'error'
};

/**
 * Alert: an inline callout for important messages on the page.
 *
 * ```html
 * <nx-alert variant="destructive" title="Payment failed">Your card was declined.</nx-alert>
 * ```
 *
 * Warnings and errors are announced by screen readers (`role="alert"`); the
 * others are polite (`role="status"`). Events: `dismiss`.
 */
export class NXAlert extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['variant', 'title', 'icon', 'dismissible'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  /** Remove the alert (unless a `dismiss` listener calls `preventDefault()`). */
  dismiss(): void {
    if (this.dispatchEvent(new CustomEvent('dismiss', { bubbles: true, composed: true, cancelable: true }))) this.remove();
  }

  protected render(): Node {
    const variant = this.getProp<NonNullable<AlertConfig['variant']>>('variant', 'default');
    const title = this.getProp<string>('title');
    const iconProp = this.getProp<string | boolean>('icon');
    const icon = iconProp === false || iconProp === 'none' ? null : (typeof iconProp === 'string' && iconProp) || DEFAULT_ICONS[variant];
    const urgent = variant === 'destructive' || variant === 'warning';

    return (
      <div part="alert" class={alert({ variant })} role={urgent ? 'alert' : 'status'}>
        {icon && <span class="icon" part="icon" aria-hidden="true" html={Icons.get(icon)} />}
        <div class="body">
          {title && <div class="title" part="title">{title}</div>}
          <div class="description" part="description"><slot /></div>
        </div>
        {this.getProp('dismissible', false) && (
          <button type="button" class="close" part="close" aria-label="Dismiss" html={Icons.get('close')} onClick={() => this.dismiss()} />
        )}
      </div>
    );
  }

  protected styles(): string {
    return `
      :host { display: block; }

      .alert {
        display: flex;
        gap: 0.75rem;
        padding: 0.875rem 1rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        color: var(--color-text);
        font-size: 0.875rem;
      }

      .icon { display: inline-flex; flex-shrink: 0; margin-top: 0.0625rem; font-size: 1rem; }
      .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.25rem; }
      .title { font-weight: 600; line-height: 1.3; }
      .description { color: var(--color-text-secondary); line-height: 1.5; }

      .info { border-color: color-mix(in srgb, var(--color-info) 35%, var(--color-border)); }
      .info .icon, .info .title { color: var(--color-info-text); }
      .success { border-color: color-mix(in srgb, var(--color-success) 35%, var(--color-border)); }
      .success .icon, .success .title { color: var(--color-success-text); }
      .warning {
        border-color: color-mix(in srgb, var(--color-warning) 45%, var(--color-border));
        background: color-mix(in srgb, var(--color-warning) 6%, var(--color-surface));
      }
      .warning .icon, .warning .title { color: var(--color-warning-text); }
      .destructive {
        border-color: color-mix(in srgb, var(--color-error) 45%, var(--color-border));
        background: color-mix(in srgb, var(--color-error) 6%, var(--color-surface));
      }
      .destructive .icon, .destructive .title { color: var(--color-error-text); }

      .close {
        display: inline-flex;
        align-self: flex-start;
        margin: -0.25rem -0.375rem 0 0;
        padding: 0.25rem;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        font-size: 1rem;
        cursor: pointer;
      }

      .close:hover { background: var(--color-accent); color: var(--color-text); }
    `;
  }
}

define('nx-alert', NXAlert);
