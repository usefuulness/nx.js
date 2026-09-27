import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NX, type NXForm, type NXTextField } from '@/index';
import { nextFrame } from '../utils';

describe('forms', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('textfield keeps its input element while typing (no focus loss)', async () => {
    const field = NX.create<NXTextField>({ xtype: 'textfield', value: 'a' });
    document.body.appendChild(field);
    const input = field.shadowRoot!.querySelector('input')!;
    input.value = 'abc';
    input.dispatchEvent(new Event('input'));
    await nextFrame();
    expect(field.shadowRoot!.querySelector('input')).toBe(input);
    expect(field.value).toBe('abc');
  });

  it('collects values, applies initial values, validates and submits', async () => {
    const onSubmit = vi.fn();
    const form = NX.create<NXForm>({
      xtype: 'form',
      values: { name: 'Ada', role: 'Editor', subscribe: true },
      items: [
        { xtype: 'textfield', name: 'name', required: true },
        { xtype: 'email', name: 'email', required: true },
        { xtype: 'numberfield', name: 'age' },
        { xtype: 'select', name: 'role', options: ['Admin', 'Editor'] },
        { xtype: 'switch', name: 'subscribe' }
      ],
      onSubmit
    });
    document.body.appendChild(form);
    await nextFrame();

    expect(form.getValues()).toEqual({ name: 'Ada', email: '', age: null, role: 'Editor', subscribe: true });

    // invalid: email is required
    expect(form.submit()).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();

    form.setValues({ email: 'ada@example.com', age: 36 });
    const values = form.submit();
    expect(values).toMatchObject({ email: 'ada@example.com', age: 36 });
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0].detail.values.name).toBe('Ada');
  });

  it('runs custom validators', async () => {
    const form = NX.create<NXForm>({
      xtype: 'form',
      items: [{ xtype: 'textfield', name: 'code', validator: (v: string) => (v === '42' ? undefined : 'Wrong code') }]
    });
    document.body.appendChild(form);
    await nextFrame();
    expect(form.validate()).toBe(false);
    const field = form.getField<NXTextField>('code')!;
    expect(field.shadowRoot!.querySelector('.nx-field-helper')!.textContent).toBe('Wrong code');
    field.value = '42';
    expect(form.validate()).toBe(true);
  });

  it('reset clears fields', async () => {
    const form = NX.create<NXForm>({ xtype: 'form', items: [{ xtype: 'textfield', name: 'a', value: 'x' }] });
    document.body.appendChild(form);
    form.reset();
    expect(form.getValues()).toEqual({ a: '' });
  });
});
