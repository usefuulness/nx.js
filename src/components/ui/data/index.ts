import { NXDataComponent } from '@/components/abstracts/data';
import { ComponentState } from '@/components/abstracts/base';

export interface ColumnDef<T> {
  field: keyof T;
  header: string;
  width?: string;
  sortable?: boolean;
  filterable?: boolean;
  renderer?: (value: any, row: T) => string;
}

export interface DataTableConfig<T> {
  columns: ColumnDef<T>[];
  data: T[];
  selectable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  pageable?: boolean;
  pageSize?: number;
}

export class NXDataTable<T = any> extends NXDataComponent<{
  columns: ColumnDef<T>[];
  data: T[];
}> {
  static get observedAttributes(): string[] {
    return ['selectable', 'sortable', 'filterable', 'pageable', 'page-size'];
  }

  protected initializeState(): void {
    this[ComponentState].set('selectedRows', new Set());
    this[ComponentState].set('sortField', null);
    this[ComponentState].set('sortDirection', 'asc');
    this[ComponentState].set('currentPage', 1);
    this[ComponentState].set('filterValue', '');
  }

  constructor(config?: DataTableConfig<T>) {
    super({
      columns: config?.columns || [],
      data: config?.data || []
    });
    this.attachShadow({ mode: 'open' });
  }

  setColumns(columns: ColumnDef<T>[]): void {
    this.setData({ columns });
  }

  setRows(data: T[]): void {
    this.setData({ data });
  }

  protected render(): string {
    const { columns, data } = this.getData();
    const filterable = this.getProp('filterable', false);
    const pageable = this.getProp('pageable', false);
    const pageSize = this.getProp('page-size', 10);
    const currentPage = this.getState('currentPage', 1);
    const filterValue = this.getState<string>('filterValue', '');

    // Filter data
    let filteredData = data;
    if (filterable && filterValue) {
      filteredData = data.filter(row => 
        Object.values(row as any).some(value => 
          String(value).toLowerCase().includes(filterValue.toLowerCase())
        )
      );
    }

    // Sort data
    const sortField = this.getState('sortField');
    const sortDirection = this.getState('sortDirection', 'asc');
    if (sortField) {
      filteredData = [...filteredData].sort((a, b) => {
        const aVal = (a as any)[sortField];
        const bVal = (b as any)[sortField];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    // Paginate data
    let displayData = filteredData;
    let totalPages = 1;
    if (pageable) {
      totalPages = Math.ceil(filteredData.length / pageSize);
      const start = (currentPage - 1) * pageSize;
      displayData = filteredData.slice(start, start + pageSize);
    }

    return `
      ${filterable ? `
        <div class="nx-data-table-toolbar" part="toolbar">
          <input type="text" 
                 class="nx-data-table-filter" 
                 part="filter"
                 placeholder="Filter..."
                 value="${filterValue}">
        </div>
      ` : ''}
      
      <div class="nx-data-table-wrapper" part="wrapper">
        <table class="nx-data-table" part="table">
          <thead>
            <tr>
              ${columns.map(col => `
                <th class="${col.sortable ? 'sortable' : ''}" 
                    data-field="${String(col.field)}"
                    style="${col.width ? `width: ${col.width}` : ''}">
                  <div class="nx-data-table-header">
                    <span>${col.header}</span>
                    ${col.sortable && sortField === col.field ? `
                      <svg class="sort-icon ${sortDirection}" viewBox="0 0 24 24">
                        <path d="M7 10l5 5 5-5z"/>
                      </svg>
                    ` : ''}
                  </div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${displayData.map((row, index) => `
              <tr data-row-index="${index}">
                ${columns.map(col => `
                  <td>
                    ${col.renderer ? 
                      col.renderer((row as any)[col.field], row) : 
                      (row as any)[col.field]
                    }
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      ${pageable ? `
        <div class="nx-data-table-pagination" part="pagination">
          <button class="pagination-btn" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>
            Previous
          </button>
          <span class="pagination-info">
            Page ${currentPage} of ${totalPages}
          </span>
          <button class="pagination-btn" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>
            Next
          </button>
        </div>
      ` : ''}
    `;
  }

  protected styles(): string {
    return `
      :host {
        display: block;
      }

      .nx-data-table-toolbar {
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
      }

      .nx-data-table-filter {
        width: 100%;
        max-width: 300px;
        padding: 0.5rem;
        border: 1px solid var(--border-color);
        border-radius: 0.25rem;
        font-family: inherit;
      }

      .nx-data-table-wrapper {
        overflow-x: auto;
      }

      .nx-data-table {
        width: 100%;
        border-collapse: collapse;
      }

      .nx-data-table th,
      .nx-data-table td {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid var(--border-color);
      }

      .nx-data-table th {
        background: var(--surface-color);
        font-weight: 600;
      }

      .nx-data-table th.sortable {
        cursor: pointer;
        user-select: none;
      }

      .nx-data-table th.sortable:hover {
        background: var(--hover-bg);
      }

      .nx-data-table-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .sort-icon {
        width: 1rem;
        height: 1rem;
        fill: currentColor;
        transition: transform 0.2s;
      }

      .sort-icon.desc {
        transform: rotate(180deg);
      }

      .nx-data-table tbody tr:hover {
        background: var(--hover-bg);
      }

      .nx-data-table-pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 1rem;
      }

      .pagination-btn {
        padding: 0.5rem 1rem;
        border: 1px solid var(--border-color);
        background: var(--surface-color);
        border-radius: 0.25rem;
        cursor: pointer;
        font-family: inherit;
      }

      .pagination-btn:hover:not(:disabled) {
        background: var(--hover-bg);
      }

      .pagination-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }

  protected afterRender(): void {
    // Filter input
    const filterInput = this.$('.nx-data-table-filter') as HTMLInputElement;
    if (filterInput) {
      this.on(filterInput, 'input', () => {
        this.setState('filterValue', filterInput.value);
        this.setState('currentPage', 1);
      });
    }

    // Sort headers
    this.$$('th.sortable').forEach(th => {
      this.on(th, 'click', () => {
        const field = th.getAttribute('data-field');
        const currentSort = this.getState('sortField');
        const currentDirection = this.getState('sortDirection', 'asc');
        
        if (field === currentSort) {
          this.setState('sortDirection', currentDirection === 'asc' ? 'desc' : 'asc');
        } else {
          this.setState('sortField', field);
          this.setState('sortDirection', 'asc');
        }
      });
    });

    // Pagination
    this.$$('.pagination-btn').forEach(btn => {
      this.on(btn, 'click', () => {
        const action = btn.getAttribute('data-page');
        const currentPage = this.getState('currentPage', 1);
        
        if (action === 'prev' && currentPage > 1) {
          this.setState('currentPage', currentPage - 1);
        } else if (action === 'next') {
          this.setState('currentPage', currentPage + 1);
        }
      });
    });
  }
}

customElements.define('nx-data-table', NXDataTable);
