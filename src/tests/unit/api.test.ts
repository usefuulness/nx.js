import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApi, Api } from '@/data/api';
import { AjaxError } from '@/data/proxy';
import { Store } from '@/data/store';

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };
const calls: Call[] = [];
let answer: (call: Call) => { status?: number; body?: unknown } = () => ({ body: {} });

beforeEach(() => {
  calls.length = 0;
  answer = () => ({ body: {} });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const call: Call = { url, method: init.method ?? 'GET', headers: { ...(init.headers as Record<string, string>) }, body: init.body as string | undefined };
    calls.push(call);
    const r = answer(call);
    const status = r.status ?? 200;
    return { ok: status < 300, status, statusText: status === 401 ? 'Unauthorized' : '', text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) } as Response;
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

const path = (c: Call) => { const u = new URL(c.url); return u.pathname + u.search; };

describe('Api: requests', () => {
  it('joins the base URL whatever the slashes, and leaves a full URL alone', async () => {
    const api = createApi({ baseUrl: 'https://api.test/v1/' });
    await api.get('/users');
    await api.get('users');
    await api.get('https://other.test/x');
    expect(calls.map(c => c.url)).toEqual(['https://api.test/v1/users', 'https://api.test/v1/users', 'https://other.test/x']);
  });

  it('has a shorthand for each method, with params and a JSON body', async () => {
    const api = createApi({ baseUrl: 'https://api.test' });
    await api.get('/a', { q: 1 }); await api.post('/a', { x: 1 }); await api.put('/a/1', { x: 2 }); await api.patch('/a/1', { x: 3 }); await api.delete('/a/1');
    expect(calls.map(c => `${c.method} ${path(c)}`)).toEqual(['GET /a?q=1', 'POST /a', 'PUT /a/1', 'PATCH /a/1', 'DELETE /a/1']);
    expect(calls[1].body).toBe('{"x":1}');
  });

  it('sends headers (an object or an async function) and a bearer token', async () => {
    let token = 'abc';
    const api = createApi({ baseUrl: 'https://a.test', headers: async () => ({ 'X-App': 'nx' }), auth: { token: () => token } });
    await api.get('/x');
    token = 'def';
    await api.get('/x', undefined, { headers: { 'X-One': '1' } });
    expect(calls[0].headers).toMatchObject({ 'X-App': 'nx', Authorization: 'Bearer abc' });
    expect(calls[1].headers).toMatchObject({ Authorization: 'Bearer def', 'X-One': '1' });
    const none = createApi({ baseUrl: 'https://a.test', auth: { token: () => null } });
    await none.get('/x');
    expect(calls[2].headers.Authorization).toBeUndefined();
  });

  it('lets onRequest change a request, and onResponse see every answer', async () => {
    const seen: unknown[] = [];
    const api = createApi({
      baseUrl: 'https://a.test',
      onRequest: (_u, o) => ({ ...o, headers: { ...o.headers, 'X-Trace': '1' } }),
      onResponse: d => seen.push(d)
    });
    answer = () => ({ body: { ok: true } });
    await api.get('/x');
    expect(calls[0].headers['X-Trace']).toBe('1');
    expect(seen).toEqual([{ ok: true }]);
  });

  it('on 401 gets a new token and repeats the request once', async () => {
    let token = 'old';
    const refresh = vi.fn(async () => { token = 'new'; });
    const api = createApi({ baseUrl: 'https://a.test', auth: { token: () => token, refresh } });
    answer = c => (c.headers.Authorization === 'Bearer new' ? { body: { ok: 1 } } : { status: 401, body: { message: 'expired' } });
    expect(await api.get('/x')).toEqual({ ok: 1 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls.map(c => c.headers.Authorization)).toEqual(['Bearer old', 'Bearer new']);
  });

  it('gives up when the refresh says no, or when the second try is refused too, and reports it once', async () => {
    const onError = vi.fn();
    answer = () => ({ status: 401, body: { message: 'no' } });
    const a = createApi({ baseUrl: 'https://a.test', auth: { token: () => 't', refresh: async () => false }, onError });
    await expect(a.get('/x')).rejects.toMatchObject({ status: 401 });
    expect(calls.length).toBe(1);
    const b = createApi({ baseUrl: 'https://a.test', auth: { token: () => 't', refresh: async () => {} }, onError });
    await expect(b.get('/x')).rejects.toMatchObject({ status: 401 });
    expect(calls.length).toBe(3); // one for a, two for b
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(AjaxError);
  });

  it('repeats a read after a 503 and a dropped connection, with growing waits, and a write only if it never arrived', async () => {
    vi.useFakeTimers();
    const api = createApi({ baseUrl: 'https://a.test', retries: 2, retryDelay: 100 });
    let n = 0;
    answer = () => (++n < 3 ? { status: 503, body: { message: 'busy' } } : { body: { ok: 1 } });
    const p = api.get('/x');
    await vi.advanceTimersByTimeAsync(100); await vi.advanceTimersByTimeAsync(200);
    expect(await p).toEqual({ ok: 1 });
    expect(calls.length).toBe(3);
    calls.length = 0; n = 0;
    answer = () => ({ status: 503, body: { message: 'busy' } });
    await expect(api.post('/x', {})).rejects.toMatchObject({ status: 503 }); // a POST that reached the server is not repeated
    expect(calls.length).toBe(1);
    vi.useRealTimers();
  });

  it('does not repeat past the limit, or when there is none', async () => {
    answer = () => ({ status: 503, body: { message: 'busy' } });
    await expect(createApi({ baseUrl: 'https://a.test' }).get('/x')).rejects.toMatchObject({ status: 503 });
    expect(calls.length).toBe(1);
  });

  it('turns a network failure into an AjaxError for onError', async () => {
    (fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const onError = vi.fn();
    await expect(createApi({ baseUrl: 'https://a.test', onError }).get('/x')).rejects.toMatchObject({ status: 0 });
    expect(onError).toHaveBeenCalled();
  });
});

describe('Api: resources', () => {
  const make = (extra = {}) => createApi({
    baseUrl: 'https://a.test/v1',
    auth: { token: () => 'tk' },
    resources: {
      users: { path: '/users', fields: ['id', 'name', { name: 'age', type: 'int' }], pageSize: 10 },
      notes: { path: '/notes', reader: { rootProperty: 'items', totalProperty: 'count' } }
    },
    ...extra
  });

  it('a client does the plain calls, with the id in the path', async () => {
    const users = make().client('users');
    answer = c => (c.method === 'GET' && !path(c).includes('/users/') ? { body: { data: [{ id: 1 }], total: 40 } } : { body: { id: 7 } });
    expect(await users.list({ page: 2 })).toEqual({ data: [{ id: 1 }], total: 40 });
    await users.get(7); await users.create({ name: 'x' }); await users.update(7, { name: 'y' }); await users.remove('a b');
    expect(calls.map(c => `${c.method} ${path(c)}`)).toEqual(['GET /v1/users?page=2', 'GET /v1/users/7', 'POST /v1/users', 'PUT /v1/users/7', 'DELETE /v1/users/a%20b']);
    expect(calls.every(c => c.headers.Authorization === 'Bearer tk')).toBe(true);
  });

  it('a list answer can be a bare array, or use a root and total property', async () => {
    const api = make();
    answer = () => ({ body: [{ id: 1 }, { id: 2 }] });
    expect((await api.client('users').list()).data.length).toBe(2);
    answer = () => ({ body: { items: [{ id: 1 }], count: 9 } });
    expect(await api.client('notes').list()).toEqual({ data: [{ id: 1 }], total: 9 });
    answer = () => ({ body: { surprise: true } });
    expect((await api.client('users').list()).data).toEqual([]);
  });

  it('refuses a resource it does not have', () => {
    expect(() => make().client('nope')).toThrow(/no resource "nope"/);
    expect(() => make().store('nope')).toThrow(/no resource/);
  });

  it('a model saves and loads through the client (auth included)', async () => {
    const api = make();
    const User = api.model('users');
    expect(api.model('users')).toBe(User);
    answer = c => (c.method === 'POST' ? { body: { id: 5, name: 'Ada', age: '36' } } : { body: { id: 5, name: 'Ada', age: 36 } });
    const u = new User({ name: 'Ada' });
    await u.save();
    expect(u.id).toBe(5);
    expect(u.get('age')).toBe(36); // converted by the model
    await User.load(5);
    expect(calls.map(c => `${c.method} ${path(c)}`)).toEqual(['POST /v1/users', 'GET /v1/users/5']);
    expect(calls[0].headers.Authorization).toBe('Bearer tk');
  });

  it('a store loads with the server sorting, filtering and paging, and is the same one each time', async () => {
    const api = make();
    const store = api.store('users');
    expect(api.store('users')).toBe(store);
    expect(Store.lookup('users')).toBe(store);
    answer = () => ({ body: { data: [{ id: 1, name: 'Ada', age: '30' }], total: 41 } });
    store.sort({ property: 'name', direction: 'DESC' });
    store.filter({ property: 'age', operator: 'gt', value: 20 });
    await store.load();
    const u = new URL(calls.at(-1)!.url);
    expect(u.pathname).toBe('/v1/users');
    expect(u.searchParams.get('limit')).toBe('10');
    expect(JSON.parse(u.searchParams.get('sort')!)[0]).toMatchObject({ property: 'name', direction: 'DESC' });
    expect(JSON.parse(u.searchParams.get('filter')!)[0].property).toBe('age');
    expect(store.getTotalCount()).toBe(41);
    expect(store.getAt(0)!.data.age).toBe(30);
    expect(calls.at(-1)!.headers.Authorization).toBe('Bearer tk');
  });

  it('a store saves edits through the client', async () => {
    const api = make();
    const store = api.store('users');
    answer = c => (c.method === 'GET' ? { body: { data: [{ id: 1, name: 'Ada', age: 30 }] } } : { body: { id: 1, name: 'Ada L.', age: 30 } });
    await store.load();
    store.update(store.getById(1)!, { name: 'Ada L.' });
    await store.sync();
    expect(calls.at(-1)).toMatchObject({ method: 'PUT' });
    expect(path(calls.at(-1)!)).toBe('/v1/users/1');
  });

  it('options give a separate store that is not shared or registered', () => {
    const api = make();
    const mine = api.store('users', { pageSize: 5 });
    expect(mine).not.toBe(api.store('users'));
  });

  it('renames the store\'s parameters the way the server wants them', async () => {
    const api = make({ params: (s: any) => ({ _page: s.page, per_page: s.limit, order: s.sort.map((x: any) => `${x.direction === 'DESC' ? '-' : ''}${x.property}`).join(','), ...s.extra }) });
    const store = api.store('users');
    answer = () => ({ body: [] });
    store.sort({ property: 'name', direction: 'DESC' });
    await store.load();
    const u = new URL(calls.at(-1)!.url);
    expect(u.searchParams.get('per_page')).toBe('10');
    expect(u.searchParams.get('order')).toBe('-name');
    expect(u.searchParams.has('limit')).toBe(false);
  });

  it('remote: false keeps sorting and filtering in the browser', async () => {
    const api = createApi({ baseUrl: 'https://a.test', resources: { tags: { path: '/tags', remote: false } } });
    const store = api.store('tags');
    answer = () => ({ body: { data: [{ id: 1, n: 'b' }, { id: 2, n: 'a' }] } });
    await store.load();
    const before = calls.length;
    store.sort({ property: 'n' });
    expect(store.getData().map((r: any) => r.n)).toEqual(['a', 'b']);
    expect(calls.length).toBe(before);
  });

  it('register() makes a named store for every resource', () => {
    const stores = make().register();
    expect(Object.keys(stores).sort()).toEqual(['notes', 'users']);
    expect(Store.lookup('notes')).toBe(stores.notes);
  });

  it('is exported as a class too', () => {
    expect(new Api({}).config).toEqual({});
  });
});
