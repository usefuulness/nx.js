/**
 * @file @/components/card.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

import { BaseComponent, ComponentState } from '@/components/abstracts/base';

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
export interface CardConfig {
  title?: string;
  subtitle?: string;
  headerActions?: any[];
  footerActions?: any[];
  elevation?: number;
  padding?: boolean;
}

export class NXCard extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['title', 'subtitle', 'elevation', 'padding'];
  }

  protected initializeState(): void {
    this[ComponentState].set('expanded', true);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected render(): string {
    const title = this.getProp('title');
    const subtitle = this.getProp('subtitle');
    const elevation = this.getProp('elevation', 1);
    const padding = this.getProp('padding', true);

    return `
      <div class="nx-card elevation-${elevation}" part="container">
        ${title || subtitle ? `
          <div class="nx-card-header" part="header">
            <div class="nx-card-header-text">
              ${title ? `<h3 class="nx-card-title" part="title">${title}</h3>` : ''}
              ${subtitle ? `<p class="nx-card-subtitle" part="subtitle">${subtitle}</p>` : ''}
            </div>
            <div class="nx-card-header-actions" part="header-actions">
              <slot name="header-actions"></slot>
            </div>
          </div>
        ` : ''}
        <div class="nx-card-content ${padding ? 'padded' : ''}" part="content">
          <slot></slot>
        </div>
        <div class="nx-card-footer" part="footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        display: block;
      }

      .nx-card {
        background: var(--surface-color);
        border-radius: 0.25rem;
        overflow: hidden;
      }

      .elevation-0 { box-shadow: none; }
      .elevation-1 { box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      .elevation-2 { box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
      .elevation-3 { box-shadow: 0 8px 16px rgba(0,0,0,0.2); }

      .nx-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
      }

      .nx-card-title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 500;
      }

      .nx-card-subtitle {
        margin: 0.25rem 0 0;
        color: var(--text-color-secondary);
        font-size: 0.875rem;
      }

      .nx-card-content {
        min-height: 2rem;
      }

      .nx-card-content.padded {
        padding: 1rem;
      }

      .nx-card-footer:not(:empty) {
        padding: 0.75rem 1rem;
        border-top: 1px solid var(--border-color);
      }
    `;
  }
}

customElements.define('nx-card', NXCard);