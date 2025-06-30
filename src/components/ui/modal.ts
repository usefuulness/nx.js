import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface ModalConfig {
  title?: string;
  content?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  animation?: 'fade' | 'slide' | 'scale' | 'none';
}

export class NXModal extends BaseComponent {
  static get observedAttributes(): string[] {
    return [
      'open', 'title', 'size', 'closable', 'close-on-backdrop',
      'close-on-escape', 'show-header', 'show-footer', 'animation'
    ];
  }

  protected initializeState(): void {
    this[ComponentState].set('open', false);
    this[ComponentState].set('animating', false);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected render(): string {
    const open = this.getState('open', false);
    const title = this.getProp('title', '');
    const size = this.getProp('size', 'md');
    const closable = this.getProp('closable', true);
    const showHeader = this.getProp('show-header', true);
    const showFooter = this.getProp('show-footer', true);
    const animation = this.getProp('animation', 'fade');
    const animating = this.getState('animating', false);

    const modalClasses = [
      'nx-modal',
      open ? 'open' : '',
      animating ? 'animating' : '',
      `animation-${animation}`
    ].filter(Boolean).join(' ');

    return `
      <div class="${modalClasses}" part="container" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="nx-modal-backdrop" part="backdrop"></div>
        <div class="nx-modal-dialog size-${size}" part="dialog">
          ${showHeader ? `
            <div class="nx-modal-header" part="header">
              <h2 id="modal-title" class="nx-modal-title" part="title">${title}</h2>
              ${closable ? `
                <button type="button" class="nx-modal-close" part="close" aria-label="Close">
                  <svg viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          ` : ''}
          
          <div class="nx-modal-body" part="body">
            <slot></slot>
          </div>
          
          ${showFooter ? `
            <div class="nx-modal-footer" part="footer">
              <slot name="footer">
                <button type="button" class="nx-modal-button secondary" data-action="cancel">
                  Cancel
                </button>
                <button type="button" class="nx-modal-button primary" data-action="confirm">
                  OK
                </button>
              </slot>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        --modal-bg: var(--surface-color);
        --modal-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        --backdrop-bg: rgba(0, 0, 0, 0.5);
      }

      .nx-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }

      .nx-modal.open {
        display: flex;
      }

      .nx-modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--backdrop-bg);
        opacity: 0;
        transition: opacity 0.3s;
      }

      .nx-modal.open .nx-modal-backdrop {
        opacity: 1;
      }

      .nx-modal-dialog {
        position: relative;
        background: var(--modal-bg);
        border-radius: 0.5rem;
        box-shadow: var(--modal-shadow);
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        opacity: 0;
        transform: scale(0.9);
        transition: all 0.3s;
      }

      .nx-modal.open .nx-modal-dialog {
        opacity: 1;
        transform: scale(1);
      }

      /* Sizes */
      .size-sm { width: 90%; max-width: 400px; }
      .size-md { width: 90%; max-width: 600px; }
      .size-lg { width: 90%; max-width: 800px; }
      .size-xl { width: 90%; max-width: 1200px; }
      .size-full { width: 95%; height: 95%; max-width: none; }

      /* Header */
      .nx-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5rem;
        border-bottom: 1px solid var(--border-color);
      }

      .nx-modal-title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .nx-modal-close {
        width: 2.5rem;
        height: 2.5rem;
        padding: 0.5rem;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 0.25rem;
        color: var(--text-color-secondary);
        transition: all 0.2s;
      }

      .nx-modal-close:hover {
        background: var(--hover-bg);
        color: var(--text-color);
      }

      .nx-modal-close svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }

      /* Body */
      .nx-modal-body {
        flex: 1;
        padding: 1.5rem;
        overflow-y: auto;
      }

      /* Footer */
      .nx-modal-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
        padding: 1.5rem;
        border-top: 1px solid var(--border-color);
      }

      .nx-modal-button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 0.25rem;
        font-family: inherit;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .nx-modal-button.primary {
        background: var(--color-primary);
        color: white;
      }

      .nx-modal-button.primary:hover {
        background: var(--color-primary-dark);
      }

      .nx-modal-button.secondary {
        background: transparent;
        color: var(--text-color);
        border: 1px solid var(--border-color);
      }

      .nx-modal-button.secondary:hover {
        background: var(--hover-bg);
      }

      /* Animations */
      .animation-slide .nx-modal-dialog {
        transform: translateY(2rem);
      }

      .animation-slide.open .nx-modal-dialog {
        transform: translateY(0);
      }

      .animation-scale .nx-modal-dialog {
        transform: scale(0.7);
      }

      .animation-scale.open .nx-modal-dialog {
        transform: scale(1);
      }

      .animation-none .nx-modal-backdrop,
      .animation-none .nx-modal-dialog {
        transition: none;
      }
    `;
  }

  protected afterRender(): void {
    // Close button
    const closeBtn = this.$('.nx-modal-close');
    if (closeBtn) {
      this.on(closeBtn, 'click', () => this.close());
    }

    // Backdrop click
    const backdrop = this.$('.nx-modal-backdrop');
    if (backdrop && this.getProp('close-on-backdrop', true)) {
      this.on(backdrop, 'click', () => this.close());
    }

    // Footer buttons
    this.$$('.nx-modal-button').forEach(btn => {
      this.on(btn, 'click', (e: Event) => {
        const action = (e.target as HTMLElement).dataset.action;
        if (action === 'cancel') {
          this.close();
        } else if (action === 'confirm') {
          this.confirm();
        }
      });
    });

    // Escape key
    if (this.getProp('close-on-escape', true)) {
      this.on(document, 'keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Escape' && this.getState('open')) {
          this.close();
        }
      });
    }

    // Focus trap
    if (this.getState('open')) {
      this.setupFocusTrap();
    }
  }

  private setupFocusTrap(): void {
    const focusableElements = this.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    firstElement?.focus();

    this.on(this.shadow!, 'keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Tab') {
        if (keyEvent.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    });
  }

  open(): void {
    this.setState('open', true);
    this.setState('animating', true);
    this.setAttribute('open', '');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    this.setTimeout(() => {
      this.setState('animating', false);
      this.emit('open');
    }, 300);
  }

  close(): void {
    this.setState('animating', true);
    
    this.setTimeout(() => {
      this.setState('open', false);
      this.setState('animating', false);
      this.removeAttribute('open');
      
      // Restore body scroll
      document.body.style.overflow = '';
      
      this.emit('close');
    }, 300);
  }

  confirm(): void {
    this.emit('confirm');
    this.close();
  }

  show(config?: ModalConfig): void {
    if (config) {
      Object.entries(config).forEach(([key, value]) => {
        this.setAttribute(key, String(value));
      });
    }
    this.open();
  }

  protected onAttributeChange(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'open') {
      if (newValue !== null) {
        this.open();
      } else {
        this.close();
      }
    }
  }
}

customElements.define('nx-modal', NXModal);
