import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ajax, AjaxError, createProxy } from '@/data/proxy';
import { Store } from '@/data/store';

type Call = { url: string; init: RequestInit };
const calls: Call[] = [];
let respond: (url: string, init: RequestInit) => { status?: number; body?: unknown; text?: string } = () => ({ body: {} });

beforeEach(() => {
  calls.length = 0;
  respond = () => ({ body: {} });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = respond(url, init);
    const status = r.status ?? 200;
    const text = r.text ?? (r.body === undefined ? '' : JSON.stringify(r.body));
    return { ok: status >= 200 && status < 300, status, statusText: status === 404 ? 'Not Found' : status === 500 ? 'Server Error' : 'OK', text: async () => text } as Response;
  }));
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe('ajax()', () => {
  it('sends params in the query string and reads JSON', async () => {
    respond = () => ({ body: { ok: 1 } });
    const out = await ajax('/api/x', { params: { a: 1, b: 'two words', skip: undefined, o: { k: 1 } } });
    expect(out).toEqual({ ok: 1 });
    expect(calls[0].url).toContain('/api/x?a=1&b=two+words&o=%7B%22k%22%3A1%7D');
    expect(calls[0].url).not.toContain('skip');
  });

  it('sends a body as JSON, but leaves strings, FormData and URLSearchParams alone', async () => {
    await ajax('/a', { method: 'POST', body: { x: 1 } });
    expect(calls[0].init.body).toBe('{"x":1}');
    expect((calls[0].init.headers as any)['Content-Type']).toBe('application/json');
    await ajax('/a', { method: 'POST', body: 'raw' });
    expect(calls[1].init.body).toBe('raw');
    expect((calls[1].init.headers as any)['Content-Type']).toBeUndefined();
    const form = new FormData(); form.append('f', '1');
    await ajax('/a', { method: 'POST', body: form });
    expect(calls[2].init.body).toBe(form);
  });

  it('throws an AjaxError with the status and the server\'s message for a bad status', async () => {
    respond = () => ({ status: 500, body: { message: 'Database is down' } });
    await expect(ajax('/a')).rejects.toMatchObject({ name: 'AjaxError', status: 500, message: 'Database is down' });
    respond = () => ({ status: 404, text: 'nope' });
    const err = await ajax('/a').catch(e => e);
    expect(err).toBeInstanceOf(AjaxError);
    expect(err.message).toBe('404 Not Found');
    expect(err.response).toBe('nope');
  });

  it('says so when a good answer is not JSON, and treats an empty answer as nothing', async () => {
    respond = () => ({ text: '<html>' });
    await expect(ajax('/a')).rejects.toThrow(/not valid JSON/);
    respond = () => ({ status: 204, text: '' });
    expect(await ajax('/a')).toBeUndefined();
    expect(await ajax('/a', { as: 'text' })).toBe('');
  });

  it('reports a network failure and a timeout as AjaxErrors', async () => {
    (fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(ajax('/a')).rejects.toMatchObject({ name: 'AjaxError', status: 0, message: 'Failed to fetch' });
    (fetch as any).mockImplementationOnce((_u: string, init: RequestInit) => new Promise((_r, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted')))));
    await expect(ajax('/a', { timeout: 20 })).rejects.toThrow(/timed out after 20 ms/);
  });

  it('can be aborted from outside', async () => {
    const controller = new AbortController();
    (fetch as any).mockImplementationOnce((_u: string, init: RequestInit) => new Promise((_r, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted')))));
    const p = ajax('/a', { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AjaxError' });
  });
});

describe('REST proxy', () => {
  const rest = (extra = {}) => createProxy({ type: 'rest', url: '/api/users/', ...extra });

  it('reads with the extra params', async () => {
    respond = () => ({ body: { data: [] } });
    await rest({ extraParams: { token: 't' }, headers: { 'X-A': '1' } }).read({ page: 2 });
    expect(calls[0].url).toMatch(/\/api\/users\/\?token=t&page=2$/);
    expect((calls[0].init.headers as any)['X-A']).toBe('1');
  });

  it('creates, updates and destroys one record per request, with the id in the URL', async () => {
    respond = (_u, init) => ({ body: init.method === 'DELETE' ? undefined : { id: 5, saved: true } });
    const proxy = rest();
    expect(await proxy.create([{ name: 'a' }])).toEqual([{ id: 5, saved: true }]);
    await proxy.update([{ id: 7, name: 'b' }, { id: 'x y', name: 'c' }]);
    await proxy.destroy([7, 'x y']);
    expect(calls.map(c => `${c.init.method} ${new URL(c.url).pathname}`)).toEqual([
      'POST /api/users/', 'PUT /api/users/7', 'PUT /api/users/x%20y', 'DELETE /api/users/7', 'DELETE /api/users/x%20y'
    ]);
    expect(calls[1].init.body).toBe('{"id":7,"name":"b"}');
  });

  it('uses an operation\'s own URL as given, and a custom id property', async () => {
    respond = () => ({ body: {} });
    const proxy = rest({ api: { update: '/api/save' }, idProperty: 'uid' });
    await proxy.update([{ uid: 3 }]);
    await proxy.destroy([3]);
    expect(calls.map(c => new URL(c.url).pathname)).toEqual(['/api/save', '/api/users/3']);
  });

  it('wraps what it sends and unwraps what it gets back', async () => {
    respond = () => ({ body: { records: { id: 1, name: 'ok' } } });
    const proxy = rest({ writer: { rootProperty: 'user' }, reader: { rootProperty: 'records' } });
    expect(await proxy.create([{ name: 'n' }])).toEqual([{ id: 1, name: 'ok' }]);
    expect(calls[0].init.body).toBe('{"user":{"name":"n"}}');
  });

  it('fails with the server\'s message when a save is refused', async () => {
    respond = () => ({ status: 500, body: { message: 'No' } });
    await expect(rest().create([{ name: 'n' }])).rejects.toThrow('No');
  });

  it('refuses to guess a URL it was not given', async () => {
    await expect(createProxy({ type: 'rest' }).read({})).rejects.toThrow(/no URL/);
  });
});

describe('Ajax proxy (records together)', () => {
  it('sends them in one request', async () => {
    respond = () => ({ body: [{ id: 1 }, { id: 2 }] });
    const proxy = createProxy({ type: 'ajax', url: '/api/batch' });
    expect(await proxy.create([{ a: 1 }, { a: 2 }])).toHaveLength(2);
    await proxy.destroy([1, 2]);
    expect(calls.map(c => c.init.method)).toEqual(['POST', 'DELETE']);
    expect(calls[0].init.body).toBe('[{"a":1},{"a":2}]');
    expect(calls[1].init.body).toBe('{"ids":[1,2]}');
  });
});

describe('Memory and localStorage proxies', () => {
  for (const [name, make] of [
    ['memory', () => createProxy({ type: 'memory', data: [{ id: 1, n: 'a' }, { id: 2, n: 'b' }] })],
    ['localstorage', () => { localStorage.setItem('k', JSON.stringify([{ id: 1, n: 'a' }, { id: 2, n: 'b' }])); return createProxy({ type: 'localstorage', url: 'k' }); }]
  ] as const) {
    it(`${name}: reads, creates, updates by id and destroys`, async () => {
      const p = make();
      expect((await p.read({})).data).toHaveLength(2);
      await p.create([{ id: 3, n: 'c' }]);
      await p.update([{ id: 2, n: 'B' }]);
      await p.destroy([1]);
      const { data, total } = await p.read({});
      expect(data).toEqual([{ id: 2, n: 'B' }, { id: 3, n: 'c' }]);
      expect(total).toBe(2);
    });
  }

  it('localstorage starts clean when the key holds something else', async () => {
    localStorage.setItem('bad', '{not json');
    expect((await createProxy({ type: 'localstorage', url: 'bad' }).read({})).data).toEqual([]);
    localStorage.setItem('obj', '{"a":1}');
    expect((await createProxy({ type: 'localstorage', url: 'obj' }).read({})).data).toEqual([]);
  });

  it('reads do not hand out the proxy\'s own rows', async () => {
    const p = createProxy({ type: 'memory', data: [{ id: 1, n: 'a' }] });
    (await p.read({})).data[0].n = 'changed';
    expect((await p.read({})).data[0].n).toBe('a');
  });
});

describe('Store with a proxy: load and sync round trip', () => {
  it('loads, adds, edits, removes and syncs against a memory proxy', async () => {
    const store = new Store<any>({ proxy: { type: 'memory', data: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] } });
    await store.load();
    expect(store.getCount()).toBe(2);
    store.update(store.getById(1)!, { name: 'A' });
    store.remove(store.getById(2)!);
    store.add({ id: 3, name: 'c' });
    await store.sync();
    expect(store.isDirty()).toBe(false);
    const fresh = new Store<any>({ proxy: { type: 'memory', data: [] } });
    expect(fresh.getCount()).toBe(0);
    await store.load();
    expect(store.getData().map((r: any) => r.name)).toEqual(['A', 'c']);
  });

  it('reports a failed load as an exception event and a rejected promise', async () => {
    respond = () => ({ status: 500, body: { message: 'Down' } });
    const store = new Store<any>({ proxy: { type: 'rest', url: '/api/x' } });
    const seen: any[] = [];
    store.on('exception', (e: any) => seen.push(e.operation));
    await expect(store.load()).rejects.toThrow('Down');
    expect(seen).toEqual(['load']);
    expect(store.isLoading()).toBe(false);
  });
});
