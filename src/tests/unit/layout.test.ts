import { describe, it, expect, beforeEach } from 'vitest';
import { NX, type NXTabPanel, type NXTree } from '@/index';
import { nextFrame } from '../utils';

describe('tabpanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('turns items into tabs with slotted content', async () => {
    const tabs = NX.create<NXTabPanel>({
      xtype: 'tabpanel',
      items: [
        { title: 'One', html: 'first' },
        { title: 'Two', closable: true, items: [{ xtype: 'button', text: 'Hi' }] }
      ]
    });
    document.body.appendChild(tabs);
    await nextFrame();
    const titles = Array.from(tabs.shadowRoot!.querySelectorAll('.nx-tab-title')).map(t => t.textContent);
    expect(titles).toEqual(['One', 'Two']);
    expect(tabs.children).toHaveLength(2);

    tabs.selectTab(1);
    await nextFrame();
    expect(tabs.getActiveTab()).toBe(1);

    tabs.closeTab(1);
    await nextFrame();
    expect(tabs.children).toHaveLength(1);
    expect(tabs.getActiveTab()).toBe(0);
  });
});

describe('tree', () => {
  it('honors expanded and emits select with the node', async () => {
    const tree = NX.create<NXTree>({
      xtype: 'tree',
      data: [{ id: 1, text: 'Root', expanded: true, children: [{ id: 2, text: 'Child', route: '/child' }] }]
    });
    document.body.appendChild(tree);
    await nextFrame();
    expect(tree.shadowRoot!.textContent).toContain('Child');

    let selected: any = null;
    tree.addEventListener('select', e => (selected = (e as CustomEvent).detail.node));
    (tree.shadowRoot!.querySelector('[data-node-id="2"] .nx-tree-node-content') as HTMLElement).click();
    expect(selected?.route).toBe('/child');
  });
});

describe('container', () => {
  it('lays out children with gap / columns', () => {
    const box = NX.create({ xtype: 'container', layout: 'grid', columns: 3, gap: 8, items: [{ html: 'a' }] });
    document.body.appendChild(box);
    const css = box.shadowRoot!.querySelector('style')!.textContent!;
    expect(css).toContain('repeat(3, minmax(0, 1fr))');
    expect(css).toContain('gap: 8px');
  });
});
