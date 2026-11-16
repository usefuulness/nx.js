/**
 * @file @/data/grid.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { FIELD_TAGS } from '@/components/ui/form/field';
import { BaseComponent } from '@/components/abstracts/base';
import type { Child } from '@/jsx/jsx-runtime';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { Store } from '@/data/store';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export interface GridColumn<T = any> {
  /** Property of the row to display (supports dot paths: `address.city`) */
  field: keyof T | string;
  /** Header label (alias: `text`) */
  header?: string;
  text?: string;
  /** Fixed width (px number or CSS length) */
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  /** Defaults to true */
  sortable?: boolean;
  hidden?: boolean;
  /** Smallest width in px when resizing (default 60) */
  minWidth?: number;
  /** Set `false` to stop this column being resized or moved when the grid allows it */
  resizable?: boolean;
  /** Keep the column at the left edge while the body scrolls sideways. Give it a px `width` */
  pinned?: 'left';
  /**
   * Built-in cell types:
   * - `number`, `currency`, `percent`, `date`, `boolean`
   * - `badge`: a pill; set tones with `badges: { Active: 'success' }`
   */
  type?: 'text' | 'number' | 'currency' | 'percent' | 'date' | 'boolean' | 'badge';
  badges?: Record<string, BadgeTone>;
  /** Currency code for `type: 'currency'` (default USD) */
  currency?: string;
  /** Return plain text (escaped for you) */
  formatter?: (value: any, row: T) => string;
  /** Return JSX, or an HTML string (not escaped — you own it) */
  renderer?: (value: any, row: T, column: GridColumn<T>) => Node | string;
}

export interface GridConfig<T extends Record<string, any> = any> {
  columns: GridColumn<T>[];
  /** Inline rows… */
  data?: T[];
  /** …or a Store instance / registered store name */
  store?: string | Store<T>;
  /** Toolbar heading */
  title?: string;
  /** Show a search box that filters across all visible columns */
  search?: boolean;
  /** Alternate row shading */
  striped?: boolean;
  /** Highlight the row under the pointer */
  hoverable?: boolean;
  /** Compact rows */
  dense?: boolean;
  /** Borders between cells */
  bordered?: boolean;
  /** Row selection: `true` or `'single'` for one row, `'multiple'` for several */
  selectable?: boolean | 'single' | 'multiple';
  /** A checkbox column for selecting rows */
  checkboxSelection?: boolean;
  /** Rows per page; omit for no paging */
  pageSize?: number;
  /**
   * Render only the rows in view, so tens of thousands of rows stay fast. Rows must be a fixed
   * height (`rowHeight`), the body scrolls (`height`), and paging is ignored.
   */
  virtual?: boolean;
  /** Row height in px for a `virtual` grid (default 48, or 36 when `dense`) */
  rowHeight?: number;
  /** Drag a header's right edge to resize (also focusable: Left/Right arrows, Shift for bigger steps, Enter or double-click resets) */
  resizable?: boolean;
  /** Reorder columns by dragging headers, or with Alt+Left/Right on a focused header */
  reorderable?: boolean;
  /** Remember column widths and order in localStorage under this key */
  stateKey?: string;
  /** Height of the scrolling body, as a CSS size or px number (a `virtual` grid defaults to 24rem) */
  height?: number | string;
  /** Shown when there are no rows */
  emptyText?: string;
}

const cssSize = (value: unknown): string =>
  typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value)) ? `${value}px` : String(value);

const isNumeric = (col: GridColumn): boolean =>
  col.type === 'number' || col.type === 'currency' || col.type === 'percent';

/**
 * Data grid: sorting, search, selection, paging, row virtualization, column resize/reorder/pinning, store binding.
 *
 * @example
 * ```typescript
 * {
 *   xtype: 'grid',
 *   title: 'Users',
 *   store: 'users',
 *   search: true,
 *   pageSize: 10,
 *   selectable: 'multiple',
 *   columns: [
 *     { field: 'name', header: 'Name' },
 *     { field: 'role', header: 'Role', type: 'badge', badges: { Admin: 'info' } },
 *     { field: 'revenue', header: 'Revenue', type: 'currency' }
 *   ],
 *   onRowClick: (e) => console.log(e.detail.row)
 * }
 * ```
 *
 * Events: `row-click`, `row-dblclick`, `selection-change`, `sort-change`, `column-change`.
 */
export class NXGrid<T extends Record<string, any> = any> extends BaseComponent {
  static get observedAttributes(): string[] {
    return [
      'title', 'search', 'striped', 'hoverable', 'dense', 'bordered',
      'selectable', 'checkbox-selection', 'page-size', 'empty-text', 'store', 'virtual', 'row-height', 'height', 'resizable', 'reorderable', 'state-key'
    ];
  }

  private rows: T[] = [];
  private columns: GridColumn<T>[] = [];
  private store: Store<T> | null = null;
  private storeRef: string | Store<T> | null = null;
  private selected = new Set<T>();
  private sortField: string | null = null;
  private sortDirection: 'asc' | 'desc' = 'asc';
  private query = '';
  private page = 1;
  private scrollFrame = 0;
  private widths = new Map<string, number>();
  private order: string[] = [];
  private stateLoaded = false;
  private readonly onStoreChange = () => {
    if (this.store) this.setRowsInternal(this.store.getData());
  };

  protected initializeState(): void {}

  constructor(config?: GridConfig<T>) {
    super();
    this.attachShadow({ mode: 'open' });
    if (config) this.configure(config);
  }

  // ────────── Config setters (picked up by configure()) ──────────

  setColumns(columns: GridColumn<T>[]): void {
    this.columns = columns;
    this.scheduleUpdate();
  }

  setData(data: T[]): void {
    this.setRowsInternal(data);
  }

  protected onAttributeChange(name: string, _old: string | null, value: string | null): void {
    // <nx-grid store="users"> from HTML / template engines
    if (name === 'store' && value) this.setStore(value);
  }

  setStore(store: string | Store<T>): void {
    this.storeRef = store;
    this.bindStore();
  }

  private bindStore(): void {
    if (!this.storeRef) return;
    const store = Store.lookup<T>(this.storeRef) ?? null;
    if (store === this.store) return;
    this.store?.off('datachanged', this.onStoreChange);
    this.store = store;
    if (store) {
      store.on('datachanged', this.onStoreChange);
      this.setRowsInternal(store.getData());
    }
  }

  private setRowsInternal(rows: T[]): void {
    this.rows = rows;
    // Drop selections that no longer exist
    const present = new Set(rows);
    this.selected.forEach(row => present.has(row) || this.selected.delete(row));
    this.refresh();
  }

  protected afterConnect(): void {
    // A named store may be registered after the grid was configured
    if (!this.store) this.bindStore();
    else this.store.on('datachanged', this.onStoreChange);
  }

  protected afterRender(): void {
    this.syncHandleValues();
  }

  protected cleanup(): void {
    this.store?.off('datachanged', this.onStoreChange);
  }

  // ────────── Public API ──────────

  getData(): T[] {
    return this.rows;
  }

  /** Rows after search + sort (all pages). */
  getVisibleRows(): T[] {
    let rows = this.rows;

    if (this.query) {
      const q = this.query.toLowerCase();
      const cols = this.visibleColumns();
      rows = rows.filter(row =>
        cols.some(col => String(this.value(row, col.field) ?? '').toLowerCase().includes(q))
      );
    }

    if (this.sortField) {
      const field = this.sortField;
      const dir = this.sortDirection === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = this.value(a, field);
        const bv = this.value(b, field);
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
      });
    }

    return rows;
  }

  getSelected(): T[] {
    return this.rows.filter(row => this.selected.has(row));
  }

  select(rows: T | T[], append = false): void {
    if (!append) this.selected.clear();
    (Array.isArray(rows) ? rows : [rows]).forEach(row => this.selected.add(row));
    this.selectionChanged();
  }

  clearSelection(): void {
    this.selected.clear();
    this.selectionChanged();
  }

  selectAll(): void {
    this.getVisibleRows().forEach(row => this.selected.add(row));
    this.selectionChanged();
  }

  sort(field: keyof T | string, direction?: 'asc' | 'desc'): void {
    const key = String(field);
    this.sortDirection = direction ?? (this.sortField === key && this.sortDirection === 'asc' ? 'desc' : 'asc');
    this.sortField = key;
    this.emit('sort-change', { field: key, direction: this.sortDirection });
    this.refresh();
  }

  /** Filter rows by a search string (same as typing in the search box). */
  setFilter(query: string): void {
    this.query = query;
    this.page = 1;
    const input = this.$('.nx-grid-search input') as HTMLInputElement | null;
    if (input && input.value !== query) input.value = query;
    this.refresh();
  }

  clearFilters(): void {
    this.setFilter('');
  }

  setPage(page: number): void {
    this.page = Math.max(1, Math.min(page, this.pageCount()));
    this.refresh();
  }

  /** Re-render the rows only (keeps the toolbar and search box focus intact). */
  refresh(): void {
    const body = this.$('.nx-grid-body');
    if (!body) {
      this.scheduleUpdate();
      return;
    }
    const scrollTop = body.scrollTop;
    const scrollLeft = body.scrollLeft;
    body.replaceChildren(this.renderTable());
    // Replacing the table collapses the scroller for a moment, which resets it
    if (scrollTop) body.scrollTop = scrollTop;
    if (scrollLeft) body.scrollLeft = scrollLeft;
    this.$('.nx-grid-footer')?.replaceWith(this.renderFooter());
    this.syncHandleValues();
  }

  /** Download visible rows as CSV. */
  exportCSV(filename = 'export.csv'): void {
    const cols = this.visibleColumns();
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      cols.map(c => escape(this.headerText(c))).join(','),
      ...this.getVisibleRows().map(row => cols.map(c => escape(this.value(row, c.field))).join(','))
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }

  // ────────── Rendering ──────────

  private visibleColumns(): GridColumn<T>[] {
    this.loadState();
    const rank = (c: GridColumn<T>) => this.order.indexOf(String(c.field));
    const cols = this.columns
      .filter(col => !col.hidden)
      .map((col, i) => ({ col, i }))
      .sort((a, b) => {
        // Pinned first, then the user's order (unknown fields keep their place), then config order
        const pin = Number(b.col.pinned === 'left') - Number(a.col.pinned === 'left');
        if (pin) return pin;
        const ra = rank(a.col), rb = rank(b.col);
        return ra >= 0 && rb >= 0 ? ra - rb : a.i - b.i;
      })
      .map(({ col }) => col);
    return cols.map(col => {
      const w = this.widths.get(String(col.field));
      return w ? { ...col, width: w } : col;
    });
  }

  // ────────── Column state: widths, order, persistence ──────────

  private storageKey(): string | null {
    const key = this.getProp<string>('state-key');
    return key ? `nx-grid:${key}` : null;
  }

  private loadState(): void {
    if (this.stateLoaded) return;
    this.stateLoaded = true;
    const key = this.storageKey();
    if (!key) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (saved?.widths) this.widths = new Map(Object.entries(saved.widths).map(([k, v]) => [k, Number(v)]));
      if (Array.isArray(saved?.order)) this.order = saved.order.map(String);
    } catch {
      // Storage blocked or corrupt: fall back to the configured columns
    }
  }

  /** Current widths (px) and order of the columns, as saved under `state-key`. */
  getColumnState(): { widths: Record<string, number>; order: string[] } {
    return { widths: Object.fromEntries(this.widths), order: this.visibleColumns().map(c => String(c.field)) };
  }

  setColumnState(state: { widths?: Record<string, number>; order?: string[] }): void {
    this.stateLoaded = true;
    this.widths = new Map(Object.entries(state.widths ?? {}).map(([k, v]) => [k, Number(v)]));
    this.order = (state.order ?? []).map(String);
    this.columnsChanged(false);
  }

  /** Back to the configured widths and order. */
  resetColumns(): void {
    this.setColumnState({});
  }

  private columnsChanged(emit = true): void {
    const key = this.storageKey();
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(this.getColumnState()));
      } catch {
        // Not persisted; the grid still works
      }
    }
    this.refresh();
    if (emit) this.emit('column-change', this.getColumnState());
  }

  /** Handles announce their real pixel width, which is only known after layout. */
  private syncHandleValues(): void {
    this.shadow?.querySelectorAll('th[data-field] .resize-handle').forEach(handle => {
      const width = Math.round((handle.parentElement as HTMLElement).getBoundingClientRect().width);
      if (width) handle.setAttribute('aria-valuenow', String(width));
    });
  }

  private headerCell(field: string): HTMLElement | null {
    const cells = this.shadow?.querySelectorAll('th[data-field]') ?? [];
    return (Array.from(cells) as HTMLElement[]).find(th => th.dataset.field === field) ?? null;
  }

  private minColumnWidth(field: string): number {
    return this.columns.find(c => String(c.field) === field)?.minWidth ?? 60;
  }

  private resizeBy(field: string, delta: number): void {
    const th = this.headerCell(field);
    const configured = parseFloat(cssSize(this.columns.find(c => String(c.field) === field)?.width));
    const current = this.widths.get(field) || th?.getBoundingClientRect().width || configured || 120;
    this.widths.set(field, Math.max(this.minColumnWidth(field), Math.round(current + delta)));
    this.columnsChanged();
    (this.headerCell(field)?.querySelector('.resize-handle') as HTMLElement | null)?.focus();
  }

  private moveColumn(field: string, to: number): void {
    // Pinned columns stay in front; moving only happens among the rest
    const fields = this.visibleColumns().map(c => String(c.field));
    const from = fields.indexOf(field);
    if (from < 0 || to < 0 || to >= fields.length || from === to) return;
    const pinned = (f: string) => this.columns.find(c => String(c.field) === f)?.pinned === 'left';
    if (pinned(field) !== pinned(fields[to])) return;
    fields.splice(to, 0, ...fields.splice(from, 1));
    this.order = fields;
    this.columnsChanged();
    (this.headerCell(field)?.querySelector('.sort-btn, .th') as HTMLElement | null)?.focus();
  }

  private startResize(e: PointerEvent, field: string): void {
    const handle = e.currentTarget as HTMLElement;
    const th = handle.closest('th') as HTMLElement;
    const index = Array.from(th.parentElement!.children).indexOf(th);
    const col = this.$('colgroup')?.children[index] as HTMLElement | undefined;
    const startX = e.clientX;
    const startWidth = th.getBoundingClientRect().width;
    // A right-to-left page grows a column when the pointer moves left
    const dir = getComputedStyle(this).direction === 'rtl' ? -1 : 1;
    let width = startWidth;
    e.preventDefault();
    handle.setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      width = Math.max(this.minColumnWidth(field), Math.round(startWidth + (ev.clientX - startX) * dir));
      if (col) col.style.width = `${width}px`;
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      if (width !== startWidth) {
        this.widths.set(field, width);
        this.columnsChanged();
      }
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  /** Left offsets (px) of pinned columns, including the checkbox column. */
  private pinnedOffsets(cols: GridColumn<T>[], checkbox: boolean): Map<string, number> {
    const offsets = new Map<string, number>();
    let left = checkbox && cols.some(c => c.pinned === 'left') ? 48 : 0;
    for (const col of cols) {
      if (col.pinned !== 'left') continue;
      offsets.set(String(col.field), left);
      left += parseFloat(cssSize(col.width)) || 160;
    }
    return offsets;
  }

  private headerText(col: GridColumn<T>): string {
    return col.header ?? col.text ?? String(col.field);
  }

  private value(row: T, field: keyof T | string): any {
    const path = String(field);
    if (!path.includes('.')) return row[path];
    return path.split('.').reduce<any>((obj, key) => obj?.[key], row);
  }

  private isVirtual(): boolean {
    return !!this.getProp('virtual', false);
  }

  private rowHeight(): number {
    const h = Number(this.getProp('row-height', 0));
    return h > 0 ? h : this.getProp('dense', false) ? 36 : 48;
  }

  /** The slice of rows a virtual grid renders for the current scroll position. */
  private virtualWindow(total: number): { start: number; end: number } {
    const rh = this.rowHeight();
    const body = this.$('.nx-grid-body') as HTMLElement | null;
    const viewport = body?.clientHeight || 400;
    const top = body?.scrollTop ?? 0;
    const overscan = 8;
    const start = Math.max(0, Math.floor(top / rh) - overscan);
    const end = Math.min(total, Math.ceil((top + viewport) / rh) + overscan);
    return { start, end };
  }

  private onBodyScroll(): void {
    if (!this.isVirtual() || this.scrollFrame) return;
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = 0;
      const tbody = this.$('.nx-grid-table tbody');
      if (!tbody) return;
      const all = this.getVisibleRows();
      const { start, end } = this.virtualWindow(all.length);
      // Only touch the DOM when the window moved
      if (tbody.getAttribute('data-window') === `${start}-${end}`) return;
      tbody.replaceWith(this.renderBody(all, this.visibleColumns(), start, end));
    });
  }

  private pageSize(): number {
    if (this.isVirtual()) return 0;
    return Number(this.getProp('page-size', 0)) || 0;
  }

  private pageCount(): number {
    const perPage = this.pageSize();
    return perPage ? Math.max(1, Math.ceil(this.getVisibleRows().length / perPage)) : 1;
  }

  private currentPageRows(all: T[]): T[] {
    const perPage = this.pageSize();
    return perPage ? all.slice((this.page - 1) * perPage, this.page * perPage) : all;
  }

  private isSelectable(): boolean {
    return !!this.getProp<any>('selectable', false) || !!this.getProp('checkbox-selection', false);
  }

  private isMulti(): boolean {
    return this.getProp<unknown>('selectable', false) === 'multiple' || !!this.getProp('checkbox-selection', false);
  }

  private align(col: GridColumn<T>): string {
    return `align-${col.align ?? (isNumeric(col) ? 'right' : 'left')}`;
  }

  protected render(): Node {
    const title = this.getProp<string>('title');
    const search = this.getProp('search', false);
    const hasToolbar = title || search || this.querySelector(':scope > [slot="toolbar"]');

    return (
      <div part="grid" class={['nx-grid', { bordered: this.getProp('bordered', true), dense: this.getProp('dense', false), virtual: this.isVirtual() }]}
           style={this.isVirtual() ? { '--nx-row-h': `${this.rowHeight()}px` } : undefined}
           // Rows are re-rendered often, so events are delegated from here
           onClick={(e: MouseEvent) => this.onClick(e)}
           onDblClick={(e: MouseEvent) => {
             const row = this.rowFromEvent(e);
             if (row) this.emit('row-dblclick', { row, index: this.rows.indexOf(row) });
           }}
           onChange={(e: Event) => this.onCheckboxChange(e)}>
        {hasToolbar && (
          <div class="nx-grid-toolbar" part="toolbar">
            {title && <div class="nx-grid-title" part="title">{title}</div>}
            <slot name="toolbar" />
            {search && (
              <label class="nx-grid-search">
                <span html={Icons.get('search')} />
                <input type="search" placeholder="Search…" value={this.query} aria-label="Search rows"
                       onInput={(e: Event) => {
                         this.query = (e.target as HTMLInputElement).value;
                         this.page = 1;
                         this.refresh();
                       }} />
              </label>
            )}
          </div>
        )}
        <div class="nx-grid-body" part="body" style={this.bodyStyle()} onScroll={() => this.onBodyScroll()}>{this.renderTable()}</div>
        {this.renderFooter()}
      </div>
    );
  }

  private bodyStyle(): Record<string, string> | undefined {
    const height = this.getProp<number | string | undefined>('height');
    if (height) return { height: cssSize(height), flex: 'none' };
    return this.isVirtual() ? { height: '24rem', flex: 'none' } : undefined;
  }

  private renderTable(): Node {
    const cols = this.visibleColumns();
    const all = this.getVisibleRows();
    this.page = Math.min(this.page, this.pageCount());
    const virtual = this.isVirtual();
    const rows = virtual ? all : this.currentPageRows(all);

    const checkbox = !!this.getProp('checkbox-selection', false);
    const allChecked = rows.length > 0 && rows.every(row => this.selected.has(row));
    const someChecked = rows.some(row => this.selected.has(row));

    // Auto-width columns get at least 10rem; below that the body scrolls sideways
    const fixed = cols.filter(c => c.width).map(c => cssSize(c.width));
    const resizable = !!this.getProp('resizable', false);
    const reorderable = !!this.getProp('reorderable', false);
    const offsets = this.pinnedOffsets(cols, checkbox);
    const anyPinned = offsets.size > 0;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const minWidth = `calc(${[...fixed, `${(cols.length - fixed.length) * 10}rem`, checkbox ? '3rem' : '0px'].join(' + ')})`;

    return (
      <table class="nx-grid-table" part="table" style={{ minWidth }}
             aria-rowcount={virtual ? String(all.length + 1) : undefined}>
        <colgroup>
          {checkbox && <col style="width: 3rem" />}
          {cols.map(col => <col style={col.width ? { width: cssSize(col.width) } : undefined} />)}
        </colgroup>
        <thead>
          <tr>
            {checkbox && (
              <th class={['check', { pinned: anyPinned }]} style={anyPinned ? { left: '0px' } : undefined}>
                <input type="checkbox" class="check-all" aria-label="Select all" checked={allChecked} indeterminate={someChecked && !allChecked} />
              </th>
            )}
            {cols.map((col, ci) => {
              const sortable = col.sortable !== false;
              const field = String(col.field);
              const active = this.sortField === field;
              const canMove = reorderable && col.resizable !== false;
              const canResize = resizable && col.resizable !== false;
              const left = offsets.get(field);
              return (
                <th class={[this.align(col), { sortable, sorted: active, pinned: left !== undefined }]} data-field={field}
                    style={left !== undefined ? { left: `${left}px` } : undefined}
                    aria-sort={active ? (this.sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                    draggable={canMove}
                    onDragStart={canMove ? (e: DragEvent) => e.dataTransfer?.setData('text/x-nx-column', field) : undefined}
                    onDragOver={canMove ? (e: DragEvent) => e.preventDefault() : undefined}
                    onDrop={canMove ? (e: DragEvent) => {
                      e.preventDefault();
                      const from = e.dataTransfer?.getData('text/x-nx-column');
                      if (from && from !== field) this.moveColumn(from, ci);
                    } : undefined}
                    onKeyDown={canMove ? (e: KeyboardEvent) => {
                      if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
                      e.preventDefault();
                      this.moveColumn(field, ci + ((e.key === 'ArrowRight') !== rtl ? 1 : -1));
                    } : undefined}>
                  {sortable ? (
                    // A real button, so sorting works from the keyboard too
                    <button type="button" class="th sort-btn" part="sort">
                      {this.headerText(col)}
                      <span class="sort-icon" aria-hidden="true" html={Icons.get(active && this.sortDirection === 'desc' ? 'chevron-down' : 'chevron-up')} />
                    </button>
                  ) : (
                    <span class="th">{this.headerText(col)}</span>
                  )}
                  {canResize && (
                    <span class="resize-handle" role="separator" aria-orientation="vertical" tabindex="0"
                          aria-label={`Resize ${this.headerText(col)} column`}
                          aria-valuenow={Math.round(parseFloat(cssSize(col.width))) || this.minColumnWidth(field)}
                          aria-valuemin={this.minColumnWidth(field)} aria-valuemax={1000}
                          onClick={(e: Event) => e.stopPropagation()}
                          onPointerDown={(e: PointerEvent) => this.startResize(e, field)}
                          onDblClick={() => { this.widths.delete(field); this.columnsChanged(); }}
                          onKeyDown={(e: KeyboardEvent) => {
                            const step = e.shiftKey ? 50 : 10;
                            const grow = (e.key === 'ArrowRight') !== rtl ? step : -step;
                            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                              e.preventDefault();
                              e.stopPropagation();
                              this.resizeBy(field, grow);
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              this.widths.delete(field);
                              this.columnsChanged();
                            }
                          }} />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        {virtual && rows.length
          ? this.renderBody(rows, cols, ...Object.values(this.virtualWindow(rows.length)) as [number, number])
          : this.renderBody(rows, cols, 0, rows.length)}
      </table>
    );
  }

  /** The `<tbody>`: every row, or for a virtual grid just rows `start`–`end` between two spacers. */
  private renderBody(rows: T[], cols: GridColumn<T>[], start: number, end: number): HTMLElement {
    const checkbox = !!this.getProp('checkbox-selection', false);
    const striped = this.getProp('striped', false);
    const hoverable = this.getProp('hoverable', true);
    const selectable = this.isSelectable();
    const virtual = this.isVirtual();
    const rh = this.rowHeight();
    const span = cols.length + (checkbox ? 1 : 0);
    const offsets = this.pinnedOffsets(cols, checkbox);
    const anyPinned = offsets.size > 0;
    const spacer = (count: number) =>
      count > 0 ? <tr class="spacer" aria-hidden="true"><td colspan={span} style={{ height: `${count * rh}px`, padding: '0', border: '0' }} /></tr> : null;

    return (
      <tbody data-window={virtual ? `${start}-${end}` : undefined}>
        {rows.length ? [
          spacer(virtual ? start : 0),
          ...rows.slice(start, end).map((row, n) => {
            const i = start + n;
            const isSelected = this.selected.has(row);
            return (
              <tr class={{ striped: striped && i % 2, hoverable, selected: isSelected, clickable: selectable }}
                  data-index={this.rows.indexOf(row)} aria-selected={selectable ? String(isSelected) : undefined}
                  aria-rowindex={virtual ? String(i + 2) : undefined}>
                {checkbox && <td class={['check', { pinned: anyPinned }]} style={anyPinned ? { left: '0px' } : undefined}><input type="checkbox" class="check-row" aria-label="Select row" checked={isSelected} /></td>}
                {cols.map(col => {
                  const left = offsets.get(String(col.field));
                  return <td class={[this.align(col), { pinned: left !== undefined }]} style={left !== undefined ? { left: `${left}px` } : undefined}>{this.renderCell(row, col)}</td>;
                })}
              </tr>
            );
          }),
          spacer(virtual ? rows.length - end : 0)
        ] : (
          <tr class="empty">
            <td colspan={span}>
              <div class="nx-grid-empty">
                <span html={Icons.get(this.query ? 'search' : 'table')} />
                <span>{this.query ? `No results for “${this.query}”` : this.getProp('empty-text', 'No data to display')}</span>
              </div>
            </td>
          </tr>
        )}
      </tbody>
    ) as HTMLElement;
  }

  private renderCell(row: T, col: GridColumn<T>): Child {
    const value = this.value(row, col.field);
    if (col.renderer) {
      const out = col.renderer(value, row, col);
      // Strings are HTML (you own escaping); nodes (JSX) are used as-is
      return typeof out === 'string' ? <span class="cell-html" html={out} /> : out;
    }
    if (col.formatter) return col.formatter(value, row);
    if (value === null || value === undefined || value === '') return <span class="muted">—</span>;

    switch (col.type) {
      case 'number':
        return Number(value).toLocaleString();
      case 'currency':
        return Number(value).toLocaleString(undefined, { style: 'currency', currency: col.currency ?? 'USD' });
      case 'percent':
        return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
      case 'date': {
        const date = value instanceof Date ? value : new Date(value);
        return isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      }
      case 'boolean':
        return value
          ? <span class="bool yes" aria-label="Yes" html={Icons.get('check')} />
          : <span class="bool no" aria-label="No" html={Icons.get('minus')} />;
      case 'badge':
        return <span class={['badge', `tone-${col.badges?.[String(value)] ?? 'neutral'}`]}>{String(value)}</span>;
      default:
        return String(value);
    }
  }

  private renderFooter(): Node {
    const perPage = this.pageSize();
    const total = this.getVisibleRows().length;
    const selectedCount = this.selected.size;
    if (!perPage && !selectedCount) return <div class="nx-grid-footer" hidden />;

    const pages = this.pageCount();
    const from = total ? (this.page - 1) * (perPage || total) + 1 : 0;
    const to = perPage ? Math.min(total, this.page * perPage) : total;

    return (
      <div class="nx-grid-footer" part="footer">
        <span class="info">{selectedCount ? `${selectedCount} of ${this.rows.length} selected` : `${from}–${to} of ${total}`}</span>
        {perPage > 0 && (
          <span class="pager">
            <span class="info">Page {this.page} of {pages}</span>
            <button class="page-btn" aria-label="Previous page" disabled={this.page <= 1} html={Icons.get('chevron-left')}
                    onClick={() => this.setPage(this.page - 1)} />
            <button class="page-btn" aria-label="Next page" disabled={this.page >= pages} html={Icons.get('chevron-right')}
                    onClick={() => this.setPage(this.page + 1)} />
          </span>
        )}
      </div>
    );
  }

  private selectionChanged(): void {
    this.refresh();
    this.emit('selection-change', { selected: this.getSelected() });
  }

  private onCheckboxChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    if (target.classList.contains('check-all')) {
      this.currentPageRows(this.getVisibleRows()).forEach(row => (target.checked ? this.selected.add(row) : this.selected.delete(row)));
      this.selectionChanged();
    } else if (target.classList.contains('check-row')) {
      const row = this.rowFromEvent(e);
      if (!row) return;
      target.checked ? this.selected.add(row) : this.selected.delete(row);
      this.selectionChanged();
    }
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    const th = target.closest('th.sortable') as HTMLElement | null;
    if (th) {
      this.sort(th.dataset.field!);
      return;
    }

    const row = this.rowFromEvent(e);
    if (!row) return;

    // Buttons, links and inputs inside cells (e.g. from a renderer) handle their own clicks
    const interactive = e.composedPath().some(el =>
      el instanceof Element && el.matches(`a, button, input, select, textarea, label, nx-button, nx-menu, ${FIELD_TAGS}, [data-no-row-click]`)
    );
    if (interactive) return;

    if (this.isSelectable()) {
      if (this.isMulti() && (e.metaKey || e.ctrlKey || this.getProp('checkbox-selection', false))) {
        this.selected.has(row) ? this.selected.delete(row) : this.selected.add(row);
      } else {
        const onlyThis = this.selected.size === 1 && this.selected.has(row);
        this.selected.clear();
        if (!onlyThis) this.selected.add(row);
      }
      this.selectionChanged();
    }

    this.emit('row-click', { row, index: this.rows.indexOf(row) });
  }

  private rowFromEvent(e: Event): T | null {
    const tr = (e.target as HTMLElement).closest('tr[data-index]') as HTMLElement | null;
    return tr ? this.rows[Number(tr.dataset.index)] ?? null : null;
  }

  protected styles(): string {
    return `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        font-size: 0.875rem;
      }

      .nx-grid {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        background: var(--color-surface);
        overflow: hidden;
      }

      .nx-grid.bordered {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
      }

      /* Toolbar */
      .nx-grid-toolbar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--color-border);
      }

      .nx-grid-title {
        flex: 1;
        font-weight: 600;
        font-size: 0.9375rem;
        letter-spacing: -0.01em;
      }

      .nx-grid-search {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        height: 2.25rem;
        width: min(16rem, 100%);
        margin-left: auto;
        padding: 0 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-background);
        color: var(--color-text-secondary);
        transition: border-color var(--transition-duration), box-shadow var(--transition-duration);
      }

      .nx-grid-search:focus-within {
        border-color: var(--color-ring);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-ring) 25%, transparent);
      }

      .nx-grid-search input {
        flex: 1;
        min-width: 0;
        border: none;
        outline: none;
        background: transparent;
        color: var(--color-text);
        font: inherit;
      }

      /* Table */
      .nx-grid-body {
        flex: 1;
        min-height: 0;
        overflow: auto;
      }

      .nx-grid-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        table-layout: fixed;
      }

      th, td {
        height: 3rem;
        padding: 0 1rem;
        text-align: left;
        border-bottom: 1px solid var(--color-border);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dense th, .dense td { height: 2.25rem; padding: 0 0.75rem; }
      th.pinned, td.pinned { position: sticky; z-index: 1; background: var(--color-background); }
      th.pinned { z-index: 3; background: var(--color-muted); }
      tr.striped td.pinned { background: color-mix(in srgb, var(--color-muted) 50%, var(--color-background)); }
      tr.hoverable:hover td.pinned, tr.selected td.pinned { background: var(--color-accent); }
      th, td { box-sizing: border-box; }
      th { position: sticky; }
      th:has(.resize-handle) { padding-inline-end: 0.5rem; }
      .resize-handle {
        position: absolute;
        inset-block: 0;
        inset-inline-end: 0;
        width: 0.5rem;
        cursor: col-resize;
        touch-action: none;
      }
      .resize-handle::after {
        content: '';
        position: absolute;
        inset-block: 25%;
        inset-inline-end: 0.125rem;
        width: 2px;
        border-radius: 1px;
        background: var(--color-border);
        transition: background-color var(--transition-duration);
      }
      .resize-handle:hover::after, .resize-handle:focus-visible::after { background: var(--color-ring); }
      .resize-handle:focus-visible { outline: none; }
      th[draggable='true'] { cursor: grab; }
      .virtual td { height: var(--nx-row-h); box-sizing: border-box; }

      th {
        position: sticky;
        top: 0;
        z-index: 1;
        height: 2.5rem;
        background: var(--color-muted);
        color: var(--color-text-secondary);
        font-weight: 500;
        font-size: 0.8125rem;
        user-select: none;
      }

      th.sortable { cursor: pointer; }
      th.sortable:hover, th.sorted { color: var(--color-text); }

      .th {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }

      .sort-icon {
        display: inline-flex;
        opacity: 0;
        transition: opacity var(--transition-duration);
      }

      .sort-btn {
        padding: 0;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: inherit;
        cursor: pointer;
      }

      .sort-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring);
      }

      th.sortable:hover .sort-icon, .sort-btn:focus-visible .sort-icon { opacity: 0.5; }
      th.sorted .sort-icon { opacity: 1; }

      .align-right { text-align: right; }
      .align-center { text-align: center; }
      .align-right .th { flex-direction: row-reverse; }

      .check {
        width: 3rem;
        padding: 0 0 0 1rem;
      }

      input[type="checkbox"] {
        width: 1rem;
        height: 1rem;
        margin: 0;
        vertical-align: middle;
        accent-color: var(--color-primary);
        cursor: pointer;
      }

      tbody tr { transition: background-color var(--transition-duration); }
      tbody tr:last-child td { border-bottom: none; }
      tr.striped { background: color-mix(in srgb, var(--color-muted) 50%, transparent); }
      tr.hoverable:hover { background: var(--color-accent); }
      tr.clickable { cursor: pointer; }
      tr.selected { background: var(--color-accent); }
      tr.selected td:first-child { box-shadow: inset 2px 0 0 var(--color-primary); }

      .muted { color: var(--color-text-secondary); }

      .badge {
        display: inline-flex;
        align-items: center;
        height: 1.375rem;
        padding: 0 0.5rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        border: 1px solid transparent;
      }

      .tone-neutral { background: var(--color-muted); color: var(--color-text); border-color: var(--color-border); }
      .tone-info { background: color-mix(in srgb, var(--color-info) 14%, transparent); color: var(--color-info-text); }
      .tone-success { background: color-mix(in srgb, var(--color-success) 14%, transparent); color: var(--color-success-text); }
      .tone-warning { background: color-mix(in srgb, var(--color-warning) 16%, transparent); color: var(--color-warning-text); }
      .tone-error { background: color-mix(in srgb, var(--color-error) 14%, transparent); color: var(--color-error-text); }

      .bool { display: inline-flex; font-size: 1rem; }
      .bool.yes { color: var(--color-success); }
      .bool.no { color: var(--color-text-secondary); }

      tr.empty td { height: auto; border-bottom: none; }

      .nx-grid-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 3rem 1rem;
        color: var(--color-text-secondary);
        white-space: normal;
      }

      .nx-grid-empty svg { width: 1.75rem; height: 1.75rem; opacity: 0.6; }

      /* Footer */
      .nx-grid-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        min-height: 3rem;
        padding: 0 0.75rem 0 1rem;
        border-top: 1px solid var(--color-border);
        color: var(--color-text-secondary);
        font-size: 0.8125rem;
      }

      .nx-grid-footer[hidden] { display: none; }

      .pager {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }

      .pager .info { margin-right: 0.5rem; }

      .page-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: var(--color-background);
        color: var(--color-text);
        cursor: pointer;
      }

      .page-btn:hover:not(:disabled) { background: var(--color-accent); }
      .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    `;
  }
}

/**
 * `<nx-data-table>` — kept for compatibility; identical to `<nx-grid>`.
 */
export class NXDataTable<T extends Record<string, any> = any> extends NXGrid<T> {}

define('nx-grid', NXGrid);
define('nx-data-table', NXDataTable);
