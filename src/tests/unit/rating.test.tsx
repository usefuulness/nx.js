import { describe, it, expect, beforeEach } from 'vitest';
import { NX, type NXRating } from '@/index';
import '@/locales/es';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };

describe('<nx-rating>', () => {
  beforeEach(() => { document.body.innerHTML = ''; document.documentElement.removeAttribute('lang'); });
  const mount = async (attrs = '') => {
    document.body.innerHTML = `<form><nx-rating name="score" label="Score" ${attrs}></nx-rating></form>`;
    await frames();
    return document.querySelector('nx-rating') as NXRating;
  };
  const radios = (el: NXRating) => Array.from(el.shadowRoot!.querySelectorAll('input')) as HTMLInputElement[];
  const fills = (el: NXRating) => Array.from(el.shadowRoot!.querySelectorAll('.star')).map(s => (s as HTMLElement).style.getPropertyValue('--fill'));

  it('is a radio group with one named radio per star', async () => {
    const el = await mount('value="3"');
    expect(el.shadowRoot!.querySelector('[role="radiogroup"]')).toBeTruthy();
    expect(radios(el).map(r => r.getAttribute('aria-label'))).toEqual(['1 of 5', '2 of 5', '3 of 5', '4 of 5', '5 of 5']);
    expect(radios(el).map(r => r.checked)).toEqual([false, false, true, false, false]);
    expect(fills(el)).toEqual(['100%', '100%', '100%', '0%', '0%']);
  });

  it('picks a star on change, emits change and posts the value', async () => {
    const el = await mount();
    const seen: number[] = [];
    el.addEventListener('change', e => seen.push((e as CustomEvent).detail.value));
    radios(el)[3].click();
    await frames();
    expect(el.value).toBe(4);
    expect(seen).toEqual([4]);
    expect(el.formValue()).toBe('4');
  });

  it('submits nothing when unrated, and is invalid when required', async () => {
    const el = await mount('required');
    expect(el.formValue()).toBeNull();
    expect(el.validate()).toBe(false);
    radios(el)[0].click(); await frames();
    expect(el.validate()).toBe(true);
  });

  it('clamps and rounds the value, and survives garbage', async () => {
    const el = await mount();
    el.value = 9; expect(el.value).toBe(5);
    el.value = -2; expect(el.value).toBe(0);
    el.value = 2.6; expect(el.value).toBe(3);
    el.value = 'abc'; expect(el.value).toBe(0);
    el.value = null; expect(el.value).toBe(0);
  });

  it('supports max, capped at 10', async () => {
    expect(radios(await mount('max="3"')).length).toBe(3);
    expect(radios(await mount('max="99"')).length).toBe(10);
    expect(radios(await mount('max="x"')).length).toBe(5);
  });

  it('read-only is one image with the value as its name, and shows halves', async () => {
    const el = await mount('readonly value="3.5"');
    expect(radios(el).length).toBe(0);
    expect(el.shadowRoot!.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('3.5 of 5');
    expect(fills(el)).toEqual(['100%', '100%', '100%', '50%', '0%']);
  });

  it('disabled stars cannot be chosen', async () => {
    const el = await mount('disabled');
    expect(radios(el).every(r => r.disabled)).toBe(true);
  });

  it('previews the hovered star without losing the value', async () => {
    const el = await mount('value="2"');
    const stars = el.shadowRoot!.querySelectorAll('.star');
    stars[3].dispatchEvent(new MouseEvent('mouseenter'));
    expect(fills(el)).toEqual(['100%', '100%', '100%', '100%', '0%']);
    el.shadowRoot!.querySelector('.nx-rating')!.dispatchEvent(new MouseEvent('mouseleave'));
    expect(fills(el)).toEqual(['100%', '100%', '0%', '0%', '0%']);
    expect(el.value).toBe(2);
  });

  it('resets, follows the attribute and takes a config', async () => {
    const el = await mount('value="4"');
    el.reset(); expect(el.value).toBe(0);
    el.setAttribute('value', '2'); await frames();
    expect(radios(el)[1].checked).toBe(true);
    const c = NX.create<NXRating>({ xtype: 'rating', name: 'q', value: 3 });
    document.body.appendChild(c); await frames();
    expect(c.value).toBe(3);
  });

  it('is translated', async () => {
    document.documentElement.setAttribute('lang', 'es');
    const el = await mount('value="2"');
    expect(radios(el)[0].getAttribute('aria-label')).toBe('1 de 5');
  });
});
