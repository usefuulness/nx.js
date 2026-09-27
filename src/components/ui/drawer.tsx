/**
 * @file @/components/ui/drawer.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { Overlays } from '@/core/overlays';
import { variants } from '@/core/variants';

export interface DrawerConfig {
  position?: 'left' | 'right' | 'top' | 'bottom';
  /** Width (left/right) or height (top/bottom): CSS length or px number. Default 24rem */
  size?: string | number;
  title?: string;
  description?: string;
  /** Dim and block the page behind (default true). `false` = non-modal side panel */
  backdrop?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  /** Can't be dismissed by the user (no ×, Escape or backdrop) */
  persistent?: boolean;
  /** Initially open */
  open?: boolean;
}

const sheet = variants({
  base: 'sheet',
  variants: { position: { left: 'left', right: 'right', top: 'top', bottom: 'bottom' } },
  defaultVariants: { position: 'right' }
});

/**
 * Slide-in panel (a "sheet"), built on the native `<dialog>` element:
 * focus trap, Escape, top layer and inert background come from the browser.
 *
 * ```tsx
 * let drawer;
 * <Drawer ref={d => (drawer = d)} title="Filters" position="right">
 *   …
 *   <DrawerFooter><Button onClick={() => drawer.close()}>Apply</Button></DrawerFooter>
 * </Drawer>
 * drawer.open();
 * ```
 * Events: `open`, `close`.
 */
export class NXDrawer extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['open', 'position', 'size', 'title', 'description', 'backdrop', 'close-on-backdrop', 'close-on-escape', 'persistent'];
  }

  private isOpen = false;
  private closeTimer = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  private get dialog(): HTMLDialogElement | null {
    return this.$('dialog') as HTMLDialogElement | null;
  }

  protected render(): Node {
    const size = this.getProp<string | number>('size');
    const title = this.getProp<string>('title');
    const description = this.getProp<string>('description');
    const persistent = this.getProp('persistent', false);
    const hasFooter = !!this.querySelector(':scope > [slot="footer"]');

    return (
      <dialog part="drawer" class={sheet({ position: this.getProp('position') })} aria-label={title || 'Panel'}
              style={size ? { '--drawer-size': typeof size === 'number' || /^\d+$/.test(String(size)) ? `${size}px` : String(size) } : undefined}
              onCancel={(e: Event) => {
                e.preventDefault();
                if (!persistent && this.getProp('close-on-escape', true)) this.close();
              }}
              onClick={(e: MouseEvent) => {
                // Clicks on the ::backdrop target the <dialog> itself, outside its box
                if (e.target !== this.dialog || persistent || !this.getProp('close-on-backdrop', true)) return;
                const r = this.dialog!.getBoundingClientRect();
                if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.close();
              }}>
        {(title || description || !persistent) && (
          <header class="header" part="header">
            <div class="heading">
              {title && <h2 class="title" part="title">{title}</h2>}
              {description && <p class="description" part="description">{description}</p>}
            </div>
            {!persistent && <button class="close" part="close" type="button" aria-label="Close" html={Icons.get('close')} onClick={() => this.close()} />}
          </header>
        )}
        <div class="content" part="content"><slot /></div>
        {hasFooter && <footer class="footer" part="footer"><slot name="footer" /></footer>}
      </dialog>
    );
  }

  protected afterRender(): void {
    // A re-render replaces the <dialog>; keep it open
    if (this.isOpen) this.show(this.dialog!);
  }

  private show(dialog: HTMLDialogElement): void {
    if (dialog.open) return;
    if (this.getProp('backdrop', true)) {
      dialog.showModal();
      Overlays.push(dialog);
    } else {
      dialog.show();
    }
  }

  open(): void {
    if (this.isOpen) return;
    window.clearTimeout(this.closeTimer);
    this.isOpen = true;
    if (!this.hasAttribute('open')) this.setAttribute('open', '');
    const dialog = this.dialog;
    if (dialog) {
      dialog.classList.remove('closing');
      this.show(dialog);
    }
    this.emit('open');
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.hasAttribute('open')) this.removeAttribute('open');
    const dialog = this.dialog;
    const finish = () => {
      dialog?.classList.remove('closing');
      dialog?.close();
      if (dialog) Overlays.remove(dialog);
      this.emit('close');
    };
    if (dialog?.open && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialog.classList.add('closing');
      this.closeTimer = window.setTimeout(finish, 200);
    } else {
      finish();
    }
  }

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  get opened(): boolean {
    return this.isOpen;
  }

  protected onAttributeChange(name: string, _old: string | null, value: string | null): void {
    if (name !== 'open') return;
    const want = value !== null && value !== 'false';
    if (want !== this.isOpen) queueMicrotask(() => (want ? this.open() : this.close()));
  }

  protected styles(): string {
    return `
      :host { display: contents; }

      .sheet {
        --drawer-size: 24rem;
        position: fixed;
        margin: 0;
        padding: 0;
        max-width: 100vw;
        max-height: 100dvh;
        border: 0 solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text);
        box-shadow: var(--shadow-xl);
        flex-direction: column;
        overflow: hidden;
      }

      .sheet[open] { display: flex; }

      .left, .right { top: 0; bottom: 0; height: 100dvh; width: min(var(--drawer-size), 90vw); }
      .top, .bottom { left: 0; right: 0; width: 100vw; height: min(var(--drawer-size), 90dvh); }
      .left { left: 0; right: auto; border-right-width: 1px; --from: translateX(-100%); }
      .right { right: 0; left: auto; border-left-width: 1px; --from: translateX(100%); }
      .top { top: 0; bottom: auto; border-bottom-width: 1px; --from: translateY(-100%); }
      .bottom { bottom: 0; top: auto; border-top-width: 1px; --from: translateY(100%); }

      .sheet[open] { animation: slide-in 250ms var(--transition-easing); }
      .sheet.closing { animation: slide-out 200ms var(--transition-easing) forwards; }
      @keyframes slide-in { from { transform: var(--from); } }
      @keyframes slide-out { to { transform: var(--from); } }

      .sheet::backdrop {
        background: var(--backdrop-bg);
        animation: fade-in 250ms var(--transition-easing);
      }
      .sheet.closing::backdrop { animation: fade-out 200ms var(--transition-easing) forwards; }
      @keyframes fade-in { from { opacity: 0; } }
      @keyframes fade-out { to { opacity: 0; } }

      .header {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1.25rem 1.25rem 0 1.5rem;
      }

      .heading { flex: 1; padding-top: 0.25rem; }
      .title { margin: 0; font-size: 1.0625rem; font-weight: 600; letter-spacing: -0.01em; }
      .description { margin: 0.375rem 0 0; color: var(--color-text-secondary); font-size: 0.875rem; }

      .close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        margin-left: auto;
        padding: 0;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        font-size: 1rem;
        cursor: pointer;
      }

      .close:hover { background: var(--color-accent); color: var(--color-text); }

      .content {
        flex: 1;
        min-height: 0;
        padding: 1rem 1.5rem 1.5rem;
        overflow: auto;
        font-size: 0.875rem;
      }

      .footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--color-border);
      }
    `;
  }
}

define('nx-drawer', NXDrawer);
