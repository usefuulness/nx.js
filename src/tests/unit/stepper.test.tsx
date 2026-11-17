import { describe, it, expect, beforeEach } from 'vitest';
import { NX, type NXStepper } from '@/index';
import '@/locales/es';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };

describe('<nx-stepper>', () => {
  beforeEach(() => { document.body.innerHTML = ''; document.documentElement.removeAttribute('lang'); });
  const mount = async (attrs = 'current="1"', steps = '<nx-step title="A"></nx-step><nx-step title="B" description="Pick"></nx-step><nx-step title="C"></nx-step>') => {
    document.body.innerHTML = `<nx-stepper ${attrs}>${steps}</nx-stepper>`;
    await frames();
    return document.body.firstElementChild as NXStepper;
  };
  const items = (el: NXStepper) => Array.from(el.shadowRoot!.querySelectorAll('li'));

  it('marks complete, current and upcoming steps', async () => {
    const li = items(await mount());
    expect(li.map(l => l.className)).toEqual(['step complete', 'step current', 'step upcoming']);
    expect(li[1].getAttribute('aria-current')).toBe('step');
    expect(li[0].getAttribute('aria-current')).toBeNull();
  });

  it('says the state in text, not only by colour', async () => {
    const li = items(await mount());
    expect(li[0].textContent).toContain('completed');
    expect(li[1].textContent).toContain('Step 2 of 3');
    expect(li[2].textContent).toContain('not started');
  });

  it('shows an error step and a description', async () => {
    const el = await mount('current="0"', '<nx-step title="A"></nx-step><nx-step title="B" status="error" description="Declined"></nx-step>');
    const li = items(el);
    expect(li[1].className).toContain('error');
    expect(li[1].textContent).toContain('needs attention');
    expect(li[1].textContent).toContain('Declined');
  });

  it('clamps current and survives garbage', async () => {
    expect((await mount('current="99"')).getCurrent()).toBe(2);
    expect((await mount('current="-4"')).getCurrent()).toBe(0);
    expect((await mount('current="abc"')).getCurrent()).toBe(0);
  });

  it('only completed steps are buttons, and only when clickable', async () => {
    expect((await mount()).shadowRoot!.querySelectorAll('button').length).toBe(0);
    const el = await mount('current="2" clickable');
    expect(el.shadowRoot!.querySelectorAll('button').length).toBe(2);
  });

  it('goes back on click and emits step-change once', async () => {
    const el = await mount('current="2" clickable');
    const seen: number[] = [];
    el.addEventListener('step-change', e => seen.push((e as CustomEvent).detail.index));
    (el.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    await frames();
    expect(el.getAttribute('current')).toBe('0');
    expect(seen).toEqual([0]);
    expect(items(el)[0].className).toContain('current');
    el.goTo(0);
    expect(seen).toEqual([0]);
  });

  it('next and previous stop at the ends', async () => {
    const el = await mount('current="2"');
    el.next();
    expect(el.getCurrent()).toBe(2);
    el.previous(); el.previous(); el.previous();
    expect(el.getCurrent()).toBe(0);
  });

  it('follows steps added later', async () => {
    const el = await mount();
    const s = document.createElement('nx-step'); s.setAttribute('title', 'D'); el.appendChild(s);
    await frames();
    expect(items(el).length).toBe(4);
    s.setAttribute('title', 'Renamed'); await frames();
    expect(items(el)[3].textContent).toContain('Renamed');
  });

  it('is translated', async () => {
    document.documentElement.setAttribute('lang', 'es');
    const li = items(await mount());
    expect(li[0].textContent).toContain('completado');
  });

  it('works from a config', async () => {
    const el = NX.create<NXStepper>({ xtype: 'stepper', current: 1 });
    el.innerHTML = '<nx-step title="A"></nx-step><nx-step title="B"></nx-step>';
    document.body.appendChild(el); await frames();
    expect(items(el)[1].className).toContain('current');
  });
});
