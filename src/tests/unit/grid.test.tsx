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
});
