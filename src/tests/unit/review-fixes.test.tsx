/**
 * Regression tests for issues found in the branch review.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NX, Button, Tree, Input, eventName, type NXModal, type NXTree } from '@/index';
import { nextFrame } from '../utils';

describe('review fixes', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('empty attributes are "" for non-boolean props (prompt placeholder was "true")', async () => {
    const field = NX.create({ xtype: 'textfield', placeholder: '' });
    document.body.append(field);
    expect(field.shadowRoot!.querySelector('input')!.placeholder).toBe('');
    const button = NX.create({ xtype: 'button', text: 'x', disabled: true });
    expect((button as any).get('disabled', false)).toBe(true);
  });

  it('a re-rendering tree does not steal focus from an input', async () => {
    const input = (<Input name="filter" />) as HTMLElement;
    const tree = (<Tree data={[{ id: 1, text: 'One' }, { id: 2, text: 'Two' }]} />) as NXTree;
    document.body.append(input, tree);
    (tree.shadowRoot!.querySelector('.nx-tree-node-content') as HTMLElement).click(); // tree remembers node 1
    await nextFrame();
    const inner = input.shadowRoot!.querySelector('input')!;
    inner.focus();
    tree.setData([{ id: 1, text: 'One' }]);
    await nextFrame();
    expect(input.shadowRoot!.activeElement).toBe(inner);
  });

  it('modal survives close() then open() during the close animation', async () => {
    const modal = NX.create<NXModal>({ xtype: 'modal', title: 'x' });
    document.body.append(modal);
    const first = modal.open();
    modal.close('first');
    const second = modal.open();
    expect(await first).toBe('first');
    await new Promise(r => setTimeout(r, 200)); // past the old close timer
    expect(modal.shadowRoot!.querySelector('dialog')!.open).toBe(true);
    modal.close('second');
    expect(await second).toBe('second');
  });

  it('tabIndex maps to the tabindex attribute', () => {
    const button = (<Button tabIndex={-1}>x</Button>) as HTMLElement;
    expect(button.getAttribute('tabindex')).toBe('-1');
    expect(button.hasAttribute('tab-index')).toBe(false);
  });

  it('style objects on components support numbers and --custom properties', () => {
    const button = (<Button style={{ marginTop: 8, '--accent': 'red', flexGrow: 2 }}>x</Button>) as HTMLElement;
    expect(button.style.marginTop).toBe('8px');
    expect(button.style.getPropertyValue('--accent')).toBe('red');
    expect(button.style.flexGrow).toBe('2');
  });

  it('components keep working after being moved in the DOM', async () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);
    const menu = NX.create({ xtype: 'menu', text: 'Actions', items: [{ text: 'Edit' }] }) as any;
    a.append(menu);
    b.append(menu); // move
    await nextFrame();
    (menu.shadowRoot!.querySelector('nx-button') as HTMLElement).click();
    expect(menu.opened).toBe(true);
    menu.close();
  });

  it('native event props resolve from the platform', () => {
    expect(eventName('onKeyDown')).toBe('keydown');
    expect(eventName('onDblClick')).toBe('dblclick');
    expect(eventName('onTabChange')).toBe('tab-change');
    expect(eventName('onSelectionChange')).toBe('selection-change');
    expect(eventName('onRowClick')).toBe('row-click');
    // Only assert platform events jsdom actually exposes
    if ('ontimeupdate' in HTMLElement.prototype) expect(eventName('onTimeUpdate')).toBe('timeupdate');
    if ('onloadedmetadata' in HTMLElement.prototype) expect(eventName('onLoadedMetadata')).toBe('loadedmetadata');
  });
});
