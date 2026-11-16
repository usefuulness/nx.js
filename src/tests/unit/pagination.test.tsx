import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NX, pageItems, type NXPagination } from '@/index';
import '@/locales/es';
import { nextFrame } from '../utils';

describe('pageItems', () => {
  const g = (side: 'start' | 'end') => `gap-${side}`;
  it('shows every page when there are few', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the same number of items as you move through a long list', () => {
    expect(pageItems(1, 20)).toEqual([1, 2, 3, 4, 5, g('end'), 20]);
    expect(pageItems(4, 20)).toEqual([1, 2, 3, 4, 5, g('end'), 20]);
    expect(pageItems(10, 20)).toEqual([1, g('start'), 9, 10, 11, g('end'), 20]);
    expect(pageItems(17, 20)).toEqual([1, g('start'), 16, 17, 18, 19, 20]);
    expect(pageItems(20, 20)).toEqual([1, g('start'), 16, 17, 18, 19, 20]);
    for (let p = 1; p <= 20; p++) expect(pageItems(p, 20)).toHaveLength(7);
  });

  it('honours siblings and boundary, and never repeats or skips a page', () => {
    expect(pageItems(10, 30, 2, 2)).toEqual([1, 2, g('start'), 8, 9, 10, 11, 12, g('end'), 29, 30]);
    for (const pages of [1, 2, 5, 9, 12, 40]) {
      for (let page = 1; page <= pages; page++) {
        const numbers = pageItems(page, pages).filter((i): i is number => typeof i === 'number');
        expect(numbers, `${page}/${pages}`).toEqual([...numbers].sort((a, b) => a - b));
        expect(new Set(numbers).size).toBe(numbers.length);
        expect(numbers).toContain(page);
        expect(numbers[0]).toBe(1);
        expect(numbers.at(-1)).toBe(pages);
      }
    }
  });
});

describe('<nx-pagination>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('lang');
  });
  const mount = (config: Record<string, any> = {}) => {
    const el = NX.create<NXPagination>({ xtype: 'pagination', total: 250, ...config });
    document.body.appendChild(el);
    return el;
  };
  const buttons = (el: NXPagination) => Array.from(el.shadowRoot!.querySelectorAll('button')) as HTMLButtonElement[];
  const labels = (el: NXPagination) => buttons(el).map(b => b.textContent!.trim() || b.getAttribute('aria-label'));
  const flush = async () => { await nextFrame(); await nextFrame(); };

  it('is a labelled navigation with the current page marked', () => {
    const el = mount({ page: 3 });
    expect(el.shadowRoot!.querySelector('nav')!.getAttribute('aria-label')).toBe('Pagination');
    const current = el.shadowRoot!.querySelector('[aria-current="page"]')!;
    expect(current.textContent!.trim()).toBe('3');
    expect(el.shadowRoot!.querySelectorAll('[aria-current]')).toHaveLength(1);
    expect(labels(el)).toEqual(['Previous page', '1', '2', '3', '4', '5', '25', 'Next page']);
    expect(buttons(el)[3].getAttribute('aria-label')).toBe('Page 3');
  });

  it('disables previous on the first page and next on the last', () => {
    const first = mount({ page: 1 });
    expect(buttons(first)[0].disabled).toBe(true);
    expect(buttons(first).at(-1)!.disabled).toBe(false);
    const last = mount({ page: 25 });
    expect(buttons(last).at(-1)!.disabled).toBe(true);
    expect(buttons(last)[0].disabled).toBe(false);
  });

  it('moves with clicks: updates the page attribute, emits page-change, and keeps focus on the current page', async () => {
    const el = mount();
    const changed = vi.fn();
    el.addEventListener('page-change', changed);
    buttons(el).at(-1)!.focus();
    buttons(el).at(-1)!.click(); // next
    await flush();
    expect(el.getAttribute('page')).toBe('2');
    expect(el.getPage()).toBe(2);
    expect((changed.mock.calls[0][0] as CustomEvent).detail).toEqual({ page: 2, pageSize: 10 });
    expect(el.shadowRoot!.activeElement).toBe(el.shadowRoot!.querySelector('.page.current'));
    expect(el.shadowRoot!.querySelector('.page.current')!.textContent!.trim()).toBe('2');

    (buttons(el).find(b => b.textContent!.trim() === '25')!).click();
    await flush();
    expect(el.getPage()).toBe(25);
    expect(el.shadowRoot!.activeElement!.textContent!.trim()).toBe('25'); // focus stays on the current page though the buttons were rebuilt
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('clamps out-of-range pages and does not emit when nothing moved', async () => {
    const el = mount({ page: 99 });
    expect(el.getPage()).toBe(25);
    const changed = vi.fn();
    el.addEventListener('page-change', changed);
    el.goTo(25);
    el.goTo(0); // clamps to 1
    await flush();
    expect(el.getPage()).toBe(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(mount({ total: 0 }).pageCount()).toBe(1);
  });

  it('recomputes when total or page size change', async () => {
    const el = mount({ total: 30, page: 2 });
    expect(el.pageCount()).toBe(3);
    el.setAttribute('total', '95');
    el.setAttribute('page-size', '5');
    await flush();
    expect(el.pageCount()).toBe(19);
    expect(labels(el)).toContain('19');
  });

  it('shows the range, and a compact form', async () => {
    const el = mount({ total: 95, page: 10, showTotal: true });
    expect(el.shadowRoot!.querySelector('.range')!.textContent).toBe('91–95 of 95');
    const compact = mount({ total: 95, page: 2, compact: true });
    expect(compact.shadowRoot!.querySelector('.status')!.textContent).toBe('Page 2 of 10');
    expect(buttons(compact)).toHaveLength(2);
  });

  it('offers page sizes and keeps the first item in view when the size changes', async () => {
    const el = mount({ total: 500, page: 5, sizes: '10, 25, 50' }); // first item: 41
    const select = el.shadowRoot!.querySelector('select') as HTMLSelectElement;
    expect(Array.from(select.options).map(o => o.value)).toEqual(['10', '25', '50']);
    const sizeChanged = vi.fn();
    el.addEventListener('page-size-change', sizeChanged);
    select.value = '25';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect(el.getPageSize()).toBe(25);
    expect(el.getPage()).toBe(2); // items 26-50 include item 41
    expect((sizeChanged.mock.calls[0][0] as CustomEvent).detail).toEqual({ pageSize: 25 });
    // A size that isn't in the list is still selectable
    const odd = mount({ pageSize: 15, sizes: [10, 25] });
    expect(Array.from((odd.shadowRoot!.querySelector('select') as HTMLSelectElement).options).map(o => o.value)).toEqual(['10', '15', '25']);
  });

  it('a page given in a config just sets the attribute, with no event', () => {
    const changed = vi.fn();
    const el = NX.create<NXPagination>({ xtype: 'pagination', total: 250, disabled: true, page: 4, pageSize: 5, onPageChange: changed } as any);
    document.body.appendChild(el);
    expect(el.getAttribute('page')).toBe('4');
    expect(el.getPage()).toBe(4);
    expect(changed).not.toHaveBeenCalled();
  });

  it('can be disabled', async () => {
    const el = mount({ disabled: true, page: 2 });
    expect(buttons(el).every(b => b.disabled)).toBe(true);
    el.goTo(3);
    expect(el.getPage()).toBe(2);
  });

  it('speaks the page language', () => {
    document.documentElement.lang = 'es';
    const el = mount({ page: 2, showTotal: true });
    expect(el.shadowRoot!.querySelector('nav')!.getAttribute('aria-label')).toBe('Paginación');
    expect(buttons(el)[0].getAttribute('aria-label')).toBe('Página anterior');
    expect(el.shadowRoot!.querySelector('.range')!.textContent).toBe('11–20 de 250');
  });
});
