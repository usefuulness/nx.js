import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseApiError, ajax, AjaxError, defineModel } from '@/index';
import { expandTemplate } from '@/data/hal';

describe('parseApiError', () => {
  it('reads Spring Boot validation answers', () => {
    const info = parseApiError({ status: 400, message: 'Validation failed for object=\'user\'. Error count: 2', response: { status: 400, error: 'Bad Request', message: 'Validation failed for object=\'user\'. Error count: 2', errors: [
      { field: 'email', defaultMessage: 'must be a well-formed email address', code: 'Email' },
      { field: 'name', defaultMessage: 'must not be blank' }, { field: 'name', defaultMessage: 'size must be between 2 and 20' }
    ] } });
    expect(info.fields).toEqual({ email: ['must be a well-formed email address'], name: ['must not be blank', 'size must be between 2 and 20'] });
    expect(info.status).toBe(400);
    // "Validation failed for object…" says little: the first complaint is the message
    expect(info.message).toBe('email: must be a well-formed email address');
  });

  it('reads Spring Data REST answers', () => {
    const info = parseApiError({ status: 400, response: { errors: [{ entity: 'Person', property: 'lastName', invalidValue: '', message: 'must not be empty' }] } });
    expect(info.fields).toEqual({ lastName: ['must not be empty'] });
    expect(info.message).toBe('lastName: must not be empty');
  });

  it('reads RFC 7807 problem details, with both error shapes', () => {
    expect(parseApiError({ response: { type: 'about:blank', title: 'Unprocessable', detail: 'The order has no items', status: 422, errors: { items: ['at least one'] } }, status: 422 }))
      .toMatchObject({ message: 'The order has no items', fields: { items: ['at least one'] } });
    expect(parseApiError({ response: { title: 'Invalid', 'invalid-params': [{ name: 'age', reason: 'must be a number' }] } }).fields).toEqual({ age: ['must be a number'] });
  });

  it('reads plain shapes: a message, a map of messages, a string, and keeps complaints with no field apart', () => {
    expect(parseApiError({ response: { message: 'Nope', errors: { a: 'bad', b: ['worse', 'worst'] } } }).fields).toEqual({ a: ['bad'], b: ['worse', 'worst'] });
    expect(parseApiError('Gateway down').message).toBe('Gateway down');
    expect(parseApiError({ response: { errors: ['Something general', { message: 'And this' }] } }).details).toEqual(['Something general', 'And this']);
    expect(parseApiError(null)).toMatchObject({ message: 'The request failed', fields: {}, details: [] });
    expect(parseApiError(new Error('boom')).message).toBe('boom');
  });
});

describe('ajax errors carry what the server said', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('the message is the server\'s detail, and `fields` says which fields', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ title: 'Invalid', detail: 'Check the form', errors: { name: ['too short'] } }), { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } })));
    const e = await ajax('/x').catch(x => x) as AjaxError;
    expect(e.status).toBe(422);
    expect(e.message).toBe('Check the form');
    expect(e.fields).toEqual({ name: ['too short'] });
  });
  it('an answer with no useful body falls back to the status line', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>oops</html>', { status: 502, statusText: 'Bad Gateway' })));
    expect(((await ajax('/x').catch(x => x)) as AjaxError).message).toBe('502 Bad Gateway');
  });
});

describe('a model keeps what the server refused', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('serverErrors holds the field complaints until the field is edited or the save works', async () => {
    const User = defineModel({ name: 'User', fields: [{ name: 'id', type: 'int' }, { name: 'email', type: 'string' }, { name: 'name', type: 'string' }], proxy: { type: 'rest', url: '/api/users' } });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ errors: [{ field: 'email', defaultMessage: 'already taken' }, { field: 'name', defaultMessage: 'too short' }] }), { status: 400, statusText: 'Bad Request' }));
    vi.stubGlobal('fetch', fetchMock);
    const user = new User({ email: 'a@b.co', name: 'A' });
    await expect(user.save()).rejects.toMatchObject({ status: 400 });
    expect(user.serverErrors).toEqual({ email: ['already taken'], name: ['too short'] });
    user.set('email', 'c@d.co');
    expect(user.serverErrors).toEqual({ name: ['too short'] });
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: 7, email: 'c@d.co', name: 'Ada' }), { status: 201, headers: { 'content-type': 'application/json' } }));
    user.set('name', 'Ada');
    await user.save();
    expect(user.serverErrors).toEqual({});
    expect(user.id).toBe(7);
  });
});

describe('HAL filters for Spring-style servers', () => {
  it('a multi-sort repeats `sort` (and expandTemplate does it for the {?sort*} form)', () => {
    expect(expandTemplate('/people{?page,size,sort*}', { page: 0, size: 10, sort: ['name,asc', 'age,desc'] })).toBe('/people?page=0&size=10&sort=name%2Casc&sort=age%2Cdesc');
  });
});
