/**
 * @file @/data/treestore.ts
 * A tree of records: parents and children, expanded or not, with filtering that keeps the way
 * down to every match, sorting within each level, moving, and children loaded when first opened.
 */
import { EventEmitter } from '@/core/events/event-emitter';
import { compareBy, matchesFilter, type Filter, type Sorter } from '@/data/store';
import { createProxy, type ProxyConfig } from '@/data/proxy';

export interface TreeNodeData {
  id?: string | number;
  /** Children given inline */
  children?: TreeNodeData[];
  /** `true`: never has children. `false` with no `children`: children are loaded when it is first expanded. Left out: it is what it looks like (children given, or none). */
  leaf?: boolean;
  /** Start open */
  expanded?: boolean;
  [field: string]: any;
}

export interface TreeStoreConfig {
  /** The top-level nodes (or one tree with `children`: then its children are the top level) */
  root?: TreeNodeData[];
  /** Where each node's children are (default `children`) */
  childrenProperty?: string;
  idProperty?: string;
  /** Open every node that has children */
  expandAll?: boolean;
  sorters?: Sorter[];
  /** Loads children of a node with `leaf: false`: `GET url?node=<id>` answers a list of nodes */
  proxy?: ProxyConfig;
}

export class TreeNode {
  id: string | number;
  data: Record<string, any>;
  parent: TreeNode | null = null;
  children: TreeNode[] = [];
  expanded = false;
  /** Children have been loaded (or were given) */
  loaded: boolean;
  loading = false;
  private leafFlag: boolean | undefined;

  constructor(id: string | number, data: Record<string, any>, leaf: boolean | undefined, loaded: boolean) {
    this.id = id;
    this.data = data;
    this.leafFlag = leaf;
    this.loaded = loaded;
  }

  /** Whether it can never have children */
  get leaf(): boolean {
    return this.leafFlag ?? (this.children.length === 0 && this.loaded);
  }

  /** How many levels down from the top (top-level nodes are 0) */
  get depth(): number {
    let d = 0;
    for (let n = this.parent; n && n.parent; n = n.parent) d++;
    return d;
  }

  /** The ids from the top down to this node */
  get path(): Array<string | number> {
    const ids: Array<string | number> = [];
    for (let n: TreeNode | null = this; n && n.parent; n = n.parent) ids.unshift(n.id);
    return ids;
  }

  isAncestorOf(node: TreeNode): boolean {
    for (let n = node.parent; n; n = n.parent) if (n === this) return true;
    return false;
  }
}

let seq = 0;

/** What `toItems()` gives `<nx-tree>` */
export interface TreeItem { id: string | number; text: string; icon?: string; expanded?: boolean; lazy?: boolean; children?: TreeItem[]; data: Record<string, any> }

export class TreeStore extends EventEmitter {
  private root = new TreeNode('root', {}, false, true);
  private byId = new Map<string | number, TreeNode>();
  private config: TreeStoreConfig;
  private sorters: Sorter[];
  private filters: Filter[] = [];
  private filterFn: ((node: TreeNode) => boolean) | null = null;
  private matched: Set<TreeNode> | null = null;
  private proxy: ReturnType<typeof createProxy> | null;

  constructor(config: TreeStoreConfig = {}) {
    super();
    this.config = config;
    this.sorters = [...(config.sorters ?? [])];
    this.proxy = config.proxy ? createProxy(config.proxy) : null;
    if (config.root) this.loadData(config.root);
  }

  private get childrenKey(): string { return this.config.childrenProperty || 'children'; }
  private get idKey(): string { return this.config.idProperty || 'id'; }

  private make(raw: TreeNodeData, parent: TreeNode): TreeNode {
    const { [this.childrenKey]: kids, leaf, expanded, ...fields } = raw as Record<string, any>;
    const given = fields[this.idKey];
    const id = given === undefined || given === null || given === '' ? `node-${++seq}` : given;
    if (this.byId.has(id)) throw new Error(`The tree already has a node with id ${String(id)}`);
    fields[this.idKey] = id;
    const hasKids = Array.isArray(kids);
    // Children are fetched later only for a node that says `leaf: false` and has none: anything else is complete as it is
    const node = new TreeNode(id, fields, leaf, hasKids || leaf !== false || !this.proxy);
    node.parent = parent;
    this.byId.set(id, node);
    if (hasKids) for (const k of kids as TreeNodeData[]) node.children.push(this.make(k, node));
    node.expanded = expanded === true || (this.config.expandAll === true && (node.children.length > 0 || node.leaf === false));
    return node;
  }

  /** Replace the whole tree */
  loadData(data: TreeNodeData[]): void {
    this.byId.clear();
    this.root = new TreeNode('root', {}, false, true);
    this.root.expanded = true;
    const top = Array.isArray(data) ? data : [];
    for (const raw of top) this.root.children.push(this.make(raw, this.root));
    this.sortLevel(this.root, true);
    this.refreshFilter();
    this.emit('load', { root: this.root });
    this.emit('datachanged', {});
  }

  // ────────── Finding ──────────

  getRoot(): TreeNode { return this.root; }
  getNodeById(id: string | number): TreeNode | null { return this.byId.get(id) ?? this.byId.get(String(id)) ?? this.byId.get(Number(id)) ?? null; }
  getCount(): number { return this.byId.size; }

  /** Visit every node, parents before children. Return `false` to stop. */
  eachNode(fn: (node: TreeNode) => boolean | void, from: TreeNode = this.root): void {
    const walk = (n: TreeNode): boolean => {
      for (const c of n.children) { if (fn(c) === false || !walk(c)) return false; }
      return true;
    };
    walk(from);
  }

  /** Nodes where `fn` is true, in tree order */
  findNodes(fn: (node: TreeNode) => boolean): TreeNode[] {
    const out: TreeNode[] = [];
    this.eachNode(n => { if (fn(n)) out.push(n); });
    return out;
  }

  /** The nodes to show now: every open node's children, below its parents, in order (filtered ones left out) */
  getVisible(): TreeNode[] {
    const out: TreeNode[] = [];
    const walk = (n: TreeNode) => {
      for (const c of n.children) {
        if (this.matched && !this.matched.has(c)) continue;
        out.push(c);
        // While a filter is on, a node with a match below it shows its children, so the match can be seen
        if (c.expanded || (this.matched && c.children.some(k => this.matched!.has(k)))) walk(c);
      }
    };
    walk(this.root);
    return out;
  }

  /** The tree as plain nested data (what `loadData` takes) */
  toData(): TreeNodeData[] {
    const plain = (n: TreeNode): TreeNodeData => {
      const out: TreeNodeData = { ...n.data };
      if (n.children.length) out[this.childrenKey] = n.children.map(plain);
      if (n.expanded) out.expanded = true;
      if (n.leaf && n.children.length === 0 && n.loaded && (n as any).leafFlag !== undefined) out.leaf = true;
      return out;
    };
    return this.root.children.map(plain);
  }

  /**
   * The tree as the items `<nx-tree>` takes (`tree.data = store.toItems()`): what the filter lets through, with
   * each node's open state. `text` is the field (or a function) that gives a node its label.
   */
  toItems(options: { text?: string | ((node: TreeNode) => string); icon?: string | ((node: TreeNode) => string | undefined) } = {}): TreeItem[] {
    const label = (n: TreeNode) => String(typeof options.text === 'function' ? options.text(n) : n.data[options.text ?? 'text'] ?? n.data.name ?? n.id);
    const walk = (nodes: TreeNode[]): TreeItem[] => nodes
      .filter(n => !this.matched || this.matched.has(n))
      .map(n => {
        const kids = walk(n.children);
        const icon = typeof options.icon === 'function' ? options.icon(n) : options.icon ? n.data[options.icon] : undefined;
        return { id: n.id, text: label(n), ...(icon ? { icon } : {}), ...(n.expanded || (this.matched && kids.length) ? { expanded: true } : {}), ...(kids.length ? { children: kids } : {}), ...(!n.loaded && !n.leaf && n.children.length === 0 ? { lazy: true } : {}), data: n.data };
      });
    return walk(this.root.children);
  }

  // ────────── Opening and closing ──────────

  /** Open a node. A node marked `leaf: false` with no children yet loads them first (through the proxy). */
  async expand(node: TreeNode | string | number, deep = false): Promise<void> {
    const n = this.resolve(node);
    if (!n || n === this.root || n.leaf) return;
    if (!n.loaded) await this.loadChildren(n);
    if (!n.expanded) { n.expanded = true; this.emit('expand', { node: n }); this.emit('datachanged', {}); }
    if (deep) for (const c of n.children) await this.expand(c, true);
  }

  collapse(node: TreeNode | string | number, deep = false): void {
    const n = this.resolve(node);
    if (!n || n === this.root) return;
    if (n.expanded) { n.expanded = false; this.emit('collapse', { node: n }); this.emit('datachanged', {}); }
    if (deep) n.children.forEach(c => this.collapse(c, true));
  }

  async toggle(node: TreeNode | string | number): Promise<void> {
    const n = this.resolve(node);
    if (n) await (n.expanded ? this.collapse(n) : this.expand(n));
  }

  async expandAll(): Promise<void> {
    for (const c of [...this.root.children]) await this.expand(c, true);
  }

  collapseAll(): void {
    this.root.children.forEach(c => this.collapse(c, true));
  }

  /** Make every ancestor of a node open, so it is visible */
  async reveal(node: TreeNode | string | number): Promise<void> {
    const n = this.resolve(node);
    if (!n) return;
    for (const id of n.path.slice(0, -1)) await this.expand(id);
  }

  private async loadChildren(node: TreeNode): Promise<void> {
    if (node.loaded || node.loading) return;
    if (!this.proxy) { node.loaded = true; return; }
    node.loading = true;
    this.emit('beforeload', { node });
    try {
      const answer = await this.proxy.read({ node: node.id });
      const root = this.config.proxy?.reader?.rootProperty;
      const list = Array.isArray(answer) ? answer : (root ? answer?.[root] : answer?.data ?? answer?.children) ?? [];
      for (const raw of Array.isArray(list) ? list : []) node.children.push(this.make(raw, node));
      node.loaded = true;
      this.sortLevel(node);
      this.refreshFilter();
      this.emit('load', { node });
    } catch (error) {
      this.emit('exception', { error, operation: 'load', node });
      throw error;
    } finally {
      node.loading = false;
    }
  }

  // ────────── Changing the tree ──────────

  private resolve(node: TreeNode | string | number | null | undefined): TreeNode | null {
    if (node === null || node === undefined) return null;
    return node instanceof TreeNode ? node : this.getNodeById(node);
  }

  /** Add a node at the end of a parent's children (or at `index`). The parent is the root when none is given. */
  appendChild(data: TreeNodeData, parent?: TreeNode | string | number | null, index?: number): TreeNode {
    const p = this.resolve(parent) ?? this.root;
    if (p.leaf && p !== this.root && p.children.length === 0) (p as any).leafFlag = false; // adding a child makes it a parent
    const node = this.make(data, p);
    const at = index === undefined ? p.children.length : Math.max(0, Math.min(index, p.children.length));
    p.children.splice(at, 0, node);
    if (this.sorters.length && index === undefined) this.sortLevel(p);
    this.refreshFilter();
    this.emit('add', { node, parent: p });
    this.emit('datachanged', {});
    return node;
  }

  /** Remove a node and everything under it */
  removeNode(node: TreeNode | string | number): boolean {
    const n = this.resolve(node);
    if (!n || n === this.root || !n.parent) return false;
    const parent = n.parent;
    parent.children.splice(parent.children.indexOf(n), 1);
    this.eachNode(x => { this.byId.delete(x.id); }, n);
    this.byId.delete(n.id);
    n.parent = null;
    this.refreshFilter();
    this.emit('remove', { node: n, parent });
    this.emit('datachanged', {});
    return true;
  }

  /** Move a node under another parent (or the root), at a position. A node cannot move into itself or its own descendants. */
  moveNode(node: TreeNode | string | number, parent?: TreeNode | string | number | null, index?: number): boolean {
    const n = this.resolve(node);
    const p = this.resolve(parent) ?? this.root;
    if (!n || n === this.root || !n.parent) return false;
    if (p === n || n.isAncestorOf(p)) return false;
    const from = n.parent;
    from.children.splice(from.children.indexOf(n), 1);
    n.parent = p;
    const at = index === undefined ? p.children.length : Math.max(0, Math.min(index, p.children.length));
    p.children.splice(at, 0, n);
    if (p !== this.root && p.leaf && p.children.length === 1) (p as any).leafFlag = false;
    this.refreshFilter();
    this.emit('move', { node: n, from, to: p });
    this.emit('datachanged', {});
    return true;
  }

  /** Change fields of a node */
  update(node: TreeNode | string | number, data: Record<string, any>): void {
    const n = this.resolve(node);
    if (!n) return;
    const { [this.idKey]: _ignored, [this.childrenKey]: _kids, ...fields } = data;
    Object.assign(n.data, fields);
    this.refreshFilter();
    this.emit('update', { node: n, data: fields });
    this.emit('datachanged', {});
  }

  // ────────── Sorting and filtering ──────────

  private sortLevel(parent: TreeNode, deep = false): void {
    if (this.sorters.length) {
      const cmp = compareBy(this.sorters);
      parent.children.sort((a, b) => cmp(a.data, b.data));
    }
    if (deep) parent.children.forEach(c => this.sortLevel(c, true));
  }

  /** Sort every level by these sorters (a sorter without a direction is ascending) */
  sort(sorters: Sorter | Sorter[]): void {
    this.sorters = Array.isArray(sorters) ? [...sorters] : [sorters];
    this.sortLevel(this.root, true);
    this.emit('sortchange', { sorters: this.sorters });
    this.emit('datachanged', {});
  }

  /**
   * Show only nodes that match, together with the nodes above them (so you can see where they are) and,
   * with `keepChildren`, the nodes below them. Filters like the store's, or a function. No argument clears it.
   */
  filter(filters?: Filter | Filter[] | ((node: TreeNode) => boolean), options: { keepChildren?: boolean } = {}): void {
    this.filters = [];
    this.filterFn = null;
    if (typeof filters === 'function') this.filterFn = filters;
    else if (filters) this.filters = Array.isArray(filters) ? [...filters] : [filters];
    this.keepChildren = !!options.keepChildren;
    this.refreshFilter();
    this.emit('filterchange', { filters: this.filters });
    this.emit('datachanged', {});
  }

  clearFilter(): void {
    this.filter();
  }

  private keepChildren = false;

  private nodeMatches(node: TreeNode): boolean {
    if (this.filterFn) return !!this.filterFn(node);
    return this.filters.every(f => {
      if (typeof f.filterFn === 'function') return !!f.filterFn(node);
      const test = (v: any) => matchesFilter(v, f);
      return f.property === '*' ? Object.values(node.data).some(test) : test(node.data[f.property]);
    });
  }

  private refreshFilter(): void {
    if (!this.filterFn && this.filters.length === 0) { this.matched = null; return; }
    const matched = new Set<TreeNode>();
    this.eachNode(n => {
      if (!this.nodeMatches(n)) return;
      matched.add(n);
      for (let a = n.parent; a && a !== this.root; a = a.parent) matched.add(a);
      if (this.keepChildren) this.eachNode(d => { matched.add(d); }, n);
    });
    this.matched = matched;
  }
}

export function createTreeStore(config: TreeStoreConfig = {}): TreeStore {
  return new TreeStore(config);
}
