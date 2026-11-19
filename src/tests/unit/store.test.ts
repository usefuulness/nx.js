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

  it('keeps an id of 0 and only generates ids for records that have none', () => {
    const store = new Store({ data: [{ id: 0, name: 'zero' }, { name: 'none' }, { id: 'abc', name: 'text' }] });
    expect(store.getAt(0)!.id).toBe(0);
    expect(store.getAt(0)!.data.id).toBe(0);
    expect(String(store.getAt(1)!.id)).toMatch(/^record-/);
    expect(store.getAt(2)!.id).toBe('abc');
  });
});

describe('Store: local filtering, sorting, aggregates and groups', () => {
  const rows = () => [
    { id: 1, name: 'Ada', country: 'UK', revenue: 30, active: true },
    { id: 2, name: 'Bob', country: 'US', revenue: 10, active: false },
    { id: 3, name: 'Cleo', country: 'UK', revenue: 20, active: true },
    { id: 4, name: 'Dan', country: 'US', revenue: null as any, active: true }
  ];
  const names = (s: Store) => s.getData().map((r: any) => r.name);

  it('filters locally with every operator, and clears', () => {
    const s = new Store({ data: rows() });
    s.filter({ property: 'country', value: 'UK' });
    expect(names(s)).toEqual(['Ada', 'Cleo']);
    expect(s.getCount()).toBe(2);
    s.filter({ property: 'revenue', operator: 'gt', value: 15 });
    expect(names(s)).toEqual(['Ada', 'Cleo']);
    s.filter({ property: 'revenue', operator: 'lte', value: 20 });
    expect(names(s)).toEqual(['Bob', 'Cleo']);
    s.filter({ property: 'name', operator: 'like', value: 'A' });
    expect(names(s)).toEqual(['Ada', 'Dan']);
    s.filter({ property: 'country', operator: 'in', value: ['US'] });
    expect(names(s)).toEqual(['Bob', 'Dan']);
    s.filter({ property: 'country', operator: 'ne', value: 'US' });
    expect(names(s)).toEqual(['Ada', 'Cleo']);
    s.filter({ property: 'x', filterFn: (r: any) => r.data.active });
    expect(names(s)).toEqual(['Ada', 'Cleo', 'Dan']);
    s.clearFilter();
    expect(s.getCount()).toBe(4);
  });

  it('combines filters, and "*" looks in every field (what the grid search sends)', () => {
    const s = new Store({ data: rows() });
    s.filter([{ property: 'country', value: 'UK' }, { property: 'active', value: true }]);
    expect(names(s)).toEqual(['Ada', 'Cleo']);
    s.filter({ property: '*', operator: 'like', value: 'us' });
    expect(names(s)).toEqual(['Bob', 'Dan']);
  });

  it('keeps filtered-out records in the store: they still count as changes and can be found', () => {
    const s = new Store({ data: rows() });
    s.filter({ property: 'country', value: 'UK' });
    expect(s.getById(2)).not.toBeNull();
    const hidden = s.getById(2)!;
    s.update(hidden, { revenue: 99 });
    expect(s.isDirty()).toBe(true);
    expect(s.getUpdatedRecords().map(r => r.id)).toEqual([2]);
    s.add({ id: 9, name: 'New', country: 'US', revenue: 1, active: true });
    expect(names(s)).toEqual(['Ada', 'Cleo']); // the new one is filtered out too
    expect(s.getNewRecords().length).toBe(1);
    s.clearFilter();
    expect(s.getCount()).toBe(5);
    s.rejectChanges();
    expect(s.getCount()).toBe(4);
    expect(s.getById(2)!.data.revenue).toBe(10);
  });

  it('removing a record works while filtered, and removeAll clears everything', () => {
    const s = new Store({ data: rows() });
    s.filter({ property: 'country', value: 'UK' });
    s.remove(s.getAt(0)!);
    s.clearFilter();
    expect(names(s)).toEqual(['Bob', 'Cleo', 'Dan']);
    s.filter({ property: 'country', value: 'US' });
    s.removeAll();
    s.clearFilter();
    expect(s.getCount()).toBe(0);
  });

  it('sorts ascending unless told otherwise, with empty values last in either direction', () => {
    const s = new Store({ data: rows() });
    s.sort({ property: 'revenue' } as any);
    expect(names(s)).toEqual(['Bob', 'Cleo', 'Ada', 'Dan']);
    s.sort({ property: 'revenue', direction: 'DESC' });
    expect(names(s)).toEqual(['Ada', 'Cleo', 'Bob', 'Dan']);
  });

  it('a sort and a filter work together, and the filter keeps the sort', () => {
    const s = new Store({ data: rows(), sorters: [{ property: 'revenue', direction: 'ASC' }] });
    s.filter({ property: 'country', value: 'UK' });
    expect(names(s)).toEqual(['Cleo', 'Ada']);
    s.add({ id: 7, name: 'Eve', country: 'UK', revenue: 5, active: true });
    expect(names(s)).toEqual(['Eve', 'Cleo', 'Ada']);
  });

  it('emits filterchange and sortchange', () => {
    const s = new Store({ data: rows() });
    const seen: string[] = [];
    s.on('filterchange', () => seen.push('filter'));
    s.on('sortchange', () => seen.push('sort'));
    s.filter({ property: 'country', value: 'UK' });
    s.sort({ property: 'name', direction: 'DESC' });
    expect(seen).toEqual(['filter', 'sort']);
    expect(s.getFilters().length).toBe(1);
    expect(s.getSorters()[0].property).toBe('name');
  });

  it('sums, averages and finds the extremes, skipping empty values', () => {
    const s = new Store({ data: rows() });
    expect(s.sum('revenue')).toBe(60);
    expect(s.average('revenue')).toBe(20);
    expect(s.min('revenue')).toBe(10);
    expect(s.max('revenue')).toBe(30);
    expect(s.min('nothing')).toBeUndefined();
    expect(s.average('nothing')).toBe(0);
    s.filter({ property: 'country', value: 'UK' });
    expect(s.sum('revenue')).toBe(50); // over what is shown
  });

  it('groups in order of first appearance, each with its own totals', () => {
    const s = new Store({ data: rows() });
    const groups = s.getGroups('country', 'revenue');
    expect(groups.map(g => [g.key, g.count, g.sum, g.average])).toEqual([['UK', 2, 50, 25], ['US', 2, 10, 10]]);
    expect(groups[1].max).toBe(10);
  });

  it('first, last, indexOf, insert and removeAt', () => {
    const s = new Store({ data: rows() });
    expect(s.first()!.id).toBe(1);
    expect(s.last()!.id).toBe(4);
    expect(s.indexOf(s.getById(3)!)).toBe(2);
    s.insert(1, { id: 10, name: 'Mid', country: 'UK', revenue: 1, active: true });
    expect(names(s)).toEqual(['Ada', 'Mid', 'Bob', 'Cleo', 'Dan']);
    s.insert(99, { id: 11, name: 'End', country: 'UK', revenue: 1, active: true });
    expect(s.last()!.data.name).toBe('End');
    s.removeAt(0);
    expect(s.first()!.data.name).toBe('Mid');
    s.removeAt(500); // nothing there: nothing happens
    expect(s.getCount()).toBe(5);
  });
});

describe('Store: grouping', () => {
  const rows = () => [
    { id: 1, name: 'Ada', team: 'b', pts: 3 }, { id: 2, name: 'Bob', team: 'a', pts: 5 },
    { id: 3, name: 'Cleo', team: 'b', pts: 1 }, { id: 4, name: 'Dan', team: 'a', pts: 2 }
  ];
  it('keeps groups together, sorted by the group first and then by the other sorters', () => {
    const s = new Store<any>({ data: rows(), groupField: 'team', sorters: [{ property: 'pts', direction: 'DESC' }] });
    s.sort();
    expect(s.getData().map((r: any) => r.name)).toEqual(['Bob', 'Dan', 'Ada', 'Cleo']);
    expect(s.getGroups(undefined, 'pts').map(g => [g.key, g.count, g.sum])).toEqual([['a', 2, 7], ['b', 2, 4]]);
  });

  it('group() changes it, with an event; no argument removes it', () => {
    const s = new Store<any>({ data: rows() });
    const seen: any[] = [];
    s.on('groupchange', (e: any) => seen.push(e.field));
    s.group('team', 'DESC');
    expect(s.getData().map((r: any) => r.team)).toEqual(['b', 'b', 'a', 'a']);
    expect(s.getGroupField()).toBe('team');
    s.group();
    expect(s.getGroupField()).toBeNull();
    expect(s.getGroups()).toEqual([]);
    expect(seen).toEqual(['team', null]);
  });

  it('works together with a filter', () => {
    const s = new Store<any>({ data: rows(), groupField: 'team' });
    s.filter({ property: 'pts', operator: 'gt', value: 1 });
    expect(s.getGroups().map(g => [g.key, g.count])).toEqual([['a', 2], ['b', 1]]);
  });
});

