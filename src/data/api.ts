/**
 * @file @/data/api.ts
 * An API client: describe a server once (its address, its sign-in, its resources) and get requests,
 * stores and models that all go through it, so grids and forms talk to it without any glue.
 */
import { ajax, AjaxError, type AjaxOptions, type ProxyConfig } from '@/data/proxy';
import { Store, type StoreConfig, type Sorter, type Filter } from '@/data/store';
import { defineModel, type ModelClass, type ModelConfig, type ModelField } from '@/data/model';

type MaybePromise<T> = T | Promise<T>;

export interface ApiResource {
  /** Where it lives, below the base URL: `/users` */
  path: string;
  /** Fields (or a whole model config) for records of this resource */
  fields?: Array<ModelField | string>;
  model?: Omit<ModelConfig, 'proxy' | 'fields'> & { fields?: Array<ModelField | string> };
  /** How the answer to a list request is laid out (default: an array, or `{ data, total }`) */
  reader?: ProxyConfig['reader'];
  /** Page size for stores of this resource */
  pageSize?: number;
  /** Let the server sort, filter and page (default true for `remote`, false keeps it all in the browser) */
  remote?: boolean;
  /** Added to every request for this resource */
  params?: Record<string, any>;
  idProperty?: string;
  /** How this resource's store parameters become query parameters (overrides the client's `params`) */
  mapParams?: ApiConfig['params'];
}

export interface ApiConfig {
  /** The server's address: `https://api.example.com/v1`, or `/api` */
  baseUrl?: string;
  /** Sent with every request: an object, or a function (it may be async) that returns one */
  headers?: Record<string, string> | (() => MaybePromise<Record<string, string>>);
  /** Sign-in: the token goes in `Authorization: Bearer …` */
  auth?: {
    token: () => MaybePromise<string | null | undefined>;
    /** Called when the server answers 401: get a new token, then the request is repeated once. Return `false` to give up. */
    refresh?: () => MaybePromise<boolean | void>;
  };
  /** Give up on a request after this many milliseconds */
  timeout?: number;
  /** Change a request before it is sent */
  onRequest?: (url: string, options: AjaxOptions) => MaybePromise<AjaxOptions | void>;
  /** See every answer (after it is read) */
  onResponse?: (data: unknown, url: string) => void;
  /** See every failure (after a refresh was tried): sign the user out on 401, show a toast… */
  onError?: (error: AjaxError, url: string) => void;
  /** Repeat a request that failed to reach the server, or answered 502, 503 or 504, this many times (default 0) */
  retries?: number;
  /** Wait this long before the first repeat, doubling each time (default 300) */
  retryDelay?: number;
  /**
   * How a store's sorting, filtering and paging become query parameters. The default sends
   * `page`, `limit`, `sort` (JSON) and `filter` (JSON). Change names or the whole shape here.
   */
  params?: (state: { page: number; start: number; limit: number; sort: Sorter[]; filter: Filter[]; extra: Record<string, any> }) => Record<string, any>;
  resources?: Record<string, ApiResource>;
}

export interface ResourceClient<T = any> {
  list(params?: Record<string, any>): Promise<{ data: T[]; total?: number }>;
  get(id: string | number): Promise<T>;
  create(data: Partial<T>): Promise<T>;
  update(id: string | number, data: Partial<T>): Promise<T>;
  remove(id: string | number): Promise<void>;
}

const RETRYABLE = new Set([502, 503, 504]);
const pause = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** `/a/` + `/b` → `/a/b`, whatever the slashes; a full URL in `path` is used as it is */
function join(base: string | undefined, path: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path) || !base) return path;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export class Api {
  readonly config: ApiConfig;
  private stores = new Map<string, Store<any>>();
  private models = new Map<string, ModelClass<any>>();

  constructor(config: ApiConfig = {}) {
    this.config = config;
  }

  private async headers(extra: Record<string, string> | undefined): Promise<Record<string, string>> {
    const given = typeof this.config.headers === 'function' ? await this.config.headers() : this.config.headers;
    const out: Record<string, string> = { ...given };
    const token = await this.config.auth?.token();
    if (token) out.Authorization = `Bearer ${token}`;
    return { ...out, ...extra };
  }

  /**
   * Send a request through the client: base URL, headers, sign-in, time limit, a new token once on 401,
   * repeats for a flaky connection, and your `onRequest`, `onResponse` and `onError`.
   */
  async request<T = any>(path: string, options: AjaxOptions = {}): Promise<T> {
    const url = join(this.config.baseUrl, path);
    let refreshed = false;
    let attempt = 0;
    for (;;) {
      let opts: AjaxOptions = { timeout: this.config.timeout, ...options, headers: await this.headers(options.headers) };
      const changed = await this.config.onRequest?.(url, opts);
      if (changed) opts = changed;
      try {
        const data = await ajax<T>(url, opts);
        this.config.onResponse?.(data, url);
        return data;
      } catch (e) {
        const error = e instanceof AjaxError ? e : new AjaxError((e as Error)?.message ?? 'The request failed');
        if (error.status === 401 && this.config.auth?.refresh && !refreshed) {
          refreshed = true;
          if ((await this.config.auth.refresh()) !== false) continue;
        }
        const method = (opts.method ?? 'GET').toUpperCase();
        // Only repeat what is safe to repeat: reads, or a request that never reached the server
        const retryable = (error.status === 0 || RETRYABLE.has(error.status)) && (method === 'GET' || error.status === 0);
        if (retryable && attempt < (this.config.retries ?? 0)) {
          await pause((this.config.retryDelay ?? 300) * 2 ** attempt++);
          continue;
        }
        this.config.onError?.(error, url);
        throw error;
      }
    }
  }

  get<T = any>(path: string, params?: Record<string, any>, options: AjaxOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET', params: { ...options.params, ...params } });
  }
  post<T = any>(path: string, body?: unknown, options: AjaxOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }
  put<T = any>(path: string, body?: unknown, options: AjaxOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }
  patch<T = any>(path: string, body?: unknown, options: AjaxOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }
  delete<T = any>(path: string, options: AjaxOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE', as: 'none' });
  }

  private resource(name: string): ApiResource {
    const r = this.config.resources?.[name];
    if (!r) throw new Error(`The API has no resource "${name}"`);
    return r;
  }

  private proxyFor(name: string): ProxyConfig {
    const r = this.resource(name);
    return {
      type: 'rest',
      url: r.path,
      reader: r.reader,
      idProperty: r.idProperty,
      extraParams: r.params,
      request: (url, options) => this.request(url, options)
    };
  }

  /** Plain calls for a resource: `api.client('users').list()`, `.get(7)`, `.create({…})`, `.update(7, {…})`, `.remove(7)` */
  client<T = any>(name: string): ResourceClient<T> {
    const r = this.resource(name);
    const reader = r.reader;
    return {
      list: async params => {
        const answer = await this.get<any>(r.path, { ...r.params, ...params });
        const data = Array.isArray(answer) ? answer : (reader?.rootProperty ? answer?.[reader.rootProperty] : answer?.data) ?? [];
        const total = Array.isArray(answer) ? undefined : answer?.[reader?.totalProperty ?? 'total'];
        return { data: Array.isArray(data) ? data : [], total };
      },
      get: id => this.get<T>(`${r.path.replace(/\/+$/, '')}/${encodeURIComponent(String(id))}`, r.params),
      create: data => this.post<T>(r.path, data),
      update: (id, data) => this.put<T>(`${r.path.replace(/\/+$/, '')}/${encodeURIComponent(String(id))}`, data),
      remove: async id => { await this.delete(`${r.path.replace(/\/+$/, '')}/${encodeURIComponent(String(id))}`); }
    };
  }

  /** A model class for a resource, saving and loading through this client */
  model<T extends Record<string, any> = any>(name: string): ModelClass<T> {
    let cls = this.models.get(name) as ModelClass<T> | undefined;
    if (!cls) {
      const r = this.resource(name);
      cls = defineModel<T>({
        name: name.replace(/s$/, ''),
        ...r.model,
        idProperty: r.idProperty ?? r.model?.idProperty,
        fields: r.model?.fields ?? r.fields ?? [],
        proxy: this.proxyFor(name)
      });
      this.models.set(name, cls);
    }
    return cls;
  }

  /**
   * A store for a resource: it loads, saves, sorts, filters and pages through this client. The same
   * store is returned each time (and is registered under the resource's name, so `<nx-grid store="users">`
   * finds it); pass `options` for a separate one.
   */
  store<T extends Record<string, any> = any>(name: string, options?: Partial<StoreConfig<T>>): Store<T> {
    if (!options && this.stores.has(name)) return this.stores.get(name) as Store<T>;
    const r = this.resource(name);
    const remote = r.remote !== false;
    const model = r.model || r.fields ? this.model<T>(name) : undefined;
    const proxy = this.proxyFor(name);
    const mapParams = r.mapParams ?? this.config.params;
    if (mapParams) {
      // Rename the store's own parameters (page, limit, sort, filter) the way this server wants them
      const base = proxy.request!;
      proxy.request = (url, opts) => {
        const p = (opts.params ?? {}) as Record<string, any>;
        const { page, start, limit, sort, filter, ...extra } = p;
        const parse = (v: unknown) => { try { return typeof v === 'string' ? JSON.parse(v) : v ?? []; } catch { return []; } };
        return base(url, { ...opts, params: mapParams({ page: Number(page ?? 1), start: Number(start ?? 0), limit: Number(limit ?? 25), sort: parse(sort), filter: parse(filter), extra }) });
      };
    }
    const store = new Store<T>({
      model,
      proxy,
      pageSize: r.pageSize,
      remoteSort: remote,
      remoteFilter: remote,
      ...options
    });
    if (!options) {
      this.stores.set(name, store);
      Store.register(name, store);
    }
    return store;
  }

  /** Make a store for every resource and register them all by name, so views can say `store="users"` */
  register(): Record<string, Store<any>> {
    return Object.fromEntries(Object.keys(this.config.resources ?? {}).map(name => [name, this.store(name)]));
  }
}

export function createApi(config: ApiConfig = {}): Api {
  return new Api(config);
}
