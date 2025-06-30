import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface ToolbarItem {
  id?: string;
  type?: 'button' | 'separator' | 'spacer' | 'custom';
  text?: string;
  icon?: string;
  tooltip?: string;
  disabled?: boolean;
  action?: () => void;
  content?: string;
}

export interface ToolbarConfig {
  items?: ToolbarItem[];
  variant?: 'default' | 'compact';
}

export class NXToolbar extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['variant'];
  }

  protected initializeState(): void {
    this[ComponentState].set('items', []);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setItems(items: ToolbarItem[]): void {
    this.setState('items', items);
  }

  protected render(): string {
    const items = this.getState<ToolbarItem[]>('items', []);
    const variant = this.getProp('variant', 'default');

    return `
      <div class="nx-toolbar variant-${variant}" part="container" role="toolbar">
        ${items.map((item, index) => this.renderItem(item, index)).join('')}
      </div>
    `;
  }

  private renderItem(item: ToolbarItem, index: number): string {
    const itemId = item.id || String(index);

    switch (item.type) {
      case 'separator':
        return '<div class="nx-toolbar-separator" part="separator" role="separator"></div>';
        
      case 'spacer':
        return '<div class="nx-toolbar-spacer" part="spacer"></div>';
        
      case 'custom':
        return `
          <div class="nx-toolbar-custom" part="custom">
            ${item.content || ''}
            <slot name="item-${itemId}"></slot>
          </div>
        `;
        
      case 'button':
      default:
        return `
          <button class="nx-toolbar-button ${item.disabled ? 'disabled' : ''}"
                  part="button"
                  data-item-id="${itemId}"
                  ${item.disabled ? 'disabled' : ''}
                  ${item.tooltip ? `title="${item.tooltip}"` : ''}>
            ${item.icon ? `<span class="nx-toolbar-icon" part="icon">${item.icon}</span>` : ''}
            ${item.text ? `<span class="nx-toolbar-text" part="text">${item.text}</span>` : ''}
          </button>
        `;
    }
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
        padding: 0.5rem;
        background: var(--surface-color);
        border-bottom: 1px solid var(--border-color);
      }

      .variant-compact {
        padding: 0.25rem;
      }

      .nx-toolbar-button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        border: none;
        background: transparent;
        font-family: inherit;
        font-size: 0.875rem;
        color: var(--text-color);
        cursor: pointer;
        border-radius: 0.25rem;
        transition: all 0.2s;
      }

      .variant-compact .nx-toolbar-button {
        padding: 0.375rem 0.5rem;
        font-size: 0.75rem;
      }

      .nx-toolbar-button:hover:not(:disabled) {
        background: var(--hover-bg);
      }

      .nx-toolbar-button:active:not(:disabled) {
        background: var(--active-bg);
      }

      .nx-toolbar-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nx-toolbar-icon {
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
      }

      .variant-compact .nx-toolbar-icon {
        width: 1rem;
        height: 1rem;
      }

      .nx-toolbar-separator {
        width: 1px;
        height: 1.5rem;
        background: var(--border-color);
        margin: 0 0.25rem;
      }

      .nx-toolbar-spacer {
        flex: 1;
      }

      .nx-toolbar-custom {
        display: flex;
        align-items: center;
      }

      /* Tooltips */
      [title] {
        position: relative;
      }

      [title]:hover::after {
        content: attr(title);
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        padding: 0.25rem 0.5rem;
        margin-bottom: 0.25rem;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        font-size: 0.75rem;
        border-radius: 0.25rem;
        white-space: nowrap;
        z-index: 1000;
      }
    `;
  }

  protected afterRender(): void {
    // Button clicks
    this.$$('.nx-toolbar-button:not(:disabled)').forEach(button => {
      this.on(button, 'click', (_e: Event) => {
        const itemId = button.getAttribute('data-item-id');
        const item = this.findItem(itemId!);
        
        if (item) {
          item.action?.();
          this.emit('item-click', { item });
        }
      });
    });

    // Keyboard navigation
    this.on(this.shadow!, 'keydown', (_e: Event) => {
      const keyEvent = _e as KeyboardEvent;
      const target = keyEvent.target as HTMLElement;
      
      if (target.classList.contains('nx-toolbar-button')) {
        switch (keyEvent.key) {
          case 'ArrowRight':
            keyEvent.preventDefault();
            this.focusNext(target);
            break;
            
          case 'ArrowLeft':
            keyEvent.preventDefault();
            this.focusPrevious(target);
            break;
        }
      }
    });
  }

  private focusNext(current: HTMLElement): void {
    const buttons = Array.from(this.$$('.nx-toolbar-button:not(:disabled)'));
    const index = buttons.indexOf(current);
    const next = buttons[index + 1] || buttons[0];
    (next as HTMLElement).focus();
  }

  private focusPrevious(current: HTMLElement): void {
    const buttons = Array.from(this.$$('.nx-toolbar-button:not(:disabled)'));
    const index = buttons.indexOf(current);
    const prev = buttons[index - 1] || buttons[buttons.length - 1];
    (prev as HTMLElement).focus();
  }

  private findItem(id: string): ToolbarItem | null {
    const items = this.getState<ToolbarItem[]>('items', []);
    return items.find((item, index) => 
      (item.id || String(index)) === id
    ) || null;
  }

  addItem(item: ToolbarItem): void {
    const items = [...this.getState<ToolbarItem[]>('items', [])];
    items.push(item);
    this.setState('items', items);
  }

  removeItem(id: string): void {
    const items = this.getState<ToolbarItem[]>('items', []);
    const filtered = items.filter((item, index) => 
      (item.id || String(index)) !== id
    );
    this.setState('items', filtered);
  }

  updateItem(id: string, updates: Partial<ToolbarItem>): void {
    const items = [...this.getState<ToolbarItem[]>('items', [])];
    const index = items.findIndex((item, i) => 
      (item.id || String(i)) === id
    );
    
    if (index >= 0) {
      items[index] = { ...items[index], ...updates };
      this.setState('items', items);
    }
  }
}

customElements.define('nx-toolbar', NXToolbar);
