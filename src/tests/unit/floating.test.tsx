/**
 * Combobox, tooltip and popover wiring (the top-layer behaviour itself is
 * covered in the browser: src/tests/e2e/demo.spec.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NX, Combobox, Tooltip, Popover, PopoverTrigger, Button, NXCombobox, type NXForm, type NXTooltip } from '@/index';
import { nextFrame } from '../utils';

const parts = (el: Element) => ({
  input: el.shadowRoot!.querySelector('input[role=combobox]') as HTMLInputElement,
  options: () => Array.from(el.shadowRoot!.querySelectorAll('[role=option]')) as HTMLElement[]
});
const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

describe('combobox', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('filters as you type and picks with the keyboard', async () => {
    const box = (<Combobox name="fw" label="Framework" options={['Astro', 'Nuxt', 'Next.js', 'Remix']} />) as NXCombobox;
    const changes: string[] = [];
    box.addEventListener('change', e => changes.push((e as CustomEvent).detail.value));
    document.body.append(box);
    await nextFrame();
    const { input, options } = parts(box);

    input.value = 'n';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(options().map(o => o.textContent)).toEqual(['Nuxt', 'Next.js']);
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[0].id);

    key(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[1].id);
    key(input, 'Enter');
    expect(box.value).toBe('Next.js');
    expect(input.value).toBe('Next.js');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(changes).toEqual(['Next.js']);
  });

  it('shows the option text for the value and drops half-typed text on blur', async () => {
    const box = (<Combobox name="c" value="de" options={{ de: 'Germany', fr: 'France' }} />) as NXCombobox;
    document.body.append(box);
    await nextFrame();
    const { input, options } = parts(box);
    expect(input.value).toBe('Germany');

    input.value = 'xyz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(box.shadowRoot!.querySelector('.empty')!.textContent).toBe('No results.');
    expect(options()).toHaveLength(0);
    input.dispatchEvent(new FocusEvent('blur'));
    expect(input.value).toBe('Germany');
    expect(box.value).toBe('de');

    // Typing an option's full text selects it
    input.value = 'france';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur'));
    expect(box.value).toBe('fr');
  });

  it('reads <option> children and validates in a form', async () => {
    const form = NX.create({ xtype: 'form', items: [{ xtype: 'combobox', name: 'city', required: true }] }) as NXForm;
    form.querySelector('nx-combobox')!.innerHTML = '<option value="ber">Berlin</option><option value="par">Paris</option>';
    document.body.append(form);
    await nextFrame();
    const box = form.querySelector('nx-combobox') as NXCombobox;
    expect(box.getOptions().map(o => o.text)).toEqual(['Berlin', 'Paris']);
    expect(form.validate()).toBe(false);
    box.value = 'par';
    expect(form.validate()).toBe(true);
    expect(form.getValues()).toEqual({ city: 'par' });
  });
});

describe('tooltip and popover', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('links the tooltip to its trigger and reuses a server-rendered bubble', async () => {
    const tip = (<Tooltip content="Save changes"><Button icon="save" aria-label="Save" /></Tooltip>) as NXTooltip;
    document.body.append(tip);
    await nextFrame();
    const bubble = tip.querySelector('[slot=tooltip]')!;
    expect(bubble.getAttribute('role')).toBe('tooltip');
    expect(bubble.textContent).toBe('Save changes');
    expect(tip.querySelector('nx-button')!.getAttribute('aria-describedby')).toBe(bubble.id);

    // Upgrading server HTML must not add a second bubble
    document.body.innerHTML = '<nx-tooltip content="Hi"><button>x</button><div slot="tooltip" id="t1" role="tooltip" popover="manual">Hi</div></nx-tooltip>';
    await nextFrame();
    expect(document.querySelectorAll('[slot=tooltip]')).toHaveLength(1);
    expect(document.querySelector('button')!.getAttribute('aria-describedby')).toBe('t1');
  });

  it('marks the popover trigger', async () => {
    const pop = (<Popover><PopoverTrigger><Button>Open</Button></PopoverTrigger><p>Body</p></Popover>) as HTMLElement;
    document.body.append(pop);
    await nextFrame();
    const trigger = pop.querySelector('nx-button')!;
    expect(trigger.slot).toBe('trigger');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(pop.shadowRoot!.querySelector('[role=dialog]')!.getAttribute('aria-label')).toBe('Open');
  });
});
