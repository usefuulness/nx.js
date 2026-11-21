/**
 * @file @/data/proxy.ts
 * How a store talks to a server (or to the browser's own storage): requests, readers and writers.
 */

export interface ProxyConfig {
  /** `rest` (one request per record, ids in the URL), `ajax` (records sent together), `memory` or `localstorage` */
  type: 'rest' | 'ajax' | 'memory' | 'localstorage' | (string & {});
  /** Base URL (for `localstorage`: the storage key) */
  url?: string;
  /** Different URLs per operation */
  api?: {
    create?: string;
    read?: string;
    update?: string;
    destroy?: string;
  };
  /** Where the answer keeps its data */
  reader?: {
    rootProperty?: string;
    totalProperty?: string;
    successProperty?: string;
    messageProperty?: string;
  };
  /** What a save sends */
  writer?: {
    /** Send every field, not only the ones that changed (updates only) */
    writeAllFields?: boolean;
    /** Wrap what is sent in `{ [rootProperty]: … }` */
    rootProperty?: string;
  };
  headers?: Record<string, string>;
  /** Send requests through this instead of `ajax` (an API client uses it to add its base URL, auth and error handling) */
  request?: <R = any>(url: string, options: AjaxOptions) => Promise<R>;
  /** Added to every read */
  extraParams?: Record<string, any>;
  /** Give up on a request after this many milliseconds (default: no limit) */
  timeout?: number;
  /** The field that identifies a record (default `id`) */
  idProperty?: string;
  /** Starting records for a `memory` proxy */
  data?: any[];
}

export interface AjaxOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Query string parameters (for GET and DELETE) */
  params?: Record<string, any>;
  /** Sent as JSON, unless it is a string, `FormData` or `URLSearchParams` */
  body?: unknown;
  headers?: Record<string, string>;
  /** Give up after this many milliseconds */
  timeout?: number;
  /** Abort from outside */
  signal?: AbortSignal;
  /** How to read the answer: `json` (default), `text` or `none` */
  as?: 'json' | 'text' | 'none';
}

/** A failed request: the HTTP status (0 when it never got an answer) and whatever the server said */
export class AjaxError extends Error {
  status: number;
  response?: unknown;

  constructor(message: string, status = 0, response?: unknown) {
    super(message);
    this.name = 'AjaxError';
    this.status = status;
    this.response = response;
  }
}

/** Anything fetch() can do for you that a data layer needs: JSON in and out, errors for bad statuses, time limits. */
export async function ajax<T = any>(url: string, options: AjaxOptions = {}): Promise<T> {
  const { method = 'GET', params, body, headers = {}, timeout, signal, as = 'json' } = options;
  const target = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost');
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    // A list of plain values is the name repeated (`tags=a&tags=b`: how servers and OpenAPI read it); anything else with structure is JSON
    if (Array.isArray(v) && v.every(x => x === null || ['string', 'number', 'boolean'].includes(typeof x))) {
      v.forEach(x => x !== null && target.searchParams.append(k, String(x)));
      return;
    }
    target.searchParams.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  });

  const controller = new AbortController();
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = timeout ? setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), timeout) : null;

  const raw = typeof body === 'string' || body instanceof FormData || body instanceof URLSearchParams;
  const init: RequestInit = {
    method,
    headers: { ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : raw ? (body as BodyInit) : JSON.stringify(body),
    signal: controller.signal
  };

  try {
    let response: Response;
    try {
      response = await fetch(target.toString(), init);
    } catch (e) {
      const timedOut = timer !== null && controller.signal.aborted && !signal?.aborted;
      throw new AjaxError(timedOut ? `The request timed out after ${timeout} ms` : (e as Error)?.message || 'The request failed');
    }
    let payload: unknown;
    if (as !== 'none') {
      const text = await response.text();
      if (as === 'text') payload = text;
      else if (text.trim() === '') payload = undefined;
      else {
        try { payload = JSON.parse(text); } catch { if (response.ok) throw new AjaxError('The answer is not valid JSON', response.status, text); payload = text; }
      }
    }
    if (!response.ok) {
      const message = payload && typeof payload === 'object' && typeof (payload as any).message === 'string' ? (payload as any).message : `${response.status} ${response.statusText}`.trim();
      throw new AjaxError(message, response.status, payload);
    }
    return payload as T;
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

/** The part of a store's contract a proxy fills */
export abstract class Proxy<T = any> {
  protected config: ProxyConfig;

  constructor(config: ProxyConfig) {
    this.config = config;
  }

  protected get idProperty(): string {
    return this.config.idProperty || 'id';
  }

  abstract read(params: any): Promise<any>;

  /** One record by id, or `undefined` when there is none (the default reads everything and looks) */
  async find(id: string | number): Promise<T | undefined> {
    const answer = await this.read({});
    const root = this.config.reader?.rootProperty;
    const list = Array.isArray(answer) ? answer : (root ? answer?.[root] : answer?.data) ?? [];
    return (Array.isArray(list) ? list : []).find((r: any) => String(r?.[this.idProperty]) === String(id));
  }

  abstract create(records: T[]): Promise<T[]>;
  abstract update(records: any[]): Promise<any[]>;
  abstract destroy(ids: (string | number)[]): Promise<void>;
}

/** What goes on the wire: optionally wrapped in a root property */
function wrap(config: ProxyConfig, payload: unknown): unknown {
  const root = config.writer?.rootProperty;
  return root ? { [root]: payload } : payload;
}

/** The records in an answer to a save: either the root property, or the answer itself */
function unwrap(config: ProxyConfig, answer: any): any {
  const root = config.reader?.rootProperty;
  return root && answer && typeof answer === 'object' && root in answer ? answer[root] : answer;
}

const toList = (value: any): any[] => (Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []);

/** `rest` and `ajax`: requests over HTTP */
export class HttpProxy<T = any> extends Proxy<T> {
  private urlFor(op: 'create' | 'read' | 'update' | 'destroy', id?: string | number): string {
    const base = this.config.api?.[op] || this.config.url;
    if (!base) throw new Error(`The proxy has no URL for "${op}"`);
    // REST puts the id in the path, unless that operation has its own URL
    if (id !== undefined && this.config.type === 'rest' && !this.config.api?.[op]) return `${base.replace(/\/+$/, '')}/${encodeURIComponent(String(id))}`;
    return base;
  }

  private request<R = any>(url: string, options: AjaxOptions): Promise<R> {
    return (this.config.request ?? ajax)<R>(url, { headers: this.config.headers, timeout: this.config.timeout, ...options });
  }

  async read(params: any): Promise<any> {
    return this.request(this.urlFor('read'), { params: { ...this.config.extraParams, ...params } });
  }

  async find(id: string | number): Promise<T | undefined> {
    try {
      const answer = this.config.type === 'rest'
        ? await this.request(this.urlFor('read', id), { params: this.config.extraParams })
        : await this.request(this.urlFor('read'), { params: { ...this.config.extraParams, [this.idProperty]: id } });
      const one = unwrap(this.config, answer);
      return (Array.isArray(one) ? one[0] : one) ?? undefined;
    } catch (e) {
      if (e instanceof AjaxError && e.status === 404) return undefined;
      throw e;
    }
  }

  async create(records: T[]): Promise<T[]> {
    if (this.config.type === 'rest') {
      const out: T[] = [];
      for (const record of records) out.push(...toList(unwrap(this.config, await this.request(this.urlFor('create'), { method: 'POST', body: wrap(this.config, record) }))) as T[]);
      return out;
    }
    return toList(unwrap(this.config, await this.request(this.urlFor('create'), { method: 'POST', body: wrap(this.config, records) }))) as T[];
  }

  async update(records: any[]): Promise<any[]> {
    if (this.config.type === 'rest') {
      const out: any[] = [];
      for (const record of records) {
        out.push(...toList(unwrap(this.config, await this.request(this.urlFor('update', record[this.idProperty]), { method: 'PUT', body: wrap(this.config, record) }))));
      }
      return out;
    }
    return toList(unwrap(this.config, await this.request(this.urlFor('update'), { method: 'PUT', body: wrap(this.config, records) })));
  }

  async destroy(ids: (string | number)[]): Promise<void> {
    if (this.config.type === 'rest') {
      for (const id of ids) await this.request(this.urlFor('destroy', id), { method: 'DELETE', as: 'none' });
      return;
    }
    await this.request(this.urlFor('destroy'), { method: 'DELETE', body: wrap(this.config, { ids }), as: 'none' });
  }
}

/** Records kept in a plain array: for tests, demos and data that never leaves the page */
export class MemoryProxy<T = any> extends Proxy<T> {
  protected rows: any[];

  constructor(config: ProxyConfig) {
    super(config);
    this.rows = (config.data ?? []).map(r => ({ ...r }));
  }

  protected load(): any[] { return this.rows; }
  protected save(rows: any[]): void { this.rows = rows; }

  async read(_params: any): Promise<any> {
    return { data: this.load().map(r => ({ ...r })), total: this.load().length, success: true };
  }

  async create(records: T[]): Promise<T[]> {
    this.save([...this.load(), ...records.map(r => ({ ...r }))]);
    return records;
  }

  async update(records: any[]): Promise<any[]> {
    const key = this.idProperty;
    const byId = new Map(records.map(r => [String(r[key]), r]));
    this.save(this.load().map(row => (byId.has(String(row[key])) ? { ...row, ...byId.get(String(row[key])) } : row)));
    return records;
  }

  async destroy(ids: (string | number)[]): Promise<void> {
    const gone = new Set(ids.map(String));
    this.save(this.load().filter(row => !gone.has(String(row[this.idProperty]))));
  }
}

/** Records kept in `localStorage` under the proxy's `url` as the key */
export class LocalStorageProxy<T = any> extends MemoryProxy<T> {
  private key: string;

  constructor(config: ProxyConfig) {
    super({ ...config, data: [] });
    this.key = config.url || 'nx-store-data';
  }

  protected load(): any[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.key) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return []; // storage holds something that is not our data: start clean, never throw into the page
    }
  }

  protected save(rows: any[]): void {
    localStorage.setItem(this.key, JSON.stringify(rows));
  }
}

const custom = new Map<string, (config: ProxyConfig) => Proxy>();

/** Add a kind of proxy that a store can name in its config: `registerProxyType('hal', config => new HalProxy(config))` */
export function registerProxyType(type: string, factory: (config: ProxyConfig) => Proxy): void {
  custom.set(type, factory);
}

export function createProxy<T = any>(config: ProxyConfig): Proxy<T> {
  const make = custom.get(config.type);
  if (make) return make(config) as Proxy<T>;
  switch (config.type) {
    case 'rest':
    case 'ajax':
      return new HttpProxy<T>(config);
    case 'memory':
      return new MemoryProxy<T>(config);
    case 'localstorage':
      return new LocalStorageProxy<T>(config);
    default:
      throw new Error(`Unknown proxy type: ${(config as ProxyConfig).type}`);
  }
}
