// src/components/ui/modal.ts
import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface ModalConfig {
  title?: string;
  content?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  backdrop?: boolean | 'static';
  keyboard?: boolean;
  animation?: 'fade' | 'slide' | 'scale' | 'none';
  buttons?: ModalButton[];
  autoFocus?: boolean;
  centered?: boolean;
}

export interface ModalButton {
  text: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  handler?: (modal: NXModal) => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Modern modal dialog component with animations and accessibility
 */
export class NXModal extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['open', 'title', 'size', 'closable', 'backdrop', 'keyboard', 'animation', 'centered'];
  }

  private previousFocus: HTMLElement | null = null;
  private focusTrap: FocusTrap | null = null;

  protected initializeState(): void {
    this[ComponentState].set('open', false);
    this[ComponentState].set('loading', false);
    this[ComponentState].set('animating', false);
  }

  constructor(config?: ModalConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    
    if (config) {
      Object.entries(config).forEach(([key, value]) => {
        if (key === 'buttons') {
          this[ComponentState].set('buttons', value);
        } else if (key === 'content') {
          this[ComponentState].set('content', value);
        } else {
          this.setAttribute(key, String(value));
        }
      });
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'dialog');
    this.setAttribute('aria-modal', 'true');
    
    if (this.getProp('open', false)) {
      this.open();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup();
  }

  protected render(): string {
    const open = this.getState('open', false);
    const animating = this.getState('animating', false);
    const title = this.getProp('title', '');
    const size = this.getProp('size', 'md');
    const closable = this.getProp('closable', true);
    const centered = this.getProp('centered', false);
    const animation = this.getProp('animation', 'fade');
    const content = this.getState('content', '');
    const buttons = this.getState('buttons', []) as ModalButton[];

    return `
      <div class="modal-wrapper ${open ? 'open' : ''} ${animating ? 'animating' : ''} ${animation}" 
           part="wrapper">
        <div class="modal-backdrop" part="backdrop"></div>
        <div class="modal-container ${centered ? 'centered' : ''}" part="container">
          <div class="modal modal-${size}" part="modal" role="document">
            ${this.renderHeader(title, closable)}
            <div class="modal-body" part="body">
              ${content ? `<div class="modal-content">${content}</div>` : ''}
              <slot></slot>
            </div>
            ${buttons.length > 0 || this.hasFooterSlot() ? this.renderFooter(buttons) : ''}
          </div>
        </div>
      </div>
    `;
  }

  private renderHeader(title: string, closable: boolean): string {
    if (!title && !closable && !this.hasHeaderSlot()) return '';

    return `
      <div class="modal-header" part="header">
        <h2 class="modal-title" id="modal-title">
          <slot name="header">${title}</slot>
        </h2>
        ${closable ? `
          <button class="modal-close" 
                  aria-label="Close dialog" 
                  type="button"
                  data-action="close">
            <svg class="modal-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        ` : ''}
      </div>
    `;
  }

  private renderFooter(buttons: ModalButton[]): string {
    return `
      <div class="modal-footer" part="footer">
        <slot name="footer">
          ${buttons.map((btn, index) => `
            <button class="modal-button button-${btn.variant || 'secondary'} ${btn.loading ? 'loading' : ''}"
                    type="button"
                    data-action="${btn.text.toLowerCase().replace(/\s+/g, '-')}"
                    data-index="${index}"
                    ${btn.disabled ? 'disabled' : ''}>
              ${btn.loading ? '<span class="button-spinner"></span>' : ''}
              <span>${btn.text}</span>
            </button>
          `).join('')}
        </slot>
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        --modal-bg: var(--color-surface);
        --modal-border: var(--color-border);
        --modal-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        --modal-radius: var(--radius-lg);
        --backdrop-bg: rgba(0, 0, 0, 0.5);
        --animation-duration: 0.3s;
      }

      .modal-wrapper {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        display: none;
        opacity: 0;
      }

      .modal-wrapper.open {
        display: block;
      }

      .modal-wrapper.open.animating {
        opacity: 1;
      }

      /* Backdrop */
      .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--backdrop-bg);
        transition: opacity var(--animation-duration) ease-out;
        opacity: 0;
      }

      .modal-wrapper.animating .modal-backdrop {
        opacity: 1;
      }

      /* Container */
      .modal-container {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 2rem;
        overflow-y: auto;
      }

      .modal-container.centered {
        align-items: center;
      }

      /* Modal */
      .modal {
        position: relative;
        background: var(--modal-bg);
        border-radius: var(--modal-radius);
        box-shadow: var(--modal-shadow);
        width: 100%;
        max-width: 500px;
        margin: 2rem auto;
        display: flex;
        flex-direction: column;
        max-height: calc(100vh - 4rem);
      }

      /* Sizes */
      .modal-sm { max-width: 300px; }
      .modal-md { max-width: 500px; }
      .modal-lg { max-width: 800px; }
      .modal-xl { max-width: 1140px; }
      .modal-full { 
        max-width: calc(100vw - 4rem); 
        max-height: calc(100vh - 4rem);
        margin: 2rem;
      }

      /* Animations */
      .modal-wrapper.fade .modal {
        transition: all var(--animation-duration) ease-out;
        opacity: 0;
        transform: scale(0.95);
      }

      .modal-wrapper.fade.animating .modal {
        opacity: 1;
        transform: scale(1);
      }

      .modal-wrapper.slide .modal {
        transition: all var(--animation-duration) ease-out;
        transform: translateY(-50px);
        opacity: 0;
      }

      .modal-wrapper.slide.animating .modal {
        transform: translateY(0);
        opacity: 1;
      }

      .modal-wrapper.scale .modal {
        transition: all var(--animation-duration) cubic-bezier(0.34, 1.56, 0.64, 1);
        transform: scale(0);
        opacity: 0;
      }

      .modal-wrapper.scale.animating .modal {
        transform: scale(1);
        opacity: 1;
      }

      .modal-wrapper.none .modal {
        transition: none;
      }

      /* Header */
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5rem;
        border-bottom: 1px solid var(--modal-border);
        flex-shrink: 0;
      }

      .modal-title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--color-text);
        flex: 1;
      }

      .modal-close {
        background: none;
        border: none;
        padding: 0.5rem;
        margin: -0.5rem -0.5rem -0.5rem 0.5rem;
        cursor: pointer;
        color: var(--color-text-secondary);
        border-radius: var(--radius-sm);
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .modal-close:hover {
        background: var(--color-background);
        color: var(--color-text);
      }

      .modal-close:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .modal-close-icon {
        width: 1.25rem;
        height: 1.25rem;
      }

      /* Body */
      .modal-body {
        flex: 1;
        padding: 1.5rem;
        overflow-y: auto;
        color: var(--color-text);
      }

      .modal-content {
        line-height: 1.6;
      }

      /* Footer */
      .modal-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--modal-border);
        flex-shrink: 0;
      }

      /* Buttons */
      .modal-button {
        padding: 0.5rem 1rem;
        border-radius: var(--radius-md);
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .modal-button:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .modal-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .button-primary {
        background: var(--color-primary);
        color: white;
      }

      .button-primary:hover:not(:disabled) {
        background: var(--color-primary-dark);
      }

      .button-secondary {
        background: var(--color-background);
        color: var(--color-text);
        border: 1px solid var(--color-border);
      }

      .button-secondary:hover:not(:disabled) {
        background: var(--color-surface);
      }

      .button-danger {
        background: var(--color-error);
        color: white;
      }

      .button-danger:hover:not(:disabled) {
        filter: brightness(0.9);
      }

      .button-ghost {
        background: transparent;
        color: var(--color-text);
      }

      .button-ghost:hover:not(:disabled) {
        background: var(--color-background);
      }

      /* Loading state */
      .button-spinner {
        width: 1rem;
        height: 1rem;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      /* Mobile responsiveness */
      @media (max-width: 640px) {
        .modal-container {
          padding: 1rem;
        }

        .modal {
          margin: 0;
          max-height: 100%;
          border-radius: 0;
        }

        .modal-full {
          max-width: 100%;
          max-height: 100%;
          margin: 0;
        }
      }
    `;
  }

  protected afterRender(): void {
    // Close button
    this.on('.modal-close', 'click', () => this.close());

    // Backdrop click
    const backdrop = this.$('.modal-backdrop');
    if (backdrop && this.getProp('backdrop') !== 'static') {
      backdrop.addEventListener('click', () => {
        if (this.getProp('backdrop') !== false) {
          this.close();
        }
      });
    }

    // Button handlers
    this.$$('.modal-button').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const index = parseInt((btn as HTMLElement).dataset.index || '0');
        const buttons = this.getState('buttons', []) as ModalButton[];
        const button = buttons[index];

        if (button?.handler) {
          // Set loading state
          if (button.loading !== false) {
            this.setButtonLoading(index, true);
          }

          try {
            await button.handler(this);
            // Handler might close the modal, so check if still connected
            if (this.isConnected && button.loading !== false) {
              this.setButtonLoading(index, false);
            }
          } catch (error) {
            console.error('Modal button handler error:', error);
            this.setButtonLoading(index, false);
          }
        }
      });
    });

    // Keyboard handling
    if (this.getProp('keyboard', true)) {
      this.handleKeyboard();
    }

    // Focus management
    if (this.getState('open') && this.getProp('autoFocus', true)) {
      this.manageFocus();
    }
  }

  private handleKeyboard(): void {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.getState('open')) {
        e.preventDefault();
        this.close();
      }
    };

    document.addEventListener('keydown', handler);
    
    // Store for cleanup
    this[ComponentState].set('keyboardHandler', handler);
  }

  private manageFocus(): void {
    // Store previously focused element
    this.previousFocus = document.activeElement as HTMLElement;

    // Focus first focusable element
    requestAnimationFrame(() => {
      const focusable = this.shadow?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusable && focusable.length > 0) {
        (focusable[0] as HTMLElement).focus();
      }

      // Set up focus trap
      this.setupFocusTrap();
    });
  }

  private setupFocusTrap(): void {
    const modalElement = this.$('.modal');
    if (!modalElement) return;

    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    modalElement.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    });
  }

  private setButtonLoading(index: number, loading: boolean): void {
    const buttons = [...(this.getState('buttons', []) as ModalButton[])];
    if (buttons[index]) {
      buttons[index] = { ...buttons[index], loading, disabled: loading };
      this.setState('buttons', buttons);
    }
  }

  private hasHeaderSlot(): boolean {
    return !!this.querySelector('[slot="header"]');
  }

  private hasFooterSlot(): boolean {
    return !!this.querySelector('[slot="footer"]');
  }

  protected cleanup(): void {
    // Remove keyboard handler
    const handler = this.getState('keyboardHandler');
    if (handler) {
      document.removeEventListener('keydown', handler);
    }

    // Restore focus
    if (this.previousFocus && this.previousFocus.focus) {
      this.previousFocus.focus();
    }
  }

  // Public API

  /**
   * Open the modal
   */
  async open(): Promise<void> {
    if (this.getState('open')) return;

    this.setState('open', true);
    this.setState('animating', false);

    // Trigger animation
    requestAnimationFrame(() => {
      this.setState('animating', true);
      this.dispatchEvent(new CustomEvent('open'));
    });
  }

  /**
   * Close the modal
   */
  async close(): Promise<void> {
    if (!this.getState('open')) return;

    this.setState('animating', false);

    // Wait for animation
    const animation = this.getProp('animation', 'fade');
    const duration = animation === 'none' ? 0 : 300;

    setTimeout(() => {
      this.setState('open', false);
      this.cleanup();
      this.dispatchEvent(new CustomEvent('close'));
    }, duration);
  }

  /**
   * Toggle modal open/close
   */
  toggle(): void {
    if (this.getState('open')) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Update modal content
   */
  setContent(content: string): void {
    this.setState('content', content);
  }

  /**
   * Update modal buttons
   */
  setButtons(buttons: ModalButton[]): void {
    this.setState('buttons', buttons);
  }

  /**
   * Static helper to create and show a modal
   */
  static async show(config: ModalConfig & { parent?: HTMLElement }): Promise<any> {
    return new Promise((resolve, reject) => {
      const modal = new NXModal({
        ...config,
        buttons: config.buttons || [
          {
            text: 'Cancel',
            variant: 'secondary',
            handler: (m) => {
              m.close();
              reject('cancelled');
            }
          },
          {
            text: 'OK',
            variant: 'primary',
            handler: (m) => {
              m.close();
              resolve(true);
            }
          }
        ]
      });

      modal.addEventListener('close', () => {
        modal.remove();
      });

      const parent = config.parent || document.body;
      parent.appendChild(modal);
      modal.open();
    });
  }

  /**
   * Static helper for confirm dialog
   */
  static confirm(message: string, title = 'Confirm'): Promise<boolean> {
    return NXModal.show({
      title,
      content: message,
      size: 'sm',
      buttons: [
        {
          text: 'Cancel',
          variant: 'secondary',
          handler: (m) => m.close()
        },
        {
          text: 'Confirm',
          variant: 'primary',
          handler: (m) => m.close()
        }
      ]
    });
  }

  /**
   * Static helper for alert dialog
   */
  static alert(message: string, title = 'Alert'): Promise<void> {
    return NXModal.show({
      title,
      content: message,
      size: 'sm',
      buttons: [
        {
          text: 'OK',
          variant: 'primary',
          handler: (m) => m.close()
        }
      ]
    });
  }
}

// Focus trap helper
interface FocusTrap {
  activate(): void;
  deactivate(): void;
}

customElements.define('nx-modal', NXModal);
