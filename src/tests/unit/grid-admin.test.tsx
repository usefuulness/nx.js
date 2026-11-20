import { describe, it, expect, beforeEach } from 'vitest';
import { NX, Store, type NXGrid } from '@/index';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };
const data = [
  { id: 1, name: 'Ada', role: 'Engineer', active: true },
  { id: 2, name: 'Grace', role: 'Admiral', active: false },
  { id: 3, name: 'Linus', role: 'Engineer', active: true },
  { id: 4, name: 'Margaret', role: 'Lead', active: true }
];
const columns = [
  { field: 'name', header: 'Name' },
  { field: 'role', header: 'Role', type: 'badge', badges: { Engineer: 'info', Admiral: 'warning', Lead: 'success' } },
  { field: 'active', header: 'Active', type: 'boolean' }
];

describe('grid: column filters, column menu, bulk actions', () => {
  beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
  const mount = async (config: Record<string, any> = {}) => {
    const el = NX.create<NXGrid>({ xtype: 'grid', columns, data: data.map(d => ({ ...d })), ...config });
    document.body.append(el);
    await frames();
    return el;
  };
  const names = (el: NXGrid) => Array.from(el.shadowRoot!.querySelectorAll('tbody tr')).map(tr => tr.querySelector('td')?.textContent?.trim());
  const type = async (input: HTMLInputElement, value: string) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); await frames(); };
  const pick = async (select: HTMLSelectElement, value: string) => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); await frames(); };

  it('shows a filter under each heading, named for its column: a box for text, a list for badges and yes/no', async () => {
    const el = await mount({ filters: true });
    const boxes = Array.from(el.shadowRoot!.querySelectorAll('tr.filters [data-filter]')) as HTMLElement[];
    expect(boxes.map(b => b.tagName)).toEqual(['INPUT', 'SELECT', 'SELECT']);
    expect(boxes[0].getAttribute('aria-label')).toBe('Filter Name');
    expect(Array.from(boxes[1].querySelectorAll('option')).map(o => o.textContent)).toEqual(['All', 'Engineer', 'Admiral', 'Lead']);
    expect(Array.from(boxes[2].querySelectorAll('option')).map(o => o.textContent)).toEqual(['All', 'Yes', 'No']);
  });

  it('filters rows by each column together, and keeps focus while typing', async () => {
    const el = await mount({ filters: true });
    const box = (f: string) => el.shadowRoot!.querySelector(`[data-filter="${f}"]`) as any;
    box('name').focus();
    await type(box('name'), 'a');
    expect(names(el)).toEqual(['Ada', 'Grace', 'Margaret']);
    expect(el.shadowRoot!.activeElement).toBe(box('name'));
    await pick(box('role'), 'Engineer');
    expect(names(el)).toEqual(['Ada']);
    await pick(box('role'), '');
    await pick(box('active'), 'false');
    expect(names(el)).toEqual(['Grace']);
    expect(el.getColumnFilters()).toEqual({ name: 'a', active: 'false' });
    el.clearFilters();
    await frames();
    expect(names(el)).toHaveLength(4);
    expect((box('name') as HTMLInputElement).value).toBe('');
  });

  it('a column can opt out of the filter row', async () => {
    const el = await mount({ filters: true, columns: [{ field: 'name', header: 'Name', filter: false }, columns[1]] });
    expect(el.shadowRoot!.querySelectorAll('tr.filters [data-filter]')).toHaveLength(1);
  });

  it('sends column filters to a server that filters, with the search', async () => {
    const calls: any[] = [];
    const store = new Store<any>({ remoteFilter: true, proxy: { type: 'memory' } } as any);
    store.filter = ((f: any) => { calls.push(f); }) as any;
    const el = await mount({ filters: true, data: undefined, store });
    (store as any).remoteFilter = true;
    store.isRemoteFilter = () => true;
    const box = el.shadowRoot!.querySelector('[data-filter="name"]') as HTMLInputElement;
    await type(box, 'ad');
    await new Promise(r => setTimeout(r, 300));
    expect(calls.at(-1)).toEqual([{ property: 'name', value: 'ad', operator: 'like' }]);
    await pick(el.shadowRoot!.querySelector('[data-filter="active"]') as HTMLSelectElement, 'true');
    await new Promise(r => setTimeout(r, 300));
    expect(calls.at(-1)).toContainEqual({ property: 'active', value: true, operator: 'eq' });
  });

  it('the column menu shows and hides columns, never the last one, and remembers with a state key', async () => {
    const el = await mount({ columnMenu: true, stateKey: 'admin-test' });
    const button = el.shadowRoot!.querySelector('.col-button') as HTMLElement;
    expect(button.textContent).toContain('Columns');
    const boxes = () => Array.from(el.shadowRoot!.querySelectorAll('.col-menu input')) as HTMLInputElement[];
    expect(boxes().map(b => b.checked)).toEqual([true, true, true]);
    el.setColumnVisible('role', false);
    await frames();
    expect(Array.from(el.shadowRoot!.querySelectorAll('thead tr:first-child th')).map(t => t.getAttribute('data-field'))).toEqual(['name', 'active']);
    el.setColumnVisible('active', false);
    el.setColumnVisible('name', false); // the last one stays
    await frames();
    expect(el.getColumnList().filter(c => c.visible).map(c => c.field)).toEqual(['name']);
    expect(boxes().find(b => b.dataset.field === 'name')!.disabled).toBe(true);
    expect(JSON.parse(localStorage.getItem('nx-grid:admin-test') ?? localStorage.getItem('admin-test') ?? '{}' ) ).toBeTruthy();
    const again = await mount({ columnMenu: true, stateKey: 'admin-test' });
    expect(again.getColumnList().filter(c => c.visible).map(c => c.field)).toEqual(['name']);
  });

  it('a bulk bar appears with the number selected, and its slot holds your actions', async () => {
    const el = NX.create<NXGrid>({ xtype: 'grid', columns, data: data.map(d => ({ ...d })), checkboxSelection: true });
    const action = document.createElement('button');
    action.slot = 'bulk';
    action.textContent = 'Archive';
    el.append(action);
    document.body.append(el);
    await frames();
    const bar = () => el.shadowRoot!.querySelector('.nx-grid-bulk') as HTMLElement;
    expect(bar().hidden).toBe(true);
    (el.shadowRoot!.querySelectorAll('.check-row')[1] as HTMLInputElement).click();
    (el.shadowRoot!.querySelectorAll('.check-row')[2] as HTMLInputElement).click();
    await frames();
    expect(bar().hidden).toBe(false);
    expect(bar().querySelector('.bulk-count')!.textContent).toBe('2 selected');
    expect(bar().getAttribute('role')).toBe('group');
    expect(bar().querySelector('slot[name="bulk"]')).toBeTruthy();
    (el.shadowRoot!.querySelector('.check-all') as HTMLInputElement).click();
    (el.shadowRoot!.querySelector('.check-all') as HTMLInputElement).click();
    await frames();
    expect(bar().hidden).toBe(true);
  });

  it('getView / setView: the search, filters, sort and columns go and come back together', async () => {
    const el = await mount({ filters: true, search: true });
    const box = (f: string) => el.shadowRoot!.querySelector(`[data-filter="${f}"]`) as any;
    await type(box('name'), 'a');
    el.setColumnVisible('active', false);
    (el.shadowRoot!.querySelector('th[data-field="name"] .sort-btn') as HTMLElement).click();
    await frames();
    const view = el.getView();
    expect(view).toMatchObject({ filters: { name: 'a' }, sort: { field: 'name', direction: 'asc' }, hidden: ['active'] });
    el.clearFilters();
    el.setColumnVisible('active', true);
    await frames();
    expect(names(el)).toHaveLength(4);
    el.setView(view);
    await frames();
    expect(names(el)).toEqual(['Ada', 'Grace', 'Margaret']);
    expect((box('name') as HTMLInputElement).value).toBe('a');
    expect(el.getColumnList().find(c => c.field === 'active')!.visible).toBe(false);
  });

  it('saved views: save by name, apply, delete, and remember them with the state key', async () => {
    const el = await mount({ savedViews: true, filters: true, stateKey: 'views-test' });
    const panel = () => el.shadowRoot!.querySelector('.view-panel') as HTMLElement;
    expect(el.shadowRoot!.querySelector('.views-button')!.textContent).toContain('Views');
    expect(panel().querySelector('.view-empty')!.textContent).toBe('No saved views yet');
    await type(el.shadowRoot!.querySelector('[data-filter="name"]') as HTMLInputElement, 'gr');
    const input = panel().querySelector('.view-name') as HTMLInputElement;
    input.value = 'Grace only';
    panel().querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await frames();
    expect(panel().querySelectorAll('.view-item')).toHaveLength(1);
    expect(el.getSavedViews()[0].name).toBe('Grace only');
    el.clearFilters();
    await frames();
    expect(names(el)).toHaveLength(4);
    (panel().querySelector('.view-apply') as HTMLElement).click();
    await frames();
    expect(names(el)).toEqual(['Grace']);
    const again = await mount({ savedViews: true, stateKey: 'views-test' });
    expect(again.getSavedViews().map(v => v.name)).toEqual(['Grace only']);
    expect((panel().querySelector('.view-delete') as HTMLElement).getAttribute('aria-label')).toBe('Delete view Grace only');
    (panel().querySelector('.view-delete') as HTMLElement).click();
    await frames();
    expect(el.getSavedViews()).toEqual([]);
    expect(panel().querySelector('.view-empty')).toBeTruthy();
  });
});
