import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineModel } from '@/data/model';
import { Session } from '@/data/session';
import { Store } from '@/data/store';

type Call = { method: string; path: string; body?: any; search: string };
const calls: Call[] = [];
let db: { users: Record<string, any>; orders: Record<string, any> };
let nextId = 100;

beforeEach(() => {
  calls.length = 0; nextId = 100;
  db = { users: { 1: { id: 1, name: 'Ada' }, 2: { id: 2, name: 'Bob' } }, orders: { 10: { id: 10, userId: 1, total: 5 }, 11: { id: 11, userId: 1, total: 7 }, 12: { id: 12, userId: 2, total: 9 } } };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const u = new URL(url);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method, path: u.pathname, body, search: u.search });
    const [, , table, id] = u.pathname.split('/');
    const t = (db as any)[table];
    const make = (status: number, payload: unknown) => ({ ok: status < 300, status, statusText: status === 404 ? 'Not Found' : '', text: async () => (payload === undefined ? '' : JSON.stringify(payload)) }) as Response;
    if (method === 'GET' && id) return t[id] ? make(200, t[id]) : make(404, { message: 'none' });
    if (method === 'GET') { const uid = u.searchParams.get('userId'); return make(200, { data: Object.values(t).filter((r: any) => !uid || String(r.userId) === uid) }); }
    if (method === 'POST') { const rec = { ...body, id: ++nextId }; t[rec.id] = rec; return make(200, rec); }
    if (method === 'PUT') { if (id === '999') return make(500, { message: 'Down' }); t[id] = { ...t[id], ...body }; return make(200, t[id]); }
    delete t[id as string]; return make(204, undefined);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

const Order: any = defineModel({ name: 'order', fields: ['id', 'userId', { name: 'total', type: 'float' }], proxy: { type: 'rest', url: '/api/orders' } });
const User: any = defineModel({
  name: 'user',
  fields: ['id', 'name'],
  proxy: { type: 'rest', url: '/api/users' },
  associations: [{ type: 'hasMany', name: 'orders', model: () => Order, foreignKey: 'userId' }]
});
// Orders point back at their user: defined after, referring to User
const OrderWithUser: any = defineModel({
  name: 'order',
  fields: ['id', 'userId', 'total'],
  proxy: { type: 'rest', url: '/api/orders' },
  associations: [{ type: 'belongsTo', name: 'user', model: () => User, foreignKey: 'userId' }]
});

describe('associations: hasMany', () => {
  it('uses nested data without a request, and orders() gives the same store each time', () => {
    const u = new User({ id: 1, name: 'Ada', orders: [{ id: 10, total: '5.5' }, { id: 11, total: 7 }] });
    const orders: Store<any> = u.orders();
    expect(orders).toBeInstanceOf(Store);
    expect(u.orders()).toBe(orders);
    expect(orders.getCount()).toBe(2);
    expect(orders.getById(10)!.data.total).toBe(5.5);       // converted by the Order model
    expect(orders.getById(10)!.data.userId).toBe(1);        // the foreign key is filled in
    expect('orders' in u.data).toBe(false);                 // nested data is not a field, and is not saved with the user
    expect('orders' in u.toJSON()).toBe(false);
    expect(calls.length).toBe(0);
  });

  it('loads from the server, asking only for this user\'s records', async () => {
    const u = new User({ id: 1, name: 'Ada' });
    const store = await u.loadAssoc('orders');
    expect(store.getData().map((o: any) => o.id)).toEqual([10, 11]);
    expect(calls[0].search).toContain('userId=1');
  });

  it('new records added to it get the owner\'s id as their foreign key, and follow it after the owner is saved', async () => {
    const u = new User({ name: 'New' });
    const orders: Store<any> = u.orders();
    const [rec] = orders.add({ total: 3 });
    expect(rec.data.userId).toBeUndefined();
    await u.save(); // gets id 101
    expect(u.id).toBe(101);
    expect(rec.data.userId).toBe(101);
  });

  it('knows its name and the default foreign key from the owner\'s name', () => {
    const M: any = defineModel({ name: 'team', fields: ['id'], associations: [{ type: 'hasMany', name: 'members', model: Order }] });
    expect(M.associations[0].foreignKey).toBe('teamId');
    expect(new M({ id: 5 }).members().getCount()).toBe(0);
  });

  it('refuses an association it does not have', () => {
    expect(() => new User({ id: 1 }).assoc('nope')).toThrow(/No association/);
  });
});

describe('associations: belongsTo', () => {
  it('uses a nested record when there is one, with the right class', () => {
    const o = new OrderWithUser({ id: 10, userId: 1, user: { id: 1, name: 'Ada' } });
    const user = o.getUser();
    expect(user.get('name')).toBe('Ada');
    expect(user.phantom).toBe(false);
    expect(o.getUser()).toBe(user);
    expect(calls.length).toBe(0);
  });

  it('is unknown until loaded, then fetched by its foreign key and remembered', async () => {
    const o = new OrderWithUser({ id: 10, userId: 2 });
    expect(o.getUser()).toBeUndefined();
    const user = await o.loadAssoc('user');
    expect(user.get('name')).toBe('Bob');
    expect(o.getUser()).toBe(user);
    expect(new URL(`http://x${calls[0].path}`).pathname).toBe('/api/users/2');
  });

  it('has nothing to load without a foreign key, and a missing record is an error', async () => {
    expect(await new OrderWithUser({ id: 1 }).loadAssoc('user')).toBeUndefined();
    expect(calls.length).toBe(0);
    await expect(new OrderWithUser({ id: 1, userId: 777 }).loadAssoc('user')).rejects.toThrow('No record with id 777');
  });

  it('setUser changes the foreign key, and null clears it', () => {
    const o = new OrderWithUser({ id: 10, userId: 1 });
    const bob = new User({ id: 2, name: 'Bob' });
    o.setUser(bob);
    expect(o.get('userId')).toBe(2);
    expect(o.getUser()).toBe(bob);
    expect(o.dirty).toBe(true);
    o.setUser(null);
    expect(o.get('userId')).toBeNull();
    expect(o.getUser()).toBeUndefined();
    expect(() => new User({ id: 1 }).setAssoc('orders', bob)).toThrow(/hasMany/);
  });
});

describe('Session', () => {
  it('gives the same object for the same record, however it was reached', async () => {
    const s = new Session();
    const a = await s.load(User, 1);
    const b = await s.load(User, '1');
    expect(a).toBe(b);
    expect(s.get(User, 1)).toBe(a);
    expect(calls.length).toBe(1);
    expect(s.adopt(new User({ id: 1, name: 'Other' }))).toBe(a); // the session already has user 1
    expect(s.get(User, 99)).toBeUndefined();
  });

  it('tracks created, updated and erased records', async () => {
    const s = new Session();
    const ada = await s.load(User, 1);
    const bob = await s.load(User, 2);
    const fresh = s.create(User, { name: 'Cleo' });
    expect(s.hasChanges()).toBe(true);
    ada.set('name', 'Ada L.');
    s.erase(bob);
    const c = s.getChanges();
    expect(c.created).toEqual([fresh]);
    expect(c.updated).toEqual([ada]);
    expect(c.erased).toEqual([bob]);
  });

  it('saves creates, then updates, then deletes, and reports what happened', async () => {
    const s = new Session();
    const ada = await s.load(User, 1);
    const bob = await s.load(User, 2);
    const fresh = s.create(User, { name: 'Cleo' });
    ada.set('name', 'Ada L.');
    s.erase(bob);
    calls.length = 0;
    const result = await s.save();
    expect(result).toEqual({ saved: 3, errors: [] });
    expect(calls.map(c => c.method)).toEqual(['POST', 'PUT', 'DELETE']);
    expect(fresh.id).toBe(101);
    expect(s.get(User, 101)).toBe(fresh); // now found by its new id
    expect(s.get(User, 2)).toBeUndefined();
    expect(s.hasChanges()).toBe(false);
    expect(db.users[1].name).toBe('Ada L.');
    expect(db.users[2]).toBeUndefined();
  });

  it('one failing save does not stop the others, and the failed record stays changed', async () => {
    const s = new Session();
    const bad = await (async () => { db.users[999] = { id: 999, name: 'Bad' }; return s.load(User, 999); })();
    const ada = await s.load(User, 1);
    bad.set('name', 'x'); ada.set('name', 'Ada 2');
    const result = await s.save();
    expect(result.saved).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].model).toBe(bad);
    expect(String((result.errors[0].error as Error).message)).toBe('Down');
    expect(s.getChanges().updated).toEqual([bad]);
  });

  it('rejects: edits are put back, new records are forgotten, deletions cancelled', async () => {
    const s = new Session();
    const ada = await s.load(User, 1);
    const bob = await s.load(User, 2);
    const fresh = s.create(User, { name: 'Cleo' });
    ada.set('name', 'Changed'); s.erase(bob);
    s.reject();
    expect(ada.get('name')).toBe('Ada');
    expect(s.hasChanges()).toBe(false);
    expect(s.getChanges().created).toEqual([]);
    expect(fresh.phantom).toBe(true);
  });

  it('erasing a record that was never saved just forgets it; commit accepts everything', async () => {
    const s = new Session();
    const fresh = s.create(User, { name: 'Temp' });
    s.erase(fresh);
    expect(s.hasChanges()).toBe(false);
    const ada = await s.load(User, 1);
    ada.set('name', 'Zed');
    s.commit();
    expect(s.hasChanges()).toBe(false);
    expect(ada.dirty).toBe(false);
  });

  it('emits change when a record in it changes, and stops after destroy', async () => {
    const s = new Session();
    const ada = await s.load(User, 1);
    const seen = vi.fn();
    s.on('change', seen);
    ada.set('name', 'A');
    expect(seen).toHaveBeenCalledTimes(1);
    s.destroy();
    ada.set('name', 'B');
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
