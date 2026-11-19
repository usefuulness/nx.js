/**
 * @file @/data/hal.ts
 * A client for HAL (hypermedia) APIs: start at one address, and everything else is found by following links.
 * Every link on the entry document becomes a store that loads, pages, sorts and saves through the links the
 * server sends, so the client needs no list of URLs.
 */
import { Api, type ApiConfig } from '@/data/api';
import { Proxy, registerProxyType, type ProxyConfig } from '@/data/proxy';
import { Store, type StoreConfig } from '@/data/store';

type Json = Record<string, any>;

export interface HalLink {
  href: string;
  templated?: boolean;
  title?: string;
  name?: string;
  type?: string;
}

// ────────── URI templates (RFC 6570, the forms HAL APIs use) ──────────

const encode = (v: unknown, reserved: boolean) => {
  const s = String(v);
  return reserved ? encodeURI(s).replace(/%5B/g, '[').replace(/%5D/g, ']') : encodeURIComponent(s);
};

/** The variable names in a template: `/orders{?page,size}` → `['page', 'size']` */
export function templateVariables(template: string): string[] {
  const names: string[] = [];
  for (const m of template.matchAll(/\{([^}]+)\}/g)) {
    m[1].replace(/^[+#./;?&]/, '').split(',').forEach(v => names.push(v.replace(/\*$/, '').split(':')[0]));
  }
  return names;
}

/**
 * Fill in a URI template: `{var}`, `{+var}` (reserved characters kept), `{/var}`, `{.var}`, `{?a,b}` and `{&a,b}`,
 * with `*` to explode lists. A variable you leave out is simply not there (and a `?` with nothing after it is dropped).
 */
export function expandTemplate(template: string, vars: Record<string, unknown> = {}): string {
  return template.replace(/\{([^}]+)\}/g, (_m, expr: string) => {
    const op = /^[+#./;?&]/.test(expr) ? expr[0] : '';
    const specs = expr.slice(op.length).split(',').map(v => ({ name: v.replace(/\*$/, '').split(':')[0], explode: v.endsWith('*') }));
    const parts: string[] = [];
    for (const { name, explode } of specs) {
      const value = vars[name];
      if (value === undefined || value === null) continue;
      const list = Array.isArray(value) ? value : [value];
      if (op === '?' || op === '&') {
        if (explode) list.forEach(v => parts.push(`${name}=${encode(v, false)}`));
        else parts.push(`${name}=${list.map(v => encode(v, false)).join(',')}`);
      } else {
        parts.push(list.map(v => encode(v, op === '+' || op === '#')).join(','));
      }
    }
    if (!parts.length) return '';
    switch (op) {
      case '?': return `?${parts.join('&')}`;
      case '&': return `&${parts.join('&')}`;
      case '/': return `/${parts.join('/')}`;
      case '.': return `.${parts.join('.')}`;
      case '#': return `#${parts.join(',')}`;
      default: return parts.join(',');
    }
  });
}

// ────────── A resource ──────────

/** One HAL document: its own data, the links it offers, and the resources embedded in it */
export class HalResource {
  readonly data: Json;
  readonly links: Record<string, HalLink[]>;
  private embeddedRaw: Record<string, Json | Json[]>;
  private client: HalClient;

  constructor(json: unknown, client: HalClient) {
    const { _links, _embedded, ...data } = (json && typeof json === 'object' && !Array.isArray(json) ? json : {}) as Json;
    this.data = data;
    this.client = client;
    this.links = {};
    for (const [rel, value] of Object.entries<any>(_links && typeof _links === 'object' ? _links : {})) {
      const list = (Array.isArray(value) ? value : [value]).filter(l => l && typeof l.href === 'string');
      if (list.length) this.links[rel] = list;
    }
    this.embeddedRaw = _embedded && typeof _embedded === 'object' ? _embedded : {};
  }

  /** The address of this resource (`self`), if it says */
  get self(): string | undefined {
    return this.links.self?.[0]?.href;
  }

  has(rel: string): boolean {
    return this.link(rel) !== undefined;
  }

  /** The link for a relation (the first, when there are several). Names with a prefix (`acme:orders`) also answer to `orders`. */
  link(rel: string): HalLink | undefined {
    return this.linksFor(rel)[0];
  }

  linksFor(rel: string): HalLink[] {
    if (this.links[rel]) return this.links[rel];
    const key = Object.keys(this.links).find(k => localName(k) === rel);
    return key ? this.links[key] : [];
  }

  /** The address for a relation, with a templated link filled in from `vars` */
  href(rel: string, vars: Record<string, unknown> = {}): string {
    const link = this.link(rel);
    if (!link) throw new Error(`No "${rel}" link here. It offers: ${Object.keys(this.links).join(', ') || 'no links'}`);
    return link.templated || /\{[^}]+\}/.test(link.href) ? expandTemplate(link.href, vars) : link.href;
  }

  /** Fetch what a relation points to */
  follow(rel: string, vars: Record<string, unknown> = {}): Promise<HalResource> {
    return this.client.fetch(this.href(rel, vars));
  }

  /** The resources embedded under a relation (none, when it was not embedded) */
  embedded(rel: string): HalResource[] {
    const key = Object.keys(this.embeddedRaw).find(k => k === rel || localName(k) === rel);
    if (!key) return [];
    const v = this.embeddedRaw[key];
    return (Array.isArray(v) ? v : [v]).map(j => new HalResource(j, this.client));
  }

  /** The names embedded in this resource */
  get embeddedNames(): string[] {
    return Object.keys(this.embeddedRaw);
  }

  /** The id: the `id` field, else the last piece of the `self` address */
  id(idProperty = 'id'): string | number | undefined {
    const given = this.data[idProperty];
    if (given !== undefined && given !== null && given !== '') return given;
    const last = this.self?.split('?')[0].split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : undefined;
  }
}

/** `acme:orders` → `orders` */
const localName = (rel: string) => rel.includes(':') && !/^[a-z][a-z0-9+.-]*:\/\//i.test(rel) ? rel.slice(rel.indexOf(':') + 1) : rel;

// ────────── The store's proxy ──────────

export interface HalProxyConfig extends ProxyConfig {
  client: HalClient;
  /** The relation this proxy serves */
  rel: string;
  /** Its address, or URI template */
  href: string;
  /** Are page numbers zero-based on this server (default true, like Spring)? */
  zeroBasedPages?: boolean;
}

const SIZE_NAMES = ['size', 'limit', 'per_page', 'perPage', 'pageSize', 'page_size'];
const PAGE_NAMES = ['page', 'pageNumber', 'page_number'];
const SEARCH_NAMES = ['q', 'query', 'search'];

export class HalProxy<T = any> extends Proxy<T> {
  private hrefs = new Map<string, string>();
  private cfg: HalProxyConfig;

  constructor(config: HalProxyConfig) {
    super(config);
    this.cfg = config;
  }

  private get collection(): string {
    return expandTemplate(this.cfg.href);
  }

  /** What a store's page, sort and search mean in this link's template */
  private variables(params: Record<string, any>): Record<string, unknown> {
    const names = new Set(templateVariables(this.cfg.href));
    const vars: Record<string, unknown> = { ...this.cfg.extraParams };
    const page = PAGE_NAMES.find(n => names.has(n));
    const size = SIZE_NAMES.find(n => names.has(n));
    if (page && params.page !== undefined) vars[page] = Number(params.page) - (this.cfg.zeroBasedPages === false ? 0 : 1);
    if (size && params.limit !== undefined) vars[size] = params.limit;
    const parse = (v: unknown) => { try { return typeof v === 'string' ? JSON.parse(v) : v ?? []; } catch { return []; } };
    const sort = parse(params.sort)[0];
    if (names.has('sort') && sort) vars.sort = `${sort.property},${sort.direction === 'DESC' ? 'desc' : 'asc'}`;
    for (const f of parse(params.filter)) {
      if (f.property === '*') { const q = SEARCH_NAMES.find(n => names.has(n)); if (q) vars[q] = f.value; }
      else if (names.has(f.property)) vars[f.property] = f.value;
    }
    return vars;
  }

  private record(resource: HalResource): any {
    const id = resource.id(this.idProperty);
    const data: Json = { ...resource.data };
    if (id !== undefined && (data[this.idProperty] === undefined || data[this.idProperty] === null)) data[this.idProperty] = id;
    if (id !== undefined && resource.self) this.hrefs.set(String(id), resource.self);
    return data;
  }

  async read(params: any): Promise<any> {
    const resource = await this.cfg.client.fetch(expandTemplate(this.cfg.href, this.variables(params ?? {})));
    const embedded = resource.embedded(this.cfg.rel);
    const items = embedded.length || resource.embeddedNames.includes(this.cfg.rel) ? embedded : resource.embeddedNames.length ? resource.embedded(resource.embeddedNames[0]) : [];
    const total = resource.data.page?.totalElements ?? resource.data.total ?? resource.data.count ?? resource.data.page?.total;
    return { data: items.map(r => this.record(r)), total: typeof total === 'number' ? total : undefined, success: true };
  }

  async create(records: T[]): Promise<T[]> {
    const out: any[] = [];
    for (const r of records) out.push(this.record(await this.cfg.client.send('POST', this.collection, r)));
    return out;
  }

  async update(records: any[]): Promise<any[]> {
    const out: any[] = [];
    for (const r of records) {
      const id = String(r[this.idProperty]);
      const href = this.hrefs.get(id) ?? `${this.collection.replace(/\/+$/, '')}/${encodeURIComponent(id)}`;
      const answer = await this.cfg.client.send('PUT', href, r);
      out.push(Object.keys(answer.data).length ? this.record(answer) : r);
    }
    return out;
  }

  async destroy(ids: Array<string | number>): Promise<void> {
    for (const id of ids) {
      const href = this.hrefs.get(String(id)) ?? `${this.collection.replace(/\/+$/, '')}/${encodeURIComponent(String(id))}`;
      await this.cfg.client.send('DELETE', href);
      this.hrefs.delete(String(id));
    }
  }
}

registerProxyType('hal', config => new HalProxy(config as HalProxyConfig));

// ────────── The client ──────────

const SKIP = new Set(['self', 'curies', 'profile', 'describedby', 'first', 'last', 'next', 'prev', 'previous', 'up', 'search']);

export class HalClient {
  readonly api: Api;
  readonly entry: string;
  private rootPromise: Promise<HalResource> | null = null;
  private stores = new Map<string, Store<any>>();

  constructor(entry: string, config: ApiConfig = {}) {
    this.entry = entry;
    this.api = new Api(config);
  }

  /** Fetch a document and read it as HAL */
  async fetch(href: string): Promise<HalResource> {
    return new HalResource(await this.api.get(href, undefined, { headers: { Accept: 'application/hal+json, application/json' } }), this);
  }

  /** Send a change (POST, PUT, DELETE) and read the answer as HAL (an empty answer is an empty resource) */
  async send(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', href: string, body?: unknown): Promise<HalResource> {
    const answer = await this.api.request(href, { method, body, headers: { Accept: 'application/hal+json, application/json' } });
    return new HalResource(answer, this);
  }

  /** The entry document, fetched once */
  root(): Promise<HalResource> {
    return (this.rootPromise ??= this.fetch(this.entry).catch(e => { this.rootPromise = null; throw e; }));
  }

  /** The relations the entry document offers, by their short names: each is a resource */
  async resources(): Promise<string[]> {
    const root = await this.root();
    return Object.keys(root.links).filter(k => !SKIP.has(k)).map(localName);
  }

  /** Follow relations from the entry: `await hal.follow('orders')`, or `follow(['orders'], { id: 7 })` */
  async follow(rels: string | string[], vars: Record<string, unknown> = {}): Promise<HalResource> {
    let cur = await this.root();
    for (const rel of Array.isArray(rels) ? rels : [rels]) cur = await cur.follow(rel, vars);
    return cur;
  }

  /**
   * A store for a relation on the entry document. It loads by following the link (a template's `page`, `size`
   * and `sort` are filled in), reads the embedded records, and saves with each record's own `self` link.
   * The same store each time; `options` give a separate one.
   */
  async store<T extends Record<string, any> = any>(rel: string, options: Partial<StoreConfig<T>> & { zeroBasedPages?: boolean; idProperty?: string } = {}): Promise<Store<T>> {
    const shared = Object.keys(options).length === 0;
    if (shared && this.stores.has(rel)) return this.stores.get(rel) as Store<T>;
    const root = await this.root();
    const link = root.link(rel);
    if (!link) throw new Error(`The API has no "${rel}" link. It offers: ${(await this.resources()).join(', ')}`);
    const { zeroBasedPages, idProperty, ...rest } = options;
    const names = new Set(templateVariables(link.href));
    const store = new Store<T>({
      idProperty,
      proxy: { type: 'hal', client: this, rel, href: link.href, zeroBasedPages, idProperty } as HalProxyConfig,
      remoteSort: names.has('sort'),
      remoteFilter: SEARCH_NAMES.some(n => names.has(n)),
      ...rest
    });
    if (shared) this.stores.set(rel, store);
    return store;
  }

  /** Make a store for every relation and register them by name, so views can say `store="orders"` */
  async register(): Promise<Record<string, Store<any>>> {
    const out: Record<string, Store<any>> = {};
    for (const rel of await this.resources()) {
      out[rel] = await this.store(rel);
      Store.register(rel, out[rel]);
    }
    return out;
  }
}

/** Make a client for a HAL API from its entry address: `const hal = NX.hal('/api')` */
export function createHal(entry: string, config: ApiConfig = {}): HalClient {
  return new HalClient(entry, config);
}
