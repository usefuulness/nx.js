/**
 * @file @/components/ui/button.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { showMenu, type MenuItemLike, type NXMenuPopup } from '@/components/ui/menu';
import { variants } from '@/core/variants';

const button = variants({
  base: 'nx-button',
  variants: {
    variant: {
      primary: 'variant-primary',
      secondary: 'variant-secondary',
      outline: 'variant-outline',
      ghost: 'variant-ghost',
      danger: 'variant-danger',
      link: 'variant-link'
    },
    size: { sm: 'size-sm', md: 'size-md', lg: 'size-lg', icon: 'icon-only' },
    iconOnly: { true: 'icon-only', false: '' },
    loading: { true: 'loading', false: '' },
    disabled: { true: 'disabled', false: '' }
  },
  defaultVariants: { variant: 'primary', size: 'md' }
});

const SPINNER = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>';

export interface ButtonConfig {
  text?: string;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  /** Icon name from the built-in set (see `Icons.names()`) or raw SVG */
  icon?: string;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** Link target — renders the button as an `<a>` */
  href?: string;
  tooltip?: string;
  handler?: (e: MouseEvent) => void;
  /** Dropdown menu opened by this button */
  menu?: MenuItemLike[];
}

/**
 * Button.
 *
 * @example
 * ```typescript
 * { xtype: 'button', text: 'Save', icon: 'save', handler: () => save() }
 * { xtype: 'button', icon: 'settings', variant: 'ghost', tooltip: 'Settings' }
 * ```
 * ```html
 * <nx-button variant="outline" icon="plus">New</nx-button>
 * ```
 */
export class NXButton extends BaseComponent {
  static get observedAttributes(): string[] {
    return [
      'text', 'type', 'variant', 'size', 'icon', 'icon-position', 'href', 'tooltip',
      'disabled', 'loading', 'full-width', 'aria-label', 'tabindex'
    ];
  }

  protected initializeState(): void {}

  constructor() {
    super();
    this.attachShadow({ mode: 'open', delegatesFocus: true });

    // Block clicks while disabled/loading — including listeners added via `handler`
    this.addEventListener('click', (e) => {
      if (this.getProp('disabled', false) || this.getProp('loading', false)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, { capture: true });

    // `menu: [...]` turns the button into a dropdown trigger (click again to close)
    this.addEventListener('click', () => {
      const menu = this.getProp<MenuItemLike[] | undefined>('menu');
      if (!Array.isArray(menu)) return;
      if (this.menuPopup?.opened) {
        this.menuPopup.close();
        return;
      }
      this.setAttribute('aria-expanded', 'true');
      this.menuPopup = showMenu(menu, this, {
        returnFocus: this,
        onSelect: item => this.emit('menu-select', { item }),
        onClose: () => {
          this.setAttribute('aria-expanded', 'false');
          this.menuPopup = null;
        }
      });
    });
  }

  private menuPopup: NXMenuPopup | null = null;

  protected render(): Node {
    const variant = this.getProp('variant', 'primary');
    const text = this.getProp<string>('text', '');
    const icon = this.getProp<string>('icon');
    const iconPosition = this.getProp<string>('icon-position', 'left');
    const disabled = this.getProp('disabled', false);
    const loading = this.getProp('loading', false);
    const href = this.getProp<string>('href');
    const tooltip = this.getProp<string>('tooltip');
    const hasLabel = !!text || this.hasLabelContent();
    const ariaLabel = this.getProp<string>('aria-label') || tooltip || (!hasLabel ? icon : undefined);

    const cls = button({
      variant,
      size: this.getProp('size', 'md'),
      iconOnly: !!icon && !hasLabel,
      loading,
      disabled
    });

    const iconNode = loading
      ? <span part="spinner" class="icon spinner" aria-hidden="true" html={SPINNER} />
      : icon ? <span part="icon" class="icon" html={Icons.get(icon)} /> : null;

    const inner = [
      iconPosition === 'left' && iconNode,
      <span part="label" class={['label', { empty: !hasLabel }]}><slot>{text}</slot></span>,
      iconPosition === 'right' && iconNode,
      Array.isArray(this.getProp('menu')) && <span class="icon caret" aria-hidden="true" html={Icons.get('chevron-down')} />
    ];

    const common = {
      part: 'button',
      class: cls,
      'aria-label': ariaLabel,
      title: tooltip,
      'aria-busy': loading ? 'true' : undefined
    };

    return href && !disabled
      ? <a {...common} href={href}>{inner}</a>
      : <button {...common} type={this.getProp('type', 'button')} disabled={disabled || loading}>{inner}</button>;
  }

  private hasLabelContent(): boolean {
    return Array.from(this.childNodes).some(node =>
      node.nodeType === Node.ELEMENT_NODE ? !(node as Element).slot : !!node.textContent?.trim()
    );
  }

  protected styles(): string {
    return `
      :host {
        display: inline-flex;
        vertical-align: middle;
      }

      :host([full-width]) {
        display: flex;
        width: 100%;
      }

      .nx-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        width: 100%;
        height: 2.25rem;
        padding: 0 1rem;
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        font-family: inherit;
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1;
        white-space: nowrap;
        text-decoration: none;
        cursor: pointer;
        user-select: none;
        transition: background-color var(--transition-duration) var(--transition-easing),
                    color var(--transition-duration) var(--transition-easing),
                    border-color var(--transition-duration) var(--transition-easing),
                    box-shadow var(--transition-duration) var(--transition-easing),
                    transform 80ms var(--transition-easing);
      }

      .nx-button:active:not(:disabled) {
        transform: scale(0.98);
      }

      .nx-button:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring);
      }

      /* Sizes */
      .size-sm { height: 2rem; padding: 0 0.75rem; font-size: 0.8125rem; border-radius: var(--radius-sm); }
      .size-lg { height: 2.75rem; padding: 0 1.5rem; font-size: 0.9375rem; }
      .icon-only { width: 2.25rem; padding: 0; }
      .size-sm.icon-only { width: 2rem; }
      .size-lg.icon-only { width: 2.75rem; }

      /* Variants */
      .variant-primary {
        background: var(--color-primary);
        color: var(--color-primary-foreground);
        box-shadow: var(--shadow-sm);
      }
      .variant-primary:hover:not(:disabled) { background: var(--color-primary-dark); }

      .variant-secondary {
        background: var(--color-secondary);
        color: var(--color-secondary-foreground);
      }
      .variant-secondary:hover:not(:disabled) { background: color-mix(in srgb, var(--color-secondary) 85%, var(--color-text)); }

      .variant-outline {
        background: var(--color-background);
        color: var(--color-text);
        border-color: var(--color-border);
        box-shadow: var(--shadow-sm);
      }
      .variant-outline:hover:not(:disabled) { background: var(--color-accent); }

      .variant-ghost {
        background: transparent;
        color: var(--color-text);
      }
      .variant-ghost:hover:not(:disabled) { background: var(--color-accent); }

      .variant-danger {
        background: var(--color-error);
        color: #fff;
        box-shadow: var(--shadow-sm);
      }
      .variant-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--color-error) 88%, #000); }

      .variant-link {
        height: auto;
        padding: 0;
        background: transparent;
        color: var(--color-text);
        text-decoration: underline;
        text-underline-offset: 4px;
      }

      /* States */
      .nx-button:disabled,
      .disabled {
        opacity: 0.5;
        cursor: not-allowed;
        box-shadow: none;
      }

      .loading {
        cursor: progress;
      }

      /* Content */
      .label.empty {
        display: none;
      }

      .icon {
        display: inline-flex;
        flex-shrink: 0;
        font-size: 1rem;
      }

      .icon :is(svg) {
        width: 1em;
        height: 1em;
      }

      .caret {
        margin-right: -0.25rem;
        font-size: 0.875rem;
        opacity: 0.7;
      }

      .spinner {
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
  }

  /** Programmatically click (respects disabled/loading). */
  click(): void {
    if (!this.getProp('disabled', false) && !this.getProp('loading', false)) {
      super.click();
    }
  }

  setText(text: string): void {
    this.setAttribute('text', text);
  }

  setLoading(loading: boolean): void {
    this.toggleAttribute('loading', loading);
  }

  setDisabled(disabled: boolean): void {
    this.toggleAttribute('disabled', disabled);
  }
}

define('nx-button', NXButton);
