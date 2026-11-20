import { describe, it, expect, beforeEach } from 'vitest';
import { NX } from '@/index';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };
const mount = async (html: string) => {
  document.body.innerHTML = html;
  await frames();
  return document.body.firstElementChild as HTMLElement;
};
const css = (el: Element) => Array.from(el.shadowRoot!.querySelectorAll('style')).map(s => s.textContent).join('\n');

describe('container layouts', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('sidebar: the side keeps its width and the content stacks under it when narrow', async () => {
    const el = await mount('<nx-container layout="sidebar" side-width="14rem" content-min="60%" gap="12"><nav>a</nav><main>b</main></nx-container>');
    const style = css(el);
    expect(style).toContain('flex-wrap: wrap');
    expect(style).toContain('::slotted(:first-child) { flex-basis: 14rem; flex-grow: 1; }');
    expect(style).toContain('min-inline-size: 60%');
    expect(style).toContain('gap: 12px');
  });

  it('sidebar side="end" makes the last child the side', async () => {
    const style = css(await mount('<nx-container layout="sidebar" side="end"><main>b</main><aside>a</aside></nx-container>'));
    expect(style).toContain('::slotted(:last-child) { flex-basis: 16rem');
  });

  it('switcher, center, cluster, stack and masonry', async () => {
    expect(css(await mount('<nx-container layout="switcher" threshold="40rem"><i></i><i></i></nx-container>'))).toContain('calc((40rem - 100%) * 999)');
    expect(css(await mount('<nx-container layout="center" max-width="48rem"></nx-container>'))).toContain('max-width: 48rem');
    expect(css(await mount('<nx-container layout="cluster"></nx-container>'))).toContain('flex-wrap: wrap');
    expect(css(await mount('<nx-container layout="stack" gap="8"></nx-container>'))).toContain('flex-direction: column');
    expect(css(await mount('<nx-container layout="masonry" min-column-width="200"></nx-container>'))).toContain('column-width: 200px');
  });

  it('table and grid: children can span columns', async () => {
    const style = css(await mount('<nx-container layout="table" columns="3"><i span="2"></i></nx-container>'));
    expect(style).toContain('repeat(3, minmax(0, 1fr))');
    expect(style).toContain('::slotted([span="2"]) { grid-column: span 2; }');
    expect(style).toContain('::slotted([span="full"])');
  });

  it('card layout shows one child, by position or name, and tells you', async () => {
    const el = await mount('<nx-container layout="card" active="1"><div id="a">A</div><div id="b" name="second">B</div><div id="c">C</div></nx-container>') as any;
    expect(css(el)).toContain('::slotted(:not(:nth-child(2))) { display: none !important; }');
    const seen: any[] = [];
    el.addEventListener('activechange', (e: Event) => seen.push((e as CustomEvent).detail));
    el.next();
    await frames();
    expect(el.getAttribute('active')).toBe('2');
    expect(css(el)).toContain(':nth-child(3)');
    el.setActive('second');
    expect(el.getAttribute('active')).toBe('1');
    el.previous(); el.previous();
    expect(el.getAttribute('active')).toBe('0');
    expect(seen.map(s => s.index)).toEqual([2, 1, 0]);
    expect(seen[1].id).toBe('b');
    el.setActive(99);
    expect(el.getAttribute('active')).toBe('0');
  });

  it('a card shown by name becomes a position when it connects', async () => {
    const el = await mount('<nx-container layout="card" active="pay"><div name="cart">1</div><div name="pay">2</div></nx-container>');
    expect(el.getAttribute('active')).toBe('1');
  });
});

describe('<nx-stat>', () => {
  it('writes the change out and colours it by whether it is good news', async () => {
    const el = await mount('<nx-stat label="Revenue" value="$48,200" delta="12.5" delta-label="vs last month" icon="chart"></nx-stat>');
    const delta = el.shadowRoot!.querySelector('.delta')!;
    expect(delta.classList.contains('good')).toBe(true);
    expect(delta.textContent).toContain('+12.5%');
    expect(delta.querySelector('.sr-only')!.textContent).toBe('up');
    expect(el.shadowRoot!.querySelector('.value')!.textContent).toBe('$48,200');
    expect(el.shadowRoot!.querySelector('.arrow')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('invert: a rise is bad; a fall is shown with a real minus sign; zero is neutral', async () => {
    const bad = await mount('<nx-stat label="Churn" value="3%" delta="2" invert></nx-stat>');
    expect(bad.shadowRoot!.querySelector('.delta')!.classList.contains('bad')).toBe(true);
    const down = await mount('<nx-stat label="Errors" value="4" delta="-8" invert></nx-stat>');
    expect(down.shadowRoot!.querySelector('.delta')!.classList.contains('good')).toBe(true);
    expect(down.shadowRoot!.querySelector('.delta')!.textContent).toContain('−8%');
    const flat = await mount('<nx-stat label="Users" value="9" delta="0"></nx-stat>');
    expect(flat.shadowRoot!.querySelector('.delta')!.classList.contains('neutral')).toBe(true);
    expect(flat.shadowRoot!.querySelector('.sr-only')!.textContent).toBe('unchanged');
  });

  it('has no change line without a delta, draws a decorative trend, and can be loading', async () => {
    const el = await mount('<nx-stat label="Users" value="9" trend="[1,3,2,5]"></nx-stat>');
    expect(el.shadowRoot!.querySelector('.delta')).toBeNull();
    expect(el.shadowRoot!.querySelector('svg.trend')!.getAttribute('aria-hidden')).toBe('true');
    const loading = await mount('<nx-stat label="Users" value="9" delta="3" loading></nx-stat>');
    expect(loading.shadowRoot!.querySelector('.value')).toBeNull();
    expect(loading.shadowRoot!.querySelector('.stat')!.getAttribute('aria-busy')).toBe('true');
  });
});

describe('<nx-page-header>', () => {
  it('renders the title as the heading level asked for, and slots for the rest', async () => {
    const el = await mount('<nx-page-header title="Orders" description="This week"><button slot="actions">New</button></nx-page-header>');
    expect(el.shadowRoot!.querySelector('h1')!.textContent).toBe('Orders');
    expect(el.shadowRoot!.querySelector('.description')!.textContent).toBe('This week');
    expect(el.shadowRoot!.querySelector('slot[name="actions"]')).toBeTruthy();
    const h2 = await mount('<nx-page-header title="Sub" level="2"></nx-page-header>');
    expect(h2.shadowRoot!.querySelector('h2')!.textContent).toBe('Sub');
  });
});

describe('<nx-empty> and <nx-descriptions>', () => {
  it('empty shows title and description', async () => {
    const el = await mount('<nx-empty icon="inbox" title="No orders yet" description="They appear here."><button>Create</button></nx-empty>');
    expect(el.shadowRoot!.querySelector('.title')!.textContent).toBe('No orders yet');
    expect(el.shadowRoot!.querySelector('.icon svg')).toBeTruthy();
  });

  it('descriptions is a real description list, shows missing values, and never treats values as HTML', async () => {
    const el = NX.create<any>({ xtype: 'descriptions', columns: 2, data: [
      { label: 'Customer', value: '<img src=x onerror=alert(1)>' }, { label: 'Phone', value: null }, { label: 'Notes', value: 'x', span: 2 }
    ] });
    document.body.replaceChildren(el);
    await frames();
    const sr = el.shadowRoot!;
    expect(sr.querySelector('dl')).toBeTruthy();
    expect(sr.querySelectorAll('dt')).toHaveLength(3);
    expect(sr.querySelector('dd')!.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(sr.querySelector('img')).toBeNull();
    expect(sr.querySelectorAll('dd')[1].textContent).toBe('—');
    expect(css(el)).toContain('repeat(2, minmax(0, 1fr))');
  });
});
