import { describe, it, expect, beforeEach } from 'vitest';
import { NX, type NXCalendar } from '@/index';
import '@/locales/es';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };
const events = `[{"date":"2026-03-04","title":"Standup","time":"09:30"},{"date":"2026-03-04","title":"Deploy","status":"error"},{"date":"2026-03-10","title":"Review","status":"success"}]`;

describe('<nx-calendar>', () => {
  beforeEach(() => { document.body.innerHTML = ''; document.documentElement.removeAttribute('lang'); });
  const mount = async (attrs = `value="2026-03-04" first-day="1" events='${events}'`) => {
    document.body.innerHTML = `<nx-calendar ${attrs}></nx-calendar>`;
    await frames();
    return document.body.firstElementChild as NXCalendar;
  };
  const day = (el: NXCalendar, iso: string) => el.shadowRoot!.querySelector(`.day[data-date="${iso}"]`) as HTMLButtonElement;
  const key = (el: NXCalendar, k: string, init: KeyboardEventInit = {}) => {
    const target = (el.shadowRoot!.activeElement ?? el.shadowRoot!.querySelector('.day[tabindex="0"]')) as HTMLElement;
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  };

  it('is a grid of 6 weeks for the month of the value, Monday first', async () => {
    const el = await mount();
    expect(el.shadowRoot!.querySelector('.month')!.textContent).toMatch(/March 2026/);
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).toBe(6);
    expect(el.shadowRoot!.querySelectorAll('th')[0].getAttribute('abbr')).toBe('Monday');
    expect(day(el, '2026-03-01').classList.contains('outside')).toBe(false);
    expect(day(el, '2026-02-27').classList.contains('outside')).toBe(true);
  });

  it('names each day in full with its event count, and marks the selection', async () => {
    const el = await mount();
    expect(day(el, '2026-03-04').getAttribute('aria-label')).toMatch(/Wednesday, March 4, 2026, 2 events/);
    expect(day(el, '2026-03-10').getAttribute('aria-label')).toMatch(/1 event$/);
    expect(day(el, '2026-03-05').getAttribute('aria-label')).not.toMatch(/event/);
    expect(day(el, '2026-03-04').closest('td')!.getAttribute('aria-selected')).toBe('true');
    expect(day(el, '2026-03-04').getAttribute('tabindex')).toBe('0');
  });

  it('lists the selected day\'s events, with the status in text', async () => {
    const el = await mount();
    const items = Array.from(el.shadowRoot!.querySelectorAll('.ev')).map(e => e.textContent);
    expect(items).toEqual(['09:30Standup', 'Deploy(failed)']);
    day(el, '2026-03-05').click(); await frames();
    expect(el.shadowRoot!.querySelector('.none')!.textContent).toBe('Nothing on this day');
  });

  it('selecting a day sets value and emits select with its events', async () => {
    const el = await mount();
    const seen: any[] = [];
    el.addEventListener('select', e => seen.push((e as CustomEvent).detail));
    day(el, '2026-03-10').click(); await frames();
    expect(el.value).toBe('2026-03-10');
    expect(seen[0].value).toBe('2026-03-10');
    expect(seen[0].events.map((e: any) => e.title)).toEqual(['Review']);
  });

  it('moves with the arrow keys, Home/End, and pages through months', async () => {
    const el = await mount();
    key(el, 'ArrowRight'); expect(day(el, '2026-03-05').getAttribute('tabindex')).toBe('0');
    key(el, 'ArrowDown'); expect(day(el, '2026-03-12').getAttribute('tabindex')).toBe('0');
    key(el, 'Home'); expect(day(el, '2026-03-09').getAttribute('tabindex')).toBe('0');
    key(el, 'End'); expect(day(el, '2026-03-15').getAttribute('tabindex')).toBe('0');
    const months: string[] = [];
    el.addEventListener('month-change', e => months.push((e as CustomEvent).detail.month));
    key(el, 'PageDown');
    expect(el.shadowRoot!.querySelector('.month')!.textContent).toMatch(/April 2026/);
    key(el, 'PageUp', { shiftKey: true });
    expect(el.shadowRoot!.querySelector('.month')!.textContent).toMatch(/April 2025/);
    expect(months).toEqual(['2026-04', '2025-04']);
  });

  it('Enter and Space select the focused day', async () => {
    const el = await mount();
    key(el, 'ArrowRight'); key(el, 'Enter'); await frames();
    expect(el.value).toBe('2026-03-05');
  });

  it('keeps keyboard focus on the day after a selection redraw', async () => {
    const el = await mount();
    day(el, '2026-03-04').focus();
    key(el, 'ArrowRight'); key(el, 'Enter'); await frames(5);
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('data-date')).toBe('2026-03-05');
  });

  it('refuses days outside min and max', async () => {
    const el = await mount(`value="2026-03-04" min="2026-03-02" max="2026-03-20"`);
    expect(day(el, '2026-03-01').getAttribute('aria-disabled')).toBe('true');
    day(el, '2026-03-01').click(); await frames();
    expect(el.value).toBe('2026-03-04');
    expect(el.shadowRoot!.querySelectorAll('.nav')[0].hasAttribute('disabled')).toBe(true);
  });

  it('survives bad input', async () => {
    for (const attrs of ['', 'value="nope"', 'events="not json"', `events='[1,null,{"date":"x"},{"date":"2026-02-30","title":"t"}]'`, 'first-day="abc"', 'month="2026-13-01"']) {
      const el = await mount(attrs);
      expect(el.shadowRoot!.querySelectorAll('.day').length).toBe(42);
    }
  });

  it('shows no agenda with hide-agenda, and treats text as text', async () => {
    const el = await mount(`value="2026-03-04" hide-agenda events='[{"date":"2026-03-04","title":"<img src=x onerror=alert(1)>"}]'`);
    expect(el.shadowRoot!.querySelector('.agenda')).toBeNull();
    const el2 = await mount(`value="2026-03-04" events='[{"date":"2026-03-04","title":"<img src=x onerror=alert(1)>"}]'`);
    expect(el2.shadowRoot!.querySelector('img')).toBeNull();
    expect(el2.shadowRoot!.querySelector('.ev-title')!.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('follows the value and month attributes, and showMonth()', async () => {
    const el = await mount();
    el.setAttribute('value', '2026-07-15'); await frames();
    expect(el.shadowRoot!.querySelector('.month')!.textContent).toMatch(/July 2026/);
    el.showMonth('2026-09-01');
    expect(el.shadowRoot!.querySelector('.month')!.textContent).toMatch(/September 2026/);
  });

  it('is translated and uses the language for names', async () => {
    document.documentElement.setAttribute('lang', 'es');
    const el = await mount();
    expect(el.shadowRoot!.querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Calendario');
    expect(el.shadowRoot!.querySelector('.month')!.textContent).toMatch(/marzo/i);
    expect(day(el, '2026-03-04').getAttribute('aria-label')).toMatch(/2 eventos/);
  });

  it('works from a config', async () => {
    const el = NX.create<NXCalendar>({ xtype: 'calendar', value: '2026-03-04', events: [{ date: '2026-03-04', title: 'A' }] });
    document.body.appendChild(el); await frames();
    expect(el.shadowRoot!.querySelectorAll('.ev').length).toBe(1);
  });
});
