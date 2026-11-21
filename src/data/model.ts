/**
 * @file @/data/model.ts
 * Models: typed fields with defaults and conversion, validators, change tracking, and loading and
 * saving through a proxy. A store can use one to clean up and check every record it holds.
 */
import { EventEmitter } from '@/core/events/event-emitter';
import { i18n } from '@/core/i18n';
import { parseApiError } from '@/data/errors';
import { createProxy, type Proxy, type ProxyConfig } from '@/data/proxy';
import { Store } from '@/data/store';

export type FieldType = 'string' | 'int' | 'float' | 'number' | 'boolean' | 'date' | 'auto';

/** A rule for a field: a name, a name with options, or your own function (return `true`, or a message, or a list of them) */
export type ValidatorSpec =
  | 'presence' | 'email' | 'url'
  | { type: 'presence' | 'email' | 'url'; message?: string }
  | { type: 'length'; min?: number; max?: number; message?: string }
  | { type: 'range'; min?: number; max?: number; message?: string }
  | { type: 'format'; matcher: RegExp; message?: string }
  | { type: 'inclusion' | 'exclusion'; list: unknown[]; message?: string }
  | ((value: any, model: { data: Record<string, any> }) => true | string | string[] | void | undefined | null | false);

export interface ModelField {
  name: string;
  /** How a value is cleaned up when it is set (default `auto`: kept as it is) */
  type?: FieldType;
  /** Used when the data has no value for this field (a function is called each time) */
  defaultValue?: unknown;
  /** Keep `null` as `null` instead of converting it (default: numbers become 0, text becomes `''`) */
  allowNull?: boolean;
  /** Your own conversion, called with the value and the whole data */
  convert?: (value: any, data: Record<string, any>) => any;
  /** Where the value lives in the incoming data, as a dotted path: `address.city` */
  mapping?: string;
  validators?: ValidatorSpec[];
  /** Leave this field out of what is saved (default true) */
  persist?: boolean;
}

export interface AssociationConfig {
  /** `hasMany`: this record owns a list of others (`user.orders()`); `belongsTo`: it points at one (`order.getUser()`) */
  type: 'hasMany' | 'belongsTo';
  /** The name it is reached by (and where embedded data sits in the incoming data) */
  name: string;
  /** The other model (a function, when it is defined later or refers back to this one) */
  model: ModelClass<any> | (() => ModelClass<any>);
  /** The field that holds the owner's id: on the other record for `hasMany`, on this one for `belongsTo`. Default: `<owner model name>Id` / `<name>Id`. */
  foreignKey?: string;
}

export interface ModelConfig {
  /** A name for the model, used to name foreign keys (`user` → `userId`) */
  name?: string;
  /** The field that identifies a record (default `id`) */
  idProperty?: string;
  fields: Array<ModelField | string>;
  /** More rules, by field name, for fields declared elsewhere */
  validators?: Record<string, ValidatorSpec[]>;
  /** Where `load()`, `save()` and `erase()` go */
  proxy?: ProxyConfig;
  /** Links to other models */
  associations?: AssociationConfig[];
}

export interface ValidationResult {
  valid: boolean;
  /** Messages by field name (only fields with a problem are present) */
  errors: Record<string, string[]>;
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URLISH = /^[a-z][a-z0-9+.-]*:\/\/[^\s/$.?#][^\s]*$/i;

/** Read a dotted path out of an object (`address.city`), without ever throwing */
export function pathGet(source: any, path: string): any {
  let cur = source;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

function convertValue(field: ModelField, value: any, data: Record<string, any>): any {
  if (field.convert) return field.convert(value, data);
  if (value === undefined) return value;
  if (value === null) {
    if (field.allowNull) return null;
    switch (field.type) {
      case 'int': case 'float': case 'number': return 0;
      case 'string': return '';
      case 'boolean': return false;
      default: return null;
    }
  }
  switch (field.type) {
    case 'string': return typeof value === 'string' ? value : String(value);
    case 'int': { const n = Math.trunc(Number(value)); return Number.isFinite(n) ? n : (field.allowNull ? null : 0); }
    case 'float': case 'number': { const n = Number(value); return value === '' || !Number.isFinite(n) ? (field.allowNull ? null : 0) : n; }
    case 'boolean': return typeof value === 'string' ? !['false', '0', 'no', 'off', ''].includes(value.trim().toLowerCase()) : !!value;
    case 'date': { const d = value instanceof Date ? value : new Date(value); return Number.isNaN(d.getTime()) ? (field.allowNull ? null : null) : d; }
    default: return value;
  }
}

function runValidator(spec: ValidatorSpec, value: any, model: { data: Record<string, any> }, locale: string): string[] {
  const t = (key: string, params?: Record<string, unknown>) => i18n.t(key, params, locale);
  if (typeof spec === 'function') {
    const out = spec(value, model);
    if (out === true || out === undefined || out === null) return [];
    if (out === false) return [t('validation.invalid')];
    return Array.isArray(out) ? out : [out];
  }
  const rule = typeof spec === 'string' ? { type: spec } as Exclude<ValidatorSpec, string | Function> : spec;
  const msg = (key: string, params?: Record<string, unknown>) => [(rule as { message?: string }).message ?? t(key, params)];
  // Every rule except `presence` lets an empty value through: whether it may be empty is `presence`'s business
  if (rule.type === 'presence') return isEmpty(value) ? msg('validation.presence') : [];
  if (isEmpty(value)) return [];
  switch (rule.type) {
    case 'email': return EMAIL.test(String(value)) ? [] : msg('validation.email');
    case 'url': return URLISH.test(String(value)) ? [] : msg('validation.url');
    case 'format': return rule.matcher.test(String(value)) ? [] : msg('validation.format');
    case 'inclusion': return rule.list.includes(value) ? [] : msg('validation.inclusion');
    case 'exclusion': return rule.list.includes(value) ? msg('validation.exclusion') : [];
    case 'length': {
      const n = typeof value === 'string' || Array.isArray(value) ? value.length : String(value).length;
      if (rule.min !== undefined && n < rule.min) return msg('validation.length.min', { min: rule.min });
      if (rule.max !== undefined && n > rule.max) return msg('validation.length.max', { max: rule.max });
      return [];
    }
    case 'range': {
      const n = Number(value);
      if (rule.min !== undefined && n < rule.min) return msg('validation.range.min', { min: rule.min });
      if (rule.max !== undefined && n > rule.max) return msg('validation.range.max', { max: rule.max });
      return [];
    }
    default: return [];
  }
}

/** The language messages come in: given, or the page's, or English */
function pageLocale(): string {
  return typeof document !== 'undefined' ? i18n.localeOf(document.documentElement) : 'en';
}

/** What `defineModel()` gives back: a class of records, plus the rules they share */
export interface ModelClass<T extends Record<string, any> = Record<string, any>> {
  new (data?: Partial<T>): Model<T>;
  readonly idProperty: string;
  readonly fields: ReadonlyArray<ModelField>;
  readonly proxyConfig: ProxyConfig | undefined;
  readonly associations: ReadonlyArray<AssociationConfig & { foreignKey: string }>;
  /** Clean up raw data: defaults, mappings and conversion, as a record would */
  convert(raw: Record<string, any>): T;
  /** Convert a single value for a field (unknown fields pass through) */
  convertField(name: string, value: any, data?: Record<string, any>): any;
  /** Check plain data against the rules, without making a record */
  validate(data: Record<string, any>, locale?: string): ValidationResult;
  create(data?: Partial<T>): Model<T>;
  /** Fetch one record through the model's proxy */
  load(id: string | number): Promise<Model<T>>;
}

/** A record: its data, what changed, whether it is valid, and how to save it */
export class Model<T extends Record<string, any> = Record<string, any>> extends EventEmitter {
  data: T;
  /** The values fields had before they were changed (field name → old value) */
  modified: Partial<T> = {};
  /** Not saved yet: created here, without an id from a server */
  phantom: boolean;
  private embedded = new Map<string, unknown>();
  private related = new Map<string, unknown>();
  /** The class this came from (set by `defineModel`) */
  declare ['constructor']: ModelClass<T>;

  constructor(data: Partial<T> = {}) {
    super();
    const cls = this.constructor;
    this.data = cls.convert(data as Record<string, any>);
    // Nested data for an association is kept apart, so it is neither saved with this record nor mistaken for a field
    for (const a of cls.associations) {
      if (a.name in (this.data as any)) { this.embedded.set(a.name, (this.data as any)[a.name]); delete (this.data as any)[a.name]; }
    }
    const id = (this.data as any)[cls.idProperty];
    this.phantom = id === undefined || id === null || id === '';
  }

  get id(): any {
    return (this.data as any)[this.constructor.idProperty];
  }

  get dirty(): boolean {
    return Object.keys(this.modified).length > 0;
  }

  get(name: keyof T & string): any {
    return this.data[name];
  }

  isModified(name: keyof T & string): boolean {
    return name in this.modified;
  }

  /**
   * Change one field (`set('name', 'Ada')`) or several (`set({ name: 'Ada', age: 36 })`). Values are converted
   * like the field says. Returns the names that really changed; `change` is emitted for each.
   */
  set(name: (keyof T & string) | Partial<T>, value?: any): string[] {
    const cls = this.constructor;
    const patch: Record<string, any> = typeof name === 'string' ? { [name]: value } : { ...(name as Record<string, any>) };
    const changed: string[] = [];
    for (const [key, raw] of Object.entries(patch)) {
      // Editing a field answers what the server said about it
      if (this.serverErrors[key]) { const { [key]: _gone, ...rest } = this.serverErrors; this.serverErrors = rest; }
      const next = cls.convertField(key, raw, this.data);
      const old = (this.data as any)[key];
      if (sameValue(old, next)) continue;
      if (!(key in this.modified)) (this.modified as any)[key] = old;
      else if (sameValue((this.modified as any)[key], next)) delete (this.modified as any)[key]; // back to where it started
      (this.data as any)[key] = next;
      changed.push(key);
      this.emit('change', { field: key, value: next, oldValue: old, model: this });
    }
    return changed;
  }

  /** Accept the current values as the saved ones */
  commit(): void {
    this.modified = {};
    this.phantom = false;
    this.emit('commit', { model: this });
  }

  /** Put every changed field back as it was */
  reject(): void {
    for (const [key, old] of Object.entries(this.modified)) (this.data as any)[key] = old;
    this.modified = {};
    this.emit('reject', { model: this });
  }

  validate(locale: string = pageLocale()): ValidationResult {
    return this.constructor.validate(this.data, locale);
  }

  isValid(locale?: string): boolean {
    return this.validate(locale).valid;
  }

  /** A new record with the same values (and no id, unless you give one) */
  copy(id?: string | number): Model<T> {
    const clone = new this.constructor({ ...this.data, [this.constructor.idProperty]: id } as Partial<T>);
    return clone;
  }

  /** What would be saved: fields marked `persist: false` are left out */
  toJSON(): Record<string, any> {
    const out: Record<string, any> = {};
    const fields = new Map(this.constructor.fields.map(f => [f.name, f]));
    for (const [key, value] of Object.entries(this.data)) {
      if (fields.get(key)?.persist === false) continue;
      out[key] = value instanceof Date ? value.toISOString() : value;
    }
    return out;
  }

  private association(name: string) {
    const a = this.constructor.associations.find(x => x.name === name);
    if (!a) throw new Error(`No association "${name}" on this model`);
    return { ...a, target: typeof a.model === 'function' && !('fields' in a.model) ? (a.model as () => ModelClass<any>)() : (a.model as ModelClass<any>) };
  }

  /**
   * The other side of an association. For `hasMany` it is a store of the related records (made the first
   * time, from nested data if there was any; new records added to it get the foreign key). For `belongsTo` it
   * is the related record if it is known (nested data, `setAssoc`, or an earlier `loadAssoc`), else `undefined`.
   */
  assoc(name: string): any {
    const a = this.association(name);
    if (a.type === 'belongsTo') {
      if (!this.related.has(name) && this.embedded.get(name) && typeof this.embedded.get(name) === 'object') {
        const m = new a.target(this.embedded.get(name) as Record<string, any>);
        m.phantom = false;
        this.related.set(name, m);
      }
      return this.related.get(name);
    }
    let store = this.related.get(name) as Store<any> | undefined;
    if (!store) {
      const rows = this.embedded.get(name);
      const proxyConfig = a.target.proxyConfig;
      store = new Store<any>({
        model: a.target,
        data: Array.isArray(rows) ? (rows as any[]).map(r => ({ ...r, [a.foreignKey]: this.id ?? r?.[a.foreignKey] })) : undefined,
        proxy: proxyConfig && { ...proxyConfig, extraParams: { ...proxyConfig.extraParams, [a.foreignKey]: this.id } }
      });
      store.on('add', (e: any) => e.records.forEach((r: any) => { r.data[a.foreignKey] = this.id; }));
      this.related.set(name, store);
    }
    return store;
  }

  /** Fetch the other side: a `hasMany` store loads its records; a `belongsTo` loads the record its foreign key points at */
  async loadAssoc(name: string): Promise<any> {
    const a = this.association(name);
    if (a.type === 'hasMany') {
      const store = this.assoc(name) as Store<any>;
      await store.load();
      return store;
    }
    const key = (this.data as any)[a.foreignKey];
    if (key === undefined || key === null || key === '') return undefined;
    const found = await a.target.load(key);
    this.related.set(name, found);
    return found;
  }

  /** Point a `belongsTo` at a record (or `null` to clear it): the foreign key follows */
  setAssoc(name: string, model: Model<any> | null): void {
    const a = this.association(name);
    if (a.type !== 'belongsTo') throw new Error(`"${name}" is a hasMany: add to its store instead`);
    this.set(a.foreignKey as any, model ? model.id : null);
    if (model) this.related.set(name, model); else this.related.delete(name);
  }

  private proxy(): Proxy {
    const config = proxies.get(this.constructor);
    if (!config) throw new Error('This model has no proxy: give defineModel() a `proxy`');
    return createProxy({ idProperty: this.constructor.idProperty, ...config });
  }

  /** Save through the model's proxy: creates when new, updates otherwise, then takes what the server sent back */
  /** What the server said is wrong with each field after the last save or delete it refused (cleared by the next success, or by editing that field) */
  serverErrors: Record<string, string[]> = {};

  /** Take a refused request's field complaints, so a form can show them next to the fields. */
  private refused(error: unknown): never {
    if (error && typeof error === 'object' && 'status' in error) this.serverErrors = { ...parseApiError(error).fields };
    throw error;
  }

  async save(): Promise<this> {
    const proxy = this.proxy();
    const sent = this.toJSON();
    // An update needs the id to find the record, even when the id is a field that is never sent as data (read-only)
    let answer: unknown;
    try {
      [answer] = this.phantom ? await proxy.create([sent]) : await proxy.update([{ ...sent, [this.constructor.idProperty]: this.id }]);
    } catch (e) {
      this.refused(e);
    }
    this.serverErrors = {};
    if (answer && typeof answer === 'object') {
      const fresh = this.constructor.convert({ ...this.data, ...(answer as Record<string, any>) });
      this.data = fresh as T;
    }
    this.commit();
    // Children added before this record had an id now point at it
    for (const a of this.constructor.associations) {
      if (a.type !== 'hasMany') continue;
      (this.related.get(a.name) as Store<any> | undefined)?.each(r => { if (r.data[a.foreignKey] !== this.id) r.data[a.foreignKey] = this.id; });
    }
    return this;
  }

  /** Delete through the model's proxy */
  async erase(): Promise<void> {
    if (this.phantom) return;
    try { await this.proxy().destroy([this.id]); } catch (e) { this.refused(e); }
    this.emit('erase', { model: this });
  }
}

const proxies = new WeakMap<object, ProxyConfig>();

function sameValue(a: any, b: any): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

/**
 * Describe a kind of record. Returns a class: `new User({ name: 'Ada' })`.
 *
 * ```ts
 * const User = defineModel<{ id: number; name: string; email: string; age: number }>({
 *   fields: [
 *     { name: 'id', type: 'int' },
 *     { name: 'name', validators: ['presence', { type: 'length', max: 40 }] },
 *     { name: 'email', validators: ['email'] },
 *     { name: 'age', type: 'int', defaultValue: 18, validators: [{ type: 'range', min: 0, max: 130 }] }
 *   ],
 *   proxy: { type: 'rest', url: '/api/users' }
 * });
 * const ada = new User({ name: 'Ada', email: 'ada@example.com' });
 * ada.validate();                      // { valid: true, errors: {} }
 * await ada.save();
 * ```
 */
export function defineModel<T extends Record<string, any> = Record<string, any>>(config: ModelConfig): ModelClass<T> {
  const idProperty = config.idProperty || 'id';
  const fields: ModelField[] = config.fields.map(f => (typeof f === 'string' ? { name: f } : { ...f }));
  if (!fields.some(f => f.name === idProperty)) fields.unshift({ name: idProperty, type: 'auto', allowNull: true });
  const byName = new Map(fields.map(f => [f.name, f]));
  const associations = (config.associations ?? []).map(a => ({
    ...a,
    foreignKey: a.foreignKey || (a.type === 'hasMany' ? `${config.name || 'parent'}Id` : `${a.name}Id`)
  }));

  class Defined extends Model<T> {
    static readonly idProperty = idProperty;
    static readonly fields: ReadonlyArray<ModelField> = fields;
    static readonly proxyConfig: ProxyConfig | undefined = config.proxy;
    static readonly associations = associations;

    static convert(raw: Record<string, any>): T {
      const input = raw ?? {};
      const out: Record<string, any> = { ...input };
      for (const field of fields) {
        let value = field.mapping ? pathGet(input, field.mapping) : input[field.name];
        if (value === undefined) {
          const d = field.defaultValue;
          value = typeof d === 'function' ? (d as () => unknown)() : d;
        }
        // A field with nothing and no default stays unset: converting `undefined` would invent a value
        // A custom convert always runs: it may compute a field from others. Otherwise nothing means nothing.
        out[field.name] = value === undefined && !field.convert ? undefined : convertValue(field, value, input);
        if (out[field.name] === undefined) delete out[field.name];
      }
      return out as T;
    }

    static convertField(name: string, value: any, data: Record<string, any> = {}): any {
      const field = byName.get(name);
      return field ? convertValue(field, value, data) : value;
    }

    static validate(data: Record<string, any>, locale: string = pageLocale()): ValidationResult {
      const errors: Record<string, string[]> = {};
      const names = new Set([...fields.map(f => f.name), ...Object.keys(config.validators ?? {})]);
      for (const name of names) {
        const rules = [...(byName.get(name)?.validators ?? []), ...(config.validators?.[name] ?? [])];
        const messages = rules.flatMap(rule => runValidator(rule, data?.[name], { data }, locale));
        if (messages.length) errors[name] = messages;
      }
      return { valid: Object.keys(errors).length === 0, errors };
    }

    static create(data: Partial<T> = {}): Model<T> {
      return new Defined(data);
    }

    static async load(id: string | number): Promise<Model<T>> {
      if (!config.proxy) throw new Error('This model has no proxy: give defineModel() a `proxy`');
      const proxy = createProxy({ idProperty, ...config.proxy });
      const found = await proxy.find(id);
      if (!found) throw new Error(`No record with id ${id}`);
      const record = new Defined(found as Partial<T>);
      record.phantom = false;
      return record;
    }
  }

  if (config.proxy) proxies.set(Defined, config.proxy);
  // Handy names for the links: `user.orders()`, `order.getUser()`, `order.setUser(user)`
  for (const a of associations) {
    const cap = a.name.charAt(0).toUpperCase() + a.name.slice(1);
    const add = (key: string, fn: (this: Model<any>, ...args: any[]) => unknown) => { if (!(key in Defined.prototype)) Object.defineProperty(Defined.prototype, key, { value: fn, writable: true, configurable: true }); };
    if (a.type === 'hasMany') add(a.name, function (this: Model<any>) { return this.assoc(a.name); });
    else { add(`get${cap}`, function (this: Model<any>) { return this.assoc(a.name); }); add(`set${cap}`, function (this: Model<any>, m: Model<any> | null) { this.setAssoc(a.name, m); }); }
  }
  return Defined as unknown as ModelClass<T>;
}
