/**
 * @file @/components/card.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

import { BaseComponent } from '@/components/abstracts/base';

/**
 * A flexible card component with header, body, and footer slots.
 *
 * @example
 * ```html
 * <nx-card>
 *   <span slot="header">Title</span>
 *   Card content goes here.
 *   <button slot="footer">Action</button>
 * </nx-card>
 * ```
 */
export class NXCard extends BaseComponent {
  /**
   * Attach shadow DOM and initialize rendering
   */
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /**
   * Called when the element is inserted into the DOM
   */
  connectedCallback(): void {
    this.update();
  }

  /**
   * Observe attribute changes and re-render
   */
  static get observedAttributes(): string[] {
    return ['disabled'];
  }

  /**
   * Handle attribute changes
   */
  attributeChangedCallback(): void {
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
   * Renders the card's template.
   * @returns HTML string representing the component
   */
  public render(): string {
    const disabled = this.hasAttribute('disabled');
    return /* html */ `
      <div class="card ${disabled ? 'disabled' : ''}">
        <div class="card-header">
          <slot name="header"></slot>
        </div>
        <div class="card-body">
          <slot></slot>
        </div>
        <div class="card-footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `;
  }

  /**
   * Defines scoped styles for the card.
   * @returns CSS string
   */
  public styles(): string {
    return /* css */ `
      .card {
        background-color: var(--color-surface, #ffffff);
        border-radius: var(--radius-lg, 8px);
        box-shadow: var(--shadow-md, 0 4px 6px rgba(0,0,0,0.1));
        overflow: hidden;
      }

      .card.disabled {
        opacity: 0.6;
        pointer-events: none;
      }

      .card-header {
        padding: 1.5rem;
        border-bottom: 1px solid var(--color-border, #e0e0e0);
        font-weight: 600;
        font-size: 1.125rem;
      }

      .card-body {
        padding: 1.5rem;
      }

      .card-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--color-border, #e0e0e0);
        background-color: var(--color-background, #f9f9f9);
      }

      /* Hide empty header or footer */
      .card-header:empty,
      .card-footer:empty {
        display: none;
      }
    `;
  }
}

// Define the custom element
customElements.define('nx-card', NXCard);
