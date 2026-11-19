import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installMockServer, onMockRequest, petsSpec } from '../../../examples/showcase/mock-server';
import { openApiClient } from '@/data/openapi';
import { createHal } from '@/data/hal';

let restore: ReturnType<typeof installMockServer>;
beforeEach(() => { restore = installMockServer({ instant: true }); });
afterEach(() => { restore(); });

const get = async (path: string) => (await fetch(`http://page.test/__mock__/${path}`)).json();

describe('the showcase\'s mock server', () => {
  it('serves an OpenAPI document that the client can read', async () => {
    const api = await openApiClient('http://page.test/__mock__/openapi.json', { baseUrl: 'http://page.test/__mock__/v1' });
    expect(api.operationInfo.map(o => o.name)).toEqual(['listPets', 'createPet', 'getPet', 'updatePet', 'deletePet']);
    expect(Object.keys(api.config.resources!)).toEqual(['pets']);
    expect(petsSpec().openapi).toBe('3.0.3');
  });

  it('lists pets sorted, searched and paged', async () => {
    const page = await get('v1/pets?limit=5&offset=5&sort=-age');
    expect(page.items.length).toBe(5);
    expect(page.total).toBe(48);
    expect(page.items.map((p: any) => p.age)).toEqual([...page.items.map((p: any) => p.age)].sort((a, b) => b - a));
    const found = await get('v1/pets?q=rex&limit=50');
    expect(found.items.every((p: any) => p.name.toLowerCase().includes('rex'))).toBe(true);
    expect((await get('v1/pets?species=dog&limit=100')).items.every((p: any) => p.species === 'dog')).toBe(true);
  });

  it('creates, changes and deletes, and refuses what is not valid', async () => {
    const post = (body: unknown) => fetch('http://page.test/__mock__/v1/pets', { method: 'POST', body: JSON.stringify(body) });
    const bad = await post({ name: 'X', species: 'fish' });
    expect(bad.status).toBe(422);
    expect((await bad.json()).errors).toEqual({ name: 'Use at least 2 characters', species: 'This is not one of the allowed values' });
    const ok = await post({ name: 'Newbie', species: 'cat' });
    expect(ok.status).toBe(201);
    const { id } = await ok.json();
    const put = await fetch(`http://page.test/__mock__/v1/pets/${id}`, { method: 'PUT', body: JSON.stringify({ name: 'Renamed' }) });
    expect((await put.json()).name).toBe('Renamed');
    expect((await fetch(`http://page.test/__mock__/v1/pets/${id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await fetch(`http://page.test/__mock__/v1/pets/${id}`)).status).toBe(404);
  });

  it('serves HAL that the client can follow', async () => {
    const hal = createHal('http://page.test/__mock__/hal/');
    expect(await hal.resources()).toEqual(['books', 'authors']);
    const books = await hal.store('books', { pageSize: 5 });
    await books.load();
    expect(books.getCount()).toBe(5);
    expect(books.getTotalCount()).toBe(37);
    const first = (await hal.follow('books', { size: 3 })).embedded('books')[0];
    expect((await first.follow('author')).data.name).toMatch(/\w+ \w+/);
    books.sort({ property: 'year', direction: 'DESC' });
    await books.load();
    const years = books.getData().map((b: any) => b.year);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it('answers folders for lazy loading, tells listeners about each request, and leaves other URLs alone', async () => {
    const seen: string[] = [];
    const off = onMockRequest(r => seen.push(`${r.method} ${r.url} ${r.status}`));
    expect((await get('tree?node=pictures')).data.length).toBe(3);
    expect((await fetch('http://page.test/__mock__/tree?node=zzz')).status).toBe(404);
    off();
    await get('v1/pets?limit=1');
    expect(seen).toEqual(['GET /tree?node=pictures 200', 'GET /tree?node=zzz 404']);
  });

  it('puts the data back with reset()', async () => {
    await fetch('http://page.test/__mock__/v1/pets', { method: 'POST', body: JSON.stringify({ name: 'Temp', species: 'dog' }) });
    expect((await get('v1/pets?limit=1')).total).toBe(49);
    restore.reset();
    expect((await get('v1/pets?limit=1')).total).toBe(48);
  });
});
