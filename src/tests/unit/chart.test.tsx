import { describe, it, expect, beforeEach } from 'vitest';
import { NX, niceScale, type NXChart } from '@/index';
import '@/locales/es';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };

describe('niceScale', () => {
  it('rounds to friendly steps and includes zero', () => {
    expect(niceScale(0, 97)).toEqual({ min: 0, max: 100, step: 20 });
    expect(niceScale(3, 47).min).toBe(0);
    expect(niceScale(-30, 40)).toMatchObject({ min: -40, max: 40 });
  });
  it('survives flat and bad input', () => {
    expect(niceScale(0, 0).max).toBeGreaterThan(0);
    expect(niceScale(NaN, 5).max).toBe(1);
  });
});

describe('<nx-chart>', () => {
  beforeEach(() => { document.body.innerHTML = ''; document.documentElement.removeAttribute('lang'); });
  const mount = async (attrs: string) => {
    document.body.innerHTML = `<nx-chart ${attrs}></nx-chart>`;
    await frames();
    return document.body.firstElementChild as NXChart;
  };
  const q = (el: NXChart, sel: string) => Array.from(el.shadowRoot!.querySelectorAll(sel));
  const data = `data='[{"label":"Jan","value":12},{"label":"Feb","value":19},{"label":"Mar","value":-3}]'`;

  it('draws one bar per value, and a real data table', async () => {
    const el = await mount(`label="Sales" ${data}`);
    expect(q(el, 'rect.mark').length).toBe(3);
    expect(q(el, 'table tbody tr').map(r => r.textContent)).toEqual(['Jan12', 'Feb19', 'Mar-3']);
    expect(el.shadowRoot!.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Sales');
    expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('gives each mark a text tooltip', async () => {
    const el = await mount(data);
    expect(q(el, 'rect.mark title').map(t => t.textContent)[1]).toBe('Feb, Value: 19');
  });

  it('draws lines and areas with differently shaped markers per series', async () => {
    const series = `labels='["A","B","C"]' series='[{"name":"x","data":[1,2,3]},{"name":"y","data":[3,2,1]},{"name":"z","data":[2,2,2]}]'`;
    const el = await mount(`type="line" ${series}`);
    expect(q(el, 'circle.point').length).toBe(3);
    expect(q(el, 'rect.point').length).toBe(3);
    expect(q(el, 'path.point').length).toBe(3);
    expect(q(el, '.legend li').length).toBe(3);
    const area = await mount(`type="area" ${series}`);
    expect(q(area, 'path[opacity]').length).toBe(3);
  });

  it('groups bars for several series', async () => {
    const el = await mount(`labels='["A","B"]' series='[{"name":"x","data":[1,2]},{"name":"y","data":[3,4]}]'`);
    expect(q(el, 'rect.mark').length).toBe(4);
  });

  it('draws a donut with a legend, percentages and the total', async () => {
    const el = await mount(`type="donut" data='[{"label":"A","value":1},{"label":"B","value":3},{"label":"C","value":0}]'`);
    expect(q(el, 'path.slice').length).toBe(2);
    expect(q(el, 'path.slice title').map(t => t.textContent)).toEqual(['A: 1 (25%)', 'B: 3 (75%)']);
    expect(el.shadowRoot!.querySelector('.total')!.textContent).toBe('4');
    expect(q(el, '.legend li').length).toBe(3);
  });

  it('a donut with one value still draws a ring', async () => {
    const el = await mount(`type="donut" data='[{"label":"A","value":5}]'`);
    expect(q(el, 'path.slice').length).toBe(1);
  });

  it('shows an empty state instead of failing on bad input', async () => {
    for (const attrs of ['', 'data="not json"', 'series="[1,2]"', 'data="[]"', `data='[null,5,"x"]'`]) {
      const el = await mount(attrs);
      expect(el.shadowRoot).toBeTruthy();
    }
    expect((await mount('')).shadowRoot!.textContent).toContain('No data to show');
    expect((await mount('data="not json"')).shadowRoot!.querySelector('.empty')).toBeTruthy();
  });

  it('treats text from data as text, never markup', async () => {
    const el = await mount(`label="&lt;img src=x onerror=alert(1)&gt;" data='[{"label":"<b>x</b>","value":1}]'`);
    expect(el.shadowRoot!.querySelector('img, b')).toBeNull();
    expect(q(el, 'text').some(t => t.textContent === '<b>x</b>')).toBe(true);
  });

  it('caps the number of points', async () => {
    const rows = JSON.stringify(Array.from({ length: 5000 }, (_, i) => ({ label: `p${i}`, value: i })));
    const el = await mount(`type="line" data='${rows}'`);
    expect(q(el, 'table tbody tr').length).toBe(500);
  });

  it('updates when the data changes, and takes a config', async () => {
    const el = await mount(data);
    el.setAttribute('data', '[{"label":"A","value":1}]');
    await frames();
    expect(q(el, 'rect.mark').length).toBe(1);
    const c = NX.create<NXChart>({ xtype: 'chart', type: 'donut', data: [{ label: 'A', value: 2 }, { label: 'B', value: 2 }] });
    document.body.appendChild(c); await frames();
    expect(q(c, 'path.slice').length).toBe(2);
  });

  it('writes every tick of an axis in the same style', async () => {
    const el = await mount(`data='[{"label":"a","value":4000},{"label":"b","value":18000}]'`);
    const ticks = q(el, 'text.tick').map(t => t.textContent).filter(t => /\d/.test(t!) && t!.length < 7);
    expect(ticks.some(t => /K$/.test(t!))).toBe(true);
    expect(ticks.filter(t => /,/.test(t!))).toEqual([]);   // no "5,000" beside "10K"
    const small = await mount(`data='[{"label":"a","value":4},{"label":"b","value":9}]'`);
    expect(q(small, 'text.tick').some(t => /K$/.test(t.textContent!))).toBe(false);
  });

  it('is translated and formats numbers per language', async () => {
    document.documentElement.setAttribute('lang', 'es');
    const el = await mount(`data='[{"label":"A","value":1234.5}]'`);
    expect(el.shadowRoot!.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Gráfico');
    expect(q(el, 'rect.mark title')[0].textContent).toContain('1234,5');
  });
});
