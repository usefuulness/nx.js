import { describe, it, expect, beforeEach } from 'vitest';
import { NX, type NXNotifications } from '@/index';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };
const data = [
  { id: 1, title: 'Invoice #3052 paid', description: 'Acme paid $2,400', time: new Date(Date.now() - 5 * 60000), icon: 'check', tone: 'success' as const },
  { id: 2, title: 'Webhook failing', time: new Date(Date.now() - 3600000 * 5), tone: 'error' as const, href: '/webhooks' },
  { id: 3, title: 'Workspace created', read: true }
];

describe('<nx-notifications>', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  const mount = async (config: Record<string, any> = {}) => {
    const el = NX.create<NXNotifications>({ xtype: 'notifications', data: data.map(d => ({ ...d })), ...config });
    document.body.append(el);
    await frames();
    return el;
  };
  const q = (el: NXNotifications, sel: string) => Array.from(el.shadowRoot!.querySelectorAll(sel)) as HTMLElement[];

  it('the bell says how many are unread, in its name', async () => {
    const el = await mount();
    const bell = q(el, '.bell')[0];
    expect(bell.getAttribute('aria-label')).toBe('Notifications, 2 unread');
    expect(bell.getAttribute('aria-haspopup')).toBe('true');
    expect(q(el, '.count')[0].textContent).toBe('2');
    expect(q(el, '.count')[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('lists them, unread ones said in text, with relative times and a link when there is an address', async () => {
    const el = await mount();
    const items = q(el, '.item');
    expect(items).toHaveLength(3);
    expect(items[0].querySelector('.sr-only')!.textContent).toContain('Unread');
    expect(items[2].querySelector('.sr-only')).toBeNull();
    expect(items[0].querySelector('time')!.textContent).toBe('5 minutes ago');
    expect(items[1].querySelector('a.row')!.getAttribute('href')).toBe('/webhooks');
    expect(items[0].querySelector('button.row')).toBeTruthy();
  });

  it('choosing one marks it read, says so, and reports the item', async () => {
    const el = await mount();
    const seen: any = { select: [], read: [] };
    el.addEventListener('select', e => seen.select.push((e as CustomEvent).detail.item.id));
    el.addEventListener('read', e => seen.read.push((e as CustomEvent).detail.ids));
    q(el, '.item button.row')[0].click();
    await frames();
    expect(seen.select).toEqual([1]);
    expect(seen.read).toEqual([[1]]);
    expect(q(el, '.bell')[0].getAttribute('aria-label')).toBe('Notifications, 1 unread');
    expect(q(el, '.item')[0].classList.contains('unread')).toBe(false);
  });

  it('mark all as read, and the button is off when there is nothing to mark', async () => {
    const el = await mount();
    const markAll = () => q(el, '.link')[0] as HTMLButtonElement;
    expect(markAll().disabled).toBe(false);
    markAll().click();
    await frames();
    expect(q(el, '.bell')[0].getAttribute('aria-label')).toBe('Notifications');
    expect(q(el, '.count')).toHaveLength(0);
    expect(markAll().disabled).toBe(true);
  });

  it('add() puts a new one first and announces it; 99+ caps the count', async () => {
    const el = await mount();
    el.add({ id: 9, title: 'Refund issued' });
    await frames();
    expect(q(el, '.item .title')[0].textContent).toContain('Refund issued');
    expect(el.shadowRoot!.querySelector('[role="status"]')!.textContent).toBe('New notification: Refund issued');
    expect(el.getUnread()).toHaveLength(3);
    const many = await mount({ data: Array.from({ length: 120 }, (_, i) => ({ id: i, title: `n${i}` })) });
    expect(q(many, '.count')[0].textContent).toBe('99+');
  });

  it('is empty politely, and clear() empties it', async () => {
    const el = await mount({ data: [] });
    expect(q(el, '.empty')[0].textContent).toBe('You are all caught up');
    const full = await mount();
    full.clear();
    await frames();
    expect(q(full, '.item')).toHaveLength(0);
  });

  it('titles are text, never markup', async () => {
    const el = await mount({ data: [{ id: 1, title: '<img src=x onerror=alert(1)>' }] });
    expect(el.shadowRoot!.querySelector('.item img')).toBeNull();
    expect(q(el, '.title')[0].textContent).toContain('<img');
  });
});
