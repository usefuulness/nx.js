import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHal } from '@/data/hal';

describe('HAL stores for Spring Data REST style servers', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const seen: string[] = [];
  const stub = (entry: Record<string, any>) => {
    seen.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = new URL(url, 'http://x');
      seen.push(u.pathname + u.search);
      const body = u.pathname === '/api' ? { _links: entry } : { _embedded: { people: [{ name: 'Ada' }] }, page: { totalElements: 1 }, _links: { self: { href: u.pathname } } };
      return { ok: true, status: 200, statusText: '', text: async () => JSON.stringify(body) } as Response;
    }));
  };

  it('filterMap renames the filtered property to the template variable the server uses', async () => {
    stub({ people: { href: '/api/people{?page,size,sort*,nameContains,enabled}', templated: true } });
    const store = await createHal('/api').store('people', { filterMap: { name: 'nameContains', active: 'enabled' } });
    store.filter([{ property: 'name', value: 'ad', operator: 'like' }, { property: 'active', value: true, operator: 'eq' }]);
    await store.load();
    const url = new URL(seen.at(-1)!, 'http://x');
    expect(url.searchParams.get('nameContains')).toBe('ad');
    expect(url.searchParams.get('enabled')).toBe('true');
  });

  it('several sorters repeat `sort`, as Spring reads them', async () => {
    stub({ people: { href: '/api/people{?page,size,sort*}', templated: true } });
    const store = await createHal('/api').store('people', {});
    store.sort([{ property: 'name', direction: 'ASC' }, { property: 'age', direction: 'DESC' }]);
    await store.load();
    expect(new URL(seen.at(-1)!, 'http://x').searchParams.getAll('sort')).toEqual(['name,asc', 'age,desc']);
  });

  it('filterVariables handles what a name cannot say, like a range', async () => {
    stub({ people: { href: '/api/people{?page,size,ageFrom,ageTo}', templated: true } });
    const store = await createHal('/api').store('people', {
      filterVariables: f => (f.property === 'age' && f.operator === 'between' ? { ageFrom: f.value[0], ageTo: f.value[1] } : undefined)
    });
    store.filter({ property: 'age', value: [18, 30], operator: 'between' } as any);
    await store.load();
    const url = new URL(seen.at(-1)!, 'http://x');
    expect([url.searchParams.get('ageFrom'), url.searchParams.get('ageTo')]).toEqual(['18', '30']);
  });
});
