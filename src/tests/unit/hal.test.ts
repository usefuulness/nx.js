import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHal, expandTemplate, templateVariables, HalClient, HalResource } from '@/data/hal';
import { Store } from '@/data/store';

describe('URI templates', () => {
  it('lists variables', () => {
    expect(templateVariables('/orders{?page,size,sort*}')).toEqual(['page', 'size', 'sort']);
    expect(templateVariables('/a/{id}{/more}{+path}')).toEqual(['id', 'more', 'path']);
    expect(templateVariables('/plain')).toEqual([]);
  });

  it('fills simple, reserved, path, dot and query forms, encoding what must be', () => {
    expect(expandTemplate('/u/{id}', { id: 'a b/c' })).toBe('/u/a%20b%2Fc');
    expect(expandTemplate('/u/{+path}', { path: 'a b/c' })).toBe('/u/a%20b/c');
    expect(expandTemplate('/u{/a,b}', { a: 'x', b: 'y' })).toBe('/u/x/y');
    expect(expandTemplate('/f{.ext}', { ext: 'json' })).toBe('/f.json');
    expect(expandTemplate('/o{?page,size}', { page: 2, size: 10 })).toBe('/o?page=2&size=10');
    expect(expandTemplate('/o?x=1{&page}', { page: 2 })).toBe('/o?x=1&page=2');
    expect(expandTemplate('/o{?q}', { q: 'a&b c' })).toBe('/o?q=a%26b%20c');
  });

  it('leaves out what is missing, and a query with nothing in it', () => {
    expect(expandTemplate('/o{?page,size}', { size: 5 })).toBe('/o?size=5');
    expect(expandTemplate('/o{?page,size}', {})).toBe('/o');
    expect(expandTemplate('/o{?page}', { page: null })).toBe('/o');
    expect(expandTemplate('/u/{id}', {})).toBe('/u/');
    expect(expandTemplate('/plain', { a: 1 })).toBe('/plain');
  });

  it('lists, with and without explode', () => {
    expect(expandTemplate('/o{?tag}', { tag: ['a', 'b'] })).toBe('/o?tag=a,b');
    expect(expandTemplate('/o{?tag*}', { tag: ['a', 'b'] })).toBe('/o?tag=a&tag=b');
    expect(expandTemplate('/o{?x:3}', { x: 'abcdef' })).toBe('/o?x=abcdef'); // length prefixes are accepted (and not applied)
  });
});

describe('HAL', () => {
  let orders: Record<string, any>;
  const calls: Array<{ method: string; url: string; body?: any; accept?: string }> = [];
  const root = {
    _links: {
      self: { href: '/api' },
      curies: [{ name: 'acme', href: '/docs/{rel}', templated: true }],
      orders: { href: '/api/orders{?page,size,sort,q}', templated: true },
      'acme:customers': { href: '/api/customers' },
      profile: { href: '/api/profile' }
    }
  };
  const itemOf = (o: any) => ({ ...o, _links: { self: { href: `/api/orders/${o.id}` }, customer: { href: `/api/customers/${o.cust}` } } });

  beforeEach(() => {
    calls.length = 0;
    orders = { 17: { id: 17, total: 5, cust: 1 }, 18: { id: 18, total: 9, cust: 2 }, 19: { id: 19, total: 2, cust: 1 } };
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const u = new URL(url, 'http://x');
      const method = init.method ?? 'GET';
      calls.push({ method, url: u.pathname + u.search, body: init.body ? JSON.parse(init.body as string) : undefined, accept: (init.headers as any)?.Accept });
      const make = (status: number, body?: unknown) => ({ ok: status < 300, status, statusText: status === 404 ? 'Not Found' : '', text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;
      if (u.pathname === '/api' && method === 'GET') return make(200, root);
      if (u.pathname === '/api/orders' && method === 'GET') {
        const size = Number(u.searchParams.get('size') ?? 2); const page = Number(u.searchParams.get('page') ?? 0);
        const all = Object.values(orders).sort((a: any, b: any) => (u.searchParams.get('sort') === 'total,desc' ? b.total - a.total : a.id - b.id));
        return make(200, { _embedded: { orders: all.slice(page * size, page * size + size).map(itemOf) }, _links: { self: { href: u.pathname } }, page: { size, totalElements: all.length, number: page } });
      }
      if (u.pathname === '/api/orders' && method === 'POST') { const b = JSON.parse(init.body as string); const o = { ...b, id: 20 }; orders[20] = o; return make(201, itemOf(o)); }
      const m = /^\/api\/orders\/(\d+)$/.exec(u.pathname);
      if (m && method === 'PUT') { const b = JSON.parse(init.body as string); orders[m[1]] = { ...orders[m[1]], ...b }; return make(200, itemOf(orders[m[1]])); }
      if (m && method === 'DELETE') { delete orders[m[1]]; return make(204); }
      if (m && method === 'GET') return orders[m[1]] ? make(200, itemOf(orders[m[1]])) : make(404, { message: 'none' });
      if (/^\/api\/customers\/\d+$/.test(u.pathname)) return make(200, { id: 1, name: 'Ann', _links: { self: { href: u.pathname } } });
      if (u.pathname === '/api/customers') return make(200, { _embedded: { customers: [{ id: 1, name: 'Ann' }] }, _links: { self: { href: '/api/customers' } } });
      return make(404, { message: 'none' });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const make = () => createHal('/api', { auth: { token: () => 'tk' } });

  it('reads the entry document and lists its relations by short name, leaving out the plumbing', async () => {
    expect(await make().resources()).toEqual(['orders', 'customers']);
    expect(calls[0].accept).toContain('application/hal+json');
  });

  it('fetches the entry once', async () => {
    const hal = make();
    await hal.resources(); await hal.root(); await hal.resources();
    expect(calls.filter(c => c.url === '/api').length).toBe(1);
  });

  it('retries the entry after a failure', async () => {
    (fetch as any).mockRejectedValueOnce(new TypeError('offline'));
    const hal = make();
    await expect(hal.root()).rejects.toThrow('offline');
    expect((await hal.root()).has('orders')).toBe(true);
  });

  it('a resource knows its links, with or without a prefix, and fills in templated ones', async () => {
    const r = await make().root();
    expect(r.has('orders') && r.has('customers') && r.has('acme:customers')).toBe(true);
    expect(r.href('orders', { page: 1, size: 5 })).toBe('/api/orders?page=1&size=5');
    expect(r.href('customers')).toBe('/api/customers');
    expect(() => r.href('nope')).toThrow(/No "nope" link here\. It offers: self, curies/);
    expect(r.self).toBe('/api');
  });

  it('follows links, one or several', async () => {
    const hal = make();
    const list = await hal.follow('orders', { size: 2 });
    expect(list.embedded('orders').length).toBe(2);
    expect(list.embedded('orders')[0].data.total).toBe(5);
    const one = await list.embedded('orders')[0].follow('customer');
    expect(one.data.name).toBe('Ann');
    expect((await hal.follow(['customers'])).embedded('customers')[0].data.name).toBe('Ann');
  });

  it('gives a resource an id from the id field or from its self address', () => {
    const client = {} as HalClient;
    expect(new HalResource({ id: 4, _links: { self: { href: '/x/9' } } }, client).id()).toBe(4);
    expect(new HalResource({ _links: { self: { href: '/x/9?v=1' } } }, client).id()).toBe('9');
    expect(new HalResource({}, client).id()).toBeUndefined();
    expect(new HalResource(null, client).data).toEqual({});
    expect(new HalResource({ _links: { bad: 5, ok: { href: '/a' } } }, client).has('bad')).toBe(false);
  });

  it('a store loads the embedded records, with ids from their self links and the total from the page', async () => {
    const orders = await make().store('orders', { pageSize: 2 });
    await orders.load();
    expect(orders.getCount()).toBe(2);
    expect(orders.getTotalCount()).toBe(3);
    expect(orders.getAt(0)!.data).toEqual({ id: 17, total: 5, cust: 1 });
    expect(orders.getAt(0)!.data._links).toBeUndefined();
    expect(calls.at(-1)!.url).toBe('/api/orders?page=0&size=2');
    expect((await make().store('orders')).getAt(0)).toBeNull(); // a different client: nothing loaded yet
  });

  it('pages (zero-based by default), sorts and searches through the template\'s variables', async () => {
    const orders = await make().store('orders', { pageSize: 2 });
    orders.sort({ property: 'total', direction: 'DESC' });
    await orders.loadPage(2);
    const u = new URL(calls.at(-1)!.url, 'http://x');
    expect(u.searchParams.get('page')).toBe('1');
    expect(u.searchParams.get('size')).toBe('2');
    expect(u.searchParams.get('sort')).toBe('total,desc');
    expect(orders.getAt(0)!.data.total).toBe(2);
  });

  it('page numbers can start at one, and a store with no sort variable keeps sorting in the browser', async () => {
    const orders = await make().store('orders', { pageSize: 2, zeroBasedPages: false });
    await orders.loadPage(1);
    expect(new URL(calls.at(-1)!.url, 'http://x').searchParams.get('page')).toBe('1');
    const customers = await make().store('customers');
    await customers.load();
    expect(calls.at(-1)!.url).toBe('/api/customers');
    customers.sort({ property: 'name' });
    expect(calls.at(-1)!.url).toBe('/api/customers'); // no new request
  });

  it('saves with each record\'s own link: PUT to its self, POST to the collection, DELETE to its self', async () => {
    const orders = await make().store('orders');
    await orders.load();
    orders.update(orders.getById(17)!, { total: 50 });
    orders.remove(orders.getById(18)!);
    const [added] = orders.add({ total: 1, cust: 3 });
    await orders.sync();
    const writes = calls.filter(c => c.method !== 'GET').map(c => `${c.method} ${c.url}`);
    expect(writes).toEqual(['POST /api/orders', 'PUT /api/orders/17', 'DELETE /api/orders/18']);
    expect(added.data.id).toBe(20);
    expect(orders.isDirty()).toBe(false);
    expect(orders.getById(17)!.data.total).toBe(50);
  });

  it('the same store comes back each time, options give another, and register() names them for views', async () => {
    const hal = make();
    const a = await hal.store('orders');
    expect(await hal.store('orders')).toBe(a);
    expect(await hal.store('orders', { pageSize: 5 })).not.toBe(a);
    const all = await hal.register();
    expect(Object.keys(all)).toEqual(['orders', 'customers']);
    expect(Store.lookup('customers')).toBe(all.customers);
  });

  it('says what the API offers when a relation is wrong, and fails clearly when a record is missing', async () => {
    const hal = make();
    await expect(hal.store('nope')).rejects.toThrow('The API has no "nope" link. It offers: orders, customers');
    await expect(hal.fetch('/api/orders/999')).rejects.toMatchObject({ status: 404, message: 'none' });
  });

  it('sends the sign-in with every request', async () => {
    const orders = await make().store('orders');
    await orders.load();
    expect(calls.length).toBeGreaterThan(1);
    expect((fetch as any).mock.calls.every((c: any[]) => c[1].headers.Authorization === 'Bearer tk')).toBe(true);
  });
});
