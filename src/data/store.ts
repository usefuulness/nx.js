import { EventEmitter } from '@/core/events/event-emitter';
import { createProxy, type Proxy, type ProxyConfig } from '@/data/proxy';
import type { ModelClass } from '@/data/model';

export type { ProxyConfig };

export interface StoreConfig<T = any> {
  data?: T[];
  /** A class from `defineModel()`: records are converted and checked by its fields and rules */
  model?: ModelClass<any>;
  /** The field that identifies a record (default: the model's, else `id`) */
  idProperty?: string;
  proxy?: ProxyConfig;
  autoLoad?: boolean;
  autoSync?: boolean;
  sorters?: Sorter[];
  filters?: Filter[];
  /** Keep records together by this field: they sort by it first, and `getGroups()` uses it */
  groupField?: string;
  pageSize?: number;
  remoteSort?: boolean;
  remoteFilter?: boolean;
  /**
   * Fetch rows in pages as they scroll into view instead of loading them all (for a `virtual`
   * grid over data too big to hold). Needs a `proxy` that answers `start` and `limit` and reports
   * the total; sorting and filtering always happen on the server. `pageSize` is the chunk size.
   */
  buffered?: boolean;
  /** Pages kept in memory for a `buffered` store; the least recently used go first (default 40) */
  maxBufferedPages?: number;
  headers?: Record<string, string>;
}

export interface Sorter {
  property: string;
  direction?: 'ASC' | 'DESC';
  transform?: (value: any) => any;
}

export interface Filter {
  property: string;
  value?: any;
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in';
  filterFn?: (record: any) => boolean;
}

export interface StoreRecord<T> {
  data: T;
  modified: Partial<T>;
  id: string | number;
  dirty: boolean;
  phantom: boolean;
  errors: Record<string, string[]>;
}

/** A failed buffered page is not retried for this long, so a dead server isn't hammered while scrolling */
const RETRY_AFTER = 5000;

interface LoadOptions {
  page?: number;
  start?: number;
  limit?: number;
  sorters?: Sorter[];
  filters?: Filter[];
  params?: Record<string, any>;
  callback?: (records: any[], success: boolean) => void;
}

/**
 * Data store for managing collections of records
 */
export class Store<T extends Record<string, any> = any> extends EventEmitter {
  private static registry = new Map<string, Store<any>>();

  /**
   * Register a store under a name so components can bind with `store: 'name'`.
   */
  static register<S extends Store<any>>(name: string, store: S): S {
    Store.registry.set(name, store);
    return store;
  }

  /**
   * Look up a named store. Passing a Store instance returns it unchanged.
   */
  static lookup<S extends Record<string, any> = any>(nameOrStore: string | Store<any>): Store<S> | undefined {
    return typeof nameOrStore === 'string' ? Store.registry.get(nameOrStore) : nameOrStore;
  }

  private config: StoreConfig<T>;
  /** What the store holds: every record, filtered or not */
  private source: StoreRecord<T>[] = [];
  /** What it shows: the records that pass the filters, in order */
  private records: StoreRecord<T>[] = [];
  private removedRecords: StoreRecord<T>[] = [];
  private proxy: Proxy<T> | null = null;
  private loading = false;
  private totalCount = 0;
  private currentPage = 1;
  private pageSize: number;
  private lastOptions: LoadOptions = {};

  // Buffered mode: pages by number, fetches in flight, recent failures and a generation that
  // makes responses to an older sort/filter harmless
  private pages = new Map<number, StoreRecord<T>[]>();
  private pending = new Map<number, Promise<void>>();
  private failedPages = new Map<number, number>();
  private generation = 0;
  
  // State
  private sorters: Sorter[] = [];
  private filters: Filter[] = [];
  private snapshotData: StoreRecord<T>[] | null = null;
  private groupField: string | null = null;
  private groupDirection: 'ASC' | 'DESC' = 'ASC';

  constructor(config: StoreConfig<T> = {}) {
    super();
    this.config = config;
    this.pageSize = config.pageSize || (config.buffered ? 100 : 25);
    
    // Set up proxy
    if (config.proxy) {
      this.proxy = this.createProxy(config.proxy);
    }
    
    // Apply initial sorters and filters
    if (config.sorters) {
      this.sorters = [...config.sorters];
    }
    
    if (config.filters) {
      this.filters = [...config.filters];
    }

    this.groupField = config.groupField ?? null;
    
    // Load initial data
    if (config.data) {
      this.loadData(config.data);
    } else if (config.autoLoad) {
      this.load();
    }
  }

  /**
   * Load data into the store
   */
  loadData(data: T[], append = false): void {
    if (!append) {
      this.source = [];
    }
    
    const records = data.map(item => this.createRecord(item));
    this.source.push(...records);
    
    this.applyState();
    this.emit('load', { records: this.records });
    this.emit('datachanged', { records: this.records });
  }

  /**
   * Load data from remote source
   */
  async load(options: LoadOptions = {}): Promise<void> {
    if (this.config.buffered && this.proxy) return this.loadBuffered(options);
    if (!this.proxy) {
      if (this.config.data) {
        this.loadData(this.config.data);
        return;
      }
      throw new Error('No proxy configured');
    }
    
    this.loading = true;
    this.lastOptions = options;
    
    this.emit('beforeload', { options });
    
    try {
      const params = this.buildParams(options);
      const response = await this.proxy.read(params);
      
      const { data, total, success, message } = this.parseResponse(response);
      
      if (!success) {
        throw new Error(message || 'Load failed');
      }
      
      this.totalCount = total || data.length;
      this.loadData(data);
      
      this.loading = false;
      this.emit('load', { records: this.records, total: this.totalCount });
    } catch (error) {
      this.loading = false;
      this.emit('exception', { error, operation: 'load' });
      throw error;
    }
  }

  // ────────── Buffered loading ──────────

  /** Whether the server sorts (the store asks it each time the sort changes) */
  isRemoteSort(): boolean {
    return !!(this.config.remoteSort || this.config.buffered) && !!this.proxy;
  }

  /** Whether the server filters */
  isRemoteFilter(): boolean {
    return !!(this.config.remoteFilter || this.config.buffered) && !!this.proxy;
  }

  isBuffered(): boolean {
    return !!this.config.buffered;
  }

  /** Forget every loaded page and start over (sort, filter and reload do this). */
  private resetBuffer(): void {
    this.generation++;
    this.pages.clear();
    this.pending.clear();
    this.failedPages.clear();
  }

  /** (Re)start a buffered store: drop the cache and load the first page, which also reports the total. */
  private async loadBuffered(options: LoadOptions): Promise<void> {
    this.lastOptions = options;
    this.resetBuffer();
    this.loading = true;
    this.emit('beforeload', { options });
    try {
      await this.loadPage0();
    } finally {
      this.loading = false;
    }
    this.emit('load', { records: this.getData(), total: this.totalCount });
  }

  private async loadPage0(): Promise<void> {
    await this.fetchBufferedPage(0, true);
  }

  /** The row at `index` if its page has arrived (else undefined: it is loading or out of range). */
  getRecordAt(index: number): StoreRecord<T> | undefined {
    const page = Math.floor(index / this.pageSize);
    const records = this.pages.get(page);
    if (!records) return undefined;
    // Touch for least-recently-used eviction
    this.pages.delete(page);
    this.pages.set(page, records);
    return records[index - page * this.pageSize];
  }

  /**
   * Make sure the rows `start` to `end` (exclusive) are loaded or loading. Resolves when the pages
   * that were missing have arrived. A page that failed is retried only after a few seconds.
   */
  ensureRange(start: number, end: number): Promise<void> {
    if (!this.config.buffered || !this.proxy) return Promise.resolve();
    const total = this.totalCount || Infinity;
    const first = Math.floor(Math.max(0, start) / this.pageSize);
    const last = Math.floor((Math.min(end, total) - 1) / this.pageSize);
    const waiting: Promise<void>[] = [];
    for (let page = first; page <= last; page++) {
      if (this.pages.has(page)) continue;
      const inFlight = this.pending.get(page);
      if (inFlight) {
        waiting.push(inFlight);
        continue;
      }
      if (Date.now() - (this.failedPages.get(page) ?? -Infinity) < RETRY_AFTER) continue;
      waiting.push(this.fetchBufferedPage(page));
    }
    return Promise.all(waiting).then(() => undefined);
  }

  private fetchBufferedPage(page: number, throwOnError = false): Promise<void> {
    const generation = this.generation;
    const request = (async () => {
      try {
        const params = this.buildParams({ start: page * this.pageSize, limit: this.pageSize, page: page + 1 });
        const response = await this.proxy!.read(params);
        const { data, total, success, message } = this.parseResponse(response);
        if (!success) throw new Error(message || 'Load failed');
        if (generation !== this.generation) return; // a newer sort/filter made this answer stale
        this.pending.delete(page);
        this.failedPages.delete(page);
        if (total !== undefined) this.totalCount = total;
        this.pages.set(page, data.map(item => this.createRecord(item)));
        const max = this.config.maxBufferedPages ?? 40;
        while (this.pages.size > max) this.pages.delete(this.pages.keys().next().value as number);
        this.emit('rangeload', { page });
        this.emit('datachanged', { records: this.getRecords() });
      } catch (error) {
        if (generation !== this.generation) return;
        this.pending.delete(page);
        this.failedPages.set(page, Date.now());
        this.emit('exception', { error, operation: 'load', page });
        if (throwOnError) throw error;
      }
    })();
    this.pending.set(page, request);
    return request;
  }

  /** Loaded records in row order (a buffered store holds only some of them). */
  private getRecords(): StoreRecord<T>[] {
    if (!this.config.buffered) return this.records;
    return [...this.pages.entries()].sort(([a], [b]) => a - b).flatMap(([, records]) => records);
  }

  /**
   * Reload with last options
   */
  reload(): Promise<void> {
    return this.load(this.lastOptions);
  }

  /**
   * Add records to the store
   */
  add(records: T | T[]): StoreRecord<T>[] {
    const recordsArray = Array.isArray(records) ? records : [records];
    const newRecords = recordsArray.map(data => {
      const record = this.createRecord(data, true);
      this.source.push(record);
      return record;
    });
    
    this.applyState();
    this.emit('add', { records: newRecords });
    this.emit('datachanged', { records: this.records });
    
    if (this.config.autoSync) {
      this.sync();
    }
    
    return newRecords;
  }

  /**
   * Remove records from the store
   */
  remove(records: StoreRecord<T> | StoreRecord<T>[] | T | T[]): void {
    const recordsArray = Array.isArray(records) ? records : [records];
    const toRemove: StoreRecord<T>[] = [];
    
    recordsArray.forEach(record => {
      const storeRecord = this.isStoreRecord(record) ? 
        record : 
        this.findRecord('id', (record as any).id);
        
      if (storeRecord) {
        toRemove.push(storeRecord);
      }
    });
    
    toRemove.forEach(record => {
      const index = this.source.indexOf(record);
      if (index > -1) {
        this.source.splice(index, 1);
        if (!record.phantom) {
          this.removedRecords.push(record);
        }
      }
    });
    
    this.applyState();
    this.emit('remove', { records: toRemove });
    this.emit('datachanged', { records: this.records });
    
    if (this.config.autoSync) {
      this.sync();
    }
  }

  /**
   * Update a record
   */
  update(record: StoreRecord<T>, data: Partial<T>): void {
    const model = this.config.model;
    Object.keys(data).forEach(key => {
      const typedKey = key as keyof T;
      // With a model, any field it declares may be set; without one, only what the record already has
      if (typedKey in record.data || model?.fields.some(f => f.name === key)) {
        const next = model ? model.convertField(key, data[typedKey], record.data) : data[typedKey];
        if (record.data[typedKey] !== next) {
          if (!(typedKey in record.modified)) {
            record.modified[typedKey] = record.data[typedKey];
          }
          (record.data as any)[typedKey] = next;
          record.dirty = true;
        }
      }
    });

    if (model) {
      const before = JSON.stringify(record.errors);
      record.errors = model.validate(record.data as Record<string, any>).errors;
      if (JSON.stringify(record.errors) !== before) this.emit('validate', { record, valid: Object.keys(record.errors).length === 0 });
    }
    
    this.emit('update', { record, data });
    this.emit('datachanged', { records: this.records });
    
    if (this.config.autoSync) {
      this.sync();
    }
  }

  /**
   * Check every record against the model's rules (the store's own check, not the server's). Each
   * record's `errors` is filled in; returns the records with a problem.
   */
  validate(): StoreRecord<T>[] {
    const model = this.config.model;
    if (!model) return [];
    const bad: StoreRecord<T>[] = [];
    this.source.forEach(r => {
      r.errors = model.validate(r.data as Record<string, any>).errors;
      if (Object.keys(r.errors).length) bad.push(r);
    });
    this.emit('validate', { records: bad, valid: bad.length === 0 });
    return bad;
  }

  /**
   * Sync changes with remote source
   */
  async sync(): Promise<void> {
    if (!this.proxy) {
      throw new Error('No proxy configured');
    }
    
    const toCreate = this.getNewRecords();
    const toUpdate = this.getUpdatedRecords();
    const toDestroy = this.removedRecords;
    
    this.emit('beforesync', { create: toCreate, update: toUpdate, destroy: toDestroy });
    
    try {
      // Create new records
      if (toCreate.length > 0) {
        const created = await this.proxy.create(toCreate.map(r => r.data));
        toCreate.forEach((record, index) => {
          if (created[index]) {
            record.data = { ...record.data, ...created[index] };
            record.phantom = false;
          }
        });
      }
      
      // Update existing records
      if (toUpdate.length > 0) {
        const updated = await this.proxy.update(toUpdate.map(r => ({
          ...r.data,
          [this.idProperty()]: r.id
        })));
        toUpdate.forEach((record, index) => {
          if (updated?.[index]) {
            record.data = { ...record.data, ...updated[index] };
            record.dirty = false;
            record.modified = {};
          }
        });
      }
      
      // Destroy removed records
      if (toDestroy.length > 0) {
        await this.proxy.destroy(toDestroy.map(r => r.id));
        this.removedRecords = [];
      }
      
      this.emit('sync', { success: true });
      this.emit('datachanged', { records: this.records });
    } catch (error) {
      this.emit('exception', { error, operation: 'sync' });
      throw error;
    }
  }

  /**
   * Find record by property value
   */
  findRecord(property: string, value: any): StoreRecord<T> | null {
    return this.source.find(record => (record.data as any)[property] === value) || null;
  }

  /**
   * Find records by function
   */
  findBy(fn: (record: StoreRecord<T>) => boolean): StoreRecord<T>[] {
    return this.getRecords().filter(fn);
  }

  /**
   * Get record by index
   */
  getAt(index: number): StoreRecord<T> | null {
    return this.records[index] || null;
  }

  /**
   * Get record by id
   */
  getById(id: string | number): StoreRecord<T> | null {
    return this.source.find(r => r.id === id || String(r.id) === String(id)) ?? null;
  }

  /**
   * Get all records
   */
  getRange(start?: number, end?: number): StoreRecord<T>[] {
    return this.records.slice(start, end);
  }

  /**
   * Get the plain data objects of all (filtered, sorted) records.
   */
  getData(): T[] {
    return this.getRecords().map(record => record.data);
  }

  /** The first shown record */
  first(): StoreRecord<T> | null {
    return this.records[0] ?? null;
  }

  /** The last shown record */
  last(): StoreRecord<T> | null {
    return this.records[this.records.length - 1] ?? null;
  }

  /** Where a record is among the shown ones (-1 when it is filtered out or not here) */
  indexOf(record: StoreRecord<T>): number {
    return this.records.indexOf(record);
  }

  /** Add records at a position among the shown ones (they sort and filter like any other). */
  insert(index: number, records: T | T[]): StoreRecord<T>[] {
    const added = this.add(records);
    const at = Math.max(0, Math.min(index, this.records.length));
    // With no sorters the order is the insertion order: put them where asked
    if (this.sorters.length === 0) {
      added.forEach(r => { const i = this.source.indexOf(r); if (i > -1) this.source.splice(i, 1); });
      const before = this.records[at];
      const target = before ? this.source.indexOf(before) : this.source.length;
      this.source.splice(target < 0 ? this.source.length : target, 0, ...added);
      this.applyState();
      this.emit('datachanged', { records: this.records });
    }
    return added;
  }

  /** Move a shown record to another position. Only a store with no sorters has an order of its own to change. */
  move(from: number, to: number): boolean {
    if (this.sorters.length > 0 || this.groupField) return false;
    const record = this.records[from];
    if (!record || to < 0 || to >= this.records.length || from === to) return false;
    const target = this.records[to];
    this.source.splice(this.source.indexOf(record), 1);
    this.source.splice(this.source.indexOf(target) + (to > from ? 1 : 0), 0, record);
    this.applyState();
    this.emit('move', { record, from, to });
    this.emit('datachanged', { records: this.records });
    return true;
  }

  /** Remove the record at a position among the shown ones */
  removeAt(index: number): void {
    const record = this.records[index];
    if (record) this.remove(record);
  }

  /** Keep records together by a field (the sort puts it first); `group()` with no field removes the grouping. */
  group(field?: string | null, direction: 'ASC' | 'DESC' = 'ASC'): void {
    this.groupField = field || null;
    this.groupDirection = direction;
    if (!this.config.remoteSort && !this.config.buffered) this.doSort();
    this.emit('groupchange', { field: this.groupField, direction });
    this.emit('datachanged', { records: this.records });
  }

  getGroupField(): string | null {
    return this.groupField;
  }

  getFilters(): Filter[] {
    return [...this.filters];
  }

  getSorters(): Sorter[] {
    return [...this.sorters];
  }

  /** The numbers in a field of the shown records (anything that is not a finite number is skipped) */
  private numbers(field: string): number[] {
    return this.records.map(r => (r.data as any)[field]).filter(v => v !== '' && v !== null && v !== undefined).map(Number).filter(Number.isFinite);
  }

  /** Total of a field over the shown records */
  sum(field: string): number {
    return this.numbers(field).reduce((a, b) => a + b, 0);
  }

  /** Average of a field over the shown records (0 when there are none) */
  average(field: string): number {
    const n = this.numbers(field);
    return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0;
  }

  /** Smallest value of a field over the shown records (`undefined` when there are none) */
  min(field: string): number | undefined {
    const n = this.numbers(field);
    return n.length ? Math.min(...n) : undefined;
  }

  /** Largest value of a field over the shown records (`undefined` when there are none) */
  max(field: string): number | undefined {
    const n = this.numbers(field);
    return n.length ? Math.max(...n) : undefined;
  }

  /**
   * The shown records grouped by a field (default: the store's `groupField`), in the order each group first
   * appears, each with its own count, sum, average, min and max for a field: `store.getGroups('country', 'revenue')`.
   */
  getGroups(field: string | undefined = this.groupField ?? undefined, aggregate?: string): Array<{ key: any; records: StoreRecord<T>[]; count: number; sum: number; average: number; min?: number; max?: number }> {
    if (!field) return [];
    const groups = new Map<any, StoreRecord<T>[]>();
    this.records.forEach(r => {
      const key = (r.data as any)[field];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });
    return Array.from(groups, ([key, records]) => {
      const n = aggregate ? records.map(r => (r.data as any)[aggregate]).filter(v => v !== '' && v !== null && v !== undefined).map(Number).filter(Number.isFinite) : [];
      const sum = n.reduce((a, b) => a + b, 0);
      return { key, records, count: records.length, sum, average: n.length ? sum / n.length : 0, min: n.length ? Math.min(...n) : undefined, max: n.length ? Math.max(...n) : undefined };
    });
  }

  /**
   * Get count of records
   */
  getCount(): number {
    return this.records.length;
  }

  /**
   * Get total count (including records not loaded)
   */
  getTotalCount(): number {
    if (this.config.buffered) return this.totalCount;
    return this.totalCount || this.records.length;
  }

  /**
   * Check if store has changes
   */
  isDirty(): boolean {
    return this.getModifiedRecords().length > 0 || this.removedRecords.length > 0;
  }

  /**
   * Get new records
   */
  getNewRecords(): StoreRecord<T>[] {
    return this.source.filter(r => r.phantom);
  }

  /**
   * Get updated records
   */
  getUpdatedRecords(): StoreRecord<T>[] {
    return this.source.filter(r => r.dirty && !r.phantom);
  }

  /**
   * Get modified records (new + updated)
   */
  getModifiedRecords(): StoreRecord<T>[] {
    return this.source.filter(r => r.dirty || r.phantom);
  }

  /**
   * Get removed records
   */
  getRemovedRecords(): StoreRecord<T>[] {
    return this.removedRecords;
  }

  /**
   * Reject changes on a record
   */
  rejectChanges(record?: StoreRecord<T>): void {
    if (record) {
      // Reject single record
      Object.keys(record.modified).forEach(key => {
        (record.data as any)[key] = record.modified[key as keyof T];
      });
      record.modified = {};
      record.dirty = false;
    } else {
      // Reject all changes
      this.source.forEach(r => {
        Object.keys(r.modified).forEach(key => {
          (r.data as any)[key] = r.modified[key as keyof T];
        });
        r.modified = {};
        r.dirty = false;
      });
      
      // Remove phantom records
      this.source = this.source.filter(r => !r.phantom);
      
      // Clear removed records
      this.removedRecords = [];
    }
    
    this.applyState();
    this.emit('datachanged', { records: this.records });
  }

  /**
   * Commit changes on a record
   */
  commitChanges(record?: StoreRecord<T>): void {
    if (record) {
      record.modified = {};
      record.dirty = false;
      record.phantom = false;
    } else {
      this.source.forEach(r => {
        r.modified = {};
        r.dirty = false;
        r.phantom = false;
      });
      this.removedRecords = [];
    }
    
    this.emit('datachanged', { records: this.records });
  }

  /**
   * Sort the store
   */
  sort(sorters?: Sorter | Sorter[], direction?: 'ASC' | 'DESC'): void {
    if (sorters) {
      if (Array.isArray(sorters)) {
        this.sorters = sorters;
      } else {
        this.sorters = [{
          ...sorters,
          direction: direction || sorters.direction || 'ASC'
        }];
      }
    }
    
    if ((this.config.remoteSort || this.config.buffered) && this.proxy) {
      this.currentPage = 1; // a new order starts from the first page
      this.load().catch(() => {}); // failures are reported by the `exception` event
    } else {
      this.doSort();
      this.emit('sortchange', { sorters: this.sorters });
      this.emit('datachanged', { records: this.records });
    }
  }

  /**
   * Filter the store
   */
  filter(filters?: Filter | Filter[]): void {
    if (filters !== undefined) {
      if (Array.isArray(filters)) {
        this.filters = filters;
      } else {
        this.filters = [filters];
      }
    }
    
    if ((this.config.remoteFilter || this.config.buffered) && this.proxy) {
      this.currentPage = 1; // and so does a new search
      this.load().catch(() => {});
    } else {
      this.applyState();
      this.emit('filterchange', { filters: this.filters });
      this.emit('datachanged', { records: this.records });
    }
  }

  /**
   * Clear filters
   */
  clearFilter(): void {
    this.filters = [];
    this.filter();
  }

  /**
   * Query the store
   */
  query(property: string, value: any): StoreRecord<T>[] {
    return this.records.filter(record => (record.data as any)[property] === value);
  }

  /**
   * Query by function
   */
  queryBy(fn: (record: StoreRecord<T>) => boolean): StoreRecord<T>[] {
    return this.records.filter(fn);
  }

  /**
   * Each iterator
   */
  each(fn: (record: StoreRecord<T>, index: number) => void | boolean): void {
    for (let i = 0; i < this.records.length; i++) {
      if (fn(this.records[i], i) === false) break;
    }
  }

  /**
   * Get snapshot of current records
   */
  snapshot(): StoreRecord<T>[] {
    this.snapshotData = this.source.map(r => ({
      ...r,
      data: { ...r.data },
      modified: { ...r.modified }
    }));
    return this.snapshotData;
  }

  /**
   * Restore from snapshot
   */
  restore(): void {
    if (this.snapshotData) {
      this.source = this.snapshotData;
      this.snapshotData = null;
      this.applyState();
      this.emit('datachanged', { records: this.records });
    }
  }

  /**
   * Clear all data
   */
  removeAll(): void {
    const removed = [...this.source];
    this.source = [];
    this.records = [];
    this.removedRecords.push(...removed.filter(r => !r.phantom));
    
    this.emit('clear', { records: removed });
    this.emit('datachanged', { records: this.records });
    
    if (this.config.autoSync) {
      this.sync();
    }
  }

  /**
   * Check if store is loading
   */
  isLoading(): boolean {
    return this.loading;
  }

  /**
   * Get current page
   */
  getCurrentPage(): number {
    return this.currentPage;
  }

  /**
   * Load page
   */
  loadPage(page: number): Promise<void> {
    this.currentPage = page;
    return this.load({
      page,
      start: (page - 1) * this.pageSize,
      limit: this.pageSize
    });
  }

  /**
   * Next page
   */
  nextPage(): Promise<void> {
    return this.loadPage(this.currentPage + 1);
  }

  /**
   * Previous page
   */
  previousPage(): Promise<void> {
    return this.loadPage(Math.max(1, this.currentPage - 1));
  }

  /**
   * Get page count
   */
  getPageCount(): number {
    return Math.ceil(this.getTotalCount() / this.pageSize);
  }

  // Private methods

  private idProperty(): string {
    return this.config.model?.idProperty || this.config.idProperty || 'id';
  }

  private createRecord(data: T, phantom = false): StoreRecord<T> {
    const key = this.idProperty();
    const clean = this.config.model ? this.config.model.convert(data as Record<string, any>) : data;
    // Only a missing id gets a generated one: 0 is a perfectly good id
    const given = (clean as any)[key];
    const id = given === undefined || given === null || given === '' ? this.generateId() : given;
    return {
      data: { ...clean, [key]: id },
      modified: {},
      id,
      dirty: false,
      phantom,
      errors: {}
    };
  }

  private generateId(): string {
    return `record-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private isStoreRecord(obj: any): obj is StoreRecord<T> {
    return obj && 
      typeof obj === 'object' && 
      'data' in obj && 
      'modified' in obj &&
      'id' in obj;
  }

  /** Rebuild what the store shows from what it holds: apply the filters, then the sort. */
  private applyState(): void {
    this.records = this.config.remoteFilter ? [...this.source] : this.source.filter(r => this.passes(r));
    if (!this.config.remoteSort) this.doSort();
  }

  /** Whether a record passes every filter */
  private passes(record: StoreRecord<T>): boolean {
    return this.filters.every(f => {
      if (typeof f.filterFn === 'function') return !!f.filterFn(record);
      const matches = (value: any) => matchesFilter(value, f);
      // `*` means any field, which is what a search box wants
      if (f.property === '*') return Object.values(record.data).some(matches);
      return matches((record.data as any)[f.property]);
    });
  }

  private doSort(): void {
    // Grouped records stay together: the group field is the first thing they sort by
    const sorters = this.groupField ? [{ property: this.groupField, direction: this.groupDirection }, ...this.sorters.filter(x => x.property !== this.groupField)] : this.sorters;
    if (sorters.length === 0) return;
    const compare = compareBy(sorters);
    this.records.sort((a, b) => compare(a.data, b.data));
  }

  private buildParams(options: LoadOptions): any {
    const page = options.page || this.currentPage;
    const limit = options.limit || this.pageSize;
    const params: any = {
      page,
      // Where this page starts, unless the caller said (a buffered store always does)
      start: options.start ?? (page - 1) * limit,
      limit,
      ...options.params
    };
    
    if ((this.config.remoteSort || this.config.buffered) && this.sorters.length > 0) {
      params.sort = JSON.stringify(this.sorters);
    }
    
    if ((this.config.remoteFilter || this.config.buffered) && this.filters.length > 0) {
      params.filter = JSON.stringify(this.filters);
    }
    
    return params;
  }

  private parseResponse(response: any): {
    data: T[];
    total?: number;
    success: boolean;
    message?: string;
  } {
    const reader = this.config.proxy?.reader;
    
    const data = reader?.rootProperty ? 
      response[reader.rootProperty] : 
      (response.data || response);
      
    const total = reader?.totalProperty ? 
      response[reader.totalProperty] : 
      response.total;
      
    const success = reader?.successProperty ? 
      response[reader.successProperty] : 
      (response.success !== undefined ? response.success : true);
      
    const message = reader?.messageProperty ? 
      response[reader.messageProperty] : 
      response.message;
    
    return {
      data: Array.isArray(data) ? data : [],
      total,
      success,
      message
    };
  }

  private lookupModel(_name: string): any {
    // Model registry would be implemented here
    return null;
  }

  private createProxy(config: ProxyConfig): Proxy<T> {
    return createProxy<T>({ idProperty: this.idProperty(), ...config, headers: { ...this.config.headers, ...config.headers } });
  }
}

// Export factory function
export function createStore<T extends Record<string, any>>(config: StoreConfig<T>): Store<T> {
  return new Store(config);
}

/** A comparison for `Array.sort` from sorters: ascending unless `DESC`, empty values last either way */
export function compareBy(sorters: Sorter[]): (a: any, b: any) => number {
  return (a, b) => {
    for (const sorter of sorters) {
      let aVal = a?.[sorter.property];
      let bVal = b?.[sorter.property];
      if (sorter.transform) {
        aVal = sorter.transform(aVal);
        bVal = sorter.transform(bVal);
      }
      const dir = sorter.direction === 'DESC' ? -1 : 1;
      const aEmpty = aVal === null || aVal === undefined;
      const bEmpty = bVal === null || bVal === undefined;
      if (aEmpty || bEmpty) {
        if (aEmpty && bEmpty) continue;
        return aEmpty ? 1 : -1;
      }
      if (aVal < bVal) return -dir;
      if (aVal > bVal) return dir;
    }
    return 0;
  };
}

/** One filter against one value: the operators the store understands */
export function matchesFilter(value: any, f: Filter): boolean {
  const target = f.value;
  switch (f.operator ?? 'eq') {
    case 'eq': return value === target || (value != null && target != null && String(value) === String(target));
    case 'ne': return !matchesFilter(value, { ...f, operator: 'eq' });
    // An empty value is not less than anything (JavaScript says null <= 20)
    case 'gt': return value != null && value !== '' && value > target;
    case 'gte': return value != null && value !== '' && value >= target;
    case 'lt': return value != null && value !== '' && value < target;
    case 'lte': return value != null && value !== '' && value <= target;
    case 'like': return value != null && String(value).toLowerCase().includes(String(target ?? '').toLowerCase());
    case 'in': return Array.isArray(target) && target.some(t => t === value || String(t) === String(value));
    default: return true;
  }
}
