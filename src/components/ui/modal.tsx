/**
 * @file @/components/ui/modal.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { ComponentRegistry, define, type ItemConfig } from '@/core/registry';
import { Icons } from '@/core/icons';
import { Overlays } from '@/core/overlays';

export interface ModalButton {
  text: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  icon?: string;
  /** Value the modal resolves with when this button closes it */
  value?: any;
  /** Return `false` to keep the modal open */
  handler?: (modal: NXModal) => void | boolean | Promise<void | boolean>;
}

export interface ModalConfig {
  title?: string;
  description?: string;
  /** Body HTML */
  html?: string;
  /** Body components */
  items?: ItemConfig[];
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  buttons?: ModalButton[];
  /** Remove the element from the DOM after it closes */
  destroyOnClose?: boolean;
}

/**
 * Modal dialog built on the native `<dialog>` element (focus trap, Escape,
 * top layer and inert background for free).
 *
 * Most of the time you want the helpers instead:
 * ```typescript
 * await NX.alert('Saved!');
 * if (await NX.confirm('Delete 3 users?', { danger: true })) { ... }
 * const name = await NX.prompt('Project name');
 * const result = await NX.dialog({ title: 'Edit', items: [...], buttons: [...] });
 * ```
 *
 * ```html
 * <nx-modal title="Hello" id="dlg">Body <nx-button slot="footer">OK</nx-button></nx-modal>
 * <script>document.getElementById('dlg').open()</script>
 * ```
 *
 * Events: `open`, `close` (detail: `{ value }`).
 */
export class NXModal extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['title', 'description', 'size', 'closable', 'close-on-backdrop', 'close-on-escape'];
  }

  private buttons: ModalButton[] = [];
  private resolvers: Array<(value: any) => void> = [];
  private isOpen = false;

  protected initializeState(): void {}

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setButtons(buttons: ModalButton[]): void {
    this.buttons = buttons;
    this.scheduleUpdate();
  }

  get dialog(): HTMLDialogElement | null {
    return this.$('dialog') as HTMLDialogElement | null;
  }

  protected render(): Node {
    const title = this.getProp<string>('title', '');
    const description = this.getProp<string>('description', '');
    const closable = this.getProp('closable', true);
    const hasFooter = this.buttons.length > 0 || !!this.querySelector(':scope > [slot="footer"]');

    return (
      <dialog class={['nx-modal', `size-${this.getProp('size', 'md')}`]} part="dialog"
              aria-labelledby={title ? 'title' : undefined} aria-label={title ? undefined : 'Dialog'}
              onCancel={(e: Event) => {
                e.preventDefault();
                if (this.getProp('close-on-escape', true)) this.close();
              }}
              onClick={(e: MouseEvent) => this.onDialogClick(e)}>
        {(title || closable) && (
          <header class="nx-modal-header" part="header">
            <div class="nx-modal-heading">
              {title && <h2 id="title" class="nx-modal-title" part="title">{title}</h2>}
              {description && <p class="nx-modal-description" part="description">{description}</p>}
            </div>
            {closable && (
              <button type="button" class="nx-modal-close" part="close" aria-label="Close" html={Icons.get('close')} onClick={() => this.close()} />
            )}
          </header>
        )}
        <div class="nx-modal-body" part="body"><slot /></div>
        {hasFooter && (
          <footer class="nx-modal-footer" part="footer">
            <slot name="footer" />
            {/* Footer buttons are real nx-buttons so they look like the rest of the app */}
            <span class="nx-modal-buttons">
              {this.buttons.map(config => (
                <nx-button text={config.text} icon={config.icon} variant={config.variant ?? 'outline'}
                           onClick={async () => {
                             const keepOpen = (await config.handler?.(this)) === false;
                             if (!keepOpen) this.close(config.value);
                           }} />
              ))}
            </span>
          </footer>
        )}
      </dialog>
    );
  }

  /** Backdrop click: the click target is the <dialog> itself, outside its box. */
  private onDialogClick(e: MouseEvent): void {
    const dialog = this.dialog;
    if (!dialog || e.target !== dialog || !this.getProp('close-on-backdrop', true)) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.close();
  }

  protected afterRender(): void {
    // Re-rendering replaces the <dialog>; keep it modal if we were open
    const dialog = this.dialog!;
    if (this.isOpen && !dialog.open) dialog.showModal();
  }

  /**
   * Open the modal. Resolves with the value passed to `close()`
   * (or the clicked button's `value`; `undefined` when dismissed).
   */
  open(): Promise<any> {
    // Reopened during the close animation: finish that close first
    if (this.pendingClose) this.pendingClose();
    if (!this.isConnected) document.body.appendChild(this);
    const promise = new Promise(resolve => this.resolvers.push(resolve));
    if (!this.isOpen) {
      this.isOpen = true;
      const dialog = this.dialog;
      if (dialog && !dialog.open) dialog.showModal();
      if (dialog) Overlays.push(dialog);
      this.setAttribute('open', '');
      this.emit('open');
      requestAnimationFrame(() => this.focusFirst());
    }
    return promise;
  }

  close(value?: any): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.removeAttribute('open');
    const dialog = this.dialog;
    // Promises of *this* open cycle; a later open() gets its own
    const resolvers = this.resolvers.splice(0);
    let timer = 0;

    const finish = () => {
      window.clearTimeout(timer);
      this.pendingClose = null;
      dialog?.close();
      dialog?.classList.remove('closing');
      if (dialog) Overlays.remove(dialog);
      this.emit('close', { value });
      resolvers.forEach(resolve => resolve(value));
      if (this.getProp('destroy-on-close', false) && !this.isOpen) this.remove();
    };

    if (dialog && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialog.classList.add('closing');
      this.pendingClose = finish;
      timer = window.setTimeout(finish, 150);
    } else {
      finish();
    }
  }

  private pendingClose: (() => void) | null = null;

  /** @deprecated use `open()` — kept for compatibility */
  show(config?: ModalConfig): Promise<any> {
    if (config) this.configure(config);
    return this.open();
  }

  confirm(): void {
    this.emit('confirm');
    this.close(true);
  }

  private focusFirst(): void {
    const target = this.querySelector('[autofocus], input, textarea, nx-textfield, nx-select') as HTMLElement | null;
    if (target) {
      target.focus();
      return;
    }
    const holder = this.$('.nx-modal-buttons');
    const last = holder?.lastElementChild as HTMLElement | null;
    last?.focus();
  }

  protected styles(): string {
    return `
      :host { display: contents; }

      .nx-modal {
        width: calc(100% - 2rem);
        max-height: calc(100% - 2rem);
        padding: 0;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        color: var(--color-text);
        box-shadow: var(--shadow-xl);
        overflow: hidden;
        flex-direction: column;
      }

      .nx-modal[open] {
        display: flex;
        animation: nx-modal-in 180ms var(--transition-easing);
      }

      .nx-modal.closing {
        animation: nx-modal-out 150ms var(--transition-easing) forwards;
      }

      .nx-modal::backdrop {
        background: var(--backdrop-bg);
        backdrop-filter: blur(2px);
        animation: nx-fade-in 180ms var(--transition-easing);
      }

      .nx-modal.closing::backdrop {
        animation: nx-fade-out 150ms var(--transition-easing) forwards;
      }

      @keyframes nx-modal-in { from { opacity: 0; transform: translateY(8px) scale(0.97); } }
      @keyframes nx-modal-out { to { opacity: 0; transform: translateY(4px) scale(0.98); } }
      @keyframes nx-fade-in { from { opacity: 0; } }
      @keyframes nx-fade-out { to { opacity: 0; } }

      .size-sm { max-width: 24rem; }
      .size-md { max-width: 32rem; }
      .size-lg { max-width: 48rem; }
      .size-xl { max-width: 64rem; }
      .size-full { max-width: none; height: calc(100% - 2rem); }

      .nx-modal-header {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1.25rem 1.25rem 0 1.5rem;
      }

      .nx-modal-heading { flex: 1; padding-top: 0.25rem; }

      .nx-modal-title {
        margin: 0;
        font-size: 1.0625rem;
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      .nx-modal-description {
        margin: 0.375rem 0 0;
        color: var(--color-text-secondary);
        font-size: 0.875rem;
      }

      .nx-modal-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        margin: -0.25rem -0.25rem 0 auto;
        padding: 0;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        font-size: 1rem;
        cursor: pointer;
      }

      .nx-modal-close:hover {
        background: var(--color-accent);
        color: var(--color-text);
      }

      .nx-modal-body {
        flex: 1;
        min-height: 0;
        padding: 1rem 1.5rem 1.5rem;
        overflow: auto;
        font-size: 0.875rem;
        line-height: 1.6;
      }

      .nx-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 0 1.5rem 1.5rem;
      }

      .nx-modal-buttons {
        display: contents;
      }

      @media (max-width: 480px) {
        .nx-modal-footer { flex-direction: column-reverse; }
        .nx-modal-footer ::slotted(*), .nx-modal-buttons > * { width: 100%; }
      }
    `;
  }
}

define('nx-modal', NXModal);

// ────────── Imperative helpers ──────────

/**
 * Open a modal from a config. Resolves with the clicked button's `value`,
 * or `undefined` when dismissed.
 */
export function dialog(config: ModalConfig): Promise<any> {
  const { items, html, ...rest } = config;
  const modal = ComponentRegistry.build({ xtype: 'modal', destroyOnClose: true, ...rest }) as NXModal;
  if (html) modal.innerHTML = html;
  if (items) ComponentRegistry.appendItems(modal, items);
  return modal.open();
}

/** Show a message with an OK button. */
export function alert(message: string, options: { title?: string; okText?: string } = {}): Promise<void> {
  return dialog({
    title: options.title ?? 'Notice',
    items: [<p style="margin: 0">{message}</p>],
    size: 'sm',
    buttons: [{ text: options.okText ?? 'OK', variant: 'primary' }]
  });
}

/** Ask a yes/no question. Resolves `true` when confirmed. */
export async function confirm(
  message: string,
  options: { title?: string; confirmText?: string; cancelText?: string; danger?: boolean } = {}
): Promise<boolean> {
  const result = await dialog({
    title: options.title ?? 'Are you sure?',
    description: message,
    size: 'sm',
    buttons: [
      { text: options.cancelText ?? 'Cancel', variant: 'outline', value: false },
      { text: options.confirmText ?? 'Confirm', variant: options.danger ? 'danger' : 'primary', value: true }
    ]
  });
  return result === true;
}

/** Ask for a line of text. Resolves with the text, or `null` when cancelled. */
export async function prompt(
  message: string,
  options: { title?: string; defaultValue?: string; placeholder?: string; okText?: string } = {}
): Promise<string | null> {
  const result = await dialog({
    title: options.title ?? message,
    description: options.title ? message : undefined,
    size: 'sm',
    items: [{
      xtype: 'textfield',
      value: options.defaultValue ?? '',
      placeholder: options.placeholder ?? '',
      listeners: {
        // Enter submits
        enter: (e: Event) => {
          const field = e.currentTarget as HTMLElement & { value: string };
          (field.closest('nx-modal') as NXModal | null)?.close(field.value);
        }
      }
    }],
    buttons: [
      { text: 'Cancel', variant: 'outline', value: null },
      {
        text: options.okText ?? 'OK',
        variant: 'primary',
        handler: modal => {
          const field = modal.querySelector('nx-textfield') as (HTMLElement & { value: string }) | null;
          modal.close(field?.value ?? '');
          return false;
        }
      }
    ]
  });
  return result ?? null;
}
