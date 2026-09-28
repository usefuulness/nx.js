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
  /** Shown when there are no rows */
  emptyText?: string;
}

const cssSize = (value: unknown): string =>
  typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value)) ? `${value}px` : String(value);

const isNumeric = (col: GridColumn): boolean =>
  col.type === 'number' || col.type === 'currency' || col.type === 'percent';

/**
 * Data grid: sorting, search, selection, paging, store binding.
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
 * Events: `row-click`, `row-dblclick`, `selection-change`, `sort-change`.
 */
export class NXGrid<T extends Record<string, any> = any> extends BaseComponent {
  static get observedAttributes(): string[] {
    return [
      'title', 'search', 'striped', 'hoverable', 'dense', 'bordered',
      'selectable', 'checkbox-selection', 'page-size', 'empty-text', 'store'
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
    body.replaceChildren(this.renderTable());
    this.$('.nx-grid-footer')?.replaceWith(this.renderFooter());
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
    return this.columns.filter(col => !col.hidden);
  }

  private headerText(col: GridColumn<T>): string {
    return col.header ?? col.text ?? String(col.field);
  }

  private value(row: T, field: keyof T | string): any {
    const path = String(field);
    if (!path.includes('.')) return row[path];
    return path.split('.').reduce<any>((obj, key) => obj?.[key], row);
  }

  private pageSize(): number {
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
      <div part="grid" class={['nx-grid', { bordered: this.getProp('bordered', true), dense: this.getProp('dense', false) }]}
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
        <div class="nx-grid-body" part="body">{this.renderTable()}</div>
        {this.renderFooter()}
      </div>
    );
  }

  private renderTable(): Node {
    const cols = this.visibleColumns();
    const all = this.getVisibleRows();
    this.page = Math.min(this.page, this.pageCount());
    const rows = this.currentPageRows(all);

    const checkbox = !!this.getProp('checkbox-selection', false);
    const allChecked = rows.length > 0 && rows.every(row => this.selected.has(row));
    const someChecked = rows.some(row => this.selected.has(row));
    const striped = this.getProp('striped', false);
    const hoverable = this.getProp('hoverable', true);
    const selectable = this.isSelectable();

    // Auto-width columns get at least 10rem; below that the body scrolls sideways
    const fixed = cols.filter(c => c.width).map(c => cssSize(c.width));
    const minWidth = `calc(${[...fixed, `${(cols.length - fixed.length) * 10}rem`, checkbox ? '3rem' : '0px'].join(' + ')})`;

    return (
      <table class="nx-grid-table" part="table" style={{ minWidth }}>
        <colgroup>
          {checkbox && <col style="width: 3rem" />}
          {cols.map(col => <col style={col.width ? { width: cssSize(col.width) } : undefined} />)}
        </colgroup>
        <thead>
          <tr>
            {checkbox && (
              <th class="check">
                <input type="checkbox" class="check-all" aria-label="Select all" checked={allChecked} indeterminate={someChecked && !allChecked} />
              </th>
            )}
            {cols.map(col => {
              const sortable = col.sortable !== false;
              const active = this.sortField === String(col.field);
              return (
                <th class={[this.align(col), { sortable, sorted: active }]} data-field={String(col.field)}
                    aria-sort={active ? (this.sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {sortable ? (
                    // A real button, so sorting works from the keyboard too
                    <button type="button" class="th sort-btn" part="sort">
                      {this.headerText(col)}
                      <span class="sort-icon" aria-hidden="true" html={Icons.get(active && this.sortDirection === 'desc' ? 'chevron-down' : 'chevron-up')} />
                    </button>
                  ) : (
                    <span class="th">{this.headerText(col)}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, i) => {
            const isSelected = this.selected.has(row);
            return (
              <tr class={{ striped: striped && i % 2, hoverable, selected: isSelected, clickable: selectable }}
                  data-index={this.rows.indexOf(row)} aria-selected={selectable ? String(isSelected) : undefined}>
                {checkbox && <td class="check"><input type="checkbox" class="check-row" aria-label="Select row" checked={isSelected} /></td>}
                {cols.map(col => <td class={this.align(col)}>{this.renderCell(row, col)}</td>)}
              </tr>
            );
          }) : (
            <tr class="empty">
              <td colspan={cols.length + (checkbox ? 1 : 0)}>
                <div class="nx-grid-empty">
                  <span html={Icons.get(this.query ? 'search' : 'table')} />
                  <span>{this.query ? `No results for “${this.query}”` : this.getProp('empty-text', 'No data to display')}</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
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
