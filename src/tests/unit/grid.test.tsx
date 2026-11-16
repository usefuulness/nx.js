import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NX, Store, type NXGrid } from '@/index';
import { nextFrame } from '../utils';

const rows = [
  { name: 'Charlie', age: 30, role: 'Admin' },
  { name: 'alice', age: 25, role: 'User' },
  { name: 'Bob', age: 35, role: 'User' }
];

const columns = [
  { field: 'name', header: 'Name' },
  { field: 'age', header: 'Age', type: 'number' as const },
  { field: 'role', header: 'Role', type: 'badge' as const, badges: { Admin: 'info' as const } }
];

const mount = (config: Record<string, any>) => {
  const grid = NX.create<NXGrid>({ xtype: 'grid', columns, ...config });
  document.body.appendChild(grid);
  return grid;
};

const cellText = (grid: NXGrid) =>
  Array.from(grid.shadowRoot!.querySelectorAll('tbody tr')).map(tr => tr.querySelector('td')!.textContent!.trim());

describe('NXGrid', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders rows from data', () => {
    const grid = mount({ data: rows });
    expect(cellText(grid)).toEqual(['Charlie', 'alice', 'Bob']);
    expect(grid.shadowRoot!.querySelector('.badge.tone-info')!.textContent).toBe('Admin');
  });

  it('sorts case-insensitively and toggles direction', () => {
    const grid = mount({ data: rows });
    grid.sort('name');
    expect(cellText(grid)).toEqual(['alice', 'Bob', 'Charlie']);
    grid.sort('name');
    expect(cellText(grid)).toEqual(['Charlie', 'Bob', 'alice']);
    grid.sort('age', 'asc');
    expect(cellText(grid)).toEqual(['alice', 'Charlie', 'Bob']);
  });

  it('filters across columns', () => {
    const grid = mount({ data: rows });
    grid.setFilter('user');
    expect(cellText(grid)).toEqual(['alice', 'Bob']);
    grid.setFilter('zzz');
    expect(grid.shadowRoot!.textContent).toContain('No results');
  });

  it('pages', () => {
    const grid = mount({ data: rows, pageSize: 2 });
    expect(cellText(grid)).toHaveLength(2);
    grid.setPage(2);
    expect(cellText(grid)).toEqual(['Bob']);
  });

  it('selects rows and emits selection-change', () => {
    const onSelectionChange = vi.fn();
    const grid = mount({ data: rows, selectable: 'multiple', onSelectionChange });
    (grid.shadowRoot!.querySelector('tbody tr') as HTMLElement).click();
    expect(grid.getSelected()).toEqual([rows[0]]);
    expect(onSelectionChange).toHaveBeenCalledOnce();
    grid.selectAll();
    expect(grid.getSelected()).toHaveLength(3);
  });

  it('binds to a named store and follows its changes', async () => {
    const store = NX.store('grid-test', { data: rows.slice(0, 2) });
    const grid = mount({ store: 'grid-test' });
    expect(cellText(grid)).toHaveLength(2);
    store.add(rows[2]);
    await nextFrame();
    expect(cellText(grid)).toHaveLength(3);
    expect(Store.lookup('grid-test')).toBe(store);
  });

  it('escapes cell values', () => {
    const grid = mount({ data: [{ name: '<img src=x onerror=alert(1)>', age: 1, role: 'x' }] });
    expect(grid.shadowRoot!.querySelector('tbody img')).toBeNull();
  });
});

describe('NXGrid JSX renderers', () => {
  it('renders JSX from renderer, and clicks on cell buttons do not select the row', () => {
    const onDelete = vi.fn();
    const onRowClick = vi.fn();
    const grid = NX.create<NXGrid>({
      xtype: 'grid',
      selectable: true,
      data: rows,
      onRowClick,
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'name', header: '', renderer: (_v: any, row: any) => <button class="del" onClick={() => onDelete(row.name)}>Delete</button> }
      ]
    });
    document.body.appendChild(grid);
    (grid.shadowRoot!.querySelector('button.del') as HTMLElement).click();
    expect(onDelete).toHaveBeenCalledWith('Charlie');
    expect(grid.getSelected()).toEqual([]);
    expect(onRowClick).not.toHaveBeenCalled();

    (grid.shadowRoot!.querySelector('tbody td') as HTMLElement).click();
    expect(grid.getSelected()).toEqual([rows[0]]);
    expect(onRowClick).toHaveBeenCalledOnce();
  });

  it('still supports HTML string renderers', () => {
    const grid = NX.create<NXGrid>({ xtype: 'grid', data: rows, columns: [{ field: 'name', renderer: (v: any) => `<em>${v}</em>` }] });
    document.body.appendChild(grid);
    expect(grid.shadowRoot!.querySelector('tbody em')!.textContent).toBe('Charlie');
  });

  it('keeps the search input across refreshes', () => {
    const grid = NX.create<NXGrid>({ xtype: 'grid', data: rows, search: true, columns });
    document.body.appendChild(grid);
    const input = grid.shadowRoot!.querySelector('.nx-grid-search input') as HTMLInputElement;
    input.value = 'bob';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(grid.shadowRoot!.querySelector('.nx-grid-search input')).toBe(input);
    expect(cellText(grid)).toEqual(['Bob']);
  });

  it('sorts from a header button, so the keyboard can sort too', async () => {
    const grid = mount({ data: rows });
    await nextFrame();
    const header = () => grid.shadowRoot!.querySelector('th[data-field="age"]')!;
    const button = header().querySelector('button.sort-btn') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toContain('Age');
    button.click(); // Enter / Space on a <button> fire click
    await nextFrame();
    expect(header().getAttribute('aria-sort')).toBe('ascending');
  });

  describe('virtual', () => {
    const many = Array.from({ length: 50000 }, (_, i) => ({ name: `Row ${i}`, age: i, role: 'User' }));
    const bodyRows = (grid: NXGrid) => grid.shadowRoot!.querySelectorAll('tbody tr:not(.spacer)');

    it('renders only a window of rows, with spacers for the rest', () => {
      const grid = mount({ data: many, virtual: true, rowHeight: 40 });
      const rendered = bodyRows(grid).length;
      expect(rendered).toBeGreaterThan(0);
      expect(rendered).toBeLessThan(60);
      const spacer = grid.shadowRoot!.querySelector('tr.spacer td') as HTMLElement | null;
      const bottom = grid.shadowRoot!.querySelectorAll('tr.spacer td');
      expect(spacer).toBeTruthy();
      // Spacers plus rendered rows add up to the full scroll height
      const heights = Array.from(bottom).reduce((n, td) => n + parseFloat((td as HTMLElement).style.height), 0);
      expect(heights + rendered * 40).toBe(50000 * 40);
    });

    it('moves the window on scroll', async () => {
      const grid = mount({ data: many, virtual: true, rowHeight: 40 });
      const body = grid.shadowRoot!.querySelector('.nx-grid-body') as HTMLElement;
      body.scrollTop = 40 * 20000;
      body.dispatchEvent(new Event('scroll'));
      await nextFrame();
      await nextFrame();
      const names = Array.from(bodyRows(grid)).map(tr => tr.querySelector('td')!.textContent);
      expect(names).toContain('Row 20000');
      expect(names).not.toContain('Row 0');
    });

    it('reports the full row count to assistive tech and maps clicks to the right row', async () => {
      const grid = mount({ data: many, virtual: true, rowHeight: 40 });
      expect(grid.shadowRoot!.querySelector('table')!.getAttribute('aria-rowcount')).toBe('50001');
      const onClick = vi.fn();
      grid.addEventListener('row-click', onClick);
      (bodyRows(grid)[2].querySelector('td') as HTMLElement).click();
      expect((onClick.mock.calls[0][0] as CustomEvent).detail.row.name).toBe('Row 2');
    });

    it('ignores paging and keeps sorting and search working', () => {
      const grid = mount({ data: many, virtual: true, pageSize: 10 });
      expect(grid.shadowRoot!.querySelector('.pager')).toBeNull();
      grid.setFilter('Row 4999');
      expect(grid.getVisibleRows()).toHaveLength(11);
      grid.sort('age', 'desc');
      expect(bodyRows(grid)[0].querySelector('td')!.textContent).toBe('Row 49999');
    });
  });

  describe('columns', () => {
    const headers = (grid: NXGrid) =>
      Array.from(grid.shadowRoot!.querySelectorAll('thead th')).map(th => th.getAttribute('data-field'));
    const key = (k: string, extra: Record<string, any> = {}) =>
      new KeyboardEvent('keydown', { key: k, bubbles: true, ...extra });

    beforeEach(() => localStorage.clear());

    it('resizes from the keyboard, respects minWidth, and double-click resets', () => {
      const grid = mount({ data: rows, resizable: true, columns: [{ field: 'name', header: 'Name', width: 100, minWidth: 90 }, columns[1]] });
      const handle = () => grid.shadowRoot!.querySelector('th[data-field="name"] .resize-handle') as HTMLElement;
      expect(handle().getAttribute('role')).toBe('separator');
      handle().dispatchEvent(key('ArrowRight', { shiftKey: true }));
      expect((grid.shadowRoot!.querySelector('col') as HTMLElement).style.width).toBe('150px');
      handle().dispatchEvent(key('ArrowLeft', { shiftKey: true }));
      handle().dispatchEvent(key('ArrowLeft', { shiftKey: true }));
      expect(grid.getColumnState().widths.name).toBe(90);
      handle().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(grid.getColumnState().widths.name).toBeUndefined();
    });

    it('has no resize handles unless resizable', () => {
      const grid = mount({ data: rows });
      expect(grid.shadowRoot!.querySelector('.resize-handle')).toBeNull();
    });

    it('moves columns with Alt+Arrow and emits column-change', () => {
      const grid = mount({ data: rows, reorderable: true });
      const changed = vi.fn();
      grid.addEventListener('column-change', changed);
      expect(headers(grid)).toEqual(['name', 'age', 'role']);
      grid.shadowRoot!.querySelector('th[data-field="name"] button')!.dispatchEvent(key('ArrowRight', { altKey: true }));
      expect(headers(grid)).toEqual(['age', 'name', 'role']);
      expect(cellText(grid)).toEqual(['30', '25', '35']);
      expect((changed.mock.calls[0][0] as CustomEvent).detail.order).toEqual(['age', 'name', 'role']);
    });

    it('keeps pinned columns first, with a sticky offset after the checkbox column', () => {
      const grid = mount({
        data: rows, checkboxSelection: true,
        columns: [columns[0], { field: 'age', header: 'Age', width: 80, pinned: 'left' }, columns[2]]
      });
      expect(headers(grid)).toEqual([null, 'age', 'name', 'role']);
      const th = grid.shadowRoot!.querySelector('th[data-field="age"]') as HTMLElement;
      expect(th.classList.contains('pinned')).toBe(true);
      expect(th.style.left).toBe('48px');
    });

    it('persists widths and order under state-key', () => {
      const first = mount({ data: rows, resizable: true, reorderable: true, stateKey: 'users' });
      first.shadowRoot!.querySelector('th[data-field="role"] button')!.dispatchEvent(key('ArrowLeft', { altKey: true }));
      first.shadowRoot!.querySelector<HTMLElement>('th[data-field="name"] .resize-handle')!.dispatchEvent(key('ArrowRight'));
      document.body.innerHTML = '';
      const second = mount({ data: rows, resizable: true, reorderable: true, stateKey: 'users' });
      expect(headers(second)).toEqual(['name', 'role', 'age']);
      expect(second.getColumnState().widths.name).toBeGreaterThan(0);
      second.resetColumns();
      expect(headers(second)).toEqual(['name', 'age', 'role']);
    });
  });

  describe('editing', () => {
    const people = () => [
      { id: 1, name: 'Ada', age: 36, active: true, role: 'Admin', address: { city: 'London' } },
      { id: 2, name: 'Grace', age: 45, active: false, role: 'User', address: { city: 'NYC' } },
      { id: 3, name: 'Linus', age: 54, active: true, role: 'User', address: { city: 'Portland' } }
    ];
    const cols = [
      { field: 'name', header: 'Name', editable: true, validate: (v: string) => (v.trim() ? true : 'Name is required') },
      { field: 'age', header: 'Age', type: 'number' as const, editable: true },
      { field: 'role', header: 'Role', editable: true, editor: 'select' as const, options: ['Admin', 'User'] },
      { field: 'active', header: 'Active', type: 'boolean' as const, editable: true },
      { field: 'address.city', header: 'City', editable: (row: any) => row.id !== 2 },
      { field: 'id', header: 'Id' }
    ];
    const td = (grid: NXGrid, pos: number, col: number) =>
      grid.shadowRoot!.querySelector(`td[data-pos="${pos}"][data-col="${col}"]`) as HTMLElement;
    const keyOn = (el: Element, key: string, init: KeyboardEventInit = {}) =>
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, ...init }));
    const editor = (grid: NXGrid) => grid.shadowRoot!.querySelector('.cell-editor') as HTMLInputElement;

    it('is a grid with one cell in the tab order, and marks read-only cells', () => {
      const grid = mount({ data: people(), columns: cols });
      expect(grid.shadowRoot!.querySelector('table')!.getAttribute('role')).toBe('grid');
      expect(grid.shadowRoot!.querySelectorAll('td[tabindex="0"]')).toHaveLength(1);
      expect(td(grid, 0, 0).getAttribute('tabindex')).toBe('0');
      expect(td(grid, 0, 5).getAttribute('aria-readonly')).toBe('true');
      expect(td(grid, 1, 4).getAttribute('aria-readonly')).toBe('true');
      expect(td(grid, 0, 4).getAttribute('aria-readonly')).toBeNull();
    });

    it('stays a plain table when nothing is editable', () => {
      const grid = mount({ data: rows });
      expect(grid.shadowRoot!.querySelector('table')!.getAttribute('role')).toBeNull();
      expect(grid.shadowRoot!.querySelector('td[tabindex]')).toBeNull();
    });

    it('moves between cells with the arrow, Home, End and Ctrl+Home keys', () => {
      const grid = mount({ data: people(), columns: cols });
      td(grid, 0, 0).focus();
      keyOn(td(grid, 0, 0), 'ArrowDown');
      expect(grid.shadowRoot!.activeElement).toBe(td(grid, 1, 0));
      keyOn(td(grid, 1, 0), 'ArrowRight');
      expect(grid.shadowRoot!.activeElement).toBe(td(grid, 1, 1));
      expect(td(grid, 1, 1).getAttribute('tabindex')).toBe('0');
      expect(td(grid, 0, 0).getAttribute('tabindex')).toBe('-1');
      keyOn(td(grid, 1, 1), 'End');
      expect(grid.shadowRoot!.activeElement).toBe(td(grid, 1, 5));
      keyOn(td(grid, 1, 5), 'Home', { ctrlKey: true });
      expect(grid.shadowRoot!.activeElement).toBe(td(grid, 0, 0));
      keyOn(td(grid, 0, 0), 'ArrowUp');
      expect(grid.shadowRoot!.activeElement).toBe(td(grid, 0, 0));
    });

    it('edits with Enter, saves with Enter and emits cell-change', () => {
      const data = people();
      const grid = mount({ data, columns: cols });
      const changed = vi.fn();
      grid.addEventListener('cell-change', changed);
      td(grid, 0, 0).focus();
      keyOn(td(grid, 0, 0), 'Enter');
      expect(editor(grid).value).toBe('Ada');
      expect(grid.shadowRoot!.activeElement).toBe(editor(grid));
      editor(grid).value = 'Ada L.';
      editor(grid).dispatchEvent(new Event('input', { bubbles: true }));
      keyOn(editor(grid), 'Enter');
      expect(data[0].name).toBe('Ada L.');
      expect(cellText(grid)[0]).toBe('Ada L.');
      expect(editor(grid)).toBeNull();
      expect(grid.shadowRoot!.activeElement).toBe(td(grid, 1, 0));
      expect(changed).toHaveBeenCalledTimes(1);
      expect((changed.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ field: 'name', value: 'Ada L.', oldValue: 'Ada', index: 0 });
    });

    it('cancels with Escape and returns focus to the cell', () => {
      const data = people();
      const grid = mount({ data, columns: cols });
      keyOn(td(grid, 0, 0), 'F2');
      editor(grid).value = 'changed';
      editor(grid).dispatchEvent(new Event('input', { bubbles: true }));
      keyOn(editor(grid), 'Escape');
      expect(data[0].name).toBe('Ada');
      expect(grid.shadowRoot!.activeElement).toBe(td(grid, 0, 0));
    });

    it('rejects invalid values, keeps the editor open and announces the message', () => {
      const data = people();
      const grid = mount({ data, columns: cols });
      keyOn(td(grid, 0, 0), 'Enter');
      editor(grid).value = '  ';
      editor(grid).dispatchEvent(new Event('input', { bubbles: true }));
      keyOn(editor(grid), 'Enter');
      expect(data[0].name).toBe('Ada');
      expect(editor(grid).getAttribute('aria-invalid')).toBe('true');
      const error = grid.shadowRoot!.querySelector('[role="alert"]')!;
      expect(error.textContent).toBe('Name is required');
      expect(editor(grid).getAttribute('aria-describedby')).toBe(error.id);
    });

    it('parses numbers, refusing text, and Tab saves and moves right', () => {
      const data = people();
      const grid = mount({ data, columns: cols });
      keyOn(td(grid, 0, 1), 'Enter');
      expect(editor(grid).type).toBe('number');
      editor(grid).value = '37';
      editor(grid).dispatchEvent(new Event('input', { bubbles: true }));
      keyOn(editor(grid), 'Tab');
      expect(data[0].age).toBe(37);
      expect(typeof data[0].age).toBe('number');
      expect(grid.shadowRoot!.activeElement).toBe(td(grid, 0, 2));
    });

    it('edits selects, toggles booleans with Space, and writes nested paths', () => {
      const data = people();
      const grid = mount({ data, columns: cols });
      keyOn(td(grid, 1, 2), 'Enter');
      const select = grid.shadowRoot!.querySelector('select.cell-editor') as HTMLSelectElement;
      expect(Array.from(select.options).map(o => o.value)).toEqual(['Admin', 'User']);
      select.value = 'Admin';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      keyOn(select, 'Enter');
      expect(data[1].role).toBe('Admin');

      keyOn(td(grid, 0, 3), ' ');
      expect(data[0].active).toBe(false);

      keyOn(td(grid, 0, 4), 'Enter');
      editor(grid).value = 'Cambridge';
      editor(grid).dispatchEvent(new Event('input', { bubbles: true }));
      keyOn(editor(grid), 'Enter');
      expect(data[0].address.city).toBe('Cambridge');
    });

    it('does not edit read-only cells', () => {
      const grid = mount({ data: people(), columns: cols });
      keyOn(td(grid, 0, 5), 'Enter');
      keyOn(td(grid, 1, 4), 'Enter');
      expect(editor(grid)).toBeNull();
    });

    it('writes through a bound store, marking the record dirty', () => {
      const store = new Store({ data: people() });
      const grid = mount({ store, columns: cols });
      keyOn(td(grid, 1, 0), 'Enter');
      editor(grid).value = 'Grace H.';
      editor(grid).dispatchEvent(new Event('input', { bubbles: true }));
      keyOn(editor(grid), 'Enter');
      const record = store.getAt(1)!;
      expect(record.data.name).toBe('Grace H.');
      expect(record.dirty).toBe(true);
      expect(record.modified.name).toBe('Grace');

      keyOn(td(grid, 0, 4), 'Enter');
      editor(grid).value = 'Cambridge';
      editor(grid).dispatchEvent(new Event('input', { bubbles: true }));
      keyOn(editor(grid), 'Enter');
      expect(store.getAt(0)!.data.address.city).toBe('Cambridge');
      expect(store.getAt(0)!.dirty).toBe(true);
    });

    it('scrolls a virtual grid to reach a cell far outside the window', () => {
      const many = Array.from({ length: 5000 }, (_, i) => ({ name: `Row ${i}`, age: i }));
      const grid = mount({ data: many, virtual: true, rowHeight: 40, columns: [{ field: 'name', editable: true }, { field: 'age' }] });
      td(grid, 0, 0).focus();
      keyOn(td(grid, 0, 0), 'End', { ctrlKey: true });
      expect(td(grid, 4999, 1)).toBeTruthy();
      expect(grid.shadowRoot!.activeElement).toBe(td(grid, 4999, 1));
      keyOn(td(grid, 4999, 1), 'Home', { ctrlKey: true });
      expect(grid.shadowRoot!.activeElement).toBe(td(grid, 0, 0));
    });
  });
});
