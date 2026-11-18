import { describe, it, expect, beforeEach } from 'vitest';
import { type NXSelect } from '@/index';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };

describe('<nx-select> themed list (popup="custom")', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  const html = `<option value="a">Alpha</option><option value="b" disabled>Beta</option><option value="c">Gamma</option><optgroup label="More"><option value="d">Delta</option></optgroup>`;
  const mount = async (attrs = 'name="x" label="Letter" popup="custom"', inner = html) => {
    document.body.innerHTML = `<nx-select ${attrs}>${inner}</nx-select>`;
    await frames();
    return document.querySelector('nx-select') as NXSelect;
  };
  const sel = (el: NXSelect) => el.shadowRoot!.querySelector('select') as HTMLSelectElement;
  const box = (el: NXSelect) => el.shadowRoot!.querySelector('.listbox') as HTMLElement | null;
  const opts = (el: NXSelect) => Array.from(el.shadowRoot!.querySelectorAll('[role="option"]')) as HTMLElement[];
  const mousedown = (el: NXSelect) => { const e = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }); sel(el).dispatchEvent(e); return e; };
  const key = (el: NXSelect, k: string, init: KeyboardEventInit = {}) => {
    const target = box(el) ?? sel(el);
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(e);
    return e;
  };
  const active = (el: NXSelect) => opts(el).findIndex(o => o.classList.contains('active'));

  it('opens on mousedown instead of the native popup, as a labelled listbox of all options', async () => {
    const el = await mount();
    expect(box(el)).toBeNull();
    const e = mousedown(el);
    expect(e.defaultPrevented).toBe(true);
    expect(box(el)!.getAttribute('role')).toBe('listbox');
    expect(box(el)!.getAttribute('aria-label')).toBe('Letter');
    expect(opts(el).map(o => o.textContent)).toEqual(['Select…', 'Alpha', 'Beta', 'Gamma', 'Delta']);
    expect(el.shadowRoot!.querySelector('[role="group"] .group')!.textContent).toBe('More');
    expect(opts(el)[2].getAttribute('aria-disabled')).toBe('true');
    expect(el.shadowRoot!.activeElement).toBe(box(el));
  });

  it('starts on the selected option and marks it', async () => {
    const el = await mount('name="x" popup="custom" value="c"');
    mousedown(el);
    expect(active(el)).toBe(3);
    expect(opts(el).map(o => o.getAttribute('aria-selected'))).toEqual(['false', 'false', 'false', 'true', 'false']);
    expect(box(el)!.getAttribute('aria-activedescendant')).toBe(opts(el)[3].id);
  });

  it('opens from the keyboard with Enter, Space and Alt+Arrow, but plain arrows keep their native job', async () => {
    const el = await mount();
    expect(key(el, 'ArrowDown').defaultPrevented).toBe(false);
    expect(box(el)).toBeNull();
    key(el, 'Enter'); expect(box(el)).toBeTruthy();
    key(el, 'Escape');
    key(el, ' '); expect(box(el)).toBeTruthy();
    key(el, 'Escape');
    key(el, 'ArrowDown', { altKey: true }); expect(box(el)).toBeTruthy();
  });

  it('moves over enabled options, with Home and End, and picks with Enter', async () => {
    const el = await mount();
    const changes: any[] = [];
    el.addEventListener('change', e => changes.push((e as CustomEvent).detail.value));
    mousedown(el);
    key(el, 'ArrowDown'); expect(active(el)).toBe(1);
    key(el, 'ArrowDown'); expect(active(el)).toBe(3); // Beta is disabled
    key(el, 'End'); expect(active(el)).toBe(4);
    key(el, 'Home'); expect(active(el)).toBe(0);
    key(el, 'ArrowDown'); key(el, 'Enter');
    expect(el.value).toBe('a');
    expect(sel(el).value).toBe('a');
    expect(changes).toEqual(['a']);
    expect(box(el)).toBeNull();
    expect(el.shadowRoot!.activeElement).toBe(sel(el)); // focus is back on the field
  });

  it('picks by click, but not a disabled option', async () => {
    const el = await mount();
    mousedown(el);
    opts(el)[2].click();
    expect(el.value).toBe('');
    expect(box(el)).toBeTruthy();
    opts(el)[4].click();
    expect(el.value).toBe('d');
    expect(box(el)).toBeNull();
  });

  it('Escape closes only the list (a dialog around it does not see it) and returns focus', async () => {
    const el = await mount();
    let bubbled = false;
    document.addEventListener('keydown', () => (bubbled = true), { once: true });
    mousedown(el);
    key(el, 'Escape');
    expect(box(el)).toBeNull();
    expect(bubbled).toBe(false);
    expect(el.shadowRoot!.activeElement).toBe(sel(el));
  });

  it('jumps to an option by typing, skipping disabled ones', async () => {
    const el = await mount();
    mousedown(el);
    key(el, 'g'); expect(active(el)).toBe(3);
    key(el, 'd'); // "gd" matches nothing: stays
    expect(active(el)).toBe(3);
  });

  it('closes on a click outside, a second mousedown on the field, and a redraw', async () => {
    const el = await mount();
    mousedown(el); document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(box(el)).toBeNull();
    mousedown(el); mousedown(el);
    expect(box(el)).toBeNull();
    mousedown(el); el.setAttribute('label', 'Changed'); await frames();
    expect(el.shadowRoot!.querySelector('.listbox')).toBeNull();
  });

  it('does nothing when disabled, for multiple, or with popup="native"', async () => {
    for (const attrs of ['name="x" popup="custom" disabled', 'name="x" popup="custom" multiple', 'name="x" popup="native"']) {
      const el = await mount(attrs);
      expect(mousedown(el).defaultPrevented).toBe(false);
      expect(box(el)).toBeNull();
    }
  });

  it('leaves the native popup alone by default in an environment that cannot tell (no hover media query)', async () => {
    const el = await mount('name="x"');
    expect(mousedown(el).defaultPrevented).toBe(false);
  });

  it('keeps form value and the placeholder state in step', async () => {
    const el = await mount();
    mousedown(el); opts(el)[1].click();
    expect(el.formValue()).toBe('a');
    expect(sel(el).classList.contains('placeholder')).toBe(false);
    mousedown(el); opts(el)[0].click();
    expect(el.value).toBe('');
    expect(sel(el).classList.contains('placeholder')).toBe(true);
  });
});
