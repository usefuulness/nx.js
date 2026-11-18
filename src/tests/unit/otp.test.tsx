import { describe, it, expect, beforeEach } from 'vitest';
import { NX, type NXOtpInput } from '@/index';
import '@/locales/es';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };

describe('<nx-otp-input>', () => {
  beforeEach(() => { document.body.innerHTML = ''; document.documentElement.removeAttribute('lang'); });
  const mount = async (attrs = 'name="code" label="Code"') => {
    document.body.innerHTML = `<form><nx-otp-input ${attrs}></nx-otp-input></form>`;
    await frames();
    return document.querySelector('nx-otp-input') as NXOtpInput;
  };
  const cells = (el: NXOtpInput) => Array.from(el.shadowRoot!.querySelectorAll('input.cell')) as HTMLInputElement[];
  const typeInto = (cell: HTMLInputElement, text: string) => { cell.value = text; cell.dispatchEvent(new Event('input', { bubbles: true })); };
  const key = (cell: HTMLInputElement, k: string) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); cell.dispatchEvent(e); return e; };
  const paste = (cell: HTMLInputElement, text: string) => {
    const e = new Event('paste', { bubbles: true, cancelable: true }) as any;
    e.clipboardData = { getData: () => text };
    cell.dispatchEvent(e);
  };
  const active = (el: NXOtpInput) => cells(el).indexOf(el.shadowRoot!.activeElement as HTMLInputElement);

  it('draws one named box per character, with autofill on the first', async () => {
    const el = await mount('name="code" label="Code" length="4"');
    expect(cells(el).length).toBe(4);
    expect(cells(el)[0].getAttribute('autocomplete')).toBe('one-time-code');
    expect(cells(el)[1].getAttribute('autocomplete')).toBe('off');
    expect(cells(el).map(c => c.getAttribute('aria-label'))).toEqual(['Character 1 of 4', 'Character 2 of 4', 'Character 3 of 4', 'Character 4 of 4']);
    expect(cells(el)[0].getAttribute('inputmode')).toBe('numeric');
  });

  it('types forward, ignores what the box does not take, and completes', async () => {
    const el = await mount('name="code" length="3"');
    const done: string[] = [];
    el.addEventListener('complete', e => done.push((e as CustomEvent).detail.value));
    typeInto(cells(el)[0], 'x');
    expect(el.value).toBe('');
    typeInto(cells(el)[0], '4');
    expect(active(el)).toBe(1);
    typeInto(cells(el)[1], '2');
    typeInto(cells(el)[2], '9');
    expect(el.value).toBe('429');
    expect(el.formValue()).toBe('429');
    expect(done).toEqual(['429']);
  });

  it('takes a pasted or autofilled code in one go', async () => {
    const el = await mount('name="code" length="6"');
    paste(cells(el)[0], ' 12 34-56 ');
    expect(el.value).toBe('123456');
    expect(cells(el).map(c => c.value).join('')).toBe('123456');
    el.value = '';
    typeInto(cells(el)[0], '987654'); // what autofill does: the whole code lands in the first box
    expect(el.value).toBe('987654');
  });

  it('a paste into a later box fills from there and stops at the end', async () => {
    const el = await mount('name="code" length="4"');
    typeInto(cells(el)[0], '1');
    paste(cells(el)[1], '23456789');
    expect(el.value).toBe('1234');
  });

  it('Backspace in an empty box steps back and clears the previous one', async () => {
    const el = await mount('name="code" length="4" value="12"');
    cells(el)[2].focus();
    const e = key(cells(el)[2], 'Backspace');
    expect(e.defaultPrevented).toBe(true);
    expect(el.value).toBe('1');
    expect(active(el)).toBe(1);
  });

  it('arrow keys and Home/End move between boxes', async () => {
    const el = await mount('name="code" length="4"');
    cells(el)[1].focus();
    key(cells(el)[1], 'ArrowRight'); expect(active(el)).toBe(2);
    key(cells(el)[2], 'ArrowLeft'); expect(active(el)).toBe(1);
    key(cells(el)[1], 'End'); expect(active(el)).toBe(3);
    key(cells(el)[3], 'Home'); expect(active(el)).toBe(0);
  });

  it('text type takes letters and digits; numeric does not', async () => {
    const t = await mount('name="c" length="4" type="text"');
    paste(cells(t)[0], 'a1-B2');
    expect(t.value).toBe('a1B2');
    const n = await mount('name="c" length="4"');
    paste(cells(n)[0], 'a1-B2');
    expect(n.value).toBe('12');
  });

  it('is invalid until complete when required', async () => {
    const el = await mount('name="code" length="4" required');
    expect(el.validate()).toBe(false);
    expect(el.shadowRoot!.querySelector('.nx-field-helper')!.textContent).toBe('Enter the 4-character code');
    paste(cells(el)[0], '1234');
    expect(el.validate()).toBe(true);
  });

  it('clamps length, follows the value attribute, resets and takes a config', async () => {
    expect(cells(await mount('length="99"')).length).toBe(12);
    expect(cells(await mount('length="1"')).length).toBe(2);
    expect(cells(await mount('length="x"')).length).toBe(6);
    const el = await mount('name="code" length="4"');
    el.setAttribute('value', '55'); await frames();
    expect(cells(el).map(c => c.value)).toEqual(['5', '5', '', '']);
    el.reset(); expect(el.value).toBe('');
    const c = NX.create<NXOtpInput>({ xtype: 'otp-input', name: 'q', length: 4, value: '12' });
    document.body.appendChild(c); await frames();
    expect(c.value).toBe('12');
  });

  it('is translated and can be disabled', async () => {
    document.documentElement.setAttribute('lang', 'es');
    const el = await mount('name="code" length="4" disabled');
    expect(cells(el)[0].getAttribute('aria-label')).toBe('Carácter 1 de 4');
    expect(cells(el).every(c => c.disabled)).toBe(true);
  });
});
