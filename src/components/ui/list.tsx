import { BaseComponent, ComponentState } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { Store } from '@/data/store';

export interface ListConfig<T = any> {
  /** Items to show (objects, or plain strings) */
  data?: T[];
  /** …or a Store instance / registered store name; the list follows it */
  store?: string | Store;
  /** Property shown as the item's text (default `text`, then `name`, then `title`, then `label`) */
  field?: string;
  /** Property shown under the text */
  descriptionField?: string;
  /** Property naming an icon before the text */
  iconField?: string;
  /** Property that identifies an item (default `id`; items without one are told apart by position) */
  idField?: string;
  /** Build an item yourself: return a node or a string */
  template?: (item: T, index: number) => Node | string;
  /** Select several items (Ctrl/⌘ and Shift, or Space to toggle) */
  multiSelect?: boolean;
  /** Items can be selected (default) */
  selectable?: boolean;
  /** Items can be moved: drag the grip, or Alt+↑ / Alt+↓ */
  reorderable?: boolean;
  /** Lay items out as a grid of cards */
  layout?: 'list' | 'cards';
  /** Shown when there are no items */
  emptyText?: string;
  /** Accessible name */
  label?: string;
}

/**
 * Listbox bound to an array or a store: your own item template, single or multiple selection, type-ahead,
 * and items that can be reordered with the mouse or the keyboard (Alt+↑ / Alt+↓, announced as they move).
 * A store with sorters or grouping has no order of its own, so its items stay put.
 *
 * ```tsx
 * <List data={tasks} field="title" descriptionField="due" reorderable onReorder={e => save(e.detail.items)} />
 * ```
 *
 * Events: `select`, `reorder`.
 */
export class NXList<T = any> extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['store', 'field', 'description-field', 'icon-field', 'id-field', 'multi-select', 'selectable', 'reorderable', 'layout', 'empty-text', 'label'];
  }

  private store: Store | null = null;
  private storeRef: string | Store | null = null;
  private template: ListConfig<T>['template'];
  private anchor: string | null = null;
  private hadFocus = false;
  private drag: { key: string; from: number; to: number } | null = null;
  private readonly onStoreChange = () => {
    if (this.store) this.setData(this.store.getData());
  };

  protected initializeState(): void {
    this[ComponentState].set('data', []);
    this[ComponentState].set('selected', new Set<string>());
    this[ComponentState].set('active', null);
    this[ComponentState].set('status', '');
  }

  constructor(config?: ListConfig<T>) {
    super();
    this.attachShadow({ mode: 'open' });
    if (config?.data) this.setData(config.data);
  }

  // ────────── Config setters ──────────

  setData(data: T[]): void {
    const keys = new Set(data.map((item, i) => this.keyOf(item, i)));
    const selected = new Set([...this.getState<Set<string>>('selected', new Set())].filter(k => keys.has(k)));
    this.updateState({ data, selected });
  }

  setStore(store: string | Store): void {
    this.storeRef = store;
    this.bindStore();
  }

  setTemplate(fn: ListConfig<T>['template']): void {
    this.template = fn;
    this.scheduleUpdate();
  }

  protected onAttributeChange(name: string, _old: string | null, value: string | null): void {
    if (name === 'store' && value) this.setStore(value);
  }

  private bindStore(): void {
    if (!this.storeRef) return;
    const store = Store.lookup<any>(this.storeRef) ?? null;
    if (store === this.store) return;
    this.store?.off('datachanged', this.onStoreChange);
    this.store = store;
    if (store) {
      store.on('datachanged', this.onStoreChange);
      this.setData(store.getData());
    }
  }

  protected afterConnect(): void {
    if (!this.store) this.bindStore();
    else this.store.on('datachanged', this.onStoreChange);
  }

  protected cleanup(): void {
    this.store?.off('datachanged', this.onStoreChange);
  }

  // ────────── Items ──────────

  private keyOf(item: any, index: number): string {
    const id = item && typeof item === 'object' ? item[this.getProp('id-field', 'id')] : undefined;
    return String(id ?? `#${index}`);
  }

  private textOf(item: any): string {
    if (item == null || typeof item !== 'object') return String(item ?? '');
    const field = this.getProp<string | undefined>('field');
    const value = field ? item[field] : (item.text ?? item.name ?? item.title ?? item.label);
    return value == null ? '' : String(value);
  }

  private get items(): T[] {
    return this.getState<T[]>('data', []);
  }

  /** The selected items, in list order. */
  getSelected(): T[] {
    const selected = this.getState<Set<string>>('selected', new Set());
    return this.items.filter((item, i) => selected.has(this.keyOf(item, i)));
  }

  /** Select items by id (or by position for items without one). */
  select(ids: string | number | Array<string | number>, emit = false): void {
    const list = (Array.isArray(ids) ? ids : [ids]).map(String);
    const keys = new Set(this.getProp('multi-select', false) ? list : list.slice(0, 1));
    this.setState('selected', keys);
    if (emit) this.emitSelect();
  }

  clearSelection(): void {
    this.setState('selected', new Set());
  }

  private get canReorder(): boolean {
    if (!this.getProp('reorderable', false)) return false;
    return !this.store || (this.store.getSorters().length === 0 && !this.store.getGroupField());
  }

  // ────────── Render ──────────

  protected render(): Node {
    const items = this.items;
    const selected = this.getState<Set<string>>('selected', new Set());
    const selectable = this.getProp('selectable', true);
    const reorderable = this.canReorder;
    const cards = this.getProp<string>('layout', 'list') === 'cards';
    const keys = items.map((item, i) => this.keyOf(item, i));
    const active = this.getState<string | null>('active', null);
    const tabKey = active !== null && keys.includes(active) ? active : (keys.find(k => selected.has(k)) ?? keys[0]);
    const iconField = this.getProp<string | undefined>('icon-field');
    const descField = this.getProp<string | undefined>('description-field');

    return (
      <div class={['nx-list', { cards }]} part="container">
        <div class="items" part="items" role="listbox" aria-label={this.getProp('label') || undefined}
             aria-multiselectable={this.getProp('multi-select', false) ? 'true' : undefined}
             onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e)}>
          {items.map((item: any, i) => {
            const key = keys[i];
            const isSelected = selected.has(key);
            const custom = this.template ? this.template(item, i) : null;
            const icon = iconField && item?.[iconField];
            const desc = descField && item?.[descField];
            return (
              <div class={['item', { selected: isSelected, dragging: this.drag?.key === key }]} part={isSelected ? 'item item-selected' : 'item'}
                   role="option" id={`${this.uid}-${i}`} data-key={key} aria-selected={selectable ? String(isSelected) : undefined}
                   aria-keyshortcuts={reorderable ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}
                   tabindex={key === tabKey ? 0 : -1}
                   onClick={(e: MouseEvent) => this.onItemClick(e, key)}>
                {reorderable && <span class="grip" part="grip" aria-hidden="true" title={this.t('list.drag')} html={Icons.get('grip-vertical')}
                                      onPointerDown={(e: PointerEvent) => this.dragStart(e, key)} />}
                {custom !== null
                  ? <div class="custom">{custom}</div>
                  : [
                      icon && <span class="icon" part="icon" aria-hidden="true" html={Icons.get(String(icon)) || undefined}>{Icons.get(String(icon)) ? undefined : String(icon)}</span>,
                      <span class="body"><span class="text" part="text">{this.textOf(item)}</span>{desc ? <span class="desc" part="description">{String(desc)}</span> : null}</span>
                    ]}
              </div>
            );
          })}
        </div>
        {items.length === 0 && <div class="empty" part="empty">{this.getProp('empty-text') || this.t('list.empty')}</div>}
        <div class="sr-only" role="status" aria-live="polite">{this.getState<string>('status', '')}</div>
      </div>
    );
  }

  private get uid(): string {
    return (this as any)._uid ??= `nx-list-${Math.random().toString(36).slice(2, 8)}`;
  }

  protected update(): void {
    this.hadFocus = !!this.shadowRoot?.activeElement;
    super.update();
  }

  protected afterRender(): void {
    const active = this.getState<string | null>('active', null);
    if (active !== null && this.hadFocus) this.itemEl(active)?.focus();
  }

  private itemEls(): HTMLElement[] {
    return Array.from(this.$$('.item')) as HTMLElement[];
  }

  private itemEl(key: string): HTMLElement | undefined {
    return this.itemEls().find(el => el.dataset.key === key);
  }

  // ────────── Selection ──────────

  private onItemClick(e: MouseEvent, key: string): void {
    if (!this.getProp('selectable', true)) return;
    this.choose(key, e);
  }

  private choose(key: string, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }): void {
    const multi = this.getProp('multi-select', false);
    const keys = this.items.map((item, i) => this.keyOf(item, i));
    let selected = new Set(this.getState<Set<string>>('selected', new Set()));
    if (multi && e?.shiftKey && this.anchor !== null && keys.includes(this.anchor)) {
      const [a, b] = [keys.indexOf(this.anchor), keys.indexOf(key)].sort((x, y) => x - y);
      selected = new Set(keys.slice(a, b + 1));
    } else if (multi && (e?.ctrlKey || e?.metaKey)) {
      selected.has(key) ? selected.delete(key) : selected.add(key);
      this.anchor = key;
    } else {
      selected = new Set([key]);
      this.anchor = key;
    }
    this.updateState({ selected, active: key });
    this.emitSelect();
  }

  private emitSelect(): void {
    this.emit('select', { selected: this.getSelected(), keys: [...this.getState<Set<string>>('selected', new Set())] });
  }

  // ────────── Keyboard ──────────

  private onKeyDown(e: KeyboardEvent): void {
    const target = (e.target as HTMLElement).closest('.item') as HTMLElement | null;
    if (!target || (e.target as HTMLElement).closest('input, textarea, select, button, a[href]') ) return;
    const els = this.itemEls();
    const index = els.indexOf(target);
    const key = target.dataset.key!;
    const focus = (i: number, extend = false) => {
      const el = els[Math.max(0, Math.min(els.length - 1, i))];
      if (!el) return;
      this[ComponentState].set('active', el.dataset.key);
      els.forEach(x => (x.tabIndex = x === el ? 0 : -1));
      el.focus();
      if (extend && this.getProp('multi-select', false)) this.choose(el.dataset.key!, { shiftKey: true });
    };
    const step = this.getProp<string>('layout', 'list') === 'cards' ? this.columnCount(els) : 1;

    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && this.canReorder) {
      e.preventDefault();
      this.moveItem(index, index + (e.key === 'ArrowDown' ? 1 : -1), key);
      return;
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); focus(index + step, e.shiftKey); break;
      case 'ArrowUp': e.preventDefault(); focus(index - step, e.shiftKey); break;
      case 'ArrowRight': if (step > 1) { e.preventDefault(); focus(index + (this.isRtl() ? -1 : 1), e.shiftKey); } break;
      case 'ArrowLeft': if (step > 1) { e.preventDefault(); focus(index + (this.isRtl() ? 1 : -1), e.shiftKey); } break;
      case 'Home': e.preventDefault(); focus(0, e.shiftKey); break;
      case 'End': e.preventDefault(); focus(els.length - 1, e.shiftKey); break;
      case 'Enter':
      case ' ':
        if (!this.getProp('selectable', true)) break;
        e.preventDefault();
        this.choose(key, e.key === ' ' ? { ctrlKey: this.getProp('multi-select', false) } : e);
        break;
      case 'a':
      case 'A':
        if ((e.ctrlKey || e.metaKey) && this.getProp('multi-select', false) && this.getProp('selectable', true)) {
          e.preventDefault();
          this.updateState({ selected: new Set(els.map(el => el.dataset.key!)) });
          this.emitSelect();
        }
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const order = [...els.slice(index + 1), ...els.slice(0, index + 1)];
          const match = order.find(el => el.querySelector('.text, .custom')?.textContent?.trim().toLowerCase().startsWith(e.key.toLowerCase()));
          if (match) { e.preventDefault(); focus(els.indexOf(match)); }
        }
    }
  }

  /** How many items sit in one row of a card layout. */
  private columnCount(els: HTMLElement[]): number {
    if (els.length < 2) return 1;
    const top = els[0].offsetTop;
    const n = els.findIndex(el => el.offsetTop !== top);
    return n === -1 ? els.length : n;
  }

  // ────────── Reordering ──────────

  /** Move an item from one position to another (what the keyboard and the mouse both call). */
  moveItem(from: number, to: number, key?: string): boolean {
    const items = this.items;
    if (!this.canReorder || from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return false;
    const item = items[from];
    const itemKey = key ?? this.keyOf(item, from);
    if (this.store) {
      if (!this.store.move(from, to)) return false;
    } else {
      const next = items.slice();
      next.splice(from, 1);
      next.splice(to, 0, item);
      this.setState('data', next);
    }
    this.updateState({
      active: itemKey,
      status: this.t('list.moved', { item: this.textOf(item), to: to + 1, total: items.length })
    });
    this.emit('reorder', { item, from, to, items: this.items });
    return true;
  }

  private dragStart(e: PointerEvent, key: string): void {
    if (e.button !== 0 || !this.canReorder) return;
    e.preventDefault();
    const from = this.itemEls().findIndex(el => el.dataset.key === key);
    this.drag = { key, from, to: from };
    const grip = e.currentTarget as HTMLElement;
    grip.setPointerCapture?.(e.pointerId);
    const els = this.itemEls();
    els[from]?.classList.add('dragging');
    const mark = (to: number) => {
      els.forEach((el, i) => {
        el.classList.toggle('drop-before', i === to && to < from);
        el.classList.toggle('drop-after', i === to && to > from);
      });
    };
    const over = (ev: PointerEvent) => {
      // The slot whose middle is the nearest to the pointer, along the list's direction
      const y = ev.clientY;
      let to = from;
      els.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (y > r.top + r.height / 2 && i >= from) to = i;
        if (y < r.top + r.height / 2 && i <= from && to === from && i < from) to = Math.min(to, i);
      });
      if (y < els[0].getBoundingClientRect().top + els[0].getBoundingClientRect().height / 2) to = 0;
      if (this.drag) this.drag.to = to;
      mark(to);
    };
    const finish = (commit: boolean) => {
      grip.removeEventListener('pointermove', over);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', cancel);
      this.removeEventListener('keydown', esc, true);
      const to = this.drag?.to ?? from;
      this.drag = null;
      els.forEach(el => el.classList.remove('dragging', 'drop-before', 'drop-after'));
      if (commit && to !== from) this.moveItem(from, to, key);
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') finish(false); };
    grip.addEventListener('pointermove', over);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', cancel);
    this.addEventListener('keydown', esc, true);
  }

  protected styles(): string {
    return `
      :host { display: block; font-size: 0.875rem; }
      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      .items { display: flex; flex-direction: column; gap: 1px; }
      .nx-list.cards .items { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.75rem; }
      .item {
        position: relative; display: flex; align-items: center; gap: 0.625rem; min-height: 2.5rem; padding: 0.5rem 0.75rem;
        color: var(--color-text); cursor: pointer; border-radius: var(--radius-md); user-select: none;
        transition: background-color var(--transition-duration), box-shadow var(--transition-duration);
      }
      .cards .item { flex-direction: column; align-items: flex-start; padding: 1rem; border: 1px solid var(--color-border); background: var(--color-card); box-shadow: var(--shadow-sm); }
      .item:hover { background: var(--color-accent); }
      .item.selected { background: var(--color-accent); box-shadow: inset 0 0 0 1px var(--color-primary); }
      .item:focus-visible { outline: 2px solid var(--color-ring); outline-offset: -2px; }
      .item.dragging { opacity: 0.55; }
      .item.drop-before::before, .item.drop-after::after {
        content: ''; position: absolute; inset-inline: 0; height: 2px; background: var(--color-primary); border-radius: 1px;
      }
      .item.drop-before::before { top: -2px; }
      .item.drop-after::after { bottom: -2px; }
      .grip { display: inline-flex; flex-shrink: 0; padding: 0.25rem; margin-inline-start: -0.375rem; color: var(--color-text-secondary); cursor: grab; touch-action: none; }
      .grip:active { cursor: grabbing; }
      .icon { display: inline-flex; flex-shrink: 0; font-size: 1.125rem; color: var(--color-text-secondary); }
      .body { display: flex; flex-direction: column; min-width: 0; flex: 1; }
      .text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .desc { font-size: 0.75rem; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .custom { flex: 1; min-width: 0; }
      .empty { padding: 1.5rem 0.75rem; text-align: center; color: var(--color-text-secondary); }
      @media (prefers-reduced-motion: reduce) { .item { transition: none; } }
    `;
  }
}

define('nx-list', NXList);
