import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readOpenApi, openApiClient, OpenApiClient } from '@/data/openapi';
import { Store } from '@/data/store';

const spec = () => ({
  openapi: '3.0.3',
  info: { title: 'Pets', version: '1' },
  servers: [{ url: 'https://{host}/v2', variables: { host: { default: 'api.pets.test' } } }],
  paths: {
    '/pets': {
      get: {
        operationId: 'list-pets',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'offset', in: 'query', schema: { type: 'integer' } },
          { name: 'sort', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'species', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Pet' } } } } } }
      },
      post: { operationId: 'createPet', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/NewPet' } } } }, responses: { 201: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } } } }
    },
    '/pets/{petId}': {
      parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'integer' } }],
      get: { operationId: 'getPet', responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } } } },
      put: { operationId: 'updatePet', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/NewPet' } } } }, responses: { 200: { description: 'ok' } } },
      delete: { operationId: 'deletePet', parameters: [{ name: 'X-Reason', in: 'header', schema: { type: 'string' } }], responses: { 204: { description: 'gone' } } }
    },
    '/owners': {
      get: {
        parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'per_page', in: 'query', schema: { type: 'integer' } }, { name: 'order_by', in: 'query', schema: { type: 'string' } }, { name: 'direction', in: 'query', schema: { type: 'string' } }],
        responses: { 200: { content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Owner' } }, totalCount: { type: 'integer' } } } } } } }
      }
    },
    '/owners/{ownerId}': { get: { parameters: [{ name: 'ownerId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Owner' } } } } } } },
    '/health': { get: { responses: { 200: { description: 'ok' } } } }
  },
  components: {
    schemas: {
      Base: { type: 'object', required: ['name'], properties: { id: { type: 'integer', readOnly: true }, name: { type: 'string', minLength: 2, maxLength: 20 } } },
      NewPet: { allOf: [{ $ref: '#/components/schemas/Base' }, { type: 'object', properties: { species: { type: 'string', enum: ['cat', 'dog'] }, age: { type: 'integer', minimum: 0, maximum: 40, default: 1 }, born: { type: 'string', format: 'date' }, owner: { type: 'string', nullable: true }, weight: { type: 'number' }, vaccinated: { type: 'boolean' }, email: { type: 'string', format: 'email' }, site: { type: 'string', format: 'uri' }, code: { type: 'string', pattern: '^[A-Z]{3}$' }, tags: { type: 'array', items: { type: 'string' } } } }] },
      Pet: { allOf: [{ $ref: '#/components/schemas/NewPet' }] },
      Owner: { type: 'object', properties: { ownerId: { type: 'string' }, name: { type: 'string' } } }
    }
  }
});

describe('readOpenApi', () => {
  it('gets the base URL from the servers, filling in variables', () => {
    expect(readOpenApi(spec()).baseUrl).toBe('https://api.pets.test/v2');
  });

  it('names operations from operationId or from the method and path, and keeps them apart', () => {
    const names = readOpenApi(spec()).operations.map(o => o.name);
    expect(names).toEqual(['listPets', 'createPet', 'getPet', 'updatePet', 'deletePet', 'getOwners', 'getOwnersByOwnerId', 'getHealth']);
    const dup = spec(); (dup.paths['/health'].get as any).operationId = 'getOwners';
    expect(new Set(readOpenApi(dup).operations.map(o => o.name)).size).toBe(8);
  });

  it('knows each operation\'s parameters, shared ones included, and whether it takes a body', () => {
    const ops = Object.fromEntries(readOpenApi(spec()).operations.map(o => [o.name, o]));
    expect(ops.getPet.parameters).toEqual([{ name: 'petId', in: 'path', required: true }]);
    expect(ops.deletePet.parameters.map(p => p.name).sort()).toEqual(['X-Reason', 'petId']);
    expect(ops.listPets.parameters.every(p => p.in === 'query' && !p.required)).toBe(true);
    expect(ops.createPet.hasBody).toBe(true);
    expect(ops.getPet.hasBody).toBe(false);
  });

  it('finds the resources: a list with its item path', () => {
    const { resources } = readOpenApi(spec());
    expect(Object.keys(resources).sort()).toEqual(['health', 'owners', 'pets']);
    expect(resources.pets.path).toBe('/pets');
    expect(resources.pets.idProperty).toBe('id');
    expect(resources.owners.idProperty).toBe('ownerId');
  });

  it('works out the reader when a list is wrapped, and none when it is a bare array', () => {
    const { resources } = readOpenApi(spec());
    expect(resources.owners.reader).toEqual({ rootProperty: 'items', totalProperty: 'totalCount' });
    expect(resources.pets.reader).toBeUndefined();
  });

  it('turns schemas into typed fields with their rules', () => {
    const fields = Object.fromEntries((readOpenApi(spec()).resources.pets.fields as any[]).map(f => [f.name, f]));
    expect(fields.id).toMatchObject({ type: 'int', persist: false });
    expect(fields.id.validators).toBeUndefined();               // read-only: never required of the user
    expect(fields.name.validators).toEqual(['presence', { type: 'length', min: 2, max: 20 }]);
    expect(fields.species.validators).toEqual([{ type: 'inclusion', list: ['cat', 'dog'] }]);
    expect(fields.age).toMatchObject({ type: 'int', defaultValue: 1 });
    expect(fields.age.validators).toEqual([{ type: 'range', min: 0, max: 40 }]);
    expect(fields.born.type).toBe('date');
    expect(fields.owner.allowNull).toBe(true);
    expect(fields.weight.type).toBe('float');
    expect(fields.vaccinated.type).toBe('boolean');
    expect(fields.email.validators).toEqual(['email']);
    expect(fields.site.validators).toEqual(['url']);
    expect(fields.code.validators![0]).toMatchObject({ type: 'format' });
    expect(fields.tags.type).toBeUndefined();
  });

  it('works out the list parameters: limit/offset/sort/search, and page/per_page/order_by/direction', () => {
    const { resources } = readOpenApi(spec());
    const state = { page: 3, start: 20, limit: 10, sort: [{ property: 'name', direction: 'DESC' as const }], filter: [{ property: '*', value: 'rex' }, { property: 'species', value: 'dog' }], extra: {} };
    expect(resources.pets.mapParams!(state)).toEqual({ limit: 10, offset: 20, sort: '-name', q: 'rex', species: 'dog' });
    expect(resources.owners.mapParams!(state)).toEqual({ per_page: 10, page: 3, order_by: 'name', direction: 'desc' });
    expect(resources.health.mapParams).toBeUndefined();
  });

  it('survives a loop in $ref, a missing $ref, and odd shapes', () => {
    const odd: any = { openapi: '3.0.0', paths: { '/a': { get: { responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Loop' } } } } } } }, '/b': { get: { responses: { 200: { content: { 'application/json': { schema: { $ref: '#/nope' } } } } } } }, '/c': null }, components: { schemas: { Loop: { $ref: '#/components/schemas/Loop' } } } };
    expect(() => readOpenApi(odd)).not.toThrow();
    expect(readOpenApi({ openapi: '3.0.0' }).operations).toEqual([]);
  });

  it('reads Swagger 2: definitions, inline response schemas, body parameters and host/basePath', () => {
    const sw: any = {
      swagger: '2.0', host: 'old.test', basePath: '/api', schemes: ['https'],
      paths: {
        '/items': { get: { operationId: 'listItems', responses: { 200: { schema: { type: 'array', items: { $ref: '#/definitions/Item' } } } } }, post: { parameters: [{ in: 'body', name: 'b', schema: { $ref: '#/definitions/Item' } }], responses: { 201: { schema: { $ref: '#/definitions/Item' } } } } },
        '/items/{id}': { get: { parameters: [{ name: 'id', in: 'path', required: true, type: 'string' }], responses: { 200: { schema: { $ref: '#/definitions/Item' } } } } }
      },
      definitions: { Item: { type: 'object', required: ['title'], properties: { id: { type: 'string' }, title: { type: 'string' } } } }
    };
    const r = readOpenApi(sw);
    expect(r.baseUrl).toBe('https://old.test/api');
    expect(r.resources.items.fields!.map((f: any) => f.name)).toEqual(['id', 'title']);
    expect(r.operations.find(o => o.name === 'createItems' || o.method === 'POST')!.hasBody).toBe(true);
  });

  it('refuses what is not an OpenAPI document', () => {
    expect(() => readOpenApi(null)).toThrow(/not an OpenAPI/);
    expect(() => readOpenApi({ info: {} })).toThrow(/neither "openapi" nor "swagger"/);
  });
});

describe('OpenApiClient', () => {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }> = [];
  let answer: (url: string, init: RequestInit) => { status?: number; body?: unknown } = () => ({ body: {} });
  beforeEach(() => {
    calls.length = 0; answer = () => ({ body: {} });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method ?? 'GET', headers: { ...(init.headers as Record<string, string>) }, body: init.body as string | undefined });
      const r = answer(url, init); const status = r.status ?? 200;
      return { ok: status < 300, status, statusText: '', text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) } as Response;
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });
  const make = (config = {}) => new OpenApiClient(spec(), { auth: { token: () => 'tk' }, ...config });

  it('calls an operation: path parameter in the path, the rest in the query and headers, JSON body second', async () => {
    const api = make();
    await api.operations.listPets({ limit: 5, species: 'cat', ignored: 1 });
    await api.operations.getPet({ petId: 'a b' });
    await api.operations.updatePet({ petId: 7 }, { name: 'Rex' });
    await api.operations.deletePet({ petId: 7, 'X-Reason': 'sold' });
    expect(calls.map(c => `${c.method} ${new URL(c.url).pathname}${new URL(c.url).search}`)).toEqual([
      'GET /v2/pets?limit=5&species=cat', 'GET /v2/pets/a%20b', 'PUT /v2/pets/7', 'DELETE /v2/pets/7'
    ]);
    expect(calls[2].body).toBe('{"name":"Rex"}');
    expect(calls[3].headers['X-Reason']).toBe('sold');
    expect(calls[0].headers.Authorization).toBe('Bearer tk'); // the client's own sign-in applies
  });

  it('takes the body from { body } among the parameters too', async () => {
    await make().operations.createPet({ body: { name: 'Tom' } });
    expect(calls[0].body).toBe('{"name":"Tom"}');
  });

  it('refuses a missing required parameter and an unknown operation, before any request', async () => {
    const api = make();
    await expect(api.operations.getPet({})).rejects.toThrow('getPet: the "petId" path parameter is required');
    await expect(api.call('nope')).rejects.toThrow(/no operation "nope"/);
    expect(calls.length).toBe(0);
  });

  it('uses a base URL from the config over the document\'s', async () => {
    await make({ baseUrl: 'https://staging.test' }).operations.getHealth();
    expect(calls[0].url).toBe('https://staging.test/health');
  });

  it('gives resources: stores that sort, page and search through the parameters the document declares', async () => {
    const api = make();
    const pets = api.store('pets');
    answer = () => ({ body: [{ id: 1, name: 'Rex', age: '3' }] });
    pets.sort({ property: 'name', direction: 'DESC' });
    pets.filter({ property: '*', value: 're', operator: 'like' });
    await pets.load();
    const u = new URL(calls.at(-1)!.url);
    expect(u.pathname).toBe('/v2/pets');
    expect([...u.searchParams.keys()].sort()).toEqual(['limit', 'offset', 'q', 'sort']);
    expect(u.searchParams.get('sort')).toBe('-name');
    expect(pets.getAt(0)!.data.age).toBe(3);   // converted by the generated model
  });

  it('a generated store reads a wrapped list with its total, and saves per record', async () => {
    const api = make();
    const owners = api.store('owners');
    answer = () => ({ body: { items: [{ ownerId: 'o1', name: 'Ann' }], totalCount: 55 } });
    await owners.load();
    expect(owners.getTotalCount()).toBe(55);
    expect(owners.getById('o1')!.data.name).toBe('Ann');
    expect(new URL(calls.at(-1)!.url).searchParams.get('per_page')).toBe('25');
  });

  it('a generated model carries the document\'s rules', () => {
    const Pet = make().model('pets');
    const bad = new Pet({ name: 'X', species: 'fish', age: 99, email: 'nope', code: 'abc' }).validate('en').errors;
    expect(Object.keys(bad).sort()).toEqual(['age', 'code', 'email', 'name', 'species']);
    expect(new Pet({ name: 'Rex', species: 'dog', age: 3, code: 'ABC' }).validate('en').valid).toBe(true);
    expect(new Pet({ id: 1, name: 'Rex' }).toJSON().id).toBeUndefined(); // read-only: never sent back
  });

  it('saving a changed record goes to its own address even though the document marks its id read-only', async () => {
    const Pet = make().model('pets');
    answer = () => ({ body: { id: 5, name: 'Rex', species: 'dog' } });
    const pet = new Pet({ id: 5, name: 'Rexy', species: 'dog' });
    expect(pet.toJSON().id).toBeUndefined();   // read-only: not sent as data…
    await pet.save();
    expect(`${calls.at(-1)!.method} ${new URL(calls.at(-1)!.url).pathname}`).toBe('PUT /v2/pets/5'); // …but still used to find the record
  });

  it('config resources override what was found', () => {
    const api = make({ resources: { pets: { path: '/v2-pets', fields: ['id'] } } });
    expect(api.config.resources!.pets.path).toBe('/v2-pets');
    expect(api.config.resources!.owners).toBeDefined();
  });

  it('registers named stores for every resource, ready for views', () => {
    const stores = make().register();
    expect(Object.keys(stores).sort()).toEqual(['health', 'owners', 'pets']);
    expect(Store.lookup('pets')).toBe(stores.pets);
  });
});

describe('openApiClient', () => {
  const doc = JSON.stringify(spec());
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: !String(url).includes('missing'), status: String(url).includes('missing') ? 404 : 200, statusText: 'Not Found', text: async () => (String(url).includes('missing') ? '' : doc) }) as Response));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('takes an object, a JSON string, or a URL', async () => {
    expect((await openApiClient(spec())).operationInfo.length).toBe(8);
    expect((await openApiClient(doc)).operationInfo.length).toBe(8);
    expect((await openApiClient('https://docs.test/openapi.json')).operationInfo.length).toBe(8);
    expect((await openApiClient('/openapi.json')).operationInfo.length).toBe(8);
  });

  it('a relative servers address is relative to where the document was served', async () => {
    const rel = JSON.stringify({ openapi: '3.0.0', servers: [{ url: 'v1' }], paths: { '/pets': { get: { responses: { 200: { description: 'ok' } } } } } });
    (fetch as any).mockImplementation(async () => ({ ok: true, status: 200, statusText: '', text: async () => rel }) as Response);
    const api = await openApiClient('http://docs.test/__mock__/openapi.json');
    expect(api.config.baseUrl).toBe('http://docs.test/__mock__/v1');
    expect((await openApiClient('http://docs.test/x/openapi.json', { baseUrl: 'http://other.test/api' })).config.baseUrl).toBe('http://other.test/api');
  });

  it('a root-relative servers address (as the Swagger Petstore declares) is resolved against the document\'s own site', async () => {
    const rooted = JSON.stringify({ openapi: '3.0.4', servers: [{ url: '/api/v3' }], paths: { '/pet': { get: { responses: { 200: { description: 'ok' } } } } } });
    (fetch as any).mockImplementation(async () => ({ ok: true, status: 200, statusText: '', text: async () => rooted }) as Response);
    expect((await openApiClient('https://petstore.test/api/v3/openapi.json')).config.baseUrl).toBe('https://petstore.test/api/v3');
    // a protocol-relative or absolute address is left as it is
    const proto = JSON.stringify({ openapi: '3.0.4', servers: [{ url: '//api.test/v3' }], paths: {} });
    (fetch as any).mockImplementation(async () => ({ ok: true, status: 200, statusText: '', text: async () => proto }) as Response);
    expect((await openApiClient('https://petstore.test/openapi.json')).config.baseUrl).toBe('//api.test/v3');
  });

  it('says what is wrong', async () => {
    await expect(openApiClient('{not json')).rejects.toThrow('not valid JSON');
    await expect(openApiClient('openapi: 3.0.0\npaths: {}')).rejects.toThrow(/YAML is not read/);
    await expect(openApiClient('https://docs.test/missing.json')).rejects.toThrow(/Could not read the OpenAPI document at https:\/\/docs.test\/missing.json/);
    await expect(openApiClient({ nothing: 1 })).rejects.toThrow(/neither "openapi" nor "swagger"/);
  });
});
