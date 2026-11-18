import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineModel, Model, pathGet } from '@/data/model';
import { Store } from '@/data/store';
import { i18n } from '@/core/i18n';
import '@/locales/es';

interface User { id: number; name: string; email: string; age: number; admin: boolean; joined: Date | null; note: string; city: string }

const User = defineModel<User>({
  fields: [
    { name: 'id', type: 'int', allowNull: true },
    { name: 'name', type: 'string', validators: ['presence', { type: 'length', min: 2, max: 10 }] },
    { name: 'email', validators: ['email'] },
    { name: 'age', type: 'int', defaultValue: 18, validators: [{ type: 'range', min: 0, max: 130 }] },
    { name: 'admin', type: 'boolean', defaultValue: false },
    { name: 'joined', type: 'date', allowNull: true },
    { name: 'note', type: 'string', persist: false, defaultValue: () => 'new' },
    { name: 'city', mapping: 'address.city' }
  ],
  validators: { name: [(v: string) => (v === 'root' ? 'That name is taken' : true)] }
});

describe('defineModel: fields', () => {
  it('fills defaults, converts types and maps nested data', () => {
    const u = new User({ name: 42 as any, age: '36.9' as any, admin: 'false' as any, address: { city: 'Oslo' } } as any);
    expect(u.data.name).toBe('42');
    expect(u.data.age).toBe(36);
    expect(u.data.admin).toBe(false);
    expect(u.data.city).toBe('Oslo');
    expect(u.data.note).toBe('new');
    expect(new User({}).data.age).toBe(18);
    expect(new User({ joined: '2026-03-04' as any }).data.joined).toBeInstanceOf(Date);
    expect(new User({ joined: 'nonsense' as any }).data.joined).toBeNull();
  });

  it('converts values it cannot make sense of to a safe default, and keeps null where allowed', () => {
    expect(new User({ age: 'abc' as any }).data.age).toBe(0);
    expect(new User({ age: null as any }).data.age).toBe(0);
    expect(new User({ age: '' as any }).data.age).toBe(0);
    expect(new User({ id: null as any }).data.id).toBeNull();
    expect(new User({ admin: 'yes' as any }).data.admin).toBe(true);
    expect(new User({ admin: 0 as any }).data.admin).toBe(false);
  });

  it('keeps fields the model does not know, leaves unset fields unset, and survives bad input', () => {
    const u = new User({ extra: 1 } as any);
    expect(u.data).toHaveProperty('extra', 1);
    expect('email' in u.data).toBe(false);
    expect(() => User.convert(null as any)).not.toThrow();
    expect(User.convert(undefined as any).age).toBe(18);
  });

  it('a custom convert gets the value and all the data', () => {
    const M = defineModel({ fields: [{ name: 'full', convert: (_v: any, d: any) => `${d.first} ${d.last}` }, 'first', 'last'] });
    expect(new M({ first: 'Ada', last: 'Lovelace' }).data.full).toBe('Ada Lovelace');
  });

  it('knows its id property, phantom state and fields', () => {
    expect(User.idProperty).toBe('id');
    expect(new User({ name: 'x' }).phantom).toBe(true);
    expect(new User({ id: 5, name: 'x' }).phantom).toBe(false);
    expect(new User({ id: 0 as any, name: 'x' }).phantom).toBe(false);
    const Keyed = defineModel({ idProperty: 'uid', fields: ['uid', 'n'] });
    expect(new Keyed({ uid: 'a' }).id).toBe('a');
    expect(Keyed.fields.map(f => f.name)).toEqual(['uid', 'n']);
    expect(defineModel({ fields: ['a'] }).fields.map(f => f.name)).toEqual(['id', 'a']);
  });
});

describe('Model: changes', () => {
  it('tracks what changed, emits change, and goes back to clean when put back', () => {
    const u = new User({ id: 1, name: 'Ada', age: 30 });
    const seen: any[] = [];
    u.on('change', (e: any) => seen.push([e.field, e.oldValue, e.value]));
    expect(u.set('age', '31')).toEqual(['age']);
    expect(u.dirty).toBe(true);
    expect(u.modified).toEqual({ age: 30 });
    expect(u.isModified('age')).toBe(true);
    expect(u.set('age', 31)).toEqual([]); // same value after conversion: nothing changed
    u.set({ name: 'Bob', age: 30 });
    expect(u.modified).toEqual({ name: 'Ada' });
    expect(seen.map(s => s[0])).toEqual(['age', 'name', 'age']);
    u.set('name', 'Ada');
    expect(u.dirty).toBe(false);
  });

  it('commits and rejects', () => {
    const u = new User({ id: 1, name: 'Ada' });
    u.set('name', 'Bob');
    u.reject();
    expect(u.get('name')).toBe('Ada');
    expect(u.dirty).toBe(false);
    const p = new User({ name: 'New' });
    p.commit();
    expect(p.phantom).toBe(false);
  });

  it('treats dates and NaN as values', () => {
    const u = new User({ id: 1, joined: '2026-03-04' as any });
    u.set('joined', new Date(u.data.joined!.getTime()));
    expect(u.dirty).toBe(false);
    u.set('joined', '2027-01-01');
    expect(u.dirty).toBe(true);
  });

  it('copies without the id, and writes JSON without non-persisted fields', () => {
    const u = new User({ id: 1, name: 'Ada', joined: '2026-03-04T00:00:00Z' as any });
    const c = u.copy();
    expect(c.phantom).toBe(true);
    expect(c.get('name')).toBe('Ada');
    const json = u.toJSON();
    expect('note' in json).toBe(false);
    expect(typeof json.joined).toBe('string');
  });
});

describe('Model: validation', () => {
  const check = (data: Partial<User>) => User.validate({ ...new User(data).data });

  it('is valid or lists messages by field', () => {
    expect(check({ name: 'Ada', email: 'a@b.co' })).toEqual({ valid: true, errors: {} });
    const bad = check({ name: '', email: 'nope', age: 200 });
    expect(bad.valid).toBe(false);
    expect(bad.errors.name).toEqual(['This field is required']);
    expect(bad.errors.email).toEqual(['Enter an email address']);
    expect(bad.errors.age).toEqual(['Must be at most 130']);
  });

  it('length, with the right plural', () => {
    expect(check({ name: 'A' }).errors.name).toEqual(['Use at least 2 characters']);
    expect(check({ name: 'Abcdefghijk' }).errors.name).toEqual(['Use at most 10 characters']);
    const One = defineModel({ fields: [{ name: 'a', validators: [{ type: 'length', min: 1 }] }, 'b'] });
    expect(One.validate({ a: '' }).valid).toBe(true); // empty passes every rule but `presence`
  });

  it('runs model-level and function validators, with your own message', () => {
    expect(check({ name: 'root' }).errors.name).toEqual(['That name is taken']);
    const M = defineModel({ fields: [{ name: 'n', validators: [{ type: 'format', matcher: /^\d+$/, message: 'Digits only' }, (v: any) => v === '13' ? ['Unlucky', 'Really'] : true] }] });
    expect(M.validate({ n: 'ab' }).errors.n).toEqual(['Digits only']);
    expect(M.validate({ n: '13' }).errors.n).toEqual(['Unlucky', 'Really']);
    expect(defineModel({ fields: [{ name: 'n', validators: [() => false] }] }).validate({ n: 1 }).errors.n).toEqual(['This value is not valid']);
  });

  it('inclusion, exclusion, url, presence of 0 and false', () => {
    const M = defineModel({ fields: [
      { name: 'role', validators: [{ type: 'inclusion', list: ['a', 'b'] }] },
      { name: 'bad', validators: [{ type: 'exclusion', list: ['x'] }] },
      { name: 'site', validators: ['url'] },
      { name: 'zero', validators: ['presence'] }
    ] });
    expect(M.validate({ role: 'c', bad: 'x', site: 'example', zero: 0 }).errors).toEqual({
      role: ['This is not one of the allowed values'], bad: ['This value is not allowed'], site: ['Enter a web address']
    });
    expect(M.validate({ role: 'a', site: 'https://example.com/x', zero: false }).valid).toBe(true);
    expect(M.validate({ zero: [] as any }).errors.zero).toEqual(['This field is required']);
  });

  it('answers in the language asked for, or the page\'s', () => {
    expect(User.validate({ name: '' }, 'es').errors.name).toEqual(['Este campo es obligatorio']);
    document.documentElement.setAttribute('lang', 'es');
    expect(new User({ name: '' }).validate().errors.name).toEqual(['Este campo es obligatorio']);
    document.documentElement.removeAttribute('lang');
    expect(i18n.t('validation.range.min', { min: 3 }, 'es')).toBe('Debe ser al menos 3');
  });

  it('isValid is a shortcut, and bad data never throws', () => {
    expect(new User({ name: 'Ada' }).isValid()).toBe(true);
    expect(() => User.validate(null as any)).not.toThrow();
  });
});

describe('pathGet', () => {
  it('reads dotted paths and never throws', () => {
    expect(pathGet({ a: { b: 1 } }, 'a.b')).toBe(1);
    expect(pathGet({ a: null }, 'a.b')).toBeUndefined();
    expect(pathGet(undefined, 'a')).toBeUndefined();
  });
});

describe('Model: loading and saving through a proxy', () => {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method!, body: init.body as string });
      const path = new URL(url).pathname;
      const make = (status: number, body: unknown) => ({ ok: status < 300, status, statusText: '', text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;
      if (init.method === 'POST') return make(200, { id: 99, name: 'Saved' });
      if (init.method === 'PUT') return make(200, { id: 7, name: 'Updated' });
      if (init.method === 'DELETE') return make(204, undefined);
      return path.endsWith('/404') ? make(404, { message: 'none' }) : make(200, { id: 7, name: 'Loaded', age: '41' });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });
  const Remote = defineModel<User>({ fields: ['id', 'name', { name: 'age', type: 'int' }], proxy: { type: 'rest', url: '/api/users' } });

  it('loads one record, converts it, and it is not new', async () => {
    const u = await Remote.load(7);
    expect(u.data).toMatchObject({ id: 7, name: 'Loaded', age: 41 });
    expect(u.phantom).toBe(false);
    expect(new URL(calls[0].url).pathname).toBe('/api/users/7');
  });

  it('says so when there is no such record', async () => {
    await expect(Remote.load('404')).rejects.toThrow('No record with id 404');
  });

  it('saves a new record with POST and takes what the server answered', async () => {
    const u = new Remote({ name: 'New' });
    await u.save();
    expect(calls[0].method).toBe('POST');
    expect(u.id).toBe(99);
    expect(u.get('name')).toBe('Saved');
    expect(u.phantom).toBe(false);
    expect(u.dirty).toBe(false);
  });

  it('saves a changed record with PUT to its URL, and erases with DELETE', async () => {
    const u = new Remote({ id: 7, name: 'Old' });
    u.set('name', 'Changed');
    await u.save();
    expect(calls[0]).toMatchObject({ method: 'PUT' });
    expect(new URL(calls[0].url).pathname).toBe('/api/users/7');
    expect(u.get('name')).toBe('Updated');
    await u.erase();
    expect(calls[1].method).toBe('DELETE');
    await new Remote({ name: 'never saved' }).erase(); // nothing to delete
    expect(calls.length).toBe(2);
  });

  it('refuses to save without a proxy', async () => {
    await expect(new User({ name: 'x' }).save()).rejects.toThrow(/no proxy/);
    await expect(User.load(1)).rejects.toThrow(/no proxy/);
  });
});

describe('Store with a model', () => {
  const rows = [{ id: 1, name: 'Ada', age: '30', admin: 'true' }, { id: 2, name: 'Bob', age: 25 }];
  const make = () => new Store<any>({ data: rows as any, model: User });

  it('converts what it loads and adds', () => {
    const s = make();
    expect(s.getById(1)!.data.age).toBe(30);
    expect(s.getById(1)!.data.admin).toBe(true);
    expect(s.getById(2)!.data.age).toBe(25);
    const [added] = s.add({ name: 'Cleo', age: '41' } as any);
    expect(added.data.age).toBe(41);
    expect(added.phantom).toBe(true);
    expect(typeof added.id).toBe('string'); // given a temporary id
  });

  it('converts and validates an edit, and says when validity changes', () => {
    const s = make();
    const seen: boolean[] = [];
    s.on('validate', (e: any) => seen.push(e.valid));
    const rec = s.getById(2)!;
    s.update(rec, { age: '200' as any });
    expect(rec.data.age).toBe(200);
    expect(rec.errors.age).toEqual(['Must be at most 130']);
    s.update(rec, { age: 20 });
    expect(rec.errors).toEqual({});
    expect(seen).toEqual([false, true]);
  });

  it('lets an edit set a declared field the record does not have yet, but not an unknown one', () => {
    const s = make();
    const rec = s.getById(1)!;
    s.update(rec, { email: 'a@b.co', nonsense: 1 } as any);
    expect(rec.data.email).toBe('a@b.co');
    expect('nonsense' in rec.data).toBe(false);
  });

  it('keeps the original value of a falsy field across repeated edits', () => {
    const s = new Store<any>({ data: [{ id: 1, n: 0 }] });
    const rec = s.getById(1)!;
    s.update(rec, { n: 5 });
    s.update(rec, { n: 6 });
    expect(rec.modified.n).toBe(0);
    s.rejectChanges(rec);
    expect(rec.data.n).toBe(0);
  });

  it('validates every record on request, and returns the bad ones', () => {
    const s = new Store<any>({ data: [{ id: 1, name: 'Ada' }, { id: 2, name: '' }], model: User });
    const bad = s.validate();
    expect(bad.map(r => r.id)).toEqual([2]);
    expect(s.getById(2)!.errors.name).toEqual(['This field is required']);
    expect(new Store<any>({ data: [{ id: 1 }] }).validate()).toEqual([]); // no model: nothing to check
  });

  it('uses the model\'s id property, and finds by id as text or number', () => {
    const Keyed = defineModel({ idProperty: 'uid', fields: ['uid', 'n'] });
    const s = new Store<any>({ data: [{ uid: 'a', n: 1 }, { uid: 7, n: 2 }], model: Keyed });
    expect(s.getById('a')!.data.n).toBe(1);
    expect(s.getById('7')!.data.n).toBe(2);
    expect(s.getById(7)!.id).toBe(7);
    expect(s.getById('zzz')).toBeNull();
    expect('id' in s.getById('a')!.data).toBe(false);
  });

  it('syncs with the model\'s id property', async () => {
    const Keyed = defineModel({ idProperty: 'uid', fields: ['uid', 'n'] });
    const s = new Store<any>({ model: Keyed, proxy: { type: 'memory', data: [{ uid: 'a', n: 1 }] } });
    await s.load();
    s.update(s.getById('a')!, { n: 2 });
    await s.sync();
    await s.load();
    expect(s.getById('a')!.data.n).toBe(2);
  });
});
