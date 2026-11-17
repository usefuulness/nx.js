import { describe, it, expect, beforeEach } from 'vitest';
import { NX, type NXTimeline } from '@/index';
import '@/locales/es';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };

describe('<nx-timeline>', () => {
  beforeEach(() => { document.body.innerHTML = ''; document.documentElement.removeAttribute('lang'); });
  const items = `<nx-timeline-item title="Delivered" time="2026-03-04" status="success">At the door.</nx-timeline-item>
    <nx-timeline-item title="Placed" time="2026-03-01T09:30"></nx-timeline-item>`;
  const mount = async (attrs = 'label="Orders"', inner = items) => {
    document.body.innerHTML = `<nx-timeline ${attrs}>${inner}</nx-timeline>`;
    await frames();
    return document.body.firstElementChild as NXTimeline;
  };
  const li = (el: NXTimeline) => Array.from(el.shadowRoot!.querySelectorAll('li'));

  it('is a named ordered list of items', async () => {
    const el = await mount();
    expect(el.shadowRoot!.querySelector('ol')!.getAttribute('aria-label')).toBe('Orders');
    expect(li(el).map(l => l.querySelector('.title')!.textContent)).toEqual(['Delivered', 'Placed']);
    expect(li(el)[0].querySelector('.body')!.textContent).toBe('At the door.');
    expect(li(el)[1].querySelector('.body')).toBeNull();
  });

  it('writes the time as a <time> element, with a date or a date and a time', async () => {
    const t = li(await mount()).map(l => l.querySelector('time')!);
    expect(t[0].getAttribute('datetime')).toBe('2026-03-04');
    expect(t[0].textContent).toMatch(/2026/);
    expect(t[1].textContent).toMatch(/9:30|09:30/);
    expect(t[0].textContent).not.toMatch(/:/);
  });

  it('shows an unparseable time as given', async () => {
    const el = await mount('', '<nx-timeline-item title="x" time="soon"></nx-timeline-item>');
    expect(li(el)[0].querySelector('time')!.textContent).toBe('soon');
  });

  it('states the status in text and gives it an icon', async () => {
    const first = li(await mount())[0];
    expect(first.className).toContain('success');
    expect(first.textContent).toContain('(succeeded)');
    expect(first.querySelector('.icon svg')).toBeTruthy();
  });

  it('reverses and follows later changes', async () => {
    const el = await mount('reverse');
    expect(li(el)[0].querySelector('.title')!.textContent).toBe('Placed');
    const extra = document.createElement('nx-timeline-item'); extra.setAttribute('title', 'New'); el.appendChild(extra);
    await frames();
    expect(li(el).length).toBe(3);
    extra.setAttribute('title', 'Renamed'); await frames();
    expect(li(el)[0].querySelector('.title')!.textContent).toBe('Renamed');
  });

  it('treats item text as text, never markup', async () => {
    const el = await mount('', '<nx-timeline-item title="&lt;b&gt;x&lt;/b&gt;">&lt;img src=x onerror=alert(1)&gt;</nx-timeline-item>');
    expect(el.shadowRoot!.querySelector('img, b')).toBeNull();
    expect(li(el)[0].querySelector('.title')!.textContent).toBe('<b>x</b>');
  });

  it('is translated and formats dates per language', async () => {
    document.documentElement.setAttribute('lang', 'es');
    const el = await mount('');
    expect(el.shadowRoot!.querySelector('ol')!.getAttribute('aria-label')).toBe('Cronología');
    expect(li(el)[0].textContent).toContain('(completado)');
    expect(li(el)[0].querySelector('time')!.textContent).toMatch(/mar/);
  });

  it('works from a config', async () => {
    const el = NX.create<NXTimeline>({ xtype: 'timeline', label: 'L' });
    el.innerHTML = '<nx-timeline-item title="A"></nx-timeline-item>';
    document.body.appendChild(el); await frames();
    expect(li(el).length).toBe(1);
  });
});
