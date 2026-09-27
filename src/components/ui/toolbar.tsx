/**
 * @file @/components/ui/toolbar.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { ComponentRegistry, define, type ItemConfig, type ItemsAware } from '@/core/registry';

export interface ToolbarConfig {
  items?: ItemConfig[];
  variant?: 'default' | 'compact' | 'plain';
  /** Optional title rendered at the start */
  title?: string;
}

/**
 * Horizontal bar of controls. Items are regular components; buttons default
 * to the `ghost` variant. Use `'->'` to push the rest to the right and `'-'` for a separator.
 *
 * @example
 * ```typescript
 * {
 *   xtype: 'toolbar',
 *   items: [
 *     { xtype: 'button', text: 'New', icon: 'plus', variant: 'primary' },
 *     '-',
 *     { xtype: 'button', icon: 'refresh' },
 *     '->',
 *     { xtype: 'textfield', placeholder: 'Search…', icon: 'search' }
 *   ]
 * }
 * ```
 */
export class NXToolbar extends BaseComponent implements ItemsAware {
  static get observedAttributes(): string[] {
    return ['variant', 'title'];
  }

  protected initializeState(): void {}

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  applyItems(items: ItemConfig[], build: (item: ItemConfig) => HTMLElement | null): void {
    items.forEach(item => {
      const child = build(defaultButtonVariant(item));
      if (child) this.appendChild(child);
    });
  }

  /** Append an item (config, element, `'->'` or `'-'`). */
  addItem(item: ItemConfig): HTMLElement | null {
    const child = ComponentRegistry.build(defaultButtonVariant(item));
    if (child) this.appendChild(child);
    return child;
  }

  protected render(): Node {
    const title = this.getProp<string>('title');
    return (
      <div part="container" role="toolbar" class={['nx-toolbar', `variant-${this.getProp('variant', 'default')}`]}>
        {title && <span class="nx-toolbar-title" part="title">{title}</span>}
        <slot />
      </div>
    );
  }

  protected styles(): string {
    return `
      :host {
        display: block;
      }

      .nx-toolbar {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        min-height: 3.5rem;
        padding: 0 0.75rem;
        background: var(--color-surface);
      }

      .variant-compact {
        min-height: 2.5rem;
        padding: 0 0.25rem;
      }

      .variant-plain {
        background: transparent;
        padding: 0;
        min-height: 0;
      }

      .nx-toolbar-title {
        font-weight: 600;
        font-size: 0.9375rem;
        letter-spacing: -0.01em;
        margin: 0 0.5rem;
        white-space: nowrap;
      }
    `;
  }

  protected afterConnect(): void {
    // Buttons added as children (JSX/HTML) also default to ghost
    const ghostify = () => this.querySelectorAll(':scope > nx-button:not([variant])').forEach(b => {
      if (!(b as any).get?.('variant')) b.setAttribute('variant', 'ghost');
    });
    ghostify();
    this.childObserver ??= new MutationObserver(ghostify);
    this.childObserver.observe(this, { childList: true });
  }

  protected beforeDisconnect(): void {
    this.childObserver?.disconnect();
  }

  private childObserver: MutationObserver | null = null;

  protected afterRender(): void {
    // Roving arrow-key focus between focusable items
    this.on(this, 'keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key !== 'ArrowRight' && keyEvent.key !== 'ArrowLeft') return;
      const target = keyEvent.target as HTMLElement;
      if (target.matches('input, textarea, nx-textfield, nx-select')) return;

      const focusable = Array.from(this.children).filter(
        el => el.matches('nx-button:not([disabled]), button:not(:disabled), a[href]')
      ) as HTMLElement[];
      const index = focusable.indexOf(target);
      if (index < 0) return;

      keyEvent.preventDefault();
      const next = keyEvent.key === 'ArrowRight'
        ? focusable[(index + 1) % focusable.length]
        : focusable[(index - 1 + focusable.length) % focusable.length];
      next.focus();
    });
  }
}

function defaultButtonVariant(item: ItemConfig): ItemConfig {
  if (item && typeof item === 'object' && !(item instanceof Node)) {
    const xtype = item.xtype;
    if ((xtype === 'button' || xtype === 'btn') && !item.variant) {
      return { ...item, variant: 'ghost' };
    }
  }
  return item;
}

define('nx-toolbar', NXToolbar);
