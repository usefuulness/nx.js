// src/components/data/grid.ts
import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface GridColumn<T = any> {
  field: keyof T | string;
  header: string;
  width?: number | string;
  flex?: number;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  formatter?: (value: any, row: T) => string;
  renderer?: (value: any, row: T, column: GridColumn<T>) => string;
  editor?: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  editorConfig?: any;
  align?: 'left' | 'center' | 'right';
  headerAlign?: 'left' | 'center' | 'right';
  hidden?: boolean;
  locked?: boolean;
  aggregator?: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

export interface GridConfig<T = any> {
  columns: GridColumn<T>[];
  data?: T[];
  striped?: boolean;
  bordered?: boolean;
  hoverable?: boolean;
  selectable?: boolean | 'single' | 'multiple';
  checkboxSelection?: boolean;
  rowHeight?: number;
  headerHeight?: number;
  virtualScroll?: boolean;
  pageSize?: number;
  groupField?: keyof T;
  showFooter?: boolean;
  showToolbar?: boolean;
  editable?: boolean;
  autoHeight?: boolean;
}

interface VirtualScrollState {
  scrollTop: number;
  visibleStart: number;
  visibleEnd: number;
  totalHeight: number;
}

/**
 * Advanced data grid with virtual scrolling, sorting, filtering, and editing capabilities.
 */
export class NXGrid<T extends Record<string, any> = any> extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['striped', 'bordered', 'hoverable', 'selectable', 'virtual-scroll', 'editable'];
  }

  private data: T[] = [];
  private columns: GridColumn<T>[] = [];
  private filteredData: T[] = [];
  private virtualScrollState: VirtualScrollState = {
    scrollTop: 0,
    visibleStart: 0,
    visibleEnd: 0,
    totalHeight: 0
  };

  protected initializeState(): void {
    this[ComponentState].set('sortField', null);
    this[ComponentState].set('sortDirection', 'asc');
    this[ComponentState].set('selectedRows', new Set<number>());
    this[ComponentState].set('filters', new Map<string, any>());
    this[ComponentState].set('editingCell', null);
    this[ComponentState].set('columnWidths', new Map<string, number>());
  }

  constructor(config?: GridConfig<T>) {
    super();
    this.attachShadow({ mode: 'open' });
    if (config) {
      this.configure(config);
    }
  }

  configure(config: GridConfig<T>): void {
    this.columns = config.columns || [];
    this.data = config.data || [];
    this.filteredData = [...this.data];
    
    Object.entries(config).forEach(([key, value]) => {
      if (key !== 'columns' && key !== 'data') {
        this.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), String(value));
      }
    });
    
    this.update();
  }

  setData(data: T[]): void {
    this.data = data;
    this.applyFiltersAndSort();
    this.update();
  }

  setColumns(columns: GridColumn<T>[]): void {
    this.columns = columns;
    this.update();
  }

  protected render(): string {
    const virtualScroll = this.getProp('virtual-scroll', false);
    const showToolbar = this.getProp('show-toolbar', true);

    return `
      <div class="nx-grid" part="grid">
        ${showToolbar ? this.renderToolbar() : ''}
        <div class="nx-grid-container">
          <div class="nx-grid-header" part="header">
            ${this.renderHeader()}
          </div>
          <div class="nx-grid-body" part="body" ${virtualScroll ? 'data-virtual="true"' : ''}>
            ${virtualScroll ? this.renderVirtualBody() : this.renderBody()}
          </div>
          ${this.getProp('show-footer', false) ? this.renderFooter() : ''}
        </div>
        ${this.renderContextMenu()}
      </div>
    `;
  }

  private renderToolbar(): string {
    return `
      <div class="nx-grid-toolbar" part="toolbar">
        <div class="nx-grid-toolbar-left">
          <slot name="toolbar-left"></slot>
        </div>
        <div class="nx-grid-toolbar-right">
          <button class="nx-grid-tool" data-action="refresh" title="Refresh">
            <svg class="nx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
          </button>
          <button class="nx-grid-tool" data-action="export" title="Export">
            <svg class="nx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
          </button>
          <button class="nx-grid-tool" data-action="settings" title="Settings">
            <svg class="nx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3"/>
            </svg>
          </button>
          <slot name="toolbar-right"></slot>
        </div>
      </div>
    `;
  }

  private renderHeader(): string {
    const sortField = this.getState('sortField');
    const sortDirection = this.getState('sortDirection', 'asc');
    const selectable = this.getProp('selectable');
    const checkboxSelection = this.getProp('checkbox-selection', false);

    return `
      <table class="nx-grid-table">
        <thead>
          <tr>
            ${checkboxSelection && selectable ? `
              <th class="nx-grid-checkbox-cell">
                <input type="checkbox" class="nx-grid-checkbox-all" />
              </th>
            ` : ''}
            ${this.columns.filter(col => !col.hidden).map((col, index) => `
              <th class="nx-grid-header-cell ${col.sortable ? 'sortable' : ''} ${col.align || 'left'}"
                  data-field="${String(col.field)}"
                  data-index="${index}"
                  style="${col.width ? `width: ${col.width}px` : ''}${col.flex ? `flex: ${col.flex}` : ''}">
                <div class="nx-grid-header-content">
                  <span class="nx-grid-header-text">${col.header}</span>
                  ${col.sortable && sortField === col.field ? `
                    <svg class="nx-sort-icon ${sortDirection}" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 10l5 5 5-5z"/>
                    </svg>
                  ` : ''}
                  ${col.filterable ? `
                    <button class="nx-filter-btn" data-field="${String(col.field)}">
                      <svg class="nx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
                      </svg>
                    </button>
                  ` : ''}
                </div>
                ${col.resizable !== false ? `
                  <div class="nx-column-resizer" data-index="${index}"></div>
                ` : ''}
              </th>
            `).join('')}
          </tr>
        </thead>
      </table>
    `;
  }

  private renderBody(): string {
    const selectedRows = this.getState('selectedRows', new Set<number>());
    const checkboxSelection = this.getProp('checkbox-selection', false);
    const selectable = this.getProp('selectable');
    const striped = this.getProp('striped', false);
    const hoverable = this.getProp('hoverable', true);

    return `
      <table class="nx-grid-table">
        <tbody>
          ${this.filteredData.map((row, rowIndex) => `
            <tr class="nx-grid-row 
                ${striped && rowIndex % 2 === 1 ? 'striped' : ''} 
                ${hoverable ? 'hoverable' : ''}
                ${selectedRows.has(rowIndex) ? 'selected' : ''}"
                data-row-index="${rowIndex}">
              ${checkboxSelection && selectable ? `
                <td class="nx-grid-checkbox-cell">
                  <input type="checkbox" class="nx-grid-checkbox" 
                         data-index="${rowIndex}"
                         ${selectedRows.has(rowIndex) ? 'checked' : ''} />
                </td>
              ` : ''}
              ${this.columns.filter(col => !col.hidden).map(col => 
                this.renderCell(row, col, rowIndex)
              ).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${this.filteredData.length === 0 ? this.renderEmptyState() : ''}
    `;
  }

  private renderVirtualBody(): string {
    const rowHeight = this.getProp('row-height', 40);
    const totalHeight = this.filteredData.length * rowHeight;
    const { visibleStart, visibleEnd } = this.virtualScrollState;

    return `
      <div class="nx-virtual-scroller" style="height: ${totalHeight}px">
        <table class="nx-grid-table" style="transform: translateY(${visibleStart * rowHeight}px)">
          <tbody>
            ${this.filteredData.slice(visibleStart, visibleEnd).map((row, index) => {
              const rowIndex = visibleStart + index;
              return this.renderRow(row, rowIndex);
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderRow(row: T, rowIndex: number): string {
    const selectedRows = this.getState('selectedRows', new Set<number>());
    const checkboxSelection = this.getProp('checkbox-selection', false);
    const selectable = this.getProp('selectable');
    const striped = this.getProp('striped', false);
    const hoverable = this.getProp('hoverable', true);

    return `
      <tr class="nx-grid-row 
          ${striped && rowIndex % 2 === 1 ? 'striped' : ''} 
          ${hoverable ? 'hoverable' : ''}
          ${selectedRows.has(rowIndex) ? 'selected' : ''}"
          data-row-index="${rowIndex}">
        ${checkboxSelection && selectable ? `
          <td class="nx-grid-checkbox-cell">
            <input type="checkbox" class="nx-grid-checkbox" 
                   data-index="${rowIndex}"
                   ${selectedRows.has(rowIndex) ? 'checked' : ''} />
          </td>
        ` : ''}
        ${this.columns.filter(col => !col.hidden).map(col => 
          this.renderCell(row, col, rowIndex)
        ).join('')}
      </tr>
    `;
  }

  private renderCell(row: T, column: GridColumn<T>, rowIndex: number): string {
    const value = this.getCellValue(row, column.field);
    const editingCell = this.getState('editingCell');
    const isEditing = editingCell?.row === rowIndex && editingCell?.field === column.field;
    const editable = this.getProp('editable', false) && column.editor;

    let content: string;
    if (isEditing) {
      content = this.renderCellEditor(value, column);
    } else if (column.renderer) {
      content = column.renderer(value, row, column);
    } else if (column.formatter) {
      content = column.formatter(value, row);
    } else {
      content = String(value ?? '');
    }

    return `
      <td class="nx-grid-cell ${column.align || 'left'} ${editable ? 'editable' : ''}"
          data-row="${rowIndex}"
          data-field="${String(column.field)}">
        ${content}
      </td>
    `;
  }

  private renderCellEditor(value: any, column: GridColumn<T>): string {
    switch (column.editor) {
      case 'text':
        return `<input type="text" class="nx-cell-editor" value="${value ?? ''}" />`;
      case 'number':
        return `<input type="number" class="nx-cell-editor" value="${value ?? ''}" />`;
      case 'date':
        return `<input type="date" class="nx-cell-editor" value="${value ?? ''}" />`;
      case 'checkbox':
        return `<input type="checkbox" class="nx-cell-editor" ${value ? 'checked' : ''} />`;
      case 'select':
        const options = column.editorConfig?.options || [];
        return `
          <select class="nx-cell-editor">
            ${options.map((opt: any) => `
              <option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>
                ${opt.text}
              </option>
            `).join('')}
          </select>
        `;
      default:
        return String(value ?? '');
    }
  }

  private renderFooter(): string {
    return `
      <div class="nx-grid-footer" part="footer">
        <div class="nx-grid-footer-left">
          <slot name="footer-left"></slot>
        </div>
        <div class="nx-grid-footer-right">
          <span class="nx-grid-record-count">
            ${this.filteredData.length} records
            ${this.filteredData.length < this.data.length ? 
              ` (filtered from ${this.data.length})` : ''}
          </span>
        </div>
      </div>
    `;
  }

  private renderEmptyState(): string {
    return `
      <div class="nx-grid-empty">
        <svg class="nx-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
        </svg>
        <p class="nx-empty-text">No data to display</p>
      </div>
    `;
  }

  private renderContextMenu(): string {
    return `
      <div class="nx-context-menu" part="context-menu">
        <div class="nx-menu-item" data-action="copy">Copy</div>
        <div class="nx-menu-item" data-action="copy-all">Copy All</div>
        <div class="nx-menu-divider"></div>
        <div class="nx-menu-item" data-action="export-csv">Export as CSV</div>
        <div class="nx-menu-item" data-action="export-json">Export as JSON</div>
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        --nx-grid-border: var(--color-border);
        --nx-grid-header-bg: var(--color-background);
        --nx-grid-row-hover: var(--color-surface);
        --nx-grid-row-selected: rgba(59, 130, 246, 0.1);
        --nx-grid-row-height: 40px;
        --nx-grid-header-height: 48px;
      }

      .nx-grid {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-surface);
        border: 1px solid var(--nx-grid-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }

      .nx-grid-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* Toolbar */
      .nx-grid-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--nx-grid-border);
        background: var(--nx-grid-header-bg);
      }

      .nx-grid-toolbar-left,
      .nx-grid-toolbar-right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .nx-grid-tool {
        padding: 0.5rem;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        border-radius: var(--radius-sm);
        transition: all 0.2s;
      }

      .nx-grid-tool:hover {
        background: var(--color-surface);
        color: var(--color-text);
      }

      /* Header */
      .nx-grid-header {
        background: var(--nx-grid-header-bg);
        border-bottom: 1px solid var(--nx-grid-border);
        overflow: hidden;
      }

      .nx-grid-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      .nx-grid-header-cell {
        padding: 0.75rem 1rem;
        text-align: left;
        font-weight: 600;
        color: var(--color-text);
        position: relative;
        user-select: none;
        height: var(--nx-grid-header-height);
      }

      .nx-grid-header-cell.sortable {
        cursor: pointer;
      }

      .nx-grid-header-cell.sortable:hover {
        background: var(--color-surface);
      }

      .nx-grid-header-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .nx-sort-icon {
        width: 1rem;
        height: 1rem;
        transition: transform 0.2s;
      }

      .nx-sort-icon.desc {
        transform: rotate(180deg);
      }

      .nx-filter-btn {
        padding: 0.25rem;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        border-radius: var(--radius-sm);
        opacity: 0;
        transition: all 0.2s;
      }

      .nx-grid-header-cell:hover .nx-filter-btn {
        opacity: 1;
      }

      .nx-filter-btn:hover {
        background: var(--color-surface);
        color: var(--color-primary);
      }

      .nx-column-resizer {
        position: absolute;
        top: 0;
        right: 0;
        width: 4px;
        height: 100%;
        cursor: col-resize;
        background: transparent;
      }

      .nx-column-resizer:hover,
      .nx-column-resizer.resizing {
        background: var(--color-primary);
      }

      /* Body */
      .nx-grid-body {
        flex: 1;
        overflow: auto;
        position: relative;
      }

      .nx-grid-body[data-virtual="true"] {
        overflow-y: scroll;
      }

      .nx-virtual-scroller {
        position: relative;
      }

      .nx-grid-row {
        transition: background-color 0.15s;
        height: var(--nx-grid-row-height);
      }

      .nx-grid-row.hoverable:hover {
        background: var(--nx-grid-row-hover);
      }

      .nx-grid-row.selected {
        background: var(--nx-grid-row-selected);
      }

      .nx-grid-row.striped {
        background: rgba(0, 0, 0, 0.02);
      }

      .nx-grid-cell {
        padding: 0.5rem 1rem;
        border-bottom: 1px solid var(--nx-grid-border);
        height: var(--nx-grid-row-height);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .nx-grid-cell.center {
        text-align: center;
      }

      .nx-grid-cell.right {
        text-align: right;
      }

      .nx-grid-cell.editable {
        cursor: pointer;
      }

      .nx-grid-cell.editable:hover {
        background: var(--color-background);
      }

      .nx-grid-checkbox-cell {
        width: 40px;
        text-align: center;
        padding: 0.5rem;
      }

      .nx-grid-checkbox {
        cursor: pointer;
      }

      /* Cell Editor */
      .nx-cell-editor {
        width: 100%;
        padding: 0.25rem 0.5rem;
        border: 2px solid var(--color-primary);
        border-radius: var(--radius-sm);
        outline: none;
        background: var(--color-surface);
        color: var(--color-text);
      }

      /* Footer */
      .nx-grid-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        border-top: 1px solid var(--nx-grid-border);
        background: var(--nx-grid-header-bg);
        font-size: 0.875rem;
        color: var(--color-text-secondary);
      }

      /* Empty State */
      .nx-grid-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3rem;
        color: var(--color-text-secondary);
      }

      .nx-empty-icon {
        width: 3rem;
        height: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }

      .nx-empty-text {
        margin: 0;
      }

      /* Context Menu */
      .nx-context-menu {
        position: fixed;
        background: var(--color-surface);
        border: 1px solid var(--nx-grid-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        padding: 0.5rem 0;
        min-width: 150px;
        display: none;
        z-index: 1000;
      }

      .nx-context-menu.show {
        display: block;
      }

      .nx-menu-item {
        padding: 0.5rem 1rem;
        cursor: pointer;
        transition: background-color 0.15s;
      }

      .nx-menu-item:hover {
        background: var(--color-background);
      }

      .nx-menu-divider {
        height: 1px;
        background: var(--nx-grid-border);
        margin: 0.5rem 0;
      }

      /* Icons */
      .nx-icon {
        width: 1.25rem;
        height: 1.25rem;
      }

      /* Scrollbar */
      .nx-grid-body::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      .nx-grid-body::-webkit-scrollbar-track {
        background: var(--color-background);
      }

      .nx-grid-body::-webkit-scrollbar-thumb {
        background: var(--color-border);
        border-radius: 4px;
      }

      .nx-grid-body::-webkit-scrollbar-thumb:hover {
        background: var(--color-text-secondary);
      }
    `;
  }

  protected afterRender(): void {
    this.setupHeaderEvents();
    this.setupBodyEvents();
    this.setupVirtualScroll();
    this.setupColumnResize();
    this.setupContextMenu();
  }

  private setupHeaderEvents(): void {
    // Sorting
    this.$$('.nx-grid-header-cell.sortable').forEach(cell => {
      cell.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.nx-filter-btn')) return;
        
        const field = (cell as HTMLElement).dataset.field;
        const currentSort = this.getState('sortField');
        const currentDirection = this.getState('sortDirection', 'asc');
        
        if (currentSort === field) {
          this.setState('sortDirection', currentDirection === 'asc' ? 'desc' : 'asc');
        } else {
          this.setState('sortField', field);
          this.setState('sortDirection', 'asc');
        }
        
        this.applyFiltersAndSort();
      });
    });

    // Select all checkbox
    const selectAll = this.$('.nx-grid-checkbox-all') as HTMLInputElement;
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        const selectedRows = new Set<number>();
        if (selectAll.checked) {
          this.filteredData.forEach((_, index) => selectedRows.add(index));
        }
        this.setState('selectedRows', selectedRows);
      });
    }
  }

  private setupBodyEvents(): void {
    // Row selection
    const selectable = this.getProp('selectable');
    if (selectable) {
      this.$$('.nx-grid-row').forEach(row => {
        row.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('nx-grid-checkbox')) return;
          
          const rowIndex = parseInt((row as HTMLElement).dataset.rowIndex!);
          this.handleRowSelection(rowIndex, e.ctrlKey || e.metaKey);
        });
      });
    }

    // Checkbox selection
    this.$$('.nx-grid-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const index = parseInt((checkbox as HTMLElement).dataset.index!);
        const selectedRows = new Set(this.getState('selectedRows', new Set<number>()));
        
        if ((e.target as HTMLInputElement).checked) {
          selectedRows.add(index);
        } else {
          selectedRows.delete(index);
        }
        
        this.setState('selectedRows', selectedRows);
      });
    });

    // Cell editing
    if (this.getProp('editable')) {
      this.$$('.nx-grid-cell.editable').forEach(cell => {
        cell.addEventListener('dblclick', () => {
          const row = parseInt((cell as HTMLElement).dataset.row!);
          const field = (cell as HTMLElement).dataset.field!;
          this.startCellEdit(row, field);
        });
      });
    }
  }

  private setupVirtualScroll(): void {
    if (!this.getProp('virtual-scroll')) return;

    const body = this.$('.nx-grid-body');
    if (!body) return;

    const rowHeight = this.getProp('row-height', 40);
    const viewportHeight = body.clientHeight;
    const totalRows = this.filteredData.length;
    const visibleRows = Math.ceil(viewportHeight / rowHeight) + 1;

    this.virtualScrollState = {
      scrollTop: 0,
      visibleStart: 0,
      visibleEnd: Math.min(visibleRows, totalRows),
      totalHeight: totalRows * rowHeight
    };

    body.addEventListener('scroll', () => {
      const scrollTop = body.scrollTop;
      const visibleStart = Math.floor(scrollTop / rowHeight);
      const visibleEnd = Math.min(visibleStart + visibleRows, totalRows);

      if (visibleStart !== this.virtualScrollState.visibleStart) {
        this.virtualScrollState = {
          ...this.virtualScrollState,
          scrollTop,
          visibleStart,
          visibleEnd
        };
        this.updateVirtualRows();
      }
    });
  }

  private setupColumnResize(): void {
    this.$$('.nx-column-resizer').forEach(resizer => {
      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const index = parseInt((resizer as HTMLElement).dataset.index!);
        this.startColumnResize(e as MouseEvent, index);
      });
    });
  }

  private setupContextMenu(): void {
    const menu = this.$('.nx-context-menu');
    if (!menu) return;

    this.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      
      if (target.closest('.nx-grid-cell')) {
        menu.classList.add('show');
        (menu as HTMLElement).style.left = `${e.clientX}px`;
        (menu as HTMLElement).style.top = `${e.clientY}px`;
      }
    });

    document.addEventListener('click', () => {
      menu.classList.remove('show');
    });

    menu.addEventListener('click', (e) => {
      const action = (e.target as HTMLElement).dataset.action;
      if (action) {
        this.handleContextMenuAction(action);
        menu.classList.remove('show');
      }
    });
  }

  private handleRowSelection(rowIndex: number, multiSelect: boolean): void {
    const selectedRows = new Set(this.getState('selectedRows', new Set<number>()));
    const selectable = this.getProp('selectable');

    if (selectable === 'single' || !multiSelect) {
      selectedRows.clear();
    }

    if (selectedRows.has(rowIndex)) {
      selectedRows.delete(rowIndex);
    } else {
      selectedRows.add(rowIndex);
    }

    this.setState('selectedRows', selectedRows);
    this.dispatchEvent(new CustomEvent('selectionchange', {
      detail: {
        selected: Array.from(selectedRows).map(i => this.filteredData[i]),
        indices: Array.from(selectedRows)
      }
    }));
  }

  private startCellEdit(row: number, field: string): void {
    this.setState('editingCell', { row, field });
    this.update();

    requestAnimationFrame(() => {
      const editor = this.$('.nx-cell-editor') as HTMLInputElement;
      if (editor) {
        editor.focus();
        editor.select();

        const finishEdit = (save: boolean) => {
          if (save) {
            const column = this.columns.find(col => col.field === field);
            if (column) {
              const value = column.editor === 'checkbox' 
                ? editor.checked 
                : editor.value;
              
              this.setCellValue(this.filteredData[row], field, value);
              this.dispatchEvent(new CustomEvent('celledit', {
                detail: { row, field, value, data: this.filteredData[row] }
              }));
            }
          }
          this.setState('editingCell', null);
        };

        editor.addEventListener('blur', () => finishEdit(true));
        editor.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') finishEdit(true);
          if (e.key === 'Escape') finishEdit(false);
        });
      }
    });
  }

  private startColumnResize(e: MouseEvent, columnIndex: number): void {
    const startX = e.clientX;
    const headerCell = this.$$('.nx-grid-header-cell')[columnIndex] as HTMLElement;
    const startWidth = headerCell.offsetWidth;

    const doResize = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + diff);
      headerCell.style.width = `${newWidth}px`;
      
      // Update all cells in this column
      this.$$(`[data-field="${headerCell.dataset.field}"]`).forEach(cell => {
        (cell as HTMLElement).style.width = `${newWidth}px`;
      });
    };

    const stopResize = () => {
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
      
      const column = this.columns[columnIndex];
      if (column) {
        column.width = headerCell.offsetWidth;
        this.dispatchEvent(new CustomEvent('columnresize', {
          detail: { column, width: column.width }
        }));
      }
    };

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
  }

  private handleContextMenuAction(action: string): void {
    switch (action) {
      case 'copy':
        // Copy selected cells
        break;
      case 'copy-all':
        // Copy all data
        break;
      case 'export-csv':
        this.exportData('csv');
        break;
      case 'export-json':
        this.exportData('json');
        break;
    }
  }

  private getCellValue(row: T, field: keyof T | string): any {
    if (typeof field === 'string' && field.includes('.')) {
      return field.split('.').reduce((obj, key) => obj?.[key], row as any);
    }
    return row[field as keyof T];
  }

  private setCellValue(row: T, field: string, value: any): void {
    if (field.includes('.')) {
      const keys = field.split('.');
      const lastKey = keys.pop()!;
      const target = keys.reduce((obj, key) => obj[key], row as any);
      target[lastKey] = value;
    } else {
      (row as any)[field] = value;
    }
  }

  private applyFiltersAndSort(): void {
    let result = [...this.data];

    // Apply filters
    const filters = this.getState('filters', new Map<string, any>());
    filters.forEach((filterValue, field) => {
      result = result.filter(row => {
        const value = this.getCellValue(row, field);
        // Implement filter logic based on filter type
        return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      });
    });

    // Apply sorting
    const sortField = this.getState('sortField');
    const sortDirection = this.getState('sortDirection', 'asc');
    
    if (sortField) {
      result.sort((a, b) => {
        const aVal = this.getCellValue(a, sortField);
        const bVal = this.getCellValue(b, sortField);
        const modifier = sortDirection === 'asc' ? 1 : -1;
        
        if (aVal < bVal) return -1 * modifier;
        if (aVal > bVal) return 1 * modifier;
        return 0;
      });
    }

    this.filteredData = result;
    this.update();
  }

  private updateVirtualRows(): void {
    const tbody = this.$('tbody');
    if (!tbody) return;

    const { visibleStart, visibleEnd } = this.virtualScrollState;
    const rowHeight = this.getProp('row-height', 40);

    tbody.innerHTML = this.filteredData
      .slice(visibleStart, visibleEnd)
      .map((row, index) => this.renderRow(row, visibleStart + index))
      .join('');

    (tbody.parentElement as HTMLElement).style.transform = 
      `translateY(${visibleStart * rowHeight}px)`;

    this.setupBodyEvents();
  }

  private exportData(format: 'csv' | 'json'): void {
    const selectedRows = this.getState('selectedRows', new Set<number>());
    const dataToExport = selectedRows.size > 0
      ? Array.from(selectedRows).map(i => this.filteredData[i])
      : this.filteredData;

    let content: string;
    let mimeType: string;
    let filename: string;

    if (format === 'csv') {
      const headers = this.columns
        .filter(col => !col.hidden)
        .map(col => col.header);
      
      const rows = dataToExport.map(row =>
        this.columns
          .filter(col => !col.hidden)
          .map(col => this.getCellValue(row, col.field))
          .map(val => `"${String(val ?? '').replace(/"/g, '""')}"`)
          .join(',')
      );

      content = [headers.join(','), ...rows].join('\n');
      mimeType = 'text/csv';
      filename = 'data.csv';
    } else {
      content = JSON.stringify(dataToExport, null, 2);
      mimeType = 'application/json';
      filename = 'data.json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    this.dispatchEvent(new CustomEvent('export', {
      detail: { format, data: dataToExport }
    }));
  }

  // Public API
  getSelectedRows(): T[] {
    const selectedRows = this.getState('selectedRows', new Set<number>());
    return Array.from(selectedRows).map(i => this.filteredData[i]);
  }

  clearSelection(): void {
    this.setState('selectedRows', new Set<number>());
  }

  selectAll(): void {
    const selectedRows = new Set<number>();
    this.filteredData.forEach((_, index) => selectedRows.add(index));
    this.setState('selectedRows', selectedRows);
  }

  refresh(): void {
    this.applyFiltersAndSort();
    this.dispatchEvent(new CustomEvent('refresh'));
  }

  setFilter(field: string, value: any): void {
    const filters = new Map(this.getState('filters', new Map<string, any>()));
    if (value === null || value === undefined || value === '') {
      filters.delete(field);
    } else {
      filters.set(field, value);
    }
    this.setState('filters', filters);
    this.applyFiltersAndSort();
  }

  clearFilters(): void {
    this.setState('filters', new Map());
    this.applyFiltersAndSort();
  }

  sort(field: keyof T | string, direction?: 'asc' | 'desc'): void {
    this.setState('sortField', field);
    this.setState('sortDirection', direction || 'asc');
    this.applyFiltersAndSort();
  }
}

customElements.define('nx-grid', NXGrid);
