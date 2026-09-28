/**
 * @file @/components/ui/menu.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * Dropdown menus. One popup primitive (`nx-menu-popup`, rendered in the top
 * layer so no `overflow: hidden` ancestor can clip it) powers:
 *   - `{ xtype: 'menu', text: 'Actions', items: [...] }`   a trigger + dropdown
 *   - `{ xtype: 'button', text: 'Export', menu: [...] }`   any button with a menu
 *   - `{ xtype: 'menubar', items: [{ text: 'File', items: [...] }] }`
 *   - `NX.menu(items, event)`                               context menus
 */
import { place, type Placement } from '@/core/position';
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { Overlays } from '@/core/overlays';

export interface MenuItem {
  id?: string;
  text?: string;
  icon?: string;
  /** Right-aligned hint, e.g. `⌘S` */
  shortcut?: string;
  disabled?: boolean;
  /** Red, for destructive actions */
  danger?: boolean;
  /** Show a check mark */
  checked?: boolean;
  /** Render a separator (or use the string `'-'`) */
  divider?: boolean;
  /** Non-interactive section label */
  heading?: string;
  /** Nested menu (alias: `submenu`) */
  items?: MenuItemLike[];
  submenu?: MenuItemLike[];
  href?: string;
  handler?: (item: MenuItem) => void;
  /** @deprecated alias of `handler` */
  action?: () => void;
}

export type MenuItemLike = MenuItem | '-' | null | undefined | false;

export interface MenuOpenOptions {
  /** Where to open relative to an anchor element */
  placement?: 'bottom-start' | 'bottom-end' | 'right-start';
  /** Element to refocus when the menu closes */
  returnFocus?: HTMLElement | null;
  /** Focus the first item right away (keyboard open) */
  focusFirst?: boolean;
  onSelect?: (item: MenuItem) => void;
  onClose?: () => void;
}

const children = (item: MenuItem): MenuItemLike[] | undefined => item.items ?? item.submenu;

const normalize = (items: MenuItemLike[]): MenuItem[] =>
  items
    .filter((i): i is MenuItem | '-' => !!i)
    .map(i => (i === '-' ? { divider: true } : i));

/**
 * The floating menu surface. Created on demand — you normally don't use it directly.
 */
export class NXMenuPopup extends BaseComponent {
  private items: MenuItem[] = [];
  private options: MenuOpenOptions = {};
  private isOpen = false;
  private readonly onDocPointer = (e: Event) => {
    if (!e.composedPath().includes(this) && !e.composedPath().includes(this.options.returnFocus as EventTarget)) {
      this.close();
    }
  };
  private readonly onWindowChange = () => this.close();

  protected initializeState(): void {}

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /** Open at an element (dropdown) or a point (context menu). */
  open(items: MenuItemLike[], anchor: Element | { x: number; y: number }, options: MenuOpenOptions = {}): void {
    this.items = normalize(items);
    this.options = options;
    // Inside an open modal dialog everything else is inert, so mount within it
    const host = Overlays.host();
    if (this.parentElement !== host) host.appendChild(this);

    this.forceUpdate();
    this.setAttribute('popover', 'manual');
    try {
      (this as any).showPopover?.();
    } catch {
      // already shown / unsupported: the fixed z-indexed fallback still works
    }
    this.isOpen = true;
    this.position(anchor, options.placement ?? 'bottom-start');

    // Defer so the click that opened us doesn't immediately close us
    setTimeout(() => {
      document.addEventListener('pointerdown', this.onDocPointer, true);
      window.addEventListener('resize', this.onWindowChange);
      window.addEventListener('blur', this.onWindowChange);
    });

    if (options.focusFirst) this.focusItem(this.rootList(), 0);
    else (this.rootList() as HTMLElement | null)?.focus({ preventScroll: true });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    document.removeEventListener('pointerdown', this.onDocPointer, true);
    window.removeEventListener('resize', this.onWindowChange);
    window.removeEventListener('blur', this.onWindowChange);
    try {
      (this as any).hidePopover?.();
    } catch {
      // not shown
    }
    this.remove();
    const { returnFocus, onClose } = this.options;
    if (returnFocus && document.activeElement === document.body) returnFocus.focus({ preventScroll: true });
    onClose?.();
  }

  get opened(): boolean {
    return this.isOpen;
  }

  private rootList(): HTMLElement | null {
    return this.$('.list') as HTMLElement | null;
  }

  private position(anchor: Element | { x: number; y: number }, placement: Placement): void {
    place(this, anchor, placement);
  }

  // ────────── Rendering ──────────

  protected render(): Node {
    return this.renderList(this.items, '');
  }

  private renderList(items: MenuItem[], parent: string): Node {
    const anyIcon = items.some(i => i.icon || i.checked !== undefined);
    return (
      <div class={['list', { sub: parent }]} part={parent ? 'submenu' : 'menu'} role="menu" tabindex={-1} data-parent={parent}
           // Submenus are nested inside the root list, so their events bubble to its handlers
           {...(parent ? {} : {
             onClick: (e: MouseEvent) => this.onClick(e),
             onPointerOver: (e: PointerEvent) => this.onPointerOver(e),
             onKeyDown: (e: KeyboardEvent) => this.onKeyDown(e)
           })}>
        {items.map((item, i) => {
          const path = parent ? `${parent}.${i}` : String(i);
          if (item.divider) return <div class="divider" role="separator" />;
          if (item.heading) return <div class="heading" role="presentation">{item.heading}</div>;
          const sub = children(item);
          const checkable = item.checked !== undefined;
          const icon = checkable ? (item.checked ? Icons.get('check') : '') : Icons.get(item.icon);
          return (
            <div class={['item', { danger: item.danger }]} part="item" role={checkable ? 'menuitemcheckbox' : 'menuitem'}
                 data-path={path} tabindex={-1}
                 aria-checked={checkable ? String(!!item.checked) : undefined}
                 aria-disabled={item.disabled ? 'true' : undefined}
                 aria-haspopup={sub ? 'menu' : undefined}
                 aria-expanded={sub ? 'false' : undefined}>
              {anyIcon && <span class="icon" html={icon} />}
              <span class="text">{item.text ?? ''}</span>
              {item.shortcut && <span class="shortcut">{item.shortcut}</span>}
              {sub && <span class="chevron" html={Icons.get('chevron-right')} />}
              {sub && this.renderList(normalize(sub), path)}
            </div>
          );
        })}
      </div>
    );
  }

  private itemAt(path: string): MenuItem | null {
    let list = this.items;
    let item: MenuItem | null = null;
    for (const index of path.split('.').map(Number)) {
      item = list[index] ?? null;
      if (!item) return null;
      list = normalize(children(item) ?? []);
    }
    return item;
  }

  // ────────── Interaction ──────────

  private itemsOf(list: Element): HTMLElement[] {
    return Array.from(list.children).filter(el =>
      el.classList.contains('item') && el.getAttribute('aria-disabled') !== 'true'
    ) as HTMLElement[];
  }

  private focusItem(list: Element | null, index: number): void {
    if (!list) return;
    const items = this.itemsOf(list);
    if (!items.length) return;
    items[(index + items.length) % items.length].focus();
  }

  private openSub(itemEl: HTMLElement, focus = false): void {
    // Close sibling submenus
    itemEl.parentElement?.querySelectorAll(':scope > .item.open').forEach(el => el !== itemEl && this.closeSub(el as HTMLElement));
    const sub = itemEl.querySelector(':scope > .list') as HTMLElement | null;
    if (!sub) return;
    itemEl.classList.add('open');
    itemEl.setAttribute('aria-expanded', 'true');

    // Flip to the left if it would overflow the viewport
    sub.classList.remove('left');
    const rect = sub.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) sub.classList.add('left');

    if (focus) this.focusItem(sub, 0);
  }

  private closeSub(itemEl: HTMLElement): void {
    itemEl.classList.remove('open');
    itemEl.setAttribute('aria-expanded', 'false');
    itemEl.querySelectorAll('.item.open').forEach(el => this.closeSub(el as HTMLElement));
  }

  private activate(itemEl: HTMLElement): void {
    if (itemEl.getAttribute('aria-disabled') === 'true') return;
    const item = this.itemAt(itemEl.dataset.path!);
    if (!item) return;
    if (children(item)) {
      this.openSub(itemEl, true);
      return;
    }
    this.close();
    if (item.href) location.href = item.href;
    item.handler?.(item);
    item.action?.();
    this.options.onSelect?.(item);
  }

  private onClick(e: Event): void {
    const itemEl = (e.target as HTMLElement).closest('.item') as HTMLElement | null;
    if (itemEl) this.activate(itemEl);
  }

  private onPointerOver(e: Event): void {
    const itemEl = (e.target as HTMLElement).closest('.item') as HTMLElement | null;
    if (!itemEl) return;
    if (itemEl.getAttribute('aria-disabled') !== 'true') itemEl.focus({ preventScroll: true });
    itemEl.parentElement?.querySelectorAll(':scope > .item.open').forEach(el => el !== itemEl && this.closeSub(el as HTMLElement));
    if (itemEl.getAttribute('aria-haspopup')) this.openSub(itemEl);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const key = e.key;
    const active = this.shadow!.activeElement as HTMLElement | null;
    const list = (active?.classList.contains('list') ? active : active?.parentElement) as HTMLElement | null;
    if (!list) return;
    const items = this.itemsOf(list);
    const index = active ? items.indexOf(active) : -1;

    switch (key) {
      case 'ArrowDown':
        this.focusItem(list, index + 1);
        break;
      case 'ArrowUp':
        this.focusItem(list, index < 0 ? -1 : index - 1);
        break;
      case 'Home':
        this.focusItem(list, 0);
        break;
      case 'End':
        this.focusItem(list, -1);
        break;
      case 'ArrowRight':
        if (active?.getAttribute('aria-haspopup')) this.openSub(active, true);
        break;
      case 'ArrowLeft': {
        const parentItem = list.parentElement?.closest('.item') as HTMLElement | null;
        if (parentItem) {
          this.closeSub(parentItem);
          parentItem.focus();
        }
        break;
      }
      case 'Enter':
      case ' ':
        if (active?.classList.contains('item')) this.activate(active);
        break;
      case 'Escape':
      case 'Tab':
        this.close();
        if (key === 'Tab') return;
        break;
      default: {
        // Type-ahead
        if (key.length !== 1) return;
        const starts = (el: HTMLElement) => el.textContent!.trim().toLowerCase().startsWith(key.toLowerCase());
        (items.find((el, i) => i > index && starts(el)) ?? items.find(starts))?.focus();
      }
    }
    e.preventDefault();
  }

  protected styles(): string {
    return `
      :host {
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 0;
        border: none;
        background: transparent;
        overflow: visible;
        z-index: 2147482000;
        color: var(--color-text);
        font-family: var(--font-family);
        font-size: 0.875rem;
      }

      .list {
        min-width: 12rem;
        max-width: 20rem;
        padding: 0.25rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        box-shadow: var(--shadow-lg);
        outline: none;
        animation: nx-menu-in 120ms var(--transition-easing);
      }

      @keyframes nx-menu-in {
        from { opacity: 0; transform: translateY(-4px) scale(0.98); }
      }

      .sub {
        position: absolute;
        top: -0.3125rem;
        left: calc(100% + 0.25rem);
        display: none;
      }

      .sub.left {
        left: auto;
        right: calc(100% + 0.25rem);
      }

      .item.open > .sub { display: block; }

      .item {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        height: 2rem;
        padding: 0 0.5rem;
        border-radius: var(--radius-sm);
        cursor: default;
        user-select: none;
        outline: none;
        white-space: nowrap;
      }

      .item:focus,
      .item.open {
        background: var(--color-accent);
      }

      .item[aria-disabled="true"] {
        opacity: 0.5;
        pointer-events: none;
      }

      .item.danger { color: var(--color-error-text); }
      .item.danger:focus { background: color-mix(in srgb, var(--color-error) 12%, transparent); }

      .icon {
        display: inline-flex;
        justify-content: center;
        width: 1rem;
        flex-shrink: 0;
        font-size: 1rem;
        color: var(--color-text-secondary);
      }

      .danger .icon { color: inherit; }

      .text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .shortcut {
        margin-left: 1rem;
        color: var(--color-text-secondary);
        font-size: 0.75rem;
        letter-spacing: 0.05em;
      }

      .chevron {
        display: inline-flex;
        margin-right: -0.25rem;
        color: var(--color-text-secondary);
      }

      .divider {
        height: 1px;
        margin: 0.25rem -0.25rem;
        background: var(--color-border);
      }

      .heading {
        padding: 0.375rem 0.5rem;
        color: var(--color-text-secondary);
        font-size: 0.75rem;
        font-weight: 600;
      }
    `;
  }
}

define('nx-menu-popup', NXMenuPopup);

/**
 * Open a menu at an element or at a mouse event's position (context menus).
 *
 * ```typescript
 * grid.addEventListener('contextmenu', e => {
 *   e.preventDefault();
 *   NX.menu([{ text: 'Copy', icon: 'copy', handler: copy }, '-', { text: 'Delete', danger: true }], e);
 * });
 * ```
 */
export function showMenu(
  items: MenuItemLike[],
  at: Element | MouseEvent | { x: number; y: number },
  options: MenuOpenOptions = {}
): NXMenuPopup {
  const popup = document.createElement('nx-menu-popup') as NXMenuPopup;
  const anchor = at instanceof Event ? { x: (at as MouseEvent).clientX, y: (at as MouseEvent).clientY } : at;
  popup.open(items, anchor, {
    returnFocus: at instanceof HTMLElement ? at : (document.activeElement as HTMLElement | null),
    ...options
  });
  return popup;
}

/**
 * A trigger button with a dropdown menu.
 *
 * @example
 * ```typescript
 * {
 *   xtype: 'menu',
 *   text: 'Actions',               // trigger label (or icon only: icon: 'more')
 *   variant: 'outline',
 *   items: [
 *     { text: 'Edit', icon: 'edit', shortcut: '⌘E', handler: edit },
 *     { text: 'Share', items: [{ text: 'Email' }, { text: 'Link' }] },
 *     '-',
 *     { text: 'Delete', icon: 'trash', danger: true, handler: remove }
 *   ],
 *   onSelect: e => console.log(e.detail.item)
 * }
 * ```
 * Or bring your own trigger: `<nx-menu><nx-button slot="trigger">…</nx-button></nx-menu>`.
 */
export class NXMenu extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['text', 'icon', 'variant', 'size', 'placement', 'disabled'];
  }

  private items: MenuItemLike[] = [];
  private popup: NXMenuPopup | null = null;

  protected initializeState(): void {}

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setItems(items: MenuItemLike[]): void {
    this.items = items;
  }

  getItems(): MenuItemLike[] {
    return this.items;
  }

  protected render(): Node {
    const text = this.getProp<string>('text', '');
    const icon = this.getProp<string>('icon', text ? '' : 'more');
    return (
      <slot name="trigger">
        <nx-button part="trigger" variant={this.getProp('variant', 'outline')} size={this.getProp('size', 'md')}
                   icon={icon || undefined} text={text || undefined} aria-label={text ? undefined : 'Open menu'}
                   disabled={this.getProp('disabled', false)} />
      </slot>
    );
  }

  protected styles(): string {
    return `:host { display: inline-flex; }`;
  }

  private trigger(): HTMLElement | null {
    const slotted = this.querySelector(':scope > [slot="trigger"]') as HTMLElement | null;
    return slotted ?? (this.$('nx-button') as HTMLElement | null);
  }

  protected afterRender(): void {
    const trigger = this.trigger();
    if (!trigger) return;
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');

    this.on(this, 'click', (e: Event) => {
      if (e.composedPath().includes(trigger)) this.toggle(false);
    });
    this.on(this, 'keydown', (e: Event) => {
      const key = (e as KeyboardEvent).key;
      if ((key === 'ArrowDown' || key === 'Enter' || key === ' ') && e.composedPath().includes(trigger)) {
        e.preventDefault();
        this.open(true);
      }
    });
  }

  get opened(): boolean {
    return !!this.popup?.opened;
  }

  open(focusFirst = false): void {
    if (this.opened || this.getProp('disabled', false)) return;
    const trigger = this.trigger() ?? this;
    trigger.setAttribute('aria-expanded', 'true');
    this.popup = showMenu(this.items, trigger, {
      placement: this.getProp('placement', 'bottom-start'),
      returnFocus: trigger,
      focusFirst,
      onSelect: item => this.emit('select', { item }),
      onClose: () => {
        trigger.setAttribute('aria-expanded', 'false');
        this.popup = null;
        this.emit('close');
      }
    });
    this.emit('open');
  }

  close(): void {
    this.popup?.close();
  }

  toggle(focusFirst = false): void {
    this.opened ? this.close() : this.open(focusFirst);
  }

  protected cleanup(): void {
    this.close();
  }
}

define('nx-menu', NXMenu);
