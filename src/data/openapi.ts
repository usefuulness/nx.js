/**
 * @file @/data/openapi.ts
 * An API client made from an OpenAPI (3.x) or Swagger (2.0) document: every operation becomes a function,
 * and every collection with its item path becomes a resource, with a model (types, required fields, limits)
 * and the query parameters its list takes already worked out.
 */
import { ajax, AjaxError } from '@/data/proxy';
import { Api, type ApiConfig, type ApiResource } from '@/data/api';
import type { ModelField, ValidatorSpec } from '@/data/model';

type Json = Record<string, any>;

export interface OperationInfo {
  /** The name it is called by: its `operationId` made into an identifier, or `getUsersById` from the method and path */
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** With `{param}` placeholders, below the base URL */
  path: string;
  summary?: string;
  tags: string[];
  parameters: Array<{ name: string; in: 'path' | 'query' | 'header' | 'cookie'; required: boolean }>;
  hasBody: boolean;
}

export interface OpenApiResult {
  baseUrl?: string;
  operations: OperationInfo[];
  resources: Record<string, ApiResource>;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const LIST_KEYS = ['data', 'items', 'results', 'content', 'records', 'rows', 'list'];
const TOTAL_KEYS = ['total', 'totalCount', 'total_count', 'count', 'totalElements', 'total_elements', 'totalItems'];

// ────────── Reading the document ──────────

/** Follow a local `$ref` (`#/components/schemas/User`); a loop or a missing target gives `{}` */
function resolve(node: any, spec: Json, depth = 0): Json {
  let cur = node;
  for (let i = 0; i < 20 && cur && typeof cur === 'object' && typeof cur.$ref === 'string'; i++) {
    const ref: string = cur.$ref;
    if (!ref.startsWith('#/')) return {};
    cur = ref.slice(2).split('/').reduce((o: any, k) => o?.[k.replace(/~1/g, '/').replace(/~0/g, '~')], spec);
  }
  if (!cur || typeof cur !== 'object') return {};
  // allOf: the pieces together; oneOf / anyOf: the first piece that is not just null
  if (depth < 20 && Array.isArray(cur.allOf)) {
    const merged: Json = { ...cur };
    delete merged.allOf;
    for (const part of cur.allOf) {
      const p = resolve(part, spec, depth + 1);
      merged.properties = { ...merged.properties, ...p.properties };
      merged.required = [...(merged.required ?? []), ...(p.required ?? [])];
      for (const k of Object.keys(p)) if (!(k in merged) && k !== 'properties' && k !== 'required') merged[k] = p[k];
    }
    return merged;
  }
  const alt = cur.oneOf ?? cur.anyOf;
  if (depth < 20 && Array.isArray(alt)) {
    const real = alt.map((a: any) => resolve(a, spec, depth + 1)).find((a: Json) => a.type !== 'null');
    if (real) return { ...real, ...(alt.some((a: any) => resolve(a, spec, depth + 1).type === 'null') ? { nullable: true } : {}) };
  }
  return cur;
}

const identifier = (text: string): string => {
  const words = String(text).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  const name = words.map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1))).join('');
  return /^[A-Za-z_]/.test(name) ? name : `op${name}`;
};

const pascal = (t: string) => t.replace(/[^A-Za-z0-9]+(.)?/g, (_m, c) => (c ? c.toUpperCase() : '')).replace(/^./, c => c.toUpperCase());

function baseUrlOf(spec: Json): string | undefined {
  if (Array.isArray(spec.servers) && spec.servers[0]?.url) {
    const s = spec.servers[0];
    return String(s.url).replace(/\{(\w+)\}/g, (_m, k) => String(s.variables?.[k]?.default ?? ''));
  }
  if (spec.swagger && (spec.host || spec.basePath)) {
    const scheme = (spec.schemes ?? ['https'])[0];
    return `${spec.host ? `${scheme}://${spec.host}` : ''}${spec.basePath && spec.basePath !== '/' ? spec.basePath : ''}` || undefined;
  }
  return undefined;
}

function jsonSchemaOf(content: Json | undefined, spec: Json): Json | undefined {
  if (!content) return undefined;
  const entry = content['application/json'] ?? Object.entries(content).find(([k]) => /json/.test(k))?.[1];
  return entry?.schema ? resolve(entry.schema, spec) : undefined;
}

function responseSchema(op: Json, spec: Json): Json | undefined {
  const responses = op.responses ?? {};
  const ok = responses['200'] ?? responses['201'] ?? responses.default ?? Object.entries(responses).find(([k]) => /^2/.test(k))?.[1];
  const r = resolve(ok, spec);
  return jsonSchemaOf(r.content, spec) ?? (r.schema ? resolve(r.schema, spec) : undefined); // Swagger 2 has `schema` right there
}

function bodySchema(op: Json, spec: Json): Json | undefined {
  const rb = resolve(op.requestBody, spec);
  return jsonSchemaOf(rb.content, spec) ?? (op.parameters ?? []).map((p: any) => resolve(p, spec)).find((p: Json) => p.in === 'body')?.schema;
}

// ────────── Models from schemas ──────────

function fieldsOf(schema: Json, spec: Json): ModelField[] {
  const props: Json = schema.properties ?? {};
  const required = new Set<string>(schema.required ?? []);
  return Object.entries(props).map(([name, raw]) => {
    const s = resolve(raw, spec);
    const types: string[] = Array.isArray(s.type) ? s.type : [s.type];
    const type = types.find(t => t && t !== 'null');
    const field: ModelField = { name };
    if (type === 'integer') field.type = 'int';
    else if (type === 'number') field.type = 'float';
    else if (type === 'boolean') field.type = 'boolean';
    else if (type === 'string') field.type = s.format === 'date' || s.format === 'date-time' ? 'date' : 'string';
    if (s.nullable === true || types.includes('null')) field.allowNull = true;
    if (s.default !== undefined) field.defaultValue = s.default;
    if (s.readOnly === true) field.persist = false;
    const validators: ValidatorSpec[] = [];
    if (required.has(name) && s.readOnly !== true) validators.push('presence');
    if (type === 'string') {
      if (s.minLength !== undefined || s.maxLength !== undefined) validators.push({ type: 'length', min: s.minLength, max: s.maxLength });
      if (s.format === 'email') validators.push('email');
      else if (s.format === 'uri' || s.format === 'url') validators.push('url');
      if (typeof s.pattern === 'string') { try { validators.push({ type: 'format', matcher: new RegExp(s.pattern) }); } catch { /* a pattern JavaScript does not understand: skip it */ } }
    }
    if ((type === 'integer' || type === 'number') && (s.minimum !== undefined || s.maximum !== undefined)) validators.push({ type: 'range', min: s.minimum, max: s.maximum });
    if (Array.isArray(s.enum)) validators.push({ type: 'inclusion', list: s.enum });
    if (validators.length) field.validators = validators;
    return field;
  });
}

// ────────── Query parameters for a list ──────────

const first = (names: Set<string>, options: string[]) => options.find(o => names.has(o));

/** Work out how a store's page, sort and search become this list's own query parameters */
function mapperFor(names: Set<string>): ApiResource['mapParams'] | undefined {
  const limit = first(names, ['limit', 'per_page', 'perPage', 'pageSize', 'page_size', 'size', 'take']);
  const page = first(names, ['page', 'pageNumber', 'page_number']);
  const offset = first(names, ['offset', 'skip', 'start']);
  const sort = first(names, ['sort', 'sortBy', 'sort_by', 'orderBy', 'order_by', 'order']);
  const dir = first(names, ['sortOrder', 'sort_order', 'direction', 'dir', 'order']);
  const search = first(names, ['q', 'query', 'search', 'filter']);
  if (!limit && !page && !offset && !sort && !search) return undefined;
  return s => {
    const out: Record<string, any> = { ...s.extra };
    if (limit) out[limit] = s.limit;
    if (page) out[page] = s.page;
    else if (offset) out[offset] = s.start;
    const by = s.sort[0];
    if (sort && by) {
      const separate = dir && dir !== sort;
      out[sort] = separate ? by.property : by.direction === 'DESC' ? `-${by.property}` : by.property;
      if (separate) out[dir!] = by.direction === 'DESC' ? 'desc' : 'asc';
    }
    for (const f of s.filter) {
      if (f.property === '*' && search) out[search] = f.value;
      else if (names.has(f.property)) out[f.property] = f.value;
    }
    return out;
  };
}

// ────────── The whole document ──────────

/** Read a document: its base URL, every operation, and the resources it describes */
export function readOpenApi(specification: unknown): OpenApiResult {
  if (!specification || typeof specification !== 'object') throw new Error('That is not an OpenAPI document (expected an object)');
  const spec = specification as Json;
  if (!spec.openapi && !spec.swagger) throw new Error('That is not an OpenAPI document: it has neither "openapi" nor "swagger"');
  const operations: OperationInfo[] = [];
  const raw: Record<string, Json> = {};
  const taken = new Set<string>();

  for (const [path, item] of Object.entries<Json>(spec.paths ?? {})) {
    if (!item || typeof item !== 'object') continue;
    const shared = (item.parameters ?? []).map((p: any) => resolve(p, spec));
    for (const m of METHODS) {
      const op = item[m] as Json | undefined;
      if (!op) continue;
      const params = [...shared, ...(op.parameters ?? []).map((p: any) => resolve(p, spec))]
        .filter((p: Json) => ['path', 'query', 'header', 'cookie'].includes(p.in));
      // An operation's own parameter replaces a shared one of the same name and place
      const unique = new Map<string, Json>(params.map((p: Json) => [`${p.in}:${p.name}`, p]));
      // `listPets` from the document, or `getPetsByPetId` made from the method and the path
      let name = op.operationId
        ? identifier(op.operationId)
        : identifier(`${m} ${path.split('/').filter(Boolean).map(seg => (seg.startsWith('{') ? `by ${pascal(seg.slice(1, -1))}` : pascal(seg))).join(' ')}`);
      for (let n = 2; taken.has(name); n++) name = `${name}${n}`;
      taken.add(name);
      operations.push({
        name, method: m.toUpperCase() as OperationInfo['method'], path, summary: op.summary, tags: op.tags ?? [],
        parameters: [...unique.values()].map(p => ({ name: p.name, in: p.in, required: p.in === 'path' || p.required === true })),
        hasBody: !!(op.requestBody || (op.parameters ?? []).some((p: any) => resolve(p, spec).in === 'body'))
      });
      raw[`${m} ${path}`] = { ...op, parameters: [...unique.values()] };
    }
  }

  // Resources: a collection you can list, with (usually) an item path below it
  const resources: Record<string, ApiResource> = {};
  for (const [path] of Object.entries<Json>(spec.paths ?? {})) {
    const list = raw[`get ${path}`];
    if (!list || /\{[^}]+\}\s*$/.test(path)) continue;
    const segment = path.split('/').filter(s => s && !s.startsWith('{')).pop();
    if (!segment) continue;
    let name = segment;
    for (let n = 2; resources[name]; n++) name = `${segment}${n}`;

    const response = responseSchema(list, spec);
    let itemsSchema: Json | undefined;
    let reader: ApiResource['reader'];
    if (response?.type === 'array') itemsSchema = resolve(response.items, spec);
    else if (response?.properties) {
      const key = LIST_KEYS.find(k => resolve(response.properties[k], spec).type === 'array')
        ?? Object.keys(response.properties).find(k => resolve(response.properties[k], spec).type === 'array');
      if (key) {
        itemsSchema = resolve(resolve(response.properties[key], spec).items, spec);
        const total = TOTAL_KEYS.find(k => k in response.properties);
        reader = { rootProperty: key, ...(total ? { totalProperty: total } : {}) };
      }
    }

    const itemPath = Object.keys(spec.paths).find(p => p.startsWith(`${path.replace(/\/+$/, '')}/{`) && /^\/\{[^}/]+\}$/.test(p.slice(path.replace(/\/+$/, '').length)));
    const idParam = itemPath ? itemPath.slice(itemPath.lastIndexOf('{') + 1, -1) : undefined;
    const itemOp = itemPath ? raw[`get ${itemPath}`] : undefined;
    const schema = (itemOp && responseSchema(itemOp, spec)) || bodySchema(raw[`post ${path}`] ?? {}, spec) || itemsSchema;
    const fields = schema?.properties ? fieldsOf(schema, spec) : undefined;
    const idProperty = idParam && schema?.properties?.[idParam] ? idParam : schema?.properties?.id ? 'id' : idParam ?? 'id';

    resources[name] = {
      path,
      ...(fields?.length ? { fields } : {}),
      ...(reader ? { reader } : {}),
      idProperty,
      mapParams: mapperFor(new Set((list.parameters ?? []).filter((p: Json) => p.in === 'query').map((p: Json) => p.name)))
    };
  }
  return { baseUrl: baseUrlOf(spec), operations, resources };
}

// ────────── The client ──────────

export type OperationCall<T = any> = (params?: Record<string, any>, body?: unknown) => Promise<T>;

export class OpenApiClient extends Api {
  /** Every operation, by its name: `api.operations.listUsers({ limit: 10 })`, `api.operations.updateUser({ id: 7 }, { name: 'Ada' })` */
  readonly operations: Record<string, OperationCall> = {};
  readonly operationInfo: OperationInfo[];
  readonly document: unknown;

  constructor(specification: unknown, config: ApiConfig = {}) {
    const read = readOpenApi(specification);
    super({ ...config, baseUrl: config.baseUrl ?? read.baseUrl, resources: { ...read.resources, ...config.resources } });
    this.document = specification;
    this.operationInfo = read.operations;
    for (const op of read.operations) this.operations[op.name] = (params, body) => this.call(op.name, params, body);
  }

  /** Call an operation. Path, query and header parameters go in one object by name; the JSON body is the second argument. */
  async call<T = any>(name: string, params: Record<string, any> = {}, body?: unknown): Promise<T> {
    const op = this.operationInfo.find(o => o.name === name);
    if (!op) throw new Error(`The API has no operation "${name}"`);
    let path = op.path;
    const query: Record<string, any> = {};
    const headers: Record<string, string> = {};
    for (const p of op.parameters) {
      const v = params[p.name];
      if (v === undefined || v === null) {
        if (p.required) throw new Error(`${name}: the "${p.name}" ${p.in} parameter is required`);
        continue;
      }
      if (p.in === 'path') path = path.replace(`{${p.name}}`, encodeURIComponent(String(v)));
      else if (p.in === 'query') query[p.name] = v;
      else if (p.in === 'header') headers[p.name] = String(v);
    }
    const known = new Set(op.parameters.map(p => p.name));
    // `{ body }` among the parameters works too, unless the API has a parameter of that name
    const payload = body !== undefined ? body : op.hasBody && !known.has('body') ? params.body : undefined;
    return this.request<T>(path, { method: op.method, params: query, body: payload, headers, as: op.method === 'DELETE' ? 'none' : 'json' });
  }
}

/**
 * Make a client from an OpenAPI document: an object, a JSON string, or the URL of a JSON document (fetched through
 * the client's own base URL, headers and sign-in only when you pass `config`). YAML is not read: convert it to JSON first.
 */
export async function openApiClient(source: string | object, config: ApiConfig = {}): Promise<OpenApiClient> {
  let document: unknown = source;
  if (typeof source === 'string') {
    const text = source.trim();
    if (text.startsWith('{')) {
      try { document = JSON.parse(text); } catch { throw new Error('That is not valid JSON'); }
    } else if (/^(https?:\/\/|\/|\.\/)/.test(text)) {
      try {
        document = await ajax(text, { headers: typeof config.headers === 'object' ? config.headers : undefined, timeout: config.timeout });
      } catch (e) {
        throw new Error(`Could not read the OpenAPI document at ${text}: ${(e as AjaxError).message}`);
      }
      // A `servers` address without a scheme or a leading slash is relative to where the document was served
      const declared = readOpenApi(document).baseUrl;
      if (!config.baseUrl && declared && !/^([a-z][a-z0-9+.-]*:)?\/|^$/i.test(declared)) {
        const from = new URL(text, typeof location !== 'undefined' ? location.href : 'http://localhost/');
        config = { ...config, baseUrl: new URL(declared.replace(/\/*$/, '/'), from).href.replace(/\/$/, '') };
      }
    } else {
      throw new Error('YAML is not read here: pass the document as JSON (an object, a JSON string, or a URL that serves JSON)');
    }
  }
  return new OpenApiClient(document, config);
}
