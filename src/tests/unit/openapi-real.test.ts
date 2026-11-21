/**
 * The OpenAPI client against a real document: the Swagger Petstore's own, as the public server serves it
 * (Apache-2.0, https://petstore3.swagger.io/api/v3/openapi.json). Checked against the live server by hand;
 * these tests keep what that run found from coming back.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readOpenApi, openApiClient } from '@/data/openapi';

const petstore = JSON.parse(readFileSync(path.resolve(__dirname, 'fixtures/petstore.openapi.json'), 'utf8'));

describe('OpenAPI client with the Swagger Petstore document', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('finds every operation, with its path and body', () => {
    const { operations } = readOpenApi(petstore);
    expect(operations).toHaveLength(19);
    const by = Object.fromEntries(operations.map(o => [o.name, o]));
    expect(by.getPetById).toMatchObject({ method: 'GET', path: '/pet/{petId}', parameters: [{ name: 'petId', in: 'path', required: true }] });
    expect(by.addPet.hasBody).toBe(true);
    expect(by.findPetsByStatus.parameters.map(p => p.name)).toEqual(['status']);
    expect(by.deletePet.parameters.map(p => p.name).sort()).toEqual(['api_key', 'petId']);
  });

  it('knows which answers are text: the login token is a string, a pet is JSON', () => {
    const by = Object.fromEntries(readOpenApi(petstore).operations.map(o => [o.name, o]));
    expect(by.loginUser.textResponse).toBe(true);
    expect(by.getPetById.textResponse).toBeUndefined();
    expect(by.getInventory.textResponse).toBeUndefined();
  });

  it('resolves the relative server address against the base it is given, and calls with real parameters', async () => {
    const fetched: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      fetched.push(String(url));
      return new Response(JSON.stringify([{ id: 1, name: 'doggie', status: 'available' }]), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    const api = await openApiClient(petstore, { baseUrl: 'https://petstore3.swagger.io/api/v3' });
    const pets = await api.operations.findPetsByStatus({ status: 'available' });
    expect(pets[0].name).toBe('doggie');
    expect(fetched[0]).toBe('https://petstore3.swagger.io/api/v3/pet/findByStatus?status=available');
    vi.unstubAllGlobals();
  });

  it('reads a string answer as text even when the server labels it JSON (the real login does)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('logged in user session:1763714622', { status: 200, headers: { 'content-type': 'application/json' } })));
    const api = await openApiClient(petstore, { baseUrl: 'https://petstore3.swagger.io/api/v3' });
    await expect(api.operations.loginUser({ username: 'a', password: 'b' })).resolves.toBe('logged in user session:1763714622');
    // …and a properly quoted JSON string is unquoted
    vi.stubGlobal('fetch', vi.fn(async () => new Response('"token-1"', { status: 200, headers: { 'content-type': 'application/json' } })));
    await expect(api.operations.loginUser({ username: 'a', password: 'b' })).resolves.toBe('token-1');
    vi.unstubAllGlobals();
  });

  it('a server error carries its status and message (the real inventory and addPet answer 500 with a JSON message)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 500, message: 'There was an error processing your request. It has been logged (ID: abc)' }), { status: 500, headers: { 'content-type': 'application/json' } })));
    const api = await openApiClient(petstore, { baseUrl: 'https://petstore3.swagger.io/api/v3', retry: 0 } as any);
    await expect(api.operations.getInventory()).rejects.toMatchObject({ status: 500, message: expect.stringContaining('error processing your request') });
    vi.unstubAllGlobals();
  });
});

describe('array query parameters (findPetsByTags declares `explode: true`)', () => {
  it('are sent as repeated names, the way the Petstore reads them', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { urls.push(String(url)); return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }); }));
    const api = await openApiClient(petstore, { baseUrl: 'https://petstore3.swagger.io/api/v3' });
    await api.operations.findPetsByTags({ tags: ['a', 'b'] });
    expect(urls[0]).toBe('https://petstore3.swagger.io/api/v3/pet/findByTags?tags=a&tags=b');
    vi.unstubAllGlobals();
  });
});
