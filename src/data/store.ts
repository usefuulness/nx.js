// src/data/store.ts
import { EventBus } from '@/core/zustand/event-bus';

export interface StoreConfig<T = any> {
  data?: T[];
  model?: string | Model<T>;
  proxy?: ProxyConfig;
  sorters?: Sorter<T>[];
  filters?: Filter<T>[];
  groupField?: keyof T;
  pageSize?: number;
  autoLoad?: boolean;
  autoSync?: boolean;
  remoteSort?: boolean;
  remoteFilter?: boolean;
  remotePaging?: boolean;
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
  reader?: ReaderConfig;
  writer?: WriterConfig;
  headers?: Record<string, string>;
  extraParams?: Record<string, any>;
}

export interface ReaderConfig {
  rootProperty?: string;
  totalProperty?: string;
  successProperty?: string;
  messageProperty?: string;
  idProperty?: string;
}

export interface WriterConfig {
  rootProperty?: string;
  writeAllFields?: boolean;
  dateFormat?: string;
}

export interface Sorter<T = any> {
  field: keyof T;
  direction: 'asc' | 'desc';
  compareFn?: (a: T, b: T) => number;
}

export interface Filter<T = any> {
  field?: keyof T;
  value?: any;
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between';
  filterFn?: (record: T) => boolean;
}

export interface Model<T = any> {
  fields: ModelField[];
  idProperty?: keyof T;
  validations?: ModelValidation[];
}

export interface ModelField {
  name: string;
  type?: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  defaultValue?: any;
  convert?: (value: any, record: any) => any;
  serialize?: (value: any, record: any) => any;
}

export interface ModelValidation {
  field: string;
  type: 'required' | 'length' | 'format' | 'custom';
  config?: any;
  message?: string;
}

export interface StoreRecord<T = any> {
  id: string | number;
  data: T;
  dirty: boolean;
  phantom: boolean;
  modified: Partial<T>;
  errors: Record<string, string[]>;
}

export type StoreEvent = 
  | 'load'
  | 'beforeload'
  | 'add'
  | 'remove'
  | 'update'
  | 'clear'
  | 'sort'
  | 'filter'
  | 'datachanged'
  | 'sync'
  | 'beforesync'
  | 'write'
  | 'exception';

/**
 * Data store for managing collections of records
 */
export class Store<T extends Record<string, any> = any> extends EventBus<StoreEvent, any> {
  private config: StoreConfig<T>;
  private records: StoreRecord<T>[] = [];
  private removedRecords: StoreRecord<T>[] = [];
  private currentPage = 1;
  private totalCount = 0;
  private loading = false;
  private lastOptions: any = {};
  private proxy: Proxy<T> | null = null;
  private model: Model<T> | null = null;

  constructor(config: StoreConfig<T> = {}) {
    super();
    this.config = config;
    
    // Initialize proxy
    if (config.proxy) {
      this.proxy = this.createProxy(config.proxy);
    }
    
    // Initialize model
    if (config.model) {
      this.model = typeof config.model === 'string' ? 
        this.lookupModel(config.model) : 
        config.model;
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
  async load(options: any = {}): Promise<void> {
    if (!this.proxy) {
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
    
    recordsArray.forEach(item => {
      let record: StoreRecord<T> | undefined;
      
      if (this.isRecord(item)) {
        record = item;
      } else {
        record = this.findRecord(item);
      }
      
      if (record) {
        const index = this.records.indexOf(record);
        if (index >= 0) {
          this.records.splice(index, 1);
          toRemove.push(record);
          
          if (!record.phantom) {
            this.removedRecords.push(record);
          }
        }
      }
    });
    
    if (toRemove.length > 0) {
      this.applyState();
      this.emit('remove', { records: toRemove });
      this.emit('datachanged', { records: this.records });
      
      if (this.config.autoSync) {
        this.sync();
      }
    }
  }

  /**
   * Update a record
   */
  update(record: StoreRecord<T>, data: Partial<T>): void {
    const oldData = { ...record.data };
    
    Object.entries(data).forEach(([key, value]) => {
      if (record.data[key] !== value) {
        record.data[key] = value;
        record.modified[key] = oldData[key];
        record.dirty = true;
      }
    });
    
    this.validateRecord(record);
    this.emit('update', { record, changes: data });
    this.emit('datachanged', { records: this.records });
    
    if (this.config.autoSync) {
      this.sync();
    }
  }

  /**
   * Find a record by id or data
   */
  findRecord(idOrData: string | number | T): StoreRecord<T> | undefined {
    if (typeof idOrData === 'object') {
      const id = this.getRecordId(idOrData);
      return this.records.find(r => r.id === id);
    }
    
    return this.records.find(r => r.id === idOrData);
  }

  /**
   * Find records by field value
   */
  findBy(field: keyof T, value: any): StoreRecord<T>[] {
    return this.records.filter(record => record.data[field] === value);
  }

  /**
   * Get record at index
   */
  getAt(index: number): StoreRecord<T> | undefined {
    return this.records[index];
  }

  /**
   * Get record count
   */
  getCount(): number {
    return this.records.length;
  }

  /**
   * Get total count (for paging)
   */
  getTotalCount(): number {
    return this.totalCount || this.records.length;
  }

  /**
   * Get all records
   */
  getRange(start = 0, end?: number): StoreRecord<T>[] {
    return this.records.slice(start, end);
  }

  /**
   * Get all data
   */
  getData(): T[] {
    return this.records.map(r => r.data);
  }

  /**
   * Clear the store
   */
  clear(): void {
    this.records = [];
    this.removedRecords = [];
    this.currentPage = 1;
    this.totalCount = 0;
    
    this.emit('clear');
    this.emit('datachanged', { records: this.records });
  }

  /**
   * Sort the store
   */
  sort(sorters?: Sorter<T> | Sorter<T>[]): void {
    if (sorters) {
      this.config.sorters = Array.isArray(sorters) ? sorters : [sorters];
    }
    
    if (this.config.remoteSort && this.proxy) {
      this.load();
    } else {
      this.doSort();
      this.emit('sort', { sorters: this.config.sorters });
      this.emit('datachanged', { records: this.records });
    }
  }

  /**
   * Filter the store
   */
  filter(filters?: Filter<T> | Filter<T>[]): void {
    if (filters) {
      this.config.filters = Array.isArray(filters) ? filters : [filters];
    }
    
    if (this.config.remoteFilter && this.proxy) {
      this.load();
    } else {
      this.doFilter();
      this.emit('filter', { filters: this.config.filters });
      this.emit('datachanged', { records: this.records });
    }
  }

  /**
   * Clear filters
   */
  clearFilter(): void {
    this.config.filters = [];
    this.filter();
  }

  /**
   * Load a specific page
   */
  loadPage(page: number): Promise<void> {
    this.currentPage = page;
    return this.load();
  }

  /**
   * Next page
   */
  nextPage(): Promise<void> {
    const totalPages = Math.ceil(this.getTotalCount() / (this.config.pageSize || 25));
    if (this.currentPage < totalPages) {
      return this.loadPage(this.currentPage + 1);
    }
    return Promise.resolve();
  }

  /**
   * Previous page
   */
  previousPage(): Promise<void> {
    if (this.currentPage > 1) {
      return this.loadPage(this.currentPage - 1);
    }
    return Promise.resolve();
  }

  /**
   * Sync changes with server
   */
  async sync(): Promise<void> {
    if (!this.proxy) {
      throw new Error('No proxy configured');
    }
    
    const toCreate = this.getNewRecords();
    const toUpdate = this.getUpdatedRecords();
    const toDestroy = this.getRemovedRecords();
    
    if (toCreate.length === 0 && toUpdate.length === 0 && toDestroy.length === 0) {
      return;
    }
    
    this.emit('beforesync', { create: toCreate, update: toUpdate, destroy: toDestroy });
    
    try {
      // Create new records
      if (toCreate.length > 0) {
        const created = await this.proxy.create(toCreate.map(r => r.data));
        this.emit('write', { action: 'create', records: created });
      }
      
      // Update existing records
      if (toUpdate.length > 0) {
        const updated = await this.proxy.update(toUpdate.map(r => ({
          id: r.id,
          ...r.data
        })));
        this.emit('write', { action: 'update', records: updated });
      }
      
      // Delete removed records
      if (toDestroy.length > 0) {
        await this.proxy.destroy(toDestroy.map(r => r.id));
        this.emit('write', { action: 'destroy', records: toDestroy });
      }
      
      // Clear dirty flags and removed records
      this.commitChanges();
      
      this.emit('sync', { success: true });
    } catch (error) {
      this.emit('exception', { error, operation: 'sync' });
      throw error;
    }
  }

  /**
   * Commit all changes
   */
  commitChanges(): void {
    this.records.forEach(record => {
      record.dirty = false;
      record.phantom = false;
      record.modified = {};
    });
    this.removedRecords = [];
  }

  /**
   * Reject all changes
   */
  rejectChanges(): void {
    // Restore modified records
    this.records.forEach(record => {
      if (record.dirty) {
        Object.assign(record.data, record.modified);
        record.dirty = false;
        record.modified = {};
      }
    });
    
    // Remove phantom records
    this.records = this.records.filter(r => !r.phantom);
    
    // Clear removed records
    this.removedRecords = [];
    
    this.applyState();
    this.emit('datachanged', { records: this.records });
  }

  /**
   * Check if store has changes
   */
  hasChanges(): boolean {
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
   * Create a snapshot of current state
   */
  snapshot(): void {
    this.snapshot = this.records.map(r => ({
      ...r,
      data: { ...r.data },
      modified: { ...r.modified }
    }));
  }

  /**
   * Restore from snapshot
   */
  restore(): void {
    if (this.snapshot) {
      this.records = this.snapshot.map(r => ({
        ...r,
        data: { ...r.data },
        modified: { ...r.modified }
      }));
      this.snapshot = null;
      this.applyState();
      this.emit('datachanged', { records: this.records });
    }
  }

  // Private methods

  private createRecord(data: T, phantom = false): StoreRecord<T> {
    const id = this.getRecordId(data) || this.generateId();
    
    const record: StoreRecord<T> = {
      id,
      data: this.processData(data),
      dirty: false,
      phantom,
      modified: {},
      errors: {}
    };
    
    this.validateRecord(record);
    return record;
  }

  private processData(data: T): T {
    if (!this.model) return { ...data };
    
    const processed: any = {};
    
    this.model.fields.forEach(field => {
      let value = data[field.name as keyof T];
      
      // Apply default value
      if (value === undefined && field.defaultValue !== undefined) {
        value = typeof field.defaultValue === 'function' ? 
          field.defaultValue() : 
          field.defaultValue;
      }
      
      // Apply converter
      if (field.convert) {
        value = field.convert(value, data);
      }
      
      processed[field.name] = value;
    });
    
    return processed;
  }

  private validateRecord(record: StoreRecord<T>): void {
    if (!this.model?.validations) return;
    
    record.errors = {};
    
    this.model.validations.forEach(validation => {
      const value = record.data[validation.field as keyof T];
      const errors: string[] = [];
      
      switch (validation.type) {
        case 'required':
          if (!value && value !== 0 && value !== false) {
            errors.push(validation.message || `${validation.field} is required`);
          }
          break;
          
        case 'length':
          if (typeof value === 'string') {
            const { min, max } = validation.config || {};
            if (min && value.length < min) {
              errors.push(validation.message || `Minimum length is ${min}`);
            }
            if (max && value.length > max) {
              errors.push(validation.message || `Maximum length is ${max}`);
            }
          }
          break;
          
        case 'format':
          if (value && validation.config?.pattern) {
            const regex = new RegExp(validation.config.pattern);
            if (!regex.test(String(value))) {
              errors.push(validation.message || 'Invalid format');
            }
          }
          break;
          
        case 'custom':
          if (validation.config?.validator) {
            const error = validation.config.validator(value, record);
            if (error) {
              errors.push(error);
            }
          }
          break;
      }
      
      if (errors.length > 0) {
        record.errors[validation.field] = errors;
      }
    });
  }

  private getRecordId(data: T): string | number | undefined {
    const idProperty = this.model?.idProperty || 'id';
    return data[idProperty as keyof T] as any;
  }

  private generateId(): string {
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private isRecord(item: any): item is StoreRecord<T> {
    return item && typeof item === 'object' && 'id' in item && 'data' in item;
  }

  private applyState(): void {
    this.doFilter();
    this.doSort();
    this.doGroup();
  }

  private doSort(): void {
    if (!this.config.sorters || this.config.sorters.length === 0) return;
    
    this.records.sort((a, b) => {
      for (const sorter of this.config.sorters!) {
        let result = 0;
        
        if (sorter.compareFn) {
          result = sorter.compareFn(a.data, b.data);
        } else {
          const aVal = a.data[sorter.field];
          const bVal = b.data[sorter.field];
          
          if (aVal < bVal) result = -1;
          else if (aVal > bVal) result = 1;
        }
        
        if (result !== 0) {
          return sorter.direction === 'asc' ? result : -result;
        }
      }
      
      return 0;
    });
  }

  private doFilter(): void {
    // In a real implementation, you'd maintain separate filtered/unfiltered arrays
    // For simplicity, we'll skip this here
  }

  private doGroup(): void {
    // Group implementation would go here
  }

  private buildParams(options: any): any {
    const params: any = {
      ...this.config.proxy?.extraParams,
      ...options.params
    };
    
    // Add paging params
    if (this.config.pageSize) {
      params.page = this.currentPage;
      params.limit = this.config.pageSize;
      params.start = (this.currentPage - 1) * this.config.pageSize;
    }
    
    // Add sort params
    if (this.config.sorters && this.config.remoteSort) {
      params.sort = JSON.stringify(this.config.sorters);
    }
    
    // Add filter params
    if (this.config.filters && this.config.remoteFilter) {
      params.filter = JSON.stringify(this.config.filters);
    }
    
    return params;
  }

  private parseResponse(response: any): { data: T[], total?: number, success: boolean, message?: string } {
    const reader = this.config.proxy?.reader || {};
    
    const rootProperty = reader.rootProperty || 'data';
    const totalProperty = reader.totalProperty || 'total';
    const successProperty = reader.successProperty || 'success';
    const messageProperty = reader.messageProperty || 'message';
    
    const data = rootProperty ? response[rootProperty] : response;
    const total = totalProperty ? response[totalProperty] : undefined;
    const success = successProperty ? response[successProperty] !== false : true;
    const message = messageProperty ? response[messageProperty] : undefined;
    
    return { data: data || [], total, success, message };
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

  private lookupModel(name: string): Model<T> | null {
    // In a real implementation, this would look up registered models
    return null;
  }
}

/**
 * Base proxy class
 */
abstract class Proxy<T> {
  constructor(protected config: ProxyConfig) {}
  
  abstract read(params: any): Promise<any>;
  abstract create(records: T[]): Promise<T[]>;
  abstract update(records: any[]): Promise<any[]>;
  abstract destroy(ids: (string | number)[]): Promise<void>;
}

/**
 * REST proxy implementation
 */
class RestProxy<T> extends Proxy<T> {
  async read(params: any): Promise<any> {
    const url = new URL(this.config.url!);
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
  
  async read(params: any): Promise<any> {
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
  
  async destroy(ids: (string | number)[]): Promise<void> {
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
  
  async read(params: any): Promise<any> {
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