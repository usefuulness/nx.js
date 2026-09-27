import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NX } from '@/index';
import { ComponentRegistry } from '@/core/registry';

describe('ComponentRegistry.build / NX.create', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves xtypes, aliases and plain tags', () => {
    expect(ComponentRegistry.resolveTag('button')).toBe('nx-button');
    expect(ComponentRegistry.resolveTag('btn')).toBe('nx-button');
    expect(ComponentRegistry.resolveTag('nx-panel')).toBe('nx-panel');
    expect(ComponentRegistry.resolveTag('section')).toBe('section');
  });

  it('creates a configured component', () => {
    const handler = vi.fn();
    const button = NX.create({ xtype: 'button', text: 'Save', variant: 'outline', handler });
    document.body.appendChild(button);
    expect(button.tagName).toBe('NX-BUTTON');
    expect(button.getAttribute('variant')).toBe('outline');
    expect(button.shadowRoot!.textContent).toContain('Save');
    button.click();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('supports the (xtype, config) form', () => {
    const panel = NX.create('panel', { title: 'Hello' });
    expect(panel.tagName).toBe('NX-PANEL');
  });

  it('builds nested items and string shorthands', () => {
    const toolbar = NX.create({
      xtype: 'toolbar',
      items: [{ xtype: 'button', text: 'A' }, '->', '-', { xtype: 'button', text: 'B', variant: 'primary' }]
    });
    const tags = Array.from(toolbar.children).map(c => c.tagName.toLowerCase());
    expect(tags).toEqual(['nx-button', 'nx-spacer', 'nx-separator', 'nx-button']);
    // toolbar buttons default to ghost unless specified
    expect(toolbar.children[0].getAttribute('variant')).toBe('ghost');
    expect(toolbar.children[3].getAttribute('variant')).toBe('primary');
  });

  it('defaults to html / container when xtype is omitted', () => {
    const html = NX.create({ html: '<b>hi</b>' });
    expect(html.tagName).toBe('DIV');
    expect(html.innerHTML).toBe('<b>hi</b>');
    const box = NX.create({ items: [{ html: 'x' }] });
    expect(box.tagName).toBe('NX-CONTAINER');
  });

  it('skips null/false items (conditional rendering)', () => {
    const show = false;
    const box = NX.create({ items: [show && { html: 'a' }, null, { html: 'b' }] });
    expect(box.children).toHaveLength(1);
  });

  it('uses registered factories (switch, textarea…)', () => {
    const sw = NX.create({ xtype: 'switch', label: 'On' });
    expect(sw.tagName).toBe('NX-CHECKBOX');
    expect(sw.hasAttribute('switch')).toBe(true);
    const ta = NX.create({ xtype: 'textarea' });
    expect(ta.tagName).toBe('NX-TEXTFIELD');
    expect(ta.hasAttribute('multiline')).toBe(true);
  });

  it('warns on unknown components', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    NX.create({ xtype: 'nx-does-not-exist' });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('NX.define registers a working component', () => {
    NX.define('hello-test', {
      observedAttributes: ['name'],
      render() {
        return `Hello ${this.getProp('name', 'world')}`;
      }
    });
    const el = NX.create({ xtype: 'hello-test', name: 'Ada' });
    document.body.appendChild(el);
    expect(el.shadowRoot!.textContent).toContain('Hello Ada');
  });

  it('NX.render mounts into a target', () => {
    document.body.innerHTML = '<div id="root"></div>';
    const [el] = NX.render({ xtype: 'button', text: 'Hi' }, '#root');
    expect(document.getElementById('root')!.firstElementChild).toBe(el);
  });
});
