import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Store } from '@/data/store';

describe('Store', () => {
  let store: Store<{ id: number; name: string }>;

  beforeEach(() => {
    store = new Store({
      data: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ]
    });
  });

  it('loads initial data', () => {
    expect(store.getCount()).toBe(2);
    expect(store.getAt(0)?.data.name).toBe('Item 1');
    expect(store.getData().map(d => d.id)).toEqual([1, 2]);
  });

  it('adds, updates and removes records', () => {
    const [record] = store.add({ id: 3, name: 'Item 3' });
    expect(store.getCount()).toBe(3);
    expect(record.phantom).toBe(true);

    const first = store.getAt(0)!;
    store.update(first, { name: 'Updated' });
    expect(first.data.name).toBe('Updated');
    expect(first.dirty).toBe(true);

    store.remove(first);
    expect(store.getCount()).toBe(2);
  });

  it('sorts', () => {
    store.sort({ property: 'name', direction: 'DESC' });
    expect(store.getAt(0)?.data.name).toBe('Item 2');
  });

  it('emits load and datachanged', () => {
    const load = vi.fn();
    const changed = vi.fn();
    store.on('load', load);
    store.on('datachanged', changed);
    store.loadData([{ id: 3, name: 'Item 3' }]);
    store.add({ id: 4, name: 'Item 4' });
    expect(load).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('registers and looks up named stores', () => {
    Store.register('things', store);
    expect(Store.lookup('things')).toBe(store);
    expect(Store.lookup(store)).toBe(store);
  });
});
