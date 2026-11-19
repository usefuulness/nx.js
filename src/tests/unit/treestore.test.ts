import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TreeStore, TreeNode } from '@/data/treestore';

const data = () => [
  { id: 'a', name: 'Apple', children: [{ id: 'a1', name: 'Fuji' }, { id: 'a2', name: 'Gala', children: [{ id: 'a2x', name: 'Royal Gala' }] }] },
  { id: 'b', name: 'Banana' },
  { id: 'c', name: 'Cherry', children: [{ id: 'c1', name: 'Bing' }] }
];
const names = (s: TreeStore) => s.getVisible().map(n => n.data.name);

describe('TreeStore: structure', () => {
  it('builds nodes with parents, depth, path and leaf', () => {
    const s = new TreeStore({ root: data() });
    const n = s.getNodeById('a2x')!;
    expect(n.depth).toBe(2);
    expect(n.path).toEqual(['a', 'a2', 'a2x']);
    expect(n.parent!.id).toBe('a2');
    expect(n.leaf).toBe(true);
    expect(s.getNodeById('a')!.leaf).toBe(false);
    expect(s.getNodeById('b')!.leaf).toBe(true);
    expect(s.getCount()).toBe(7);
    expect(s.getNodeById('nope')).toBeNull();
    expect(s.getNodeById(undefined as any)).toBeNull();
  });

  it('gives nodes without an id one, and refuses a duplicate id', () => {
    const s = new TreeStore({ root: [{ name: 'x' }, { name: 'y' }] });
    const ids = s.getRoot().children.map(c => c.id);
    expect(new Set(ids).size).toBe(2);
    expect(() => new TreeStore({ root: [{ id: 1 }, { id: 1 }] })).toThrow(/already has a node/);
  });

  it('uses another children property and id property', () => {
    const s = new TreeStore({ childrenProperty: 'items', idProperty: 'key', root: [{ key: 'k', items: [{ key: 'j' }] }] });
    expect(s.getNodeById('j')!.parent!.id).toBe('k');
  });

  it('survives bad data', () => {
    expect(() => new TreeStore({ root: null as any })).not.toThrow();
    const s = new TreeStore();
    s.loadData(undefined as any);
    expect(s.getCount()).toBe(0);
    expect(names(s)).toEqual([]);
  });

  it('walks in order, finds, and writes plain nested data back', () => {
    const s = new TreeStore({ root: data() });
    const seen: string[] = [];
    s.eachNode(n => { seen.push(String(n.id)); });
    expect(seen).toEqual(['a', 'a1', 'a2', 'a2x', 'b', 'c', 'c1']);
    const stop: string[] = [];
    s.eachNode(n => { stop.push(String(n.id)); if (n.id === 'a2') return false; });
    expect(stop).toEqual(['a', 'a1', 'a2']);
    expect(s.findNodes(n => n.data.name.includes('Gala')).map(n => n.id)).toEqual(['a2', 'a2x']);
    const round = new TreeStore({ root: s.toData() });
    expect(round.getCount()).toBe(7);
    expect(round.getNodeById('a2x')!.path).toEqual(['a', 'a2', 'a2x']);
  });
});

describe('TreeStore: opening', () => {
  it('shows top level only until opened, and follows open nodes', async () => {
    const s = new TreeStore({ root: data() });
    expect(names(s)).toEqual(['Apple', 'Banana', 'Cherry']);
    const seen: string[] = [];
    s.on('expand', (e: any) => seen.push(e.node.id));
    await s.expand('a');
    expect(names(s)).toEqual(['Apple', 'Fuji', 'Gala', 'Banana', 'Cherry']);
    await s.expand('a2');
    expect(names(s)).toContain('Royal Gala');
    s.collapse('a');
    expect(names(s)).toEqual(['Apple', 'Banana', 'Cherry']);
    await s.toggle('c'); await s.toggle('c');
    expect(seen).toEqual(['a', 'a2', 'c']);
  });

  it('expands everything, deeply, and collapses everything; starts open on request', async () => {
    const s = new TreeStore({ root: data() });
    await s.expandAll();
    expect(s.getVisible().length).toBe(7);
    s.collapseAll();
    expect(s.getVisible().length).toBe(3);
    expect(new TreeStore({ root: data(), expandAll: true }).getVisible().length).toBe(7);
    expect(names(new TreeStore({ root: [{ id: 1, name: 'x', expanded: true, children: [{ id: 2, name: 'y' }] }] }))).toEqual(['x', 'y']);
  });

  it('opening a leaf, an unknown node or the root does nothing; reveal opens the way', async () => {
    const s = new TreeStore({ root: data() });
    await s.expand('b'); await s.expand('zzz'); await s.expand(s.getRoot());
    expect(names(s).length).toBe(3);
    await s.reveal('a2x');
    expect(names(s)).toContain('Royal Gala');
    expect(s.getNodeById('a')!.expanded).toBe(true);
    expect(s.getNodeById('a2x')!.expanded).toBe(false);
  });
});

describe('TreeStore: changing', () => {
  it('appends under a parent or the root, at a position; a leaf becomes a parent', async () => {
    const s = new TreeStore({ root: data() });
    const added: string[] = [];
    s.on('add', (e: any) => added.push(e.node.id));
    s.appendChild({ id: 'b1', name: 'Plantain' }, 'b');
    expect(s.getNodeById('b')!.leaf).toBe(false);
    s.appendChild({ id: 'z', name: 'Zucchini' });
    s.appendChild({ id: 'first', name: 'First' }, null, 0);
    await s.expand('b');
    expect(names(s)).toEqual(['First', 'Apple', 'Banana', 'Plantain', 'Cherry', 'Zucchini']);
    expect(added).toEqual(['b1', 'z', 'first']);
  });

  it('removes a node with everything under it', () => {
    const s = new TreeStore({ root: data() });
    expect(s.removeNode('a')).toBe(true);
    expect(s.getNodeById('a2x')).toBeNull();
    expect(s.getCount()).toBe(3);
    expect(s.removeNode('a')).toBe(false);
    expect(s.removeNode(s.getRoot())).toBe(false);
  });

  it('moves a node, but never into itself or below itself', async () => {
    const s = new TreeStore({ root: data() });
    const moves: string[] = [];
    s.on('move', (e: any) => moves.push(`${e.node.id}:${e.from.id}>${e.to.id}`));
    expect(s.moveNode('a1', 'c')).toBe(true);
    expect(s.getNodeById('a1')!.path).toEqual(['c', 'a1']);
    expect(s.moveNode('a', 'a2x')).toBe(false); // into its own descendant
    expect(s.moveNode('a', 'a')).toBe(false);
    expect(s.moveNode('c1', null, 0)).toBe(true);
    expect(s.getRoot().children[0].id).toBe('c1');
    expect(s.moveNode('zzz', 'a')).toBe(false);
    expect(moves).toEqual(['a1:a>c', 'c1:c>root']);
    expect(s.getCount()).toBe(7);
  });

  it('updates fields but not the id or the children', () => {
    const s = new TreeStore({ root: data() });
    s.update('a', { name: 'Apples', id: 'hack', children: [] });
    expect(s.getNodeById('a')!.data.name).toBe('Apples');
    expect(s.getNodeById('a')!.data.id).toBe('a');
    expect(s.getNodeById('a')!.children.length).toBe(2);
    expect(() => s.update('nope', { x: 1 })).not.toThrow();
  });
});

describe('TreeStore: sorting and filtering', () => {
  it('sorts every level, and keeps new nodes in order', () => {
    const s = new TreeStore({ root: data(), sorters: [{ property: 'name', direction: 'DESC' }] });
    expect(s.getRoot().children.map(n => n.data.name)).toEqual(['Cherry', 'Banana', 'Apple']);
    expect(s.getNodeById('a')!.children.map(n => n.data.name)).toEqual(['Gala', 'Fuji']);
    s.appendChild({ id: 'd', name: 'Date' });
    expect(s.getRoot().children.map(n => n.data.name)).toEqual(['Date', 'Cherry', 'Banana', 'Apple']);
    s.sort({ property: 'name' });
    expect(s.getRoot().children.map(n => n.data.name)).toEqual(['Apple', 'Banana', 'Cherry', 'Date']);
  });

  it('a filter keeps matches and the way down to them, opening what it must, without changing what is open', () => {
    const s = new TreeStore({ root: data() });
    s.filter({ property: 'name', operator: 'like', value: 'royal' });
    expect(names(s)).toEqual(['Apple', 'Gala', 'Royal Gala']);
    expect(s.getNodeById('a')!.expanded).toBe(false); // the filter did not open anything for good
    s.clearFilter();
    expect(names(s)).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('can keep the children of matches, take a function, and "*"', async () => {
    const s = new TreeStore({ root: data() });
    s.filter({ property: 'name', value: 'Apple' }, { keepChildren: true });
    await s.expandAll();
    expect(names(s)).toEqual(['Apple', 'Fuji', 'Gala', 'Royal Gala']);
    s.filter(n => n.data.name === 'Bing');
    expect(names(s)).toEqual(['Cherry', 'Bing']);
    s.filter({ property: '*', operator: 'like', value: 'ban' });
    expect(names(s)).toEqual(['Banana']);
  });

  it('a filter that matches nothing shows nothing, and a new matching node appears', () => {
    const s = new TreeStore({ root: data() });
    s.filter({ property: 'name', value: 'Nothing' });
    expect(names(s)).toEqual([]);
    s.filter({ property: 'name', value: 'Kiwi' });
    s.appendChild({ id: 'k', name: 'Kiwi' });
    expect(names(s)).toEqual(['Kiwi']);
  });
});

describe('TreeStore: children loaded when first opened', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const node = new URL(url).searchParams.get('node');
      const body = node === 'bad' ? null : node === 'folder' ? [{ id: 'f1', name: 'File 1', leaf: true }, { id: 'sub', name: 'Sub', leaf: false }] : [{ id: 'sub1', name: 'Inner', leaf: true }];
      return { ok: node !== 'bad', status: node === 'bad' ? 500 : 200, statusText: '', text: async () => JSON.stringify(body ?? { message: 'Down' }) } as Response;
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });
  const make = () => new TreeStore({ root: [{ id: 'folder', name: 'Folder', leaf: false }, { id: 'bad', name: 'Bad', leaf: false }, { id: 'file', name: 'File', leaf: true }], proxy: { type: 'rest', url: '/api/tree' } });

  it('loads a node\'s children on the first open, once', async () => {
    const s = make();
    const loads: string[] = [];
    s.on('load', (e: any) => e.node && loads.push(e.node.id));
    expect(s.getNodeById('folder')!.leaf).toBe(false);
    expect(s.getNodeById('file')!.leaf).toBe(true);
    await s.expand('folder');
    expect(names(s)).toEqual(['Folder', 'File 1', 'Sub', 'Bad', 'File']);
    await s.collapse('folder'); await s.expand('folder');
    expect(loads).toEqual(['folder']);
    expect((fetch as any).mock.calls.length).toBe(1);
    await s.expand('sub');
    expect(names(s)).toContain('Inner');
  });

  it('reports a failed load and stays closed and retryable', async () => {
    const s = make();
    const errors: string[] = [];
    s.on('exception', (e: any) => errors.push(e.operation));
    await expect(s.expand('bad')).rejects.toThrow('Down');
    expect(errors).toEqual(['load']);
    expect(s.getNodeById('bad')!.expanded).toBe(false);
    expect(s.getNodeById('bad')!.loading).toBe(false);
    expect(s.getNodeById('bad')!.loaded).toBe(false);
  });

  it('a node with no proxy and no children is simply a leaf', () => {
    expect(new TreeStore({ root: [{ id: 1, name: 'x' }] }).getNodeById(1)!.leaf).toBe(true);
  });
});

describe('TreeStore: items for <nx-tree>', () => {
  it('gives nested items with labels, open state and the node data', async () => {
    const s = new TreeStore({ root: data() });
    await s.expand('a');
    const items = s.toItems({ text: 'name' });
    expect(items.map(i => i.text)).toEqual(['Apple', 'Banana', 'Cherry']);
    expect(items[0].expanded).toBe(true);
    expect(items[0].children!.map(c => c.text)).toEqual(['Fuji', 'Gala']);
    expect(items[1].children).toBeUndefined();
    expect(items[0].data.id).toBe('a');
  });

  it('follows the filter, opening the way to matches, and can build labels and icons from the node', () => {
    const s = new TreeStore({ root: data() });
    s.filter({ property: 'name', operator: 'like', value: 'royal' });
    const items = s.toItems({ text: n => n.data.name.toUpperCase(), icon: () => 'folder' });
    expect(items.map(i => i.text)).toEqual(['APPLE']);
    expect(items[0].expanded).toBe(true);
    expect(items[0].children![0].children![0].text).toBe('ROYAL GALA');
    expect(items[0].icon).toBe('folder');
  });

  it('falls back to name, then id, for a label', () => {
    const s = new TreeStore({ root: [{ id: 7 }] });
    expect(s.toItems()[0].text).toBe('7');
  });
});
