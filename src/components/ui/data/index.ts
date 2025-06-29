// nx-data-table.ts

import { NXDataComponent } from '@/components/abstracts/data';
import { ComponentState } from '@/components/abstracts/base';

export interface ColumnDef<T> {
  /** Key of the field in each row object */
  key: keyof T;
  /** Display label for the column header */
  label: string;
}

/**
 * A feature-rich data table with sorting, selection, and pagination.
 *
 * @template T Type of each data row.
 */
export class NXDataTable<T extends Record<string, any> = Record<string, any>> extends NXDataComponent<{
  columns: ColumnDef<T>[];
  data: T[];
}> {
  /** Which attributes to watch on the host element */
  static get observedAttributes(): string[] {
    return ['columns', 'data', 'sortable', 'selectable'];
  }

  /**
   * Initialize internal state: sort, selection, and pagination.
   * Bypass normal update triggers for these defaults.
   */
  protected initializeState(): void {
    this[ComponentState].set('sortColumn', null as keyof T | null);
    this[ComponentState].set('sortDirection', 'asc' as 'asc' | 'desc');
    this[ComponentState].set('selectedRows', new Set<number>());
    this[ComponentState].set('currentPage', 1);
    this[ComponentState].set('pageSize', 10);
  }

  constructor(initial: {
    columns?: ColumnDef<T>[];
    data?: T[];
  } = {}) {
    super({
      columns: initial.columns ?? [],
      data: initial.data ?? []
    });
    this.attachShadow({ mode: 'open' });
  }

  private update(): void {
    // Render the table HTML and styles
    this.update()
  }

  /**
   * Re-render on attribute changes.
   */
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    if (oldVal !== newVal) this.update();
  }

  connectedCallback(): void {
    this.initializeState();
    this.update();
    this.afterRender();
  }

  /**
   * Build table HTML: headers, rows, empty state, pagination.
   */
  protected render(): string {
    const cols = this.getData().columns;
    const rows = this.getData().data;
    const sortable = this.getProp('sortable') === 'true';
    const selectable = this.getProp('selectable') === 'true';

    const sortColumn = this.getState('sortColumn', null);
    const sortDirection = this.getState('sortDirection', 'asc');
    const currentPage = this.getState('currentPage', 1);
    const pageSize = this.getState('pageSize', 10);
    const selectedRows = this.getState('selectedRows', new Set<number>()) ?? new Set<number>();

    // Sort
    let sorted = [...rows];
    if (sortable && sortColumn != null) {
      sorted.sort((a, b) => {
        const aVal = a[sortColumn], bVal = b[sortColumn];
        const modifier = sortDirection === 'asc' ? 1 : -1;
        if (aVal < bVal) return -1 * modifier;
        if (aVal > bVal) return 1 * modifier;
        return 0;
      });
    }

    // Paginate
    const safePageSize = pageSize ?? 10;
    const totalPages = Math.max(1, Math.ceil(sorted.length / safePageSize));
    const safeCurrentPage = currentPage ?? 1;
    const start = (safeCurrentPage - 1) * safePageSize;
    const pageData = sorted.slice(start, start + safePageSize);

    if (cols.length === 0 || rows.length === 0) {
      return `<div class="empty-state">No data available</div>`;
    }

    return `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${selectable
                ? `<th class="checkbox-cell"><input type="checkbox" id="select-all"></th>`
                : ''}
              ${cols.map(col => `
                <th class="${sortable ? 'sortable' : ''}"
                    data-column="${String(col.key)}">
                  <div class="th-content">
                    <span>${col.label}</span>
                    ${sortable && sortColumn != null && sortColumn === col.key ? `
                      <svg class="sort-icon ${sortDirection}" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 10l5 5 5-5z"/>
                      </svg>`
                      : ''}
                  </div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${pageData.map((row, i) => {
              const idx = start + i;
              const isSel = selectedRows.has(idx);
              return `
                <tr data-row-index="${idx}" class="${isSel ? 'selected' : ''}">
                  ${selectable
                    ? `<td class="checkbox-cell">
                         <input type="checkbox" class="row-checkbox"
                                data-index="${idx}" ${isSel ? 'checked' : ''}>
                       </td>`
                    : ''}
                  ${cols.map(col => `<td>${row[col.key] ?? ''}</td>`).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        ${totalPages > 1 ? `
          <div class="pagination">
            <button class="pagination-btn" id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>
              Previous
            </button>
            <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
            <button class="pagination-btn" id="next-page" ${currentPage === totalPages ? 'disabled' : ''}>
              Next
            </button>
          </div>`
          : ''}
      </div>
    `;
  }

  /**
   * Table and control styling.
   */
  protected styles(): string {
    return `
      .table-container {
        background-color: var(--color-surface);
        border-radius: var(--radius-lg);
        overflow: hidden;
        box-shadow: var(--shadow-md);
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
      }
      .data-table th {
        background-color: var(--color-background);
        padding: 1rem;
        text-align: left;
        font-weight: 600;
        color: var(--color-text);
        border-bottom: 1px solid var(--color-border);
      }
      .data-table th.sortable {
        cursor: pointer;
        user-select: none;
      }
      .th-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .sort-icon {
        transition: transform 0.2s;
      }
      .sort-icon.desc {
        transform: rotate(180deg);
      }
      .data-table td {
        padding: 1rem;
        border-bottom: 1px solid var(--color-border);
      }
      .data-table tr:hover {
        background-color: var(--color-background);
      }
      .data-table tr.selected {
        background-color: rgba(59, 130, 246, 0.1);
      }
      .checkbox-cell {
        width: 40px;
        text-align: center;
      }
      .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 1rem;
        border-top: 1px solid var(--color-border);
      }
      .pagination-btn {
        padding: 0.5rem 1rem;
        background-color: var(--color-primary);
        color: white;
        border: none;
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all 0.2s;
      }
      .pagination-btn:hover:not(:disabled) {
        background-color: var(--color-primary-dark);
      }
      .pagination-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .pagination-info {
        color: var(--color-text-secondary);
      }
      .empty-state {
        padding: 3rem;
        text-align: center;
        color: var(--color-text-secondary);
      }
    `;
  }

  /**
   * Wire up sorting, selection, pagination, and row-click events.
   */
  protected afterRender(): void {
    // Sorting
    if (this.getProp('sortable') === 'true') {
      this.$$('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
          const col = (th as HTMLElement).dataset.column as keyof T;
          const cur = this.getState('sortColumn', null as keyof T | null);
          const dir = this.getState('sortDirection', 'asc' as 'asc' | 'desc');
          if (col === cur) {
            this.setState('sortDirection', dir === 'asc' ? 'desc' : 'asc');
          } else {
            this.setState('sortColumn', col);
            this.setState('sortDirection', 'asc');
          }
        });
      });
    }

    // Selection
    if (this.getProp('selectable') === 'true') {
      this.on('#select-all', 'change', (e: Event) => {
        const checked = (e.target as HTMLInputElement).checked;
        const sel = new Set<number>();
        if (checked) this.getData().data.forEach((_, i) => sel.add(i));
        this.setState('selectedRows', sel);
        this.$$('.row-checkbox').forEach(cb => {
          (cb as HTMLInputElement).checked = checked;
        });
      });

      this.$$('.row-checkbox').forEach(cb => {
        const idx = Number((cb as HTMLElement).dataset.index);
        (cb as HTMLInputElement).checked = (this.getState('selectedRows', new Set()) ?? new Set<number>()).has(idx);
        cb.addEventListener('change', (e: Event) => {
          const target = e.target as HTMLInputElement;
          const sel = new Set(this.getState('selectedRows', new Set<number>()));
          if (target.checked) sel.add(idx);
          else sel.delete(idx);
          this.setState('selectedRows', sel);
        });
      });
    }

    // Pagination
    this.on('#prev-page', 'click', () => {
      const cur = this.getState('currentPage', 1) ?? 1;
      if (cur > 1) this.setState('currentPage', cur - 1);
    });
    this.on('#next-page', 'click', () => {
      const cur = this.getState('currentPage', 1) ?? 1;
      const dataArr = Array.isArray(this.getData().data) ? this.getData().data : ([] as T[]);
      const pageSize = this.getState('pageSize', 10) ?? 10;
      const total = Math.ceil(((dataArr && dataArr.length) ? dataArr.length : 0) / pageSize);
      if (cur < total) this.setState('currentPage', cur + 1);
    });

    // Row clicks
    this.$$('tbody tr').forEach(tr => {
      tr.addEventListener('click', e => {
        if ((e.target as HTMLElement).tagName !== 'INPUT') {
          const idx = Number((tr as HTMLElement).dataset.rowIndex);
          this.dispatchEvent(new CustomEvent('rowclick', {
            detail: { row: this.getData().data[idx], index: idx }
          }));
        }
      });
    });
  }
}

customElements.define('nx-data-table', NXDataTable);
