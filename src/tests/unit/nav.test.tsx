import { describe, it, expect, beforeEach } from 'vitest';
import { NX, type NXNav } from '@/index';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };
const data = [
  { id: 'home', text: 'Dashboard', icon: 'dashboard', route: '/' },
  { heading: true, text: 'Sales' },
  { id: 'orders', text: 'Orders', icon: 'cart', route: '/orders', badge: 12 },
  { id: 'reports', text: 'Reports', icon: 'chart', children: [{ id: 'monthly', text: 'Monthly', route: '/reports/monthly' }, { id: 'yearly', text: 'Yearly', href: '/yearly' }] },
  { id: 'gone', text: 'Archive', route: '/archive', disabled: true }
];

describe('<nx-nav>', () => {
  beforeEach(() => { document.body.innerHTML = ''; location.hash = ''; });
  const mount = async (config: Record<string, any> = {}) => {
    const el = NX.create<NXNav>({ xtype: 'nav', data, label: 'Main', ...config });
    document.body.append(el);
    await frames();
    return el;
  };
  const q = (el: NXNav, sel: string) => Array.from(el.shadowRoot!.querySelectorAll(sel)) as HTMLElement[];

  it('is a labelled navigation of links, with group headings and badges', async () => {
    const el = await mount();
    expect(el.shadowRoot!.querySelector('nav')!.getAttribute('aria-label')).toBe('Main');
    expect(q(el, 'a.item').map(a => a.querySelector('.text')!.textContent)).toEqual(['Dashboard', 'Orders', 'Archive']);
    expect(q(el, 'a.item')[1].getAttribute('href')).toBe('#/orders');
    expect(q(el, '.heading')[0].textContent).toBe('Sales');
    expect(q(el, '.badge')[0].textContent).toBe('12');
  });

  it('marks the current page from the address and follows it', async () => {
    location.hash = '#/orders';
    const el = await mount();
    expect(q(el, '[aria-current="page"]').map(a => a.querySelector('.text')!.textContent)).toEqual(['Orders']);
    location.hash = '#/';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await frames();
    expect(q(el, '[aria-current="page"]').map(a => a.querySelector('.text')!.textContent)).toEqual(['Dashboard']);
  });

  it('value wins over the address', async () => {
    location.hash = '#/orders';
    const el = await mount({ value: 'home' });
    expect(q(el, '[aria-current="page"] .text')[0].textContent).toBe('Dashboard');
  });

  it('choosing a route item says so (an NX.app navigates) without leaving the page; an href item stays a plain link', async () => {
    const el = await mount();
    const seen: any[] = [];
    el.addEventListener('select', e => seen.push((e as CustomEvent).detail));
    const orders = q(el, 'a.item')[1];
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    orders.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(seen[0].node.route).toBe('/orders');
    // A disabled item does nothing
    const archive = q(el, 'a.item')[2];
    expect(archive.getAttribute('aria-disabled')).toBe('true');
    archive.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(seen).toHaveLength(1);
  });

  it('sub-items open from a disclosure button, and the one holding the current page starts open', async () => {
    const el = await mount();
    const button = q(el, 'button.item')[0];
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(q(el, '.sub')).toHaveLength(0);
    button.click();
    await frames();
    expect(q(el, 'button.item')[0].getAttribute('aria-expanded')).toBe('true');
    expect(q(el, '.sub a.item').map(a => a.getAttribute('href'))).toEqual(['#/reports/monthly', '/yearly']);
    const open = await (async () => { document.body.innerHTML = ''; location.hash = '#/reports/monthly'; return mount(); })();
    expect(q(open, 'button.item')[0].getAttribute('aria-expanded')).toBe('true');
    expect(q(open, '.sub [aria-current="page"]')).toHaveLength(1);
  });

  it('arrow keys, Home and End move between enabled links', async () => {
    const el = await mount();
    const links = () => q(el, '[data-nav]').filter(x => x.getAttribute('aria-disabled') !== 'true');
    links()[0].focus();
    const key = (k: string) => (el.shadowRoot!.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true }));
    key('ArrowDown');
    expect(el.shadowRoot!.activeElement).toBe(links()[1]);
    key('End');
    expect(el.shadowRoot!.activeElement).toBe(links().at(-1));
    key('ArrowDown');
    expect(el.shadowRoot!.activeElement).toBe(links().at(-1));
    key('Home');
    expect(el.shadowRoot!.activeElement).toBe(links()[0]);
  });

  it('collapses to a rail: text stays for assistive technology, with a tooltip; the button says what it does', async () => {
    const el = await mount({ collapsible: true });
    const events: boolean[] = [];
    el.addEventListener('collapse-change', e => events.push((e as CustomEvent).detail.collapsed));
    const toggle = () => el.shadowRoot!.querySelector('.collapse') as HTMLElement;
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    toggle().click();
    await frames();
    expect(el.hasAttribute('collapsed')).toBe(true);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().getAttribute('aria-label')).toBe('Expand menu');
    expect(q(el, 'a.item')[0].getAttribute('title')).toBe('Dashboard');
    expect(q(el, 'a.item')[0].querySelector('.text')!.textContent).toBe('Dashboard');
    expect(events).toEqual([true]);
  });
});
