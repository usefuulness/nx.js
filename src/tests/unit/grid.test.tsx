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
});
