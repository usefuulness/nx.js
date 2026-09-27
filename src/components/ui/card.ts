/**
 * @file @/components/card.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

import { BaseComponent, ComponentState, escapeHTML } from '@/components/abstracts/base';
import { Icons } from '@/core/icons';
import { define } from '@/core/registry';

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
    return ['title', 'subtitle', 'icon', 'elevation', 'padding'];
  }

  protected initializeState(): void {
    this[ComponentState].set('expanded', true);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected render(): string {
    const title = this.getProp<string>('title');
    const subtitle = this.getProp<string>('subtitle');
    const icon = this.getProp<string>('icon');
    const elevation = this.getProp('elevation', 1);
    const padding = this.getProp('padding', true);
    const hasHeaderActions = !!this.querySelector('[slot="header-actions"]');
    const hasFooter = !!this.querySelector('[slot="footer"]');

    return `
      <div class="nx-card elevation-${elevation}" part="container">
        ${title || subtitle || hasHeaderActions ? `
          <div class="nx-card-header" part="header">
            ${icon ? `<span class="nx-card-icon" part="icon">${Icons.get(icon)}</span>` : ''}
            <div class="nx-card-header-text">
              ${title ? `<h3 class="nx-card-title" part="title">${escapeHTML(title)}</h3>` : ''}
              ${subtitle ? `<p class="nx-card-subtitle" part="subtitle">${escapeHTML(subtitle)}</p>` : ''}
            </div>
            <div class="nx-card-header-actions" part="header-actions">
              <slot name="header-actions"></slot>
            </div>
          </div>
        ` : ''}
        <div class="nx-card-content ${padding ? 'padded' : ''}" part="content">
          <slot></slot>
        </div>
        ${hasFooter ? `
          <div class="nx-card-footer" part="footer">
            <slot name="footer"></slot>
          </div>
        ` : ''}
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        display: block;
        min-width: 0;
      }

      .nx-card {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-surface);
        color: var(--color-text);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }

      .elevation-0 { box-shadow: none; }
      .elevation-1 { box-shadow: var(--shadow-sm); }
      .elevation-2 { box-shadow: var(--shadow-md); }
      .elevation-3 { box-shadow: var(--shadow-lg); }

      .nx-card-header {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 1.25rem 1.25rem 0;
      }

      .nx-card-icon {
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

      .nx-card-header-text {
        flex: 1;
        min-width: 0;
      }

      .nx-card-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.4;
      }

      .nx-card-subtitle {
        margin: 0.125rem 0 0;
        color: var(--color-text-secondary);
        font-size: 0.875rem;
      }

      .nx-card-header-actions {
        display: flex;
        gap: 0.25rem;
      }

      .nx-card-content {
        flex: 1;
        min-height: 0;
        font-size: 0.875rem;
      }

      .nx-card-content.padded {
        padding: 1.25rem;
      }

      .nx-card-footer {
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
