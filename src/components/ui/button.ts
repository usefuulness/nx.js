/**
 * @file @/components/button.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

import { BaseComponent } from '@/components/abstracts/base';

// Define allowed variants and sizes
export type Variant = 'primary' | 'secondary';
export type Size = 'sm' | 'md' | 'lg';

/**
 * Props interface for NXButton component.
 */
export interface NXButtonProps {
  /** Visual style of the button */
  variant: Variant;
  /** Size of the button */
  size: Size;
  /** Disabled state of the button */
  disabled: boolean;
}

/**
 * A customizable button component supporting different variants, sizes, and disabled state.
 *
 * @example
 * ```html
 * <nx-button variant="secondary" size="lg">Submit</nx-button>
 * ```
 */
export class NXButton extends BaseComponent {
  /** Internal props with defaults */
  private props: NXButtonProps = {
    variant: 'primary',
    size: 'md',
    disabled: false,
  };

  /**
   * Attach shadow DOM and initialize rendering
   */
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /** Attributes to observe for changes */
  static get observedAttributes(): string[] {
    return ['variant', 'size', 'disabled'];
  }

  /**
   * Lifecycle hook when element is added to the DOM.
   */
  connectedCallback(): void {
    this.update();
  }

  /**
   * Called when one of the observed attributes changes.
   * @param attrName Name of the changed attribute
   * @param oldValue Previous value of the attribute
   * @param newValue Current value of the attribute
   */
  attributeChangedCallback(
    attrName: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    switch (attrName) {
      case 'variant':
        this.props.variant = (newValue as Variant) || 'primary';
        break;
      case 'size':
        this.props.size = (newValue as Size) || 'md';
        break;
      case 'disabled':
        this.props.disabled = newValue !== null && newValue !== 'false';
        break;
    }
    this.update();
  }

  /**
   * Perform DOM update: re-render template and styles
   */
  private update(): void {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>${this.styles()}</style>
      ${this.render()}
    `;
  }

  /**
   * Renders the button's template.
   * @returns HTML string representing the component
   */
  public render(): string {
    const { variant, size, disabled } = this.props;
    return /* html */ `
      <button
        class="ui-button ${variant} ${size}"
        type="button"
        ${disabled ? 'disabled aria-disabled="true"' : ''}
      >
        <slot></slot>
      </button>
    `;
  }

  /**
   * Defines scoped styles for the button.
   * @returns CSS string
   */
  public styles(): string {
    return /* css */ `
      .ui-button {
        padding: 0.5rem 1rem;
        border-radius: var(--radius-md, 4px);
        border: none;
        font-weight: 500;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        background-color: var(--color-primary, #007bff);
        color: var(--color-on-primary, #ffffff);
      }

      .ui-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: var(--shadow-md, 0 4px 6px rgba(0,0,0,0.1));
      }

      .ui-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Variant styles */
      .ui-button.secondary {
        background-color: var(--color-surface, #f5f5f5);
        color: var(--color-on-surface, #333333);
        border: 1px solid var(--color-border, #cccccc);
      }

      /* Size styles */
      .ui-button.sm {
        padding: 0.25rem 0.75rem;
        font-size: 0.875rem;
      }

      .ui-button.lg {
        padding: 0.75rem 1.5rem;
        font-size: 1.125rem;
      }
    `;
  }
}

// Define the custom element
customElements.define('nx-button', NXButton);
