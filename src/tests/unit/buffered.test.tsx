import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NX, Store, type NXGrid } from '@/index';
import { nextFrame } from '../utils';

const TOTAL = 100_000;
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

/** A paged server over 100,000 rows: answers start/limit/sort/filter and records every request. */
const server = () => {
  const requests: URL[] = [];
  const delays = new Map<number, number>();
  const handler = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    const start = Number(url.searchParams.get('start'));
    const limit = Number(url.searchParams.get('limit'));
    const sort = JSON.parse(url.searchParams.get('sort') ?? '[]');
    const filter = JSON.parse(url.searchParams.get('filter') ?? '[]');
    await tick(delays.get(start) ?? 0);
    const desc = sort[0]?.direction === 'DESC';
    const matches = filter[0]?.value ? (i: number) => `row ${i}`.includes(filter[0].value) : () => true;
    const ids: number[] = [];
    let count = 0;
    for (let n = 0; n < TOTAL; n++) {
      const i = desc ? TOTAL - 1 - n : n;
      if (!matches(i)) continue;
      if (count >= start && ids.length < limit) ids.push(i);
      count++;
      if (ids.length >= limit && count >= start + limit && !filter[0]) { count = filter[0] ? count : TOTAL; break; }
    }
    return new Response(JSON.stringify({ data: ids.map(i => ({ id: i, name: `Row ${i}` })), total: filter[0] ? count : TOTAL }), {
      headers: { 'content-type': 'application/json' }
    });
  });
  return { handler, requests, delays };
};
const pagesRequested = (requests: URL[]) => requests.map(u => Number(u.searchParams.get('start')) / Number(u.searchParams.get('limit')));
const makeStore = (extra: Record<string, any> = {}) =>
  new Store({ buffered: true, pageSize: 100, proxy: { type: 'rest', url: '/api/rows' }, ...extra });

describe('buffered Store', () => {
  let srv: ReturnType<typeof server>;
  beforeEach(() => {
    srv = server();
    vi.stubGlobal('fetch', srv.handler);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the first page, learns the total and serves rows by index', async () => {
    const store = makeStore();
    await store.load();
    expect(store.getTotalCount()).toBe(TOTAL);
    expect(store.getRecordAt(0)!.data).toEqual({ id: 0, name: 'Row 0' });
    expect(store.getRecordAt(99)!.data.name).toBe('Row 99');
    expect(store.getRecordAt(100)).toBeUndefined();
    expect(srv.requests).toHaveLength(1);
    expect(srv.requests[0].pathname).toBe('/api/rows');
  });

  it('fetches only missing pages and never the same page twice at once', async () => {
    const store = makeStore();
    await store.load();
    await Promise.all([store.ensureRange(150, 420), store.ensureRange(250, 300)]);
    expect(pagesRequested(srv.requests)).toEqual([0, 1, 2, 3, 4]);
    await store.ensureRange(0, 500);
    expect(srv.requests).toHaveLength(5);
    expect(store.getRecordAt(450)!.data.id).toBe(450);
  });

  it('keeps at most maxBufferedPages, dropping the least recently used', async () => {
    const store = makeStore({ maxBufferedPages: 3 });
    await store.load();
    await store.ensureRange(100, 400); // pages 1-3
    expect(store.getRecordAt(0)).toBeUndefined(); // page 0 was the oldest
    store.getRecordAt(150); // touch page 1
    await store.ensureRange(400, 500); // page 4 evicts page 2, not the touched page 1
    expect(store.getRecordAt(150)).toBeDefined();
    expect(store.getRecordAt(250)).toBeUndefined();
  });

  it('sorting asks the server, starts over, and ignores an older slow answer', async () => {
    const store = makeStore();
    await store.load();
    srv.delays.set(100, 60); // page 1 of the old order answers late
    const slow = store.ensureRange(100, 200);
    store.sort({ property: 'id', direction: 'DESC' });
    await tick(120);
    await slow;
    expect(JSON.parse(srv.requests.at(-1)!.searchParams.get('sort')!)).toEqual([{ property: 'id', direction: 'DESC' }]);
    expect(store.getRecordAt(0)!.data.id).toBe(TOTAL - 1);
    expect(store.getRecordAt(150)).toBeUndefined(); // the stale page 1 was dropped, not stored
  });

  it('reports a failed page, and does not retry it straight away', async () => {
    const store = makeStore();
    await store.load();
    srv.handler.mockRejectedValueOnce(new Error('offline'));
    const onException = vi.fn();
    store.on('exception', onException);
    await store.ensureRange(100, 200);
    expect(onException).toHaveBeenCalledTimes(1);
    const calls = srv.handler.mock.calls.length;
    await store.ensureRange(100, 200);
    expect(srv.handler.mock.calls.length).toBe(calls);
  });
});

describe('buffered grid', () => {
  let srv: ReturnType<typeof server>;
  beforeEach(() => {
    document.body.innerHTML = '';
    srv = server();
    vi.stubGlobal('fetch', srv.handler);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mount = async (extra: Record<string, any> = {}) => {
    const store = makeStore({ autoLoad: true });
    const grid = NX.create<NXGrid>({
      xtype: 'grid', store, rowHeight: 40, height: 400, search: true,
      columns: [{ field: 'id', header: 'Id' }, { field: 'name', header: 'Name' }],
      ...extra
    });
    document.body.appendChild(grid);
    await tick(20);
    await nextFrame();
    return { grid, store };
  };
  const body = (grid: NXGrid) => grid.shadowRoot!.querySelector('.nx-grid-body') as HTMLElement;
  const names = (grid: NXGrid) =>
    Array.from(grid.shadowRoot!.querySelectorAll('tbody tr:not(.spacer):not(.loading-row)')).map(tr => tr.querySelectorAll('td')[1]?.textContent);

  it('is virtual by itself, reports the full size, and shows rows from the first page', async () => {
    const { grid } = await mount();
    expect(grid.shadowRoot!.querySelector('table')!.getAttribute('aria-rowcount')).toBe(String(TOTAL + 1));
    expect(names(grid).slice(0, 3)).toEqual(['Row 0', 'Row 1', 'Row 2']);
    expect(grid.shadowRoot!.querySelector('.nx-grid-footer')!.textContent).toContain('100,000 rows');
    expect(grid.shadowRoot!.querySelector('.pager')).toBeNull();
  });

  it('shows skeleton rows for a page in flight, then the data, fetching only what is near the view', async () => {
    const { grid } = await mount();
    // Rows 3,992-4,018 sit on pages 39 and 40 (start 3900 and 4000): answer those slowly
    srv.delays.set(3900, 150);
    srv.delays.set(4000, 150);
    body(grid).scrollTop = 40 * 4000;
    body(grid).dispatchEvent(new Event('scroll'));
    await nextFrame();
    await nextFrame();
    expect(grid.shadowRoot!.querySelectorAll('tr.loading-row').length).toBeGreaterThan(0);
    expect(grid.shadowRoot!.querySelector('tr.loading-row')!.getAttribute('aria-busy')).toBe('true');
    expect(grid.shadowRoot!.querySelector('tr.loading-row .sr-only')!.textContent).toBe('Loading');
    await tick(250);
    await nextFrame();
    expect(grid.shadowRoot!.querySelectorAll('tr.loading-row')).toHaveLength(0);
    expect(names(grid)).toContain('Row 4000');
    // Page 0 plus the one or two pages around row 4,000, not thousands of them
    expect(srv.requests.length).toBeLessThanOrEqual(4);
  });

  it('sorts on the server when a header is clicked', async () => {
    const { grid } = await mount();
    (grid.shadowRoot!.querySelector('th[data-field="id"] button') as HTMLElement).click();
    await tick(20);
    await nextFrame();
    expect(JSON.parse(srv.requests.at(-1)!.searchParams.get('sort')!)).toEqual([{ property: 'id', direction: 'ASC' }]);
    (grid.shadowRoot!.querySelector('th[data-field="id"] button') as HTMLElement).click();
    await tick(20);
    await nextFrame();
    expect(names(grid)[0]).toBe(`Row ${TOTAL - 1}`);
  });

  it('searches on the server after typing pauses, as one request', async () => {
    const { grid } = await mount();
    const before = srv.requests.length;
    const input = grid.shadowRoot!.querySelector('.nx-grid-search input') as HTMLInputElement;
    for (const text of ['9', '99', '999']) {
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await tick(350);
    await nextFrame();
    expect(srv.requests.length - before).toBe(1);
    expect(JSON.parse(srv.requests.at(-1)!.searchParams.get('filter')!)).toEqual([{ property: '*', value: '999', operator: 'like' }]);
    expect(names(grid)[0]).toBe('Row 999');
    expect(grid.shadowRoot!.querySelector('.nx-grid-footer')!.textContent).toMatch(/\d+ rows/);
  });

  it('maps clicks to the right row by position', async () => {
    const { grid } = await mount();
    const onClick = vi.fn();
    grid.addEventListener('row-click', onClick);
    (grid.shadowRoot!.querySelectorAll('tbody tr:not(.spacer)')[3].querySelector('td') as HTMLElement).click();
    expect((onClick.mock.calls[0][0] as CustomEvent).detail.row).toEqual({ id: 3, name: 'Row 3' });
  });
});
