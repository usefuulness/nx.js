/**
 * @file @/components/ui/button.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

import { BaseComponent, ComponentState } from '@/components/abstracts/base';

/**
 * Button visual style variants.
 * @typedef {'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'ghost'} ButtonVariant
 */
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'ghost';

/**
 * Button size options.
 * @typedef {'xs' | 'sm' | 'md' | 'lg' | 'xl'} ButtonSize
 */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Button type options matching HTML button types.
 * @typedef {'button' | 'submit' | 'reset'} ButtonType
 */
export type ButtonType = 'button' | 'submit' | 'reset';

/**
 * Configuration interface for button icons.
 */
export interface ButtonIcon {
  /** Icon content (SVG string or icon name) */
  content: string;
  /** Icon position relative to text */
  position?: 'left' | 'right';
  /** Icon size in pixels */
  size?: number;
}

/**
 * Configuration options for NXButton component.
 */
export interface ButtonConfig {
  /** Button text content */
  text?: string;
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size variant */
  size?: ButtonSize;
  /** Button type attribute */
  type?: ButtonType;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Icon configuration */
  icon?: ButtonIcon | string;
  /** Tooltip text */
  tooltip?: string;
  /** ARIA label */
  ariaLabel?: string;
  /** Tab index */
  tabIndex?: number;
  /** Click handler */
  onClick?: (event: MouseEvent) => void;
}

/**
 * A versatile button component with multiple variants, sizes, and states.
 * Supports icons, loading states, and full accessibility.
 * 
 * @extends {BaseComponent}
 * @customElement nx-button
 * 
 * @example
 * ```html
 * <!-- Basic button -->
 * <nx-button variant="primary">Click Me</nx-button>
 * 
 * <!-- Button with icon -->
 * <nx-button variant="secondary" icon="save" size="lg">
 *   Save Document
 * </nx-button>
 * 
 * <!-- Loading button -->
 * <nx-button loading="true" disabled="true">
 *   Processing...
 * </nx-button>
 * 
 * <!-- Full width button -->
 * <nx-button variant="success" full-width="true">
 *   Complete Purchase
 * </nx-button>
 * ```
 * 
 * @example
 * ```typescript
 * // Create programmatically
 * const button = ComponentRegistry.create('button', {
 *   variant: 'primary',
 *   size: 'lg',
 *   icon: {
 *     content: '<svg>...</svg>',
 *     position: 'left'
 *   },
 *   onClick: (e) => console.log('Clicked!')
 * });
 * ```
 * 
 * @fires click - Fired when button is clicked (unless disabled)
 * @fires focus - Fired when button receives focus
 * @fires blur - Fired when button loses focus
 * 
 * @slot - Button content (text and/or elements)
 * @slot icon-left - Custom icon for left position
 * @slot icon-right - Custom icon for right position
 * 
 * @csspart button - The button element
 * @csspart icon - Icon wrapper element
 * @csspart spinner - Loading spinner element
 * @csspart content - Text content wrapper
 * 
 * @cssproperty [--button-padding=0.5rem 1rem] - Button padding
 * @cssproperty [--button-font-size=1rem] - Font size
 * @cssproperty [--button-border-radius=var(--radius-md)] - Border radius
 * @cssproperty [--button-transition=all 0.2s ease] - Transition
 */
export class NXButton extends BaseComponent {
  /**
   * Observed attributes that trigger updates when changed.
   * @static
   * @returns {string[]} List of observed attribute names
   */
  static get observedAttributes(): string[] {
    return [
      'variant',
      'size',
      'type',
      'disabled',
      'loading',
      'full-width',
      'icon',
      'icon-position',
      'tooltip',
      'aria-label',
      'tabindex'
    ];
  }

  /**
   * Internal button element reference.
   * @private
   */
  private buttonElement: HTMLButtonElement | null = null;

  /**
   * Ripple effect animation controller.
   * @private
   */
  private rippleController: AbortController | null = null;

  /**
   * Initialize component state with default values.
   * @protected
   * @override
   */
  protected initializeState(): void {
    this.setState('isPressed', false);
    this.setState('isFocused', false);
    this.setState('isHovered', false);
    this.setState('ripples', []);
  }

  /**
   * Creates a new button instance.
   * @param {ButtonConfig} [config] - Initial configuration
   */
  constructor(config?: ButtonConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Apply initial configuration if provided
    if (config) {
      this.configure(config);
    }
  }

  /**
   * Configure the button with new settings.
   * @param {ButtonConfig} config - Configuration object
   * @public
   */
  configure(config: ButtonConfig): void {
    // Set attributes
    if (config.variant) this.setAttribute('variant', config.variant);
    if (config.size) this.setAttribute('size', config.size);
    if (config.type) this.setAttribute('type', config.type);
    if (config.disabled !== undefined) this.toggleAttribute('disabled', config.disabled);
    if (config.loading !== undefined) this.toggleAttribute('loading', config.loading);
    if (config.fullWidth !== undefined) this.toggleAttribute('full-width', config.fullWidth);
    if (config.tooltip) this.setAttribute('tooltip', config.tooltip);
    if (config.ariaLabel) this.setAttribute('aria-label', config.ariaLabel);
    if (config.tabIndex !== undefined) this.setAttribute('tabindex', String(config.tabIndex));
    
    // Set icon
    if (config.icon) {
      if (typeof config.icon === 'string') {
        this.setAttribute('icon', config.icon);
      } else {
        this.setProp('iconConfig', config.icon);
        this.setAttribute('icon', 'custom');
        if (config.icon.position) {
          this.setAttribute('icon-position', config.icon.position);
        }
      }
    }
    
    // Set text content
    if (config.text) {
      this.textContent = config.text;
    }
    
    // Store click handler
    if (config.onClick) {
      this.setProp('onClick', config.onClick);
    }
  }

  /**
   * Render the button component.
   * @protected
   * @override
   * @returns {string} HTML template
   */
  protected render(): string {
    const variant = this.getProp('variant', 'primary');
    const size = this.getProp('size', 'md');
    const type = this.getProp('type', 'button') as ButtonType;
    const disabled = this.hasAttribute('disabled');
    const loading = this.hasAttribute('loading');
    const fullWidth = this.hasAttribute('full-width');
    const iconPosition = this.getProp('icon-position', 'left');
    const hasIcon = this.hasAttribute('icon');
    const ariaLabel = this.getAttribute('aria-label');
    const tabIndex = this.getAttribute('tabindex');
    
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

  /**
   * Render loading spinner.
   * @private
   * @returns {string} Spinner HTML
   */
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

  /**
   * Render button icon.
   * @private
   * @returns {string} Icon HTML
   */
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
    
    // Check for slotted icon
    const iconPosition = this.getProp('icon-position', 'left');
    return `
      <span part="icon" class="button-icon">
        <slot name="icon-${iconPosition}">${this.getDefaultIcon(icon || '')}</slot>
      </span>
    `;
  }

  /**
   * Get default icon SVG by name.
   * @private
   * @param {string} iconName - Icon identifier
   * @returns {string} SVG string
   */
  private getDefaultIcon(iconName: string): string {
    // Icon library would be implemented here
    const icons: Record<string, string> = {
      'arrow-right': '<svg viewBox="0 0 24 24"><path d="M5 12h14m-7-7l7 7-7 7"/></svg>',
      'check': '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
      'close': '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
      'save': '<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/></svg>'
    };
    
    return icons[iconName] || '';
  }

  /**
   * Component styles.
   * @protected
   * @override
   * @returns {string} CSS styles
   */
  protected styles(): string {
    return `
      /* Base button styles */
      .nx-button {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5em;
        padding: var(--button-padding, 0.5rem 1rem);
        font-family: inherit;
        font-size: var(--button-font-size, 1rem);
        font-weight: 500;
        line-height: 1.5;
        border: none;
        border-radius: var(--button-border-radius, var(--radius-md, 0.375rem));
        cursor: pointer;
        user-select: none;
        text-decoration: none;
        vertical-align: middle;
        white-space: nowrap;
        transition: var(--button-transition, all 0.2s ease);
        overflow: hidden;
        -webkit-tap-highlight-color: transparent;
      }

      .nx-button:focus {
        outline: 2px solid var(--focus-color, var(--color-primary));
        outline-offset: 2px;
      }

      .nx-button:focus:not(:focus-visible) {
        outline: none;
      }

      /* Disabled state */
      .nx-button:disabled,
      .nx-button.disabled {
        opacity: 0.6;
        cursor: not-allowed;
        pointer-events: none;
      }

      /* Full width */
      .nx-button.full-width {
        width: 100%;
      }

      /* Size variants */
      .nx-button.size-xs {
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
      }

      .nx-button.size-sm {
        padding: 0.375rem 0.75rem;
        font-size: 0.875rem;
      }

      .nx-button.size-md {
        padding: 0.5rem 1rem;
        font-size: 1rem;
      }

      .nx-button.size-lg {
        padding: 0.625rem 1.25rem;
        font-size: 1.125rem;
      }

      .nx-button.size-xl {
        padding: 0.75rem 1.5rem;
        font-size: 1.25rem;
      }

      /* Variant styles */
      .nx-button.variant-primary {
        background-color: var(--color-primary, #0066cc);
        color: white;
      }

      .nx-button.variant-primary:hover:not(:disabled) {
        background-color: var(--color-primary-dark, #0052a3);
      }

      .nx-button.variant-primary:active:not(:disabled) {
        transform: translateY(1px);
      }

      .nx-button.variant-secondary {
        background-color: var(--color-surface, #f8f9fa);
        color: var(--color-text, #212529);
        border: 1px solid var(--color-border, #dee2e6);
      }

      .nx-button.variant-secondary:hover:not(:disabled) {
        background-color: var(--color-background, #ffffff);
        border-color: var(--color-border-dark, #adb5bd);
      }

      .nx-button.variant-success {
        background-color: var(--color-success, #28a745);
        color: white;
      }

      .nx-button.variant-success:hover:not(:disabled) {
        background-color: var(--color-success-dark, #218838);
      }

      .nx-button.variant-warning {
        background-color: var(--color-warning, #ffc107);
        color: #212529;
      }

      .nx-button.variant-warning:hover:not(:disabled) {
        background-color: var(--color-warning-dark, #e0a800);
      }

      .nx-button.variant-error {
        background-color: var(--color-error, #dc3545);
        color: white;
      }

      .nx-button.variant-error:hover:not(:disabled) {
        background-color: var(--color-error-dark, #c82333);
      }

      .nx-button.variant-info {
        background-color: var(--color-info, #17a2b8);
        color: white;
      }

      .nx-button.variant-info:hover:not(:disabled) {
        background-color: var(--color-info-dark, #138496);
      }

      .nx-button.variant-ghost {
        background-color: transparent;
        color: var(--color-primary, #0066cc);
        border: 1px solid transparent;
      }

      .nx-button.variant-ghost:hover:not(:disabled) {
        background-color: var(--color-surface, #f8f9fa);
        border-color: var(--color-border, #dee2e6);
      }

      /* Icon styles */
      .button-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.2em;
        height: 1.2em;
        flex-shrink: 0;
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

      .nx-button.has-icon.icon-right {
        flex-direction: row-reverse;
      }

      /* Loading state */
      .nx-button.loading {
        color: transparent;
      }

      .button-spinner {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 1.2em;
        height: 1.2em;
      }

      .spinner-svg {
        animation: spin 1s linear infinite;
        width: 100%;
        height: 100%;
      }

      .spinner-circle {
        stroke: currentColor;
        stroke-dasharray: 44;
        stroke-dashoffset: 44;
        animation: dash 1.5s ease-in-out infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @keyframes dash {
        0% {
          stroke-dashoffset: 44;
        }
        50% {
          stroke-dashoffset: 11;
        }
        100% {
          stroke-dashoffset: 44;
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
        background: currentColor;
        opacity: 0.2;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
      }

      @keyframes ripple {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .nx-button {
          border: 2px solid;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .nx-button {
          transition: none;
        }
        
        .ripple,
        .spinner-svg,
        .spinner-circle {
          animation: none;
        }
      }
    `;
  }

  /**
   * Setup event listeners after render.
   * @protected
   * @override
   */
  protected afterRender(): void {
    this.buttonElement = this.$<HTMLButtonElement>('.nx-button');
    if (!this.buttonElement) return;

    // Click handler
    this.addListener(this.buttonElement, 'click', (e) => {
      const onClick = this.getProp<(event: MouseEvent) => void>('onClick');
      if (onClick) {
        onClick(e as MouseEvent);
      }
      
      // Create ripple effect
      if (!this.hasAttribute('disabled') && !this.hasAttribute('loading')) {
        this.createRipple(e as MouseEvent);
      }
    });

    // Keyboard interactions
    this.addListener(this.buttonElement, 'keydown', (e) => {
      const key = (e as KeyboardEvent).key;
      if (key === ' ' || key === 'Enter') {
        this.setState('isPressed', true);
      }
    });

    this.addListener(this.buttonElement, 'keyup', (e) => {
      const key = (e as KeyboardEvent).key;
      if (key === ' ' || key === 'Enter') {
        this.setState('isPressed', false);
      }
    });

    // Mouse interactions
    this.addListener(this.buttonElement, 'mouseenter', () => {
      this.setState('isHovered', true);
    });

    this.addListener(this.buttonElement, 'mouseleave', () => {
      this.setState('isHovered', false);
      this.setState('isPressed', false);
    });

    this.addListener(this.buttonElement, 'mousedown', () => {
      this.setState('isPressed', true);
    });

    this.addListener(this.buttonElement, 'mouseup', () => {
      this.setState('isPressed', false);
    });

    // Focus management
    this.addListener(this.buttonElement, 'focus', () => {
      this.setState('isFocused', true);
    });

    this.addListener(this.buttonElement, 'blur', () => {
      this.setState('isFocused', false);
    });

    // Tooltip
    const tooltip = this.getAttribute('tooltip');
    if (tooltip) {
      this.buttonElement.title = tooltip;
    }
  }

  /**
   * Create ripple effect on click.
   * @private
   * @param {MouseEvent} event - Click event
   */
  private createRipple(event: MouseEvent): void {
    const button = this.buttonElement;
    if (!button) return;

    const rippleContainer = this.$('.ripple-container');
    if (!rippleContainer) return;

    // Calculate ripple position
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const size = Math.max(rect.width, rect.height);

    // Create ripple element
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x - size / 2}px`;
    ripple.style.top = `${y - size / 2}px`;

    // Add to container
    rippleContainer.appendChild(ripple);

    // Remove after animation
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  /**
   * Handle attribute changes for special cases.
   * @protected
   * @override
   */
  protected onAttributeChange(name: string, oldValue: string | null, newValue: string | null): void {
    // Update ARIA attributes
    if (name === 'disabled') {
      this.setAttribute('aria-disabled', newValue !== null ? 'true' : 'false');
    }
    
    if (name === 'loading' && newValue !== null) {
      // Ensure disabled when loading
      this.setAttribute('disabled', '');
    }
  }

  /**
   * Public API Methods
   */

  /**
   * Programmatically click the button.
   * @public
   */
  click(): void {
    this.buttonElement?.click();
  }

  /**
   * Focus the button.
   * @public
   */
  focus(): void {
    this.buttonElement?.focus();
  }

  /**
   * Blur (unfocus) the button.
   * @public
   */
  blur(): void {
    this.buttonElement?.blur();
  }

  /**
   * Set loading state.
   * @param {boolean} loading - Loading state
   * @public
   */
  setLoading(loading: boolean): void {
    this.toggleAttribute('loading', loading);
    this.toggleAttribute('disabled', loading);
  }

  /**
   * Set disabled state.
   * @param {boolean} disabled - Disabled state
   * @public
   */
  setDisabled(disabled: boolean): void {
    this.toggleAttribute('disabled', disabled);
  }

  /**
   * Get current loading state.
   * @returns {boolean} Loading state
   * @public
   */
  get loading(): boolean {
    return this.hasAttribute('loading');
  }

  /**
   * Get current disabled state.
   * @returns {boolean} Disabled state
   * @public
   */
  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }

  /**
   * Get button variant.
   * @returns {ButtonVariant} Current variant
   * @public
   */
  get variant(): ButtonVariant {
    return (this.getAttribute('variant') as ButtonVariant) || 'primary';
  }

  /**
   * Set button variant.
   * @param {ButtonVariant} variant - New variant
   * @public
   */
  set variant(variant: ButtonVariant) {
    this.setAttribute('variant', variant);
  }

  /**
   * Get button size.
   * @returns {ButtonSize} Current size
   * @public
   */
  get size(): ButtonSize {
    return (this.getAttribute('size') as ButtonSize) || 'md';
  }

  /**
   * Set button size.
   * @param {ButtonSize} size - New size
   * @public
   */
  set size(size: ButtonSize) {
    this.setAttribute('size', size);
  }
}

// Register the custom element
customElements.define('nx-button', NXButton);
