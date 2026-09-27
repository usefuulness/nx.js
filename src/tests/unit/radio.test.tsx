/**
 * Radio group and the HTML names that match the JSX components.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NX, RadioGroup, Input, Textarea, Switch, Tabs, Tab, Dialog, NXRadioGroup, NXTextField, NXCheckbox, NXTabPanel, NXModal, type NXForm } from '@/index';
import { nextFrame } from '../utils';

const radios = (el: Element) => Array.from(el.shadowRoot!.querySelectorAll('input[type=radio]')) as HTMLInputElement[];

describe('radio group', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders options, reflects the value and reports changes', async () => {
    const group = (<RadioGroup name="plan" label="Plan" value="pro" options={{ free: 'Free', pro: 'Pro' }} />) as NXRadioGroup;
    const changes: string[] = [];
    group.addEventListener('change', e => changes.push((e as CustomEvent).detail.value));
    document.body.append(group);
    await nextFrame();

    expect(radios(group).map(r => [r.value, r.checked])).toEqual([['free', false], ['pro', true]]);
    expect(group.shadowRoot!.querySelector('[role=radiogroup]')!.getAttribute('aria-labelledby')).toMatch(/-label$/);

    radios(group)[0].click();
    expect(group.value).toBe('free');
    expect(changes).toEqual(['free']);

    group.value = 'pro';
    expect(radios(group)[1].checked).toBe(true);
  });

  it('reads <option> children, including ones added later', async () => {
    document.body.innerHTML = '<nx-radio-group name="size" value="m"><option value="s">Small</option><option value="m" data-description="Most popular">Medium</option></nx-radio-group>';
    const group = document.querySelector('nx-radio-group') as NXRadioGroup;
    await nextFrame();
    expect(radios(group).find(r => r.checked)!.value).toBe('m');
    expect(group.shadowRoot!.textContent).toContain('Most popular');

    group.insertAdjacentHTML('beforeend', '<option value="l">Large</option>');
    await new Promise(r => setTimeout(r, 0));
    await nextFrame();
    expect(radios(group).map(r => r.value)).toEqual(['s', 'm', 'l']);
  });

  it('validates `required` and works in <nx-form> and xtype configs', async () => {
    const form = NX.create({
      xtype: 'form',
      items: [{ xtype: 'radio', name: 'color', required: true, options: ['Red', 'Blue'] }]
    }) as NXForm;
    document.body.append(form);
    await nextFrame();
    expect(form.querySelector('nx-radio-group')).toBeInstanceOf(NXRadioGroup);
    expect(form.validate()).toBe(false);
    radios(form.querySelector('nx-radio-group')!)[1].click();
    expect(form.validate()).toBe(true);
    expect(form.getValues()).toEqual({ color: 'Blue' });
  });
});

describe('HTML names match the JSX components', () => {
  it('<Input>, <Textarea>, <Switch>, <Tabs>, <Dialog> render their shadcn-named tags', async () => {
    const nodes = [
      <Input name="a" />, <Textarea name="b" />, <Switch name="c" />,
      <Tabs><Tab title="One">1</Tab></Tabs>, <Dialog title="D">x</Dialog>
    ] as HTMLElement[];
    expect(nodes.map(n => n.localName)).toEqual(['nx-input', 'nx-textarea', 'nx-switch', 'nx-tabs', 'nx-dialog']);
    // Same components underneath
    expect(nodes[0]).toBeInstanceOf(NXTextField);
    expect(nodes[2]).toBeInstanceOf(NXCheckbox);
    expect(nodes[3]).toBeInstanceOf(NXTabPanel);
    expect(nodes[4]).toBeInstanceOf(NXModal);

    document.body.append(...nodes.slice(0, 3));
    await nextFrame();
    expect(nodes[1].shadowRoot!.querySelector('textarea')).not.toBeNull();
    expect(nodes[2].shadowRoot!.querySelector('[role=switch]')).not.toBeNull();
  });
});
