import { EventEmitter } from '@/core/zustand/event-emitter';

export interface StoreConfig<T = any> {
  data?: T[];
  model?: any;
  proxy?: ProxyConfig;
  autoLoad?: boolean;
  autoSync?: boolean;
  sorters?: Sorter[];
  filters?: Filter[];
  pageSize?: number;
  remoteSort?: boolean;
  remoteFilter?: boolean;
  headers?: Record<string, string>;
}

export interface ProxyConfig {
  type: 'rest' | 'ajax' | 'memory' | 'localstorage';
  url?: string;
  api?: {
    create?: string;
    read?: string;
    update?: string;
    destroy?: string;
  };
  reader?: {
    rootProperty?: string;
    totalProperty?: string;
    successProperty?: string;
    messageProperty?: string;
  };
  writer?: {
    writeAllFields?: boolean;
    rootProperty?: string;
  };
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
  private records: StoreRecord<T>[] = [];
  private removedRecords: StoreRecord<T>[] = [];
  private proxy: Proxy<T> | null = null;
  private loading = false;
  private totalCount = 0;
  private currentPage = 1;
  private pageSize: number;
  private lastOptions: LoadOptions = {};
  
  // State
  private sorters: Sorter[] = [];
  private filters: Filter[] = [];
  private snapshotData: StoreRecord<T>[] | null = null;

  constructor(config: StoreConfig<T> = {}) {
    super();
    this.config = config;
    this.pageSize = config.pageSize || 25;
    
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
      this.records = [];
    }
    
    const records = data.map(item => this.createRecord(item));
    this.records.push(...records);
    
    this.applyState();
    this.emit('load', { records: this.records });
    this.emit('datachanged', { records: this.records });
  }

  /**
   * Load data from remote source
   */
  async load(options: LoadOptions = {}): Promise<void> {
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
      this.records.push(record);
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
      const index = this.records.indexOf(record);
      if (index > -1) {
        this.records.splice(index, 1);
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
    Object.keys(data).forEach(key => {
      const typedKey = key as keyof T;
      if (typedKey in record.data) {
        if (record.data[typedKey] !== data[typedKey]) {
          if (!record.modified[typedKey]) {
            record.modified[typedKey] = record.data[typedKey];
          }
          (record.data as any)[typedKey] = data[typedKey];
          record.dirty = true;
        }
      }
    });
    
    this.emit('update', { record, data });
    this.emit('datachanged', { records: this.records });
    
    if (this.config.autoSync) {
      this.sync();
    }
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
          id: r.id
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
    return this.records.find(record => (record.data as any)[property] === value) || null;
  }

  /**
   * Find records by function
   */
  findBy(fn: (record: StoreRecord<T>) => boolean): StoreRecord<T>[] {
    return this.records.filter(fn);
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
    return this.findRecord('id', id);
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
    return this.records.map(record => record.data);
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
    return this.records.filter(r => r.phantom);
  }

  /**
   * Get updated records
   */
  getUpdatedRecords(): StoreRecord<T>[] {
    return this.records.filter(r => r.dirty && !r.phantom);
  }

  /**
   * Get modified records (new + updated)
   */
  getModifiedRecords(): StoreRecord<T>[] {
    return this.records.filter(r => r.dirty || r.phantom);
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
      this.records.forEach(r => {
        Object.keys(r.modified).forEach(key => {
          (r.data as any)[key] = r.modified[key as keyof T];
        });
        r.modified = {};
        r.dirty = false;
      });
      
      // Remove phantom records
      this.records = this.records.filter(r => !r.phantom);
      
      // Clear removed records
      this.removedRecords = [];
    }
    
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
      this.records.forEach(r => {
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
    
    if (this.config.remoteSort && this.proxy) {
      this.load();
    } else {
      this.doSort();
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
    
    if (this.config.remoteFilter && this.proxy) {
      this.load();
    } else {
      this.doFilter();
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
    this.snapshotData = this.records.map(r => ({
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
      this.records = this.snapshotData;
      this.snapshotData = null;
      this.emit('datachanged', { records: this.records });
    }
  }

  /**
   * Clear all data
   */
  removeAll(): void {
    const removed = [...this.records];
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

  private createRecord(data: T, phantom = false): StoreRecord<T> {
    const id = (data as any).id || this.generateId();
    return {
      data: { ...data, id },
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

  private applyState(): void {
    if (!this.config.remoteSort) {
      this.doSort();
    }
    if (!this.config.remoteFilter) {
      this.doFilter();
    }
  }

  private doSort(): void {
    if (this.sorters.length === 0) return;
    
    this.records.sort((a, b) => {
      for (const sorter of this.sorters) {
        let aVal = (a.data as any)[sorter.property];
        let bVal = (b.data as any)[sorter.property];
        
        if (sorter.transform) {
          aVal = sorter.transform(aVal);
          bVal = sorter.transform(bVal);
        }
        
        if (aVal < bVal) return sorter.direction === 'ASC' ? -1 : 1;
        if (aVal > bVal) return sorter.direction === 'ASC' ? 1 : -1;
      }
      return 0;
    });
  }

  private doFilter(): void {
    // Implementation would filter records based on this.filters
    // For now, we'll keep all records visible
  }

  private buildParams(options: LoadOptions): any {
    const params: any = {
      page: options.page || this.currentPage,
      start: options.start || 0,
      limit: options.limit || this.pageSize,
      ...options.params
    };
    
    if (this.config.remoteSort && this.sorters.length > 0) {
      params.sort = JSON.stringify(this.sorters);
    }
    
    if (this.config.remoteFilter && this.filters.length > 0) {
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
    switch (config.type) {
      case 'rest':
        return new RestProxy(config);
      case 'ajax':
        return new AjaxProxy(config);
      case 'memory':
        return new MemoryProxy(config);
      case 'localstorage':
        return new LocalStorageProxy(config);
      default:
        throw new Error(`Unknown proxy type: ${config.type}`);
    }
  }
}

/**
 * Base proxy class
 */
abstract class Proxy<T> {
  protected config: ProxyConfig;

  constructor(config: ProxyConfig) {
    this.config = config;
  }

  abstract read(params: any): Promise<any>;
  abstract create(records: T[]): Promise<T[]>;
  abstract update(records: any[]): Promise<any[]>;
  abstract destroy(ids: (string | number)[]): Promise<void>;
}

/**
 * REST proxy for server communication
 */
class RestProxy<T> extends Proxy<T> {
  async read(params: any): Promise<any> {
    const url = new URL(this.config.api?.read || this.config.url!);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.config.headers
    });
    
    return response.json();
  }
  
  async create(records: T[]): Promise<T[]> {
    const response = await fetch(this.config.api?.create || this.config.url!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: JSON.stringify(records)
    });
    
    return response.json();
  }
  
  async update(records: any[]): Promise<any[]> {
    const response = await fetch(this.config.api?.update || this.config.url!, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: JSON.stringify(records)
    });
    
    return response.json();
  }
  
  async destroy(ids: (string | number)[]): Promise<void> {
    await fetch(this.config.api?.destroy || this.config.url!, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: JSON.stringify({ ids })
    });
  }
}

/**
 * AJAX proxy (similar to REST but more flexible)
 */
class AjaxProxy<T> extends RestProxy<T> {
  // Override methods as needed for different AJAX behaviors
}

/**
 * Memory proxy for client-side data
 */
class MemoryProxy<T> extends Proxy<T> {
  private data: T[] = [];
  
  async read(_params: any): Promise<any> {
    return { data: [...this.data], success: true };
  }
  
  async create(records: T[]): Promise<T[]> {
    this.data.push(...records);
    return records;
  }
  
  async update(records: any[]): Promise<any[]> {
    // Update logic
    return records;
  }
  
  async destroy(_ids: (string | number)[]): Promise<void> {
    // Remove logic
  }
}

/**
 * LocalStorage proxy
 */
class LocalStorageProxy<T> extends Proxy<T> {
  private key: string;
  
  constructor(config: ProxyConfig) {
    super(config);
    this.key = config.url || 'nx-store-data';
  }
  
  async read(_params: any): Promise<any> {
    const data = localStorage.getItem(this.key);
    return { 
      data: data ? JSON.parse(data) : [], 
      success: true 
    };
  }
  
  async create(records: T[]): Promise<T[]> {
    const existing = await this.read({});
    const newData = [...existing.data, ...records];
    localStorage.setItem(this.key, JSON.stringify(newData));
    return records;
  }
  
  async update(records: any[]): Promise<any[]> {
    const existing = await this.read({});
    // Update logic
    localStorage.setItem(this.key, JSON.stringify(existing.data));
    return records;
  }
  
  async destroy(ids: (string | number)[]): Promise<void> {
    const existing = await this.read({});
    const filtered = existing.data.filter((item: any) => 
      !ids.includes(item.id)
    );
    localStorage.setItem(this.key, JSON.stringify(filtered));
  }
}

// Export factory function
export function createStore<T extends Record<string, any>>(config: StoreConfig<T>): Store<T> {
  return new Store(config);
}
