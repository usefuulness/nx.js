/**
 * @file @/components/ui/toast.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent, escapeHTML } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'default';

export interface ToastOptions {
  type?: ToastType;
  /** Secondary line under the message */
  description?: string;
  /** ms before auto-dismiss; 0 keeps it until closed. Default 4000 */
  duration?: number;
  /** Optional action button */
  action?: { text: string; handler: () => void };
}

export interface ToastHandle {
  close(): void;
}

let toastSeq = 0;

/**
 * Toast notifications. You normally don't create this yourself:
 *
 * ```typescript
 * NX.toast('Saved');
 * NX.toast.success('Profile updated', { description: 'Changes are live.' });
 * NX.toast.error('Upload failed', { action: { text: 'Retry', handler: retry } });
 * ```
 */
export class NXToast extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['position'];
  }

  protected initializeState(): void {}

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /** Show a toast. Old signature `show(message, type, duration)` still works. */
  show(message: string, typeOrOptions: ToastType | ToastOptions = {}, duration?: number): ToastHandle {
    const options: ToastOptions = typeof typeOrOptions === 'string'
      ? { type: typeOrOptions, duration }
      : typeOrOptions;
    const type = options.type ?? 'default';
    const id = ++toastSeq;
    const list = this.$('.list');

    const item = document.createElement('div');
    item.className = `toast type-${type}`;
    item.dataset.id = String(id);
    item.setAttribute('role', type === 'error' ? 'alert' : 'status');
    item.innerHTML = `
      ${type !== 'default' ? `<span class="icon">${Icons.get(type)}</span>` : ''}
      <div class="content">
        <div class="message">${escapeHTML(message)}</div>
        ${options.description ? `<div class="description">${escapeHTML(options.description)}</div>` : ''}
      </div>
      ${options.action ? `<button class="action" type="button">${escapeHTML(options.action.text)}</button>` : ''}
      <button class="close" type="button" aria-label="Dismiss">${Icons.get('close')}</button>
    `;

    let timer = 0;
    const close = () => {
      window.clearTimeout(timer);
      if (item.classList.contains('leaving')) return;
      item.classList.add('leaving');
      setTimeout(() => item.remove(), 180);
    };
    const arm = () => {
      const ms = options.duration ?? 4000;
      if (ms > 0) timer = window.setTimeout(close, ms);
    };

    item.querySelector('.close')!.addEventListener('click', close);
    item.querySelector('.action')?.addEventListener('click', () => {
      options.action!.handler();
      close();
    });
    // Pause while hovered
    item.addEventListener('mouseenter', () => window.clearTimeout(timer));
    item.addEventListener('mouseleave', arm);

    list?.appendChild(item);
    arm();
    return { close };
  }

  /** Remove every toast. */
  clear(): void {
    this.$$('.toast').forEach(el => el.remove());
  }

  protected render(): string {
    return `<div class="list" part="list" aria-live="polite"></div>`;
  }

  protected styles(): string {
    const position = this.getProp<string>('position', 'bottom-right');
    const [vertical, horizontal] = position.split('-');

    return `
      .list {
        position: fixed;
        ${vertical === 'top' ? 'top' : 'bottom'}: 1rem;
        ${horizontal === 'left' ? 'left: 1rem;' : horizontal === 'center' ? 'left: 50%; transform: translateX(-50%);' : 'right: 1rem;'}
        z-index: 2147483000;
        display: flex;
        flex-direction: ${vertical === 'top' ? 'column' : 'column-reverse'};
        gap: 0.5rem;
        width: min(22rem, calc(100vw - 2rem));
        pointer-events: none;
      }

      .toast {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.875rem 0.875rem 0.875rem 1rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        color: var(--color-text);
        box-shadow: var(--shadow-lg);
        font-size: 0.875rem;
        pointer-events: auto;
        animation: in 220ms var(--transition-easing);
      }

      .toast.leaving {
        animation: out 180ms var(--transition-easing) forwards;
      }

      @keyframes in {
        from { opacity: 0; transform: translateY(${vertical === 'top' ? '-' : ''}0.5rem) scale(0.97); }
      }

      @keyframes out {
        to { opacity: 0; transform: scale(0.96); }
      }

      .icon {
        display: inline-flex;
        margin-top: 0.0625rem;
        font-size: 1.125rem;
      }

      .type-success .icon { color: var(--color-success); }
      .type-error .icon { color: var(--color-error); }
      .type-warning .icon { color: var(--color-warning); }
      .type-info .icon { color: var(--color-info); }

      .content {
        flex: 1;
        min-width: 0;
        padding-top: 0.0625rem;
      }

      .message { font-weight: 500; }

      .description {
        margin-top: 0.125rem;
        color: var(--color-text-secondary);
      }

      button {
        font: inherit;
        cursor: pointer;
      }

      .action {
        align-self: center;
        height: 1.75rem;
        padding: 0 0.625rem;
        border: none;
        border-radius: var(--radius-sm);
        background: var(--color-primary);
        color: var(--color-primary-foreground);
        font-size: 0.8125rem;
        font-weight: 500;
      }

      .close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        opacity: 0.7;
      }

      .close:hover {
        opacity: 1;
        background: var(--color-accent);
      }
    `;
  }
}

define('nx-toast', NXToast);

function container(): NXToast {
  let el = document.querySelector('nx-toast') as NXToast | null;
  if (!el) {
    el = document.createElement('nx-toast') as NXToast;
    document.body.appendChild(el);
  }
  return el;
}

type ToastFn = ((message: string, options?: ToastOptions | ToastType) => ToastHandle) & {
  success(message: string, options?: Omit<ToastOptions, 'type'>): ToastHandle;
  error(message: string, options?: Omit<ToastOptions, 'type'>): ToastHandle;
  warning(message: string, options?: Omit<ToastOptions, 'type'>): ToastHandle;
  info(message: string, options?: Omit<ToastOptions, 'type'>): ToastHandle;
  clear(): void;
};

/** Show a toast notification. */
export const toast: ToastFn = Object.assign(
  (message: string, options: ToastOptions | ToastType = {}) => container().show(message, options),
  {
    success: (message: string, options: Omit<ToastOptions, 'type'> = {}) => container().show(message, { ...options, type: 'success' }),
    error: (message: string, options: Omit<ToastOptions, 'type'> = {}) => container().show(message, { ...options, type: 'error' }),
    warning: (message: string, options: Omit<ToastOptions, 'type'> = {}) => container().show(message, { ...options, type: 'warning' }),
    info: (message: string, options: Omit<ToastOptions, 'type'> = {}) => container().show(message, { ...options, type: 'info' }),
    clear: () => container().clear()
  }
);
