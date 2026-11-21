import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NX, type NXPropertyGrid, type PropertyField } from '@/index';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };

const schema: PropertyField[] = [
  { name: 'name', label: 'Name', required: true, help: 'Shown in lists' },
  { name: 'kind', label: 'Kind', type: 'select', options: ['job', 'extension'], default: 'job' },
  { name: 'retries', label: 'Retries', type: 'number', min: 0, max: 5 },
  { name: 'enabled', label: 'Enabled', type: 'boolean' },
  { name: 'schedule', label: 'Schedule', hidden: v => v.kind !== 'job', pattern: '[0-9*/, -]+( [0-9*/, -]+){4}' },
  { name: 'locked', label: 'Locked field', readonly: v => !!v.enabled },
  { name: 'config', label: 'Settings', type: 'json', group: 'Advanced' }
];

describe('<nx-property-grid>', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  const mount = async (config: Record<string, any> = {}) => {
    const el = NX.create<NXPropertyGrid>({ xtype: 'property-grid', schema, label: 'Details', ...config });
    document.body.append(el);
    await frames(4);
    return el;
  };
  const ctl = (el: NXPropertyGrid, name: string) => el.shadowRoot!.querySelector(`[data-name="${name}"] > *`) as any;
  const row = (el: NXPropertyGrid, name: string) => el.shadowRoot!.querySelector(`[data-name="${name}"]`) as HTMLElement;
  const enter = async (control: any, value: any) => { control.value = value; control.dispatchEvent(new CustomEvent('change', { detail: { value }, bubbles: true })); await frames(); };

  it('builds a field of the right kind for each type, with label, help and groups', async () => {
    const el = await mount({ value: { name: 'Nightly', retries: 2 } });
    expect(el.shadowRoot!.querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Details');
    expect(ctl(el, 'name').tagName).toBe('NX-INPUT');
    expect(ctl(el, 'name').getAttribute('helper-text')).toBe('Shown in lists');
    expect(ctl(el, 'kind').tagName).toBe('NX-SELECT');
    expect(ctl(el, 'retries').getAttribute('type')).toBe('number');
    expect(ctl(el, 'enabled').tagName).toBe('NX-SWITCH');
    expect(ctl(el, 'config').tagName).toBe('NX-CODE-EDITOR');
    expect(el.shadowRoot!.querySelector('.heading')!.textContent).toBe('Advanced');
    expect(ctl(el, 'name').value).toBe('Nightly');
  });

  it('a change becomes a typed value, and the event carries the name, the value and all the values', async () => {
    const el = await mount({ value: { name: 'a' } });
    const seen: any[] = [];
    el.addEventListener('change', e => seen.push((e as CustomEvent).detail));
    await enter(ctl(el, 'retries'), '3');
    await enter(ctl(el, 'name'), 'Nightly');
    expect(seen[0]).toMatchObject({ name: 'retries', value: 3 });
    expect(seen[1].values).toMatchObject({ name: 'Nightly', retries: 3, kind: 'job' }); // the default is filled in
    expect(el.value.retries).toBe(3);
    ctl(el, 'enabled').checked = true;
    ctl(el, 'enabled').dispatchEvent(new CustomEvent('change', { detail: { value: true }, bubbles: true }));
    expect(el.value.enabled).toBe(true);
    await enter(ctl(el, 'retries'), '');
    expect(el.value.retries).toBeUndefined();
  });

  it('JSON fields hold parsed values, and bad text keeps the last good value', async () => {
    const el = await mount({ value: { name: 'a', config: { a: 1 } } });
    expect(JSON.parse(ctl(el, 'config').value)).toEqual({ a: 1 });
    await enter(ctl(el, 'config'), '{"b": [1, 2]}');
    expect(el.value.config).toEqual({ b: [1, 2] });
    await enter(ctl(el, 'config'), '{"b": ');
    expect(el.value.config).toEqual({ b: [1, 2] });
  });

  it('hidden and read-only follow the other values', async () => {
    const el = await mount({ value: { name: 'a', kind: 'job' } });
    expect(row(el, 'schedule').hidden).toBe(false);
    expect(ctl(el, 'locked').hasAttribute('readonly')).toBe(false);
    await enter(ctl(el, 'kind'), 'extension');
    expect(row(el, 'schedule').hidden).toBe(true);
    ctl(el, 'enabled').checked = true;
    ctl(el, 'enabled').dispatchEvent(new CustomEvent('change', { detail: { value: true }, bubbles: true }));
    await frames();
    expect(ctl(el, 'locked').hasAttribute('readonly')).toBe(true);
    el.setAttribute('readonly', '');
    await frames();
    expect(ctl(el, 'name').hasAttribute('readonly')).toBe(true);
    expect(ctl(el, 'kind').hasAttribute('disabled')).toBe(true);
  });

  it('validate(): required, number range, pattern and your own rule that can see the other values; hidden fields are skipped', async () => {
    const custom: PropertyField[] = [...schema, { name: 'to', label: 'To', validate: (v, all) => (all.from && v && v < all.from ? 'Must not be before From' : true) }, { name: 'from', label: 'From' }];
    const el = await mount({ schema: custom, value: { retries: 9, schedule: 'nope', from: 'b', to: 'a' } });
    const { valid, errors } = el.validate();
    expect(valid).toBe(false);
    expect(errors.name).toBe('This field is required');
    expect(errors.retries).toBe('Must be at most 5');
    expect(errors.schedule).toBe('Does not match the expected format');
    expect(errors.to).toBe('Must not be before From');
    expect(ctl(el, 'name').getAttribute('error-text')).toBe('This field is required');
    // Hidden: not checked
    await enter(ctl(el, 'kind'), 'extension');
    expect(el.validate().errors.schedule).toBeUndefined();
    // Fixed values pass
    el.value = { name: 'ok', retries: 1, from: 'a', to: 'b' };
    await frames();
    expect(el.validate()).toEqual({ valid: true, errors: {} });
    expect(ctl(el, 'name').hasAttribute('error-text')).toBe(false);
  });

  it('setErrors shows the server\'s complaints next to the fields, and editing a field clears its complaint', async () => {
    const el = await mount({ value: { name: 'a' } });
    el.setErrors({ name: ['already taken'], retries: 'too many' });
    expect(ctl(el, 'name').getAttribute('error-text')).toBe('already taken');
    expect(ctl(el, 'retries').getAttribute('error-text')).toBe('too many');
    await enter(ctl(el, 'name'), 'b');
    expect(ctl(el, 'name').hasAttribute('error-text')).toBe(false);
    expect(ctl(el, 'retries').getAttribute('error-text')).toBe('too many');
  });

  it('reference fields: shows the name, picks with your picker, clears, and is locked when read-only', async () => {
    const picker = vi.fn(async () => ({ value: 42, text: 'scripts/nightly.groovy' }));
    const refs: PropertyField[] = [{ name: 'script', label: 'Script', type: 'reference', required: true, picker, display: id => `script #${id}`, readonly: v => !!v.frozen }, { name: 'frozen', label: 'Frozen', type: 'boolean' }];
    const el = await mount({ schema: refs, value: { script: 7 } });
    const text = () => el.shadowRoot!.querySelector('.ref-text')!.textContent;
    expect(text()).toBe('script #7');
    const seen: any[] = [];
    el.addEventListener('change', e => seen.push((e as CustomEvent).detail));
    (el.shadowRoot!.querySelector('.ref-choose') as HTMLElement).click();
    await frames();
    expect(picker).toHaveBeenCalledWith(7);
    expect(text()).toBe('scripts/nightly.groovy');
    expect(el.value.script).toBe(42);
    expect(seen.at(-1)).toMatchObject({ name: 'script', value: 42 });
    (el.shadowRoot!.querySelector('.ref-clear') as HTMLElement).click();
    await frames();
    expect(el.value.script).toBeUndefined();
    expect(text()).toBe('—');
    expect(el.validate().errors.script).toBe('This field is required');
    expect(el.shadowRoot!.querySelector('.ref-error')!.textContent).toBe('This field is required');
    el.value = { script: 1, frozen: true };
    await frames();
    expect((el.shadowRoot!.querySelector('.ref-choose') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the controls (and their focus) when values change, and rebuilds only for a new schema', async () => {
    const el = await mount({ value: { name: 'a' } });
    const before = ctl(el, 'name');
    el.value = { name: 'b' };
    await frames();
    expect(ctl(el, 'name')).toBe(before);
    expect(before.value).toBe('b');
    (el as any).setProp?.('schema', [{ name: 'other' }]);
    el.setAttribute('schema', JSON.stringify([{ name: 'other' }]));
    await frames();
    expect(row(el, 'other')).toBeTruthy();
  });

  it('dirty tracking: edits are dirty, setting the value or markClean is not', async () => {
    const el = await mount({ value: { name: 'a' } });
    const flips: boolean[] = [];
    el.addEventListener('dirty-change', e => flips.push((e as CustomEvent).detail.dirty));
    await enter(ctl(el, 'name'), 'b');
    expect(el.isDirty()).toBe(true);
    el.markClean();
    expect(el.isDirty()).toBe(false);
    await enter(ctl(el, 'name'), 'c');
    await enter(ctl(el, 'name'), 'b');
    expect(el.isDirty()).toBe(false);
    expect(flips).toEqual([true, false, true, false]);
  });
});
