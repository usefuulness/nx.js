import { describe, it, expect, beforeEach } from 'vitest';
import { NX, Store, type NXList } from '@/index';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };
const rows = [{ id: 1, name: 'Ada', role: 'Engineer' }, { id: 2, name: 'Grace', role: 'Admiral' }, { id: 3, name: 'Linus', role: 'Maintainer' }];

describe('<nx-list>', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  const mount = async (config: Record<string, any> = {}) => {
    const el = NX.create<NXList>({ xtype: 'list', data: rows.map(r => ({ ...r })), ...config });
    document.body.append(el);
    await frames();
    return el;
  };
  const options = (el: NXList) => Array.from(el.shadowRoot!.querySelectorAll('[role="option"]')) as HTMLElement[];
  const names = (el: NXList) => options(el).map(o => o.querySelector('.text')!.textContent);
  const key = (target: HTMLElement, k: string, init: KeyboardEventInit = {}) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, composed: true, ...init }));

  it('is a listbox of options, with one stop in the tab order', async () => {
    const el = await mount({ label: 'People' });
    expect(el.shadowRoot!.querySelector('[role="listbox"]')!.getAttribute('aria-label')).toBe('People');
    expect(names(el)).toEqual(['Ada', 'Grace', 'Linus']);
    expect(options(el).map(o => o.tabIndex)).toEqual([0, -1, -1]);
    expect(options(el)[0].getAttribute('aria-selected')).toBe('false');
  });

  it('shows a description, a custom field and a template', async () => {
    const el = await mount({ field: 'name', descriptionField: 'role' });
    expect(options(el)[1].textContent).toContain('Admiral');
    el.setTemplate(item => `#${item.id} ${item.name}`);
    await frames();
    expect(options(el)[2].textContent).toContain('#3 Linus');
  });

  it('selects one item on click and moves the selection; reports it', async () => {
    const el = await mount();
    const seen: any[] = [];
    el.addEventListener('select', e => seen.push((e as CustomEvent).detail));
    options(el)[1].click();
    await frames();
    expect(options(el)[1].getAttribute('aria-selected')).toBe('true');
    options(el)[2].click();
    await frames();
    expect(options(el).map(o => o.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
    expect(seen.at(-1).selected).toEqual([expect.objectContaining({ name: 'Linus' })]);
    expect(el.getSelected().length).toBe(1);
  });

  it('multi-select: Ctrl toggles, Shift extends, Ctrl+A selects all', async () => {
    const el = await mount({ multiSelect: true });
    expect(el.shadowRoot!.querySelector('[role="listbox"]')!.getAttribute('aria-multiselectable')).toBe('true');
    options(el)[0].click();
    options(el)[2].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    await frames();
    expect(el.getSelected().map((r: any) => r.name)).toEqual(['Ada', 'Linus']);
    options(el)[0].click();
    options(el)[2].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    await frames();
    expect(el.getSelected().length).toBe(3);
    options(el)[1].click();
    await frames();
    key(options(el)[1], 'a', { ctrlKey: true });
    await frames();
    expect(el.getSelected().length).toBe(3);
  });

  it('arrow keys, Home, End and type-ahead move focus; Space selects', async () => {
    const el = await mount();
    options(el)[0].focus();
    key(options(el)[0], 'ArrowDown');
    expect(el.shadowRoot!.activeElement).toBe(options(el)[1]);
    key(options(el)[1], 'End');
    expect(el.shadowRoot!.activeElement).toBe(options(el)[2]);
    key(options(el)[2], 'Home');
    expect(el.shadowRoot!.activeElement).toBe(options(el)[0]);
    key(options(el)[0], 'l');
    expect(el.shadowRoot!.activeElement).toBe(options(el)[2]);
    key(options(el)[2], ' ');
    await frames();
    expect(options(el)[2].getAttribute('aria-selected')).toBe('true');
  });

  it('Alt+Arrow reorders, keeps focus on the moved item, announces it and emits reorder', async () => {
    const el = await mount({ reorderable: true });
    const seen: any[] = [];
    el.addEventListener('reorder', e => seen.push((e as CustomEvent).detail));
    options(el)[0].focus();
    key(options(el)[0], 'ArrowDown', { altKey: true });
    await frames();
    expect(names(el)).toEqual(['Grace', 'Ada', 'Linus']);
    expect((el.shadowRoot!.activeElement as HTMLElement).querySelector('.text')!.textContent).toBe('Ada');
    expect(seen[0]).toMatchObject({ from: 0, to: 1 });
    expect(el.shadowRoot!.querySelector('[role="status"]')!.textContent).toBe('Ada moved to position 2 of 3');
    // The ends do not wrap
    key(options(el)[2], 'ArrowDown', { altKey: true });
    await frames();
    expect(names(el)).toEqual(['Grace', 'Ada', 'Linus']);
  });

  it('does not reorder unless asked to', async () => {
    const el = await mount();
    options(el)[0].focus();
    key(options(el)[0], 'ArrowDown', { altKey: true });
    await frames();
    expect(names(el)).toEqual(['Ada', 'Grace', 'Linus']);
    expect(el.shadowRoot!.querySelector('.grip')).toBeNull();
  });

  it('follows a store, and reordering reorders the store', async () => {
    const store = new Store<any>({ data: rows.map(r => ({ ...r })) });
    store.loadData(rows.map(r => ({ ...r })));
    const el = await mount({ data: undefined, store, reorderable: true });
    expect(names(el)).toEqual(['Ada', 'Grace', 'Linus']);
    store.add({ id: 4, name: 'Margaret', role: 'Lead' });
    await frames();
    expect(names(el)).toHaveLength(4);
    options(el)[3].focus();
    key(options(el)[3], 'ArrowUp', { altKey: true });
    await frames();
    expect(store.getData().map((r: any) => r.name)).toEqual(['Ada', 'Grace', 'Margaret', 'Linus']);
    expect(names(el)).toEqual(['Ada', 'Grace', 'Margaret', 'Linus']);
  });

  it('a sorted store keeps its order: no grips, no moving', async () => {
    const store = new Store<any>({ data: rows.map(r => ({ ...r })) });
    store.loadData(rows.map(r => ({ ...r })));
    store.sort({ property: 'name', direction: 'DESC' });
    const el = await mount({ data: undefined, store, reorderable: true });
    expect(el.shadowRoot!.querySelector('.grip')).toBeNull();
    expect(el.moveItem(0, 1)).toBe(false);
    expect(store.move(0, 1)).toBe(false);
  });

  it('shows the empty text, and a store registered by name', async () => {
    const el = await mount({ data: [], emptyText: 'No people' });
    expect(el.shadowRoot!.querySelector('.empty')!.textContent).toBe('No people');
    const named = new Store<any>({ data: [] });
    named.loadData([{ id: 9, name: 'Zed' }]);
    Store.register('people', named);
    const html = document.createElement('nx-list') as NXList;
    html.setAttribute('store', 'people');
    document.body.append(html);
    await frames();
    expect(names(html)).toEqual(['Zed']);
  });
});

describe('Store.move', () => {
  it('moves a record to a place among the shown ones and says so', () => {
    const store = new Store<any>({ data: [] });
    store.loadData([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
    const moves: any[] = [];
    store.on('move', (e: any) => moves.push([e.from, e.to]));
    expect(store.move(0, 2)).toBe(true);
    expect(store.getData().map((r: any) => r.id)).toEqual([2, 3, 1, 4]);
    expect(store.move(3, 0)).toBe(true);
    expect(store.getData().map((r: any) => r.id)).toEqual([4, 2, 3, 1]);
    expect(store.move(1, 1)).toBe(false);
    expect(store.move(0, 9)).toBe(false);
    expect(moves).toEqual([[0, 2], [3, 0]]);
  });
});
