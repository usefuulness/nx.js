/**
 * A small server that lives in the page, so the showcase can show real requests without a backend.
 * It answers `fetch()` calls to `…/__mock__/…` (anything else goes to the network as usual):
 *
 *   openapi.json     an OpenAPI 3 document for the pets API
 *   v1/pets          the pets API: list (limit, offset, sort, q, species), create, read, update, delete
 *   hal/             a HAL API: books, authors, with templated links and embedded records
 *   tree             folders whose children load when first opened
 *
 * It sorts, filters, pages and validates like a server would, and takes a moment to answer.
 */

export interface MockRequest {
  method: string;
  /** Path and query, as sent */
  url: string;
  status: number;
  ms: number;
}

type Listener = (request: MockRequest) => void;
const listeners = new Set<Listener>();

/** Hear about every request the mock server answered */
export function onMockRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ────────── Data ──────────

const PET_NAMES = ['Rex', 'Misty', 'Biscuit', 'Olive', 'Pixel', 'Juno', 'Mochi', 'Ziggy', 'Pepper', 'Nova', 'Waffles', 'Clover', 'Maple', 'Otis', 'Ruby', 'Finn', 'Luna', 'Cosmo', 'Hazel', 'Archie'];
const SPECIES = ['cat', 'dog', 'rabbit'];

function makePets() {
  return Array.from({ length: 48 }, (_, i) => ({
    id: i + 1,
    name: `${PET_NAMES[i % PET_NAMES.length]}${i >= PET_NAMES.length ? ` ${Math.floor(i / PET_NAMES.length) + 1}` : ''}`,
    species: SPECIES[(i * 7 + 2) % 3],
    age: (i * 5 + 3) % 15,
    adopted: i % 3 === 0,
    born: new Date(Date.UTC(2026 - ((i * 5 + 3) % 15), (i * 7) % 12, 1 + ((i * 11) % 27))).toISOString().slice(0, 10)
  }));
}

const TITLES = ['The Quiet Orchard', 'Salt and Signal', 'A Map of Small Hours', 'Lanterns over Tabor', 'Paper Kingdoms', 'The Last Telegraph', 'Winter Grammar', 'Harbour Lights', 'Cartographers of Rain', 'The Glass Almanac', 'Night Trains to Aral', 'Notes from the Weir'];
const AUTHORS = ['Ada Okafor', 'Bram Visser', 'Chiara Rossi', 'Dmitri Volkov', 'Elena Park', 'Farid Haddad', 'Greta Lund', 'Hiro Tanaka'];

function makeBooks() {
  return Array.from({ length: 37 }, (_, i) => ({
    id: i + 1,
    title: `${TITLES[i % TITLES.length]}${i >= TITLES.length ? ` ${['II', 'III', 'IV'][Math.floor(i / TITLES.length) - 1]}` : ''}`,
    year: 1978 + ((i * 7) % 46),
    pages: 160 + ((i * 53) % 420),
    author: (i * 3) % AUTHORS.length + 1
  }));
}

const FOLDERS: Record<string, unknown[]> = {
  pictures: [{ id: 'holiday', name: 'Holiday', leaf: false }, { id: 'screenshots', name: 'Screenshots', leaf: false }, { id: 'cover', name: 'cover.png', leaf: true }],
  holiday: [{ id: 'h-1', name: 'beach.jpg', leaf: true }, { id: 'h-2', name: 'market.jpg', leaf: true }, { id: 'h-3', name: 'sunset.jpg', leaf: true }],
  screenshots: [{ id: 's-1', name: 'dashboard.png', leaf: true }, { id: 's-2', name: 'settings.png', leaf: true }],
  music: [{ id: 'albums', name: 'Albums', leaf: false }, { id: 'mu-2', name: 'playlist.m3u', leaf: true }],
  albums: [{ id: 'a-1', name: 'Blue Hour.flac', leaf: true }, { id: 'a-2', name: 'Low Tide.flac', leaf: true }]
};

// ────────── The pets API (OpenAPI) ──────────

/** The OpenAPI document the pets API serves */
export function petsSpec(): Record<string, unknown> {
  const pet = { $ref: '#/components/schemas/Pet' };
  return {
    openapi: '3.0.3',
    info: { title: 'Pets', version: '1.0.0', description: 'A small API with a list, an item and validation.' },
    servers: [{ url: 'v1' }],
    paths: {
      '/pets': {
        get: {
          operationId: 'listPets', summary: 'List pets',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
            { name: 'sort', in: 'query', schema: { type: 'string' }, description: 'A field name; prefix with - for descending' },
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search by name' },
            { name: 'species', in: 'query', schema: { type: 'string', enum: SPECIES } }
          ],
          responses: { 200: { content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array', items: pet }, total: { type: 'integer' } } } } } } }
        },
        post: { operationId: 'createPet', summary: 'Add a pet', requestBody: { content: { 'application/json': { schema: pet } } }, responses: { 201: { content: { 'application/json': { schema: pet } } }, 422: { description: 'Not valid' } } }
      },
      '/pets/{petId}': {
        parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'integer' } }],
        get: { operationId: 'getPet', summary: 'One pet', responses: { 200: { content: { 'application/json': { schema: pet } } } } },
        put: { operationId: 'updatePet', summary: 'Change a pet', requestBody: { content: { 'application/json': { schema: pet } } }, responses: { 200: { content: { 'application/json': { schema: pet } } } } },
        delete: { operationId: 'deletePet', summary: 'Remove a pet', responses: { 204: { description: 'Gone' } } }
      }
    },
    components: {
      schemas: {
        Pet: {
          type: 'object', required: ['name', 'species'],
          properties: {
            id: { type: 'integer', readOnly: true },
            name: { type: 'string', minLength: 2, maxLength: 20 },
            species: { type: 'string', enum: SPECIES },
            age: { type: 'integer', minimum: 0, maximum: 30, default: 1 },
            adopted: { type: 'boolean' },
            born: { type: 'string', format: 'date' }
          }
        }
      }
    }
  };
}

type Params = URLSearchParams;
const json = (status: number, body: unknown) => ({ status, body });

function sortRows<T extends Record<string, any>>(rows: T[], sort: string | null): T[] {
  if (!sort) return rows;
  const desc = sort.startsWith('-');
  const key = desc ? sort.slice(1) : sort;
  return [...rows].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (desc ? -1 : 1));
}

function validatePet(body: any): Record<string, string> {
  const errors: Record<string, string> = {};
  if (typeof body?.name !== 'string' || body.name.length < 2) errors.name = 'Use at least 2 characters';
  else if (body.name.length > 20) errors.name = 'Use at most 20 characters';
  if (!SPECIES.includes(body?.species)) errors.species = 'This is not one of the allowed values';
  if (body?.age !== undefined && (!Number.isInteger(Number(body.age)) || Number(body.age) < 0 || Number(body.age) > 30)) errors.age = 'Must be between 0 and 30';
  return errors;
}

function petsApi(method: string, path: string[], params: Params, body: any, state: State) {
  if (path.length === 0) {
    if (method === 'GET') {
      let rows = state.pets;
      const q = params.get('q')?.toLowerCase();
      if (q) rows = rows.filter(p => p.name.toLowerCase().includes(q));
      if (params.get('species')) rows = rows.filter(p => p.species === params.get('species'));
      rows = sortRows(rows, params.get('sort'));
      const offset = Number(params.get('offset') ?? 0);
      const limit = Number(params.get('limit') ?? 10);
      return json(200, { items: rows.slice(offset, offset + limit), total: rows.length });
    }
    if (method === 'POST') {
      const errors = validatePet(body);
      if (Object.keys(errors).length) return json(422, { message: Object.values(errors)[0], errors });
      const pet = { adopted: false, age: 1, born: null, ...body, id: Math.max(0, ...state.pets.map(p => p.id)) + 1 };
      state.pets.push(pet);
      return json(201, pet);
    }
  } else {
    const pet = state.pets.find(p => String(p.id) === path[0]);
    if (!pet) return json(404, { message: `No pet ${path[0]}` });
    if (method === 'GET') return json(200, pet);
    if (method === 'PUT') {
      const next = { ...pet, ...body, id: pet.id };
      const errors = validatePet(next);
      if (Object.keys(errors).length) return json(422, { message: Object.values(errors)[0], errors });
      Object.assign(pet, next);
      return json(200, pet);
    }
    if (method === 'DELETE') { state.pets.splice(state.pets.indexOf(pet), 1); return json(204, undefined); }
  }
  return json(405, { message: 'Method not allowed' });
}

// ────────── The books API (HAL) ──────────

const HAL = 'hal';

function halApi(method: string, path: string[], params: Params, state: State, base: string) {
  const link = (href: string, extra: object = {}) => ({ href: `${base}${href}`, ...extra });
  if (path.length === 0) {
    return json(200, {
      title: 'Library',
      _links: {
        self: link(`${HAL}/`),
        books: link(`${HAL}/books{?page,size,sort,q}`, { templated: true, title: 'All books' }),
        authors: link(`${HAL}/authors`, { title: 'The people who wrote them' })
      }
    });
  }
  const bookRes = (b: ReturnType<typeof makeBooks>[number]) => ({ ...b, author: undefined, _links: { self: link(`${HAL}/books/${b.id}`), author: link(`${HAL}/authors/${b.author}`, { title: AUTHORS[b.author - 1] }) } });
  if (path[0] === 'books') {
    if (path.length === 1) {
      let rows = state.books;
      const q = params.get('q')?.toLowerCase();
      if (q) rows = rows.filter(b => b.title.toLowerCase().includes(q));
      const [field, dir] = (params.get('sort') ?? '').split(',');
      if (field) rows = sortRows(rows, `${dir === 'desc' ? '-' : ''}${field}`);
      const size = Number(params.get('size') ?? 10);
      const page = Number(params.get('page') ?? 0);
      const last = Math.max(0, Math.ceil(rows.length / size) - 1);
      const url = (p: number) => `${HAL}/books?page=${p}&size=${size}`;
      return json(200, {
        _embedded: { books: rows.slice(page * size, page * size + size).map(bookRes) },
        _links: { self: link(url(page)), first: link(url(0)), last: link(url(last)), ...(page > 0 ? { prev: link(url(page - 1)) } : {}), ...(page < last ? { next: link(url(page + 1)) } : {}) },
        page: { size, totalElements: rows.length, totalPages: last + 1, number: page }
      });
    }
    const book = state.books.find(b => String(b.id) === path[1]);
    if (!book) return json(404, { message: `No book ${path[1]}` });
    if (method === 'GET') return json(200, bookRes(book));
  }
  if (path[0] === 'authors') {
    const rec = (i: number) => ({ id: i + 1, name: AUTHORS[i], books: state.books.filter(b => b.author === i + 1).length, _links: { self: link(`${HAL}/authors/${i + 1}`), books: link(`${HAL}/books{?q}`, { templated: true }) } });
    if (path.length === 1) return json(200, { _embedded: { authors: AUTHORS.map((_, i) => rec(i)) }, _links: { self: link(`${HAL}/authors`) } });
    const i = Number(path[1]) - 1;
    return AUTHORS[i] ? json(200, rec(i)) : json(404, { message: `No author ${path[1]}` });
  }
  return json(404, { message: 'Not found' });
}

// ────────── The server ──────────

interface State { pets: ReturnType<typeof makePets>; books: ReturnType<typeof makeBooks> }

const MARK = '/__mock__/';

/** How long a response takes: a stable 90–280 ms for a given address, so it feels like a network without being random */
function latency(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return 90 + (h % 190);
}

export interface MockServerOptions {
  /** Skip the pause (tests) */
  instant?: boolean;
}

/**
 * Answer requests to `…/__mock__/…` in memory. Returns a function that puts the real `fetch` back.
 * Call it once; `reset()` on the result puts the data back as it started.
 */
export function installMockServer(options: MockServerOptions = {}): (() => void) & { reset(): void } {
  const real = globalThis.fetch;
  let state: State = { pets: makePets(), books: makeBooks() };

  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const at = href.indexOf(MARK);
    if (at < 0) return real(input as RequestInfo, init);

    const started = performance.now();
    const method = (init.method ?? 'GET').toUpperCase();
    const url = new URL(href, 'http://mock.local');
    const rest = url.pathname.slice(url.pathname.indexOf(MARK) + MARK.length).split('/').filter(Boolean);
    const baseHref = href.slice(0, at + MARK.length);
    // Links the server sends are absolute paths below the mock root, so they work wherever the page lives
    const base = new URL(baseHref, typeof location !== 'undefined' ? location.href : 'http://mock.local').pathname;
    let body: any;
    try { body = init.body ? JSON.parse(String(init.body)) : undefined; } catch { body = undefined; }

    let result: { status: number; body: unknown };
    if (rest[0] === 'openapi.json') result = json(200, petsSpec());
    else if (rest[0] === 'v1' && rest[1] === 'pets') result = petsApi(method, rest.slice(2), url.searchParams, body, state);
    else if (rest[0] === HAL) result = halApi(method, rest.slice(1), url.searchParams, state, base);
    else if (rest[0] === 'tree') {
      const node = (url.searchParams.get('node') ?? '').toLowerCase();
      result = FOLDERS[node] ? json(200, { data: FOLDERS[node] }) : json(404, { message: `No folder ${node}` });
    } else result = json(404, { message: 'Not found' });

    if (!options.instant) await new Promise(r => setTimeout(r, latency(`${method} ${url.pathname}${url.search}`)));
    const ms = Math.round(performance.now() - started);
    listeners.forEach(l => l({ method, url: url.pathname.replace(/^.*\/__mock__/, '') + url.search, status: result.status, ms }));
    const text = result.body === undefined ? '' : JSON.stringify(result.body);
    return new Response(result.status === 204 ? null : text, { status: result.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const restore = Object.assign(() => { globalThis.fetch = real; }, { reset: () => { state = { pets: makePets(), books: makeBooks() }; } });
  return restore;
}
