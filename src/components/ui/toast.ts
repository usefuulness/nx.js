// nx-toast.ts

import { BaseComponent, ComponentState } from '@/components/abstracts/base';
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Represents a single toast notification.
 */
interface Toast {
  /** Unique identifier for this toast */
  id: number;
  /** Text message to display */
  message: string;
  /** Visual style variant */
  type: ToastType;
  /** Milliseconds until auto-dismiss */
  duration: number;
}

/**
 * A toast notification container that shows transient messages.
 *
 * @example
 * ```ts
 * const toasts = document.createElement('nx-toast') as NXToast;
 * document.body.appendChild(toasts);
 * toasts.show('Saved successfully!', 'success', 2000);
 * ```
 */
export class NXToast extends BaseComponent {
  /** Watch for declarative toast via attributes */
  static get observedAttributes(): string[] {
    return ['message', 'type', 'duration'];
  }

  /**
   * Set up initial state without triggering render.
   */
  protected initializeState(): void {
    this[ComponentState].set('toasts', [] as Toast[]);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /**
   * If `message` attribute changes, show a new toast with current `type` & `duration`.
   */
  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'message' && value) {
      const type = (this.getAttribute('type') as ToastType) || 'info';
      const duration = parseInt(this.getAttribute('duration') || '3000', 10);
      this.show(value, type, duration);
    }
  }

  /**
   * Display a new toast.
   *
   * @param message - The message text.
   * @param type - One of 'success', 'error', 'warning', 'info'.
   * @param duration - How long (ms) before it auto-closes.
   */
  public show(message: string, type: ToastType = 'info', duration: number = 3000): void {
    const id = Date.now();
    const current = this.getState('toasts') ?? ([] as Toast[]);
    this.setState('toasts', [...current, { id, message, type, duration }]);
    this.update();

    setTimeout(() => this.removeToast(id), duration);
  }

  /**
   * Remove a toast by its ID.
   *
   * @param id - Identifier of the toast to remove.
   */
  public removeToast(id: number): void {
    const toasts = this.getState('toasts', [] as Toast[]) || [];
    const remaining = toasts.filter(t => t.id !== id);
    this.setState('toasts', remaining);
    this.update();
  }

  /**
   * Generate the HTML for the current toasts.
   */
  protected render(): string {
    const toasts = this.getState('toasts', [] as Toast[]) || [];
    return `
      <div class="toast-container">
        ${(toasts || [])
          .map(
            t => `
          <div class="toast toast-${t.type}" data-id="${t.id}">
            <span>${t.message}</span>
            <button class="toast-close" data-id="${t.id}" aria-label="Dismiss">&times;</button>
          </div>`
          )
          .join('')}
      </div>
    `;
  }

  /**
   * CSS styles for the toast UI.
   */
  protected styles(): string {
    return `
      .toast-container {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .toast {
        background-color: var(--color-surface);
        color: var(--color-text);
        padding: 1rem 1.5rem;
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        min-width: 250px;
        animation: slideIn 0.3s ease-out;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to   { transform: translateX(0); opacity: 1; }
      }
      .toast-success { border-left: 4px solid var(--color-success); }
      .toast-error   { border-left: 4px solid var(--color-error); }
      .toast-warning { border-left: 4px solid var(--color-warning); }
      .toast-info    { border-left: 4px solid var(--color-primary); }
      .toast-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: var(--color-text-secondary);
        padding: 0;
        line-height: 1;
      }
    `;
  }

  /**
   * After each render, bind close-button clicks.
   */
  protected afterRender(): void {
    this.$$('.toast-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number((btn as HTMLElement).dataset.id);
        this.removeToast(id);
      });
    });
  }

  /**
   * Re-render shadow DOM.
   */
  protected update(): void {
    if (!this.shadow) return;
    this.shadow.innerHTML = `
      <style>${this.styles()}</style>
      ${this.render()}
    `;
    this.afterRender();
  }
}

customElements.define('nx-toast', NXToast);
