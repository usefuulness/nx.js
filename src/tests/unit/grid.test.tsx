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

  describe('export and clipboard', () => {
    const data = () => [
      { name: 'Ada', note: '=SUM(A1)', n: 5, joined: '2024-03-05', ok: true },
      { name: 'Bob, "B"', note: '-cmd', n: -3, joined: '2024-12-31T13:45:30Z', ok: false },
      { name: 'Eve\tT', note: 'plain\nline', n: 7, joined: 'not a date', ok: null }
    ];
    const cols = [
      { field: 'name', header: 'Name' },
      { field: 'note', header: 'Note' },
      { field: 'n', header: 'N', type: 'number' as const },
      { field: 'joined', header: 'Joined', type: 'date' as const },
      { field: 'ok', header: 'OK', type: 'boolean' as const }
    ];

    it('CSV quotes fields, uses CRLF, and turns formula-looking text into text', () => {
      const grid = mount({ data: data(), columns: cols });
      const lines = grid.toCSV().split('\r\n');
      expect(lines[0]).toBe('"Name","Note","N","Joined","OK"');
      expect(lines[1]).toBe(`"Ada","'=SUM(A1)","5","2024-03-05","true"`);
      // The text "-cmd" is guarded; the number -3 is not
      expect(lines[2]).toContain(`"Bob, ""B""","'-cmd","-3"`);
    });

    it('exports what search and sort show, across pages', () => {
      const grid = mount({ data: data(), columns: cols, pageSize: 1 });
      grid.sort('n', 'desc');
      const lines = grid.toCSV().split('\r\n');
      expect(lines).toHaveLength(4); // header plus all three rows, not just the page
      expect(lines[1].startsWith('"Eve')).toBe(true);
      grid.setFilter('ada');
      expect(grid.toCSV().split('\r\n')).toHaveLength(2);
    });

    it('TSV quotes tabs, newlines and quotes, and can take a subset of rows', () => {
      const d = data();
      const grid = mount({ data: d, columns: cols });
      expect(grid.toTSV([d[2]])).toBe('Name\tNote\tN\tJoined\tOK\n"Eve\tT"\t"plain\nline"\t7\tnot a date\t');
    });

    it('XLSX keeps types: numbers, dates and booleans are not text', async () => {
      const grid = mount({ data: data(), columns: cols, title: 'People' });
      const bytes = await grid.toXLSX();
      expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // "PK"
      const text = new TextDecoder().decode(bytes);
      expect(text).toContain('name="People"');
      expect(text).toMatch(/<c r="C2"><v>5<\/v><\/c>/); // number
      expect(text).toMatch(/<c r="D2" s="2"><v>45356<\/v><\/c>/); // date
      expect(text).toMatch(/<c r="E2" t="b"><v>1<\/v><\/c>/); // boolean
      expect(text).toMatch(/<c r="D4" t="inlineStr"><is><t xml:space="preserve">not a date/); // unparseable stays text
      expect(text).not.toContain('<f>');
    });

    it('downloads CSV with a byte-order mark and XLSX as a workbook', async () => {
      const grid = mount({ data: data(), columns: cols });
      const blobs: Blob[] = [];
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toMatch(/\.(csv|xlsx)$/);
      });
      Object.assign(URL, { createObjectURL: (blob: Blob) => (blobs.push(blob), 'blob:x'), revokeObjectURL: vi.fn() });
      grid.exportCSV('people.csv');
      await grid.exportXLSX('people.xlsx');
      expect(click).toHaveBeenCalledTimes(2);
      expect(blobs[0].type).toContain('text/csv');
      const bytes = await new Promise<Uint8Array>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.readAsArrayBuffer(blobs[0]);
      });
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
      expect(blobs[1].type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      click.mockRestore();
    });

    const copyEvent = (target: Element) => {
      const clip: Record<string, string> = {};
      const event = Object.assign(new Event('copy', { bubbles: true, cancelable: true, composed: true }), {
        clipboardData: { setData: (type: string, value: string) => (clip[type] = value) }
      });
      target.dispatchEvent(event);
      return { event, clip };
    };

    it('copies the selected rows as TSV and an HTML table', () => {
      const d = data();
      const grid = mount({ data: d, columns: cols, checkboxSelection: true });
      grid.select([d[0], d[1]]);
      const { event, clip } = copyEvent(grid.shadowRoot!.querySelector('tbody td')!);
      expect(event.defaultPrevented).toBe(true);
      expect(clip['text/plain'].split('\n')[0]).toBe('Name\tNote\tN\tJoined\tOK');
      expect(clip['text/plain']).toContain("Ada\t'=SUM(A1)\t5");
      expect(clip['text/html']).toContain('<th>Name</th>');
      expect(clip['text/html']).toContain('<td>&#39;=SUM(A1)</td>'); // escaped, and still the guarded text
    });

    it('copies the focused cell, and leaves copy alone inside inputs and with nothing selected', () => {
      const d = data();
      const grid = mount({ data: d, columns: [{ field: 'name', editable: true }, cols[1]], search: true });
      const cell = grid.shadowRoot!.querySelector('tbody td') as HTMLElement;
      cell.focus();
      expect(copyEvent(cell).clip['text/plain']).toBe('Ada');
      // A cell that merely got a mouse selection, without keyboard focus, copies as the browser would
      (grid.shadowRoot!.querySelectorAll('tbody td')[1] as HTMLElement).focus();
      expect(copyEvent(cell).event.defaultPrevented).toBe(false);
      expect(copyEvent(grid.shadowRoot!.querySelector('.nx-grid-search input')!).event.defaultPrevented).toBe(false);
      const plain = mount({ data: d, columns: cols });
      expect(copyEvent(plain.shadowRoot!.querySelector('tbody td')!).event.defaultPrevented).toBe(false);
    });
  });

  describe('grouping and summaries', () => {
    const sales = () => [
      { id: 1, rep: 'Ada', region: 'West', amount: 100, units: 2 },
      { id: 2, rep: 'Bob', region: 'East', amount: 250, units: 5 },
      { id: 3, rep: 'Cy', region: 'West', amount: 50, units: 1 },
      { id: 4, rep: 'Di', region: 'North', amount: 400, units: 8 },
      { id: 5, rep: 'Ed', region: 'East', amount: 50, units: 3 }
    ];
    const cols = (extra: Record<string, any> = {}) => [
      { field: 'rep', header: 'Rep' },
      { field: 'region', header: 'Region' },
      { field: 'amount', header: 'Amount', type: 'currency' as const, summary: 'sum' as const },
      { field: 'units', header: 'Units', type: 'number' as const, summary: 'avg' as const, ...extra }
    ];
    const rowsOf = (grid: NXGrid) =>
      Array.from(grid.shadowRoot!.querySelectorAll('tbody tr')).map(tr =>
        tr.classList.contains('group-row') ? `# ${tr.querySelector('.group-label')!.textContent}`
          : tr.classList.contains('summary-row') ? `= ${Array.from(tr.querySelectorAll('td')).map(td => td.textContent!.trim()).join('|')}`
          : tr.querySelector('td')!.textContent!.trim()
      );
    const footer = (grid: NXGrid) =>
      Array.from(grid.shadowRoot!.querySelectorAll('tfoot td')).map(td => td.textContent!.trim());

    it('groups rows under headers ordered by the group value, with counts and aria-expanded', () => {
      const grid = mount({ data: sales(), columns: cols(), groupBy: 'region' });
      expect(rowsOf(grid).filter(r => r.startsWith('#'))).toEqual(['# East', '# North', '# West']);
      expect(rowsOf(grid).filter(r => !r.startsWith('#') && !r.startsWith('='))).toEqual(['Bob', 'Ed', 'Di', 'Ada', 'Cy']);
      const east = grid.shadowRoot!.querySelector('.group-toggle') as HTMLElement;
      expect(east.getAttribute('aria-expanded')).toBe('true');
      expect(east.querySelector('.group-count')!.textContent).toBe('2 rows');
      expect(grid.shadowRoot!.querySelectorAll('.group-toggle')[1].querySelector('.group-count')!.textContent).toBe('1 row');
    });

    it('follows the sort direction when sorting by the group field', () => {
      const grid = mount({ data: sales(), columns: cols(), groupBy: 'region' });
      grid.sort('region', 'desc');
      expect(rowsOf(grid).filter(r => r.startsWith('#'))).toEqual(['# West', '# North', '# East']);
    });

    it('totals each group and the whole grid, formatted like the column', () => {
      const grid = mount({ data: sales(), columns: cols(), groupBy: 'region' });
      const subtotals = rowsOf(grid).filter(r => r.startsWith('='));
      expect(subtotals).toEqual(['= Subtotal||$300.00|4', '= Subtotal||$400.00|8', '= Subtotal||$150.00|1.5']);
      expect(footer(grid)).toEqual(['Total', '', '$850.00', '3.8']);
    });

    it('totals only the rows search leaves, and an empty total shows a dash', () => {
      const grid = mount({ data: sales(), columns: cols({ summary: 'max' }), groupBy: 'region' });
      grid.setFilter('west');
      expect(footer(grid)).toEqual(['Total', '', '$150.00', '2']);
      const none = mount({ data: [{ rep: 'X', amount: null, units: 'n/a' }], columns: cols() });
      expect(footer(none)).toEqual(['Total', '', '—', '—']);
    });

    it('supports count, min and custom functions', () => {
      const grid = mount({
        data: sales(),
        columns: [
          { field: 'rep', header: 'Rep', summary: 'count' as const },
          { field: 'amount', header: 'Amount', type: 'currency' as const, summary: 'min' as const },
          { field: 'units', header: 'Units', summary: (values: number[]) => `${values.filter(v => v > 2).length} big` }
        ]
      });
      expect(footer(grid)).toEqual(['5', '$50.00', '3 big']);
      expect(rowsOf(grid).some(r => r.startsWith('#'))).toBe(false); // no groupBy: no headers, but a footer
    });

    it('collapses a group on click, keeps keyboard focus on its button, and emits group-toggle', () => {
      const grid = mount({ data: sales(), columns: cols(), groupBy: 'region' });
      const toggled = vi.fn();
      grid.addEventListener('group-toggle', toggled);
      (grid.shadowRoot!.querySelector('.group-toggle') as HTMLElement).click();
      expect(rowsOf(grid).slice(0, 3)).toEqual(['# East', '# North', 'Di']);
      expect((toggled.mock.calls[0][0] as CustomEvent).detail).toEqual({ key: 'East', collapsed: true });
      const button = grid.shadowRoot!.querySelector('.group-toggle') as HTMLElement;
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(grid.shadowRoot!.activeElement).toBe(button);
      button.click();
      expect(rowsOf(grid)[1]).toBe('Bob');
      expect(footer(grid)[2]).toBe('$850.00'); // the footer totals every row, collapsed or not
    });

    it('starts collapsed with group-collapsed; expandAll and collapseAll work; setGroupBy(null) ungroups', async () => {
      const grid = mount({ data: sales(), columns: cols(), groupBy: 'region', groupCollapsed: true });
      expect(rowsOf(grid)).toEqual(['# East', '# North', '# West']);
      grid.expandAll();
      expect(rowsOf(grid)).toHaveLength(3 + 5 + 3);
      grid.collapseAll();
      expect(rowsOf(grid)).toEqual(['# East', '# North', '# West']);
      grid.setGroupBy(null);
      await nextFrame();
      expect(rowsOf(grid).filter(r => r.startsWith('#'))).toEqual([]);
      expect(rowsOf(grid)).toHaveLength(5);
    });

    it('is keyboard-navigable across headers: arrows skip them, End/Home reach the first and last rows', () => {
      const grid = mount({
        data: sales(), groupBy: 'region',
        columns: [{ field: 'rep', header: 'Rep', editable: true }, { field: 'region', header: 'Region' }]
      });
      const td = (pos: number, col = 0) => grid.shadowRoot!.querySelector(`td[data-pos="${pos}"][data-col="${col}"]`) as HTMLElement;
      const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
        el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, ...init }));
      // Items: 0 East header, 1 Bob, 2 Ed, 3 North header, 4 Di, 5 West header, 6 Ada, 7 Cy
      td(1).focus();
      key(td(1), 'ArrowDown');
      expect(grid.shadowRoot!.activeElement).toBe(td(2));
      key(td(2), 'ArrowDown'); // over the North header
      expect(grid.shadowRoot!.activeElement).toBe(td(4));
      key(td(4), 'ArrowUp');
      expect(grid.shadowRoot!.activeElement).toBe(td(2));
      key(td(2), 'Home', { ctrlKey: true });
      expect(grid.shadowRoot!.activeElement).toBe(td(1));
      key(td(1), 'End', { ctrlKey: true });
      expect(grid.shadowRoot!.activeElement).toBe(td(7, 1));
    });

    it('keeps group headers out of data-index, so clicks still map to the right row', () => {
      const data = sales();
      const grid = mount({ data, columns: cols(), groupBy: 'region' });
      const onClick = vi.fn();
      grid.addEventListener('row-click', onClick);
      (grid.shadowRoot!.querySelectorAll('tbody tr:not(.group-row):not(.summary-row)')[2].querySelector('td') as HTMLElement).click();
      expect((onClick.mock.calls[0][0] as CustomEvent).detail.row).toBe(data[3]); // Di, the third row shown
    });

    it('groups per page when paging, and counts group rows in a virtual grid', () => {
      const paged = mount({ data: sales(), columns: cols(), groupBy: 'region', pageSize: 3 });
      expect(rowsOf(paged).filter(r => r.startsWith('#'))).toEqual(['# East', '# West']); // page 1 is rows 1-3 in data order (Ada, Bob, Cy), grouped
      const virtual = mount({ data: sales(), columns: cols(), groupBy: 'region', virtual: true, rowHeight: 40 });
      expect(virtual.shadowRoot!.querySelector('table')!.getAttribute('aria-rowcount')).toBe(String(3 + 5 + 3 + 1));
      expect(virtual.shadowRoot!.querySelector('tr.group-row')!.getAttribute('aria-rowindex')).toBe('2');
    });
  });
});
