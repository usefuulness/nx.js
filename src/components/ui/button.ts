/**
 * @file @/components/ui/button.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface ButtonConfig {
  text?: string;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
}

export interface ButtonIcon {
  content: string;
  position?: 'left' | 'right';
}

export class NXButton extends BaseComponent {
  static get observedAttributes(): string[] {
    return [
      'type', 'variant', 'size', 'icon', 'icon-position',
      'disabled', 'loading', 'full-width', 'aria-label', 'tabindex'
    ];
  }

  protected initializeState(): void {
    this[ComponentState].set('pressed', false);
    this[ComponentState].set('ripples', []);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected render(): string {
    const type = this.getProp('type', 'button');
    const variant = this.getProp('variant', 'primary');
    const size = this.getProp('size', 'md');
    const icon = this.getProp('icon');
    const iconPosition = this.getProp<string>('icon-position', 'left');
    const disabled = this.getProp('disabled', false);
    const loading = this.getProp('loading', false);
    const fullWidth = this.getProp('full-width', false);
    const ariaLabel = this.getProp('aria-label');
    const tabIndex = this.getProp('tabindex');
    
    const hasIcon = !!icon || !!this.querySelector('[slot^="icon-"]');

    const buttonClasses = [
      'nx-button',
      `variant-${variant}`,
      `size-${size}`,
      fullWidth ? 'full-width' : '',
      loading ? 'loading' : '',
      disabled ? 'disabled' : '',
      hasIcon ? `has-icon icon-${iconPosition}` : ''
    ].filter(Boolean).join(' ');

    return `
      <button
        part="button"
        class="${buttonClasses}"
        type="${type}"
        ${disabled || loading ? 'disabled' : ''}
        ${ariaLabel ? `aria-label="${ariaLabel}"` : ''}
        ${tabIndex ? `tabindex="${tabIndex}"` : ''}
        ${loading ? 'aria-busy="true"' : ''}
      >
        ${loading ? this.renderSpinner() : ''}
        ${hasIcon && iconPosition === 'left' && !loading ? this.renderIcon() : ''}
        <span part="content" class="button-content">
          <slot></slot>
        </span>
        ${hasIcon && iconPosition === 'right' && !loading ? this.renderIcon() : ''}
        <span class="ripple-container"></span>
      </button>
    `;
  }

  private renderSpinner(): string {
    return `
      <span part="spinner" class="button-spinner" aria-hidden="true">
        <svg class="spinner-svg" viewBox="0 0 24 24">
          <circle 
            class="spinner-circle" 
            cx="12" 
            cy="12" 
            r="10" 
            fill="none" 
            stroke-width="3"
          />
        </svg>
      </span>
    `;
  }

  private renderIcon(): string {
    const icon = this.getAttribute('icon');
    const iconConfig = this.getProp<ButtonIcon>('iconConfig');
    
    if (iconConfig?.content) {
      return `
        <span part="icon" class="button-icon">
          ${iconConfig.content}
        </span>
      `;
    }
    
    const iconPosition = this.getProp('icon-position', 'left');
    return `
      <span part="icon" class="button-icon">
        <slot name="icon-${iconPosition}">${this.getDefaultIcon(icon || '')}</slot>
      </span>
    `;
  }

  private getDefaultIcon(iconName: string): string {
    const icons: Record<string, string> = {
      'arrow-right': '<svg viewBox="0 0 24 24"><path d="M5 12h14m-7-7l7 7-7 7"/></svg>',
      'check': '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
      'close': '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
      'save': '<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/></svg>'
    };
    
    return icons[iconName] || '';
  }

  protected styles(): string {
    return `
      :host {
        display: inline-block;
      }

      .nx-button {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 0.25rem;
        font-family: inherit;
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1.25rem;
        cursor: pointer;
        transition: all 0.2s;
        overflow: hidden;
        user-select: none;
      }

      /* Sizes */
      .size-sm {
        padding: 0.25rem 0.75rem;
        font-size: 0.75rem;
      }

      .size-lg {
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
      }

      /* Variants */
      .variant-primary {
        background: var(--color-primary);
        color: white;
      }

      .variant-primary:hover:not(:disabled) {
        background: var(--color-primary-dark);
      }

      .variant-secondary {
        background: var(--color-secondary);
        color: white;
      }

      .variant-danger {
        background: var(--color-danger);
        color: white;
      }

      .variant-ghost {
        background: transparent;
        color: var(--color-primary);
        border: 1px solid currentColor;
      }

      .variant-link {
        background: transparent;
        color: var(--color-primary);
        text-decoration: underline;
        padding: 0;
      }

      /* States */
      .disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .loading {
        cursor: wait;
      }

      .full-width {
        width: 100%;
      }

      /* Icons */
      .button-icon {
        display: inline-flex;
        width: 1.25em;
        height: 1.25em;
      }

      .button-icon svg {
        width: 100%;
        height: 100%;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      /* Spinner */
      .button-spinner {
        position: absolute;
        display: inline-flex;
      }

      .spinner-svg {
        width: 1.25em;
        height: 1.25em;
        animation: rotate 1s linear infinite;
      }

      .spinner-circle {
        stroke: currentColor;
        stroke-dasharray: 62.83;
        stroke-dashoffset: 47.12;
        animation: dash 1.5s ease-in-out infinite;
      }

      @keyframes rotate {
        100% {
          transform: rotate(360deg);
        }
      }

      @keyframes dash {
        0% {
          stroke-dashoffset: 47.12;
        }
        50% {
          stroke-dashoffset: 11.78;
        }
        100% {
          stroke-dashoffset: 47.12;
        }
      }

      /* Ripple effect */
      .ripple-container {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        overflow: hidden;
        pointer-events: none;
      }

      .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        transform: scale(0);
        animation: ripple 0.6s ease-out;
      }

      @keyframes ripple {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }
    `;
  }

  protected afterRender(): void {
    const button = this.$('button');
    if (button) {
      this.on(button, 'click', (e: Event) => {
        if (!this.getProp('disabled') && !this.getProp('loading')) {
          this.createRipple(e as MouseEvent);
          this.emit('click', e);
        }
      });
    }
  }

  private createRipple(e: MouseEvent): void {
    const button = this.$('button') as HTMLElement;
    const container = this.$('.ripple-container') as HTMLElement;
    
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    
    container.appendChild(ripple);
    
    this.setTimeout(() => ripple.remove(), 600);
  }

  protected onAttributeChange(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'loading') {
      const button = this.$('button') as HTMLButtonElement;
      if (button) {
        button.disabled = newValue !== null || this.hasAttribute('disabled');
      }
    }
  }
}

customElements.define('nx-button', NXButton);