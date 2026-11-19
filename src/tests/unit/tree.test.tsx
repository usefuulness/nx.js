import { describe, it, expect, beforeEach } from 'vitest';
import { NX, TreeStore, type NXTree } from '@/index';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };

describe('<nx-tree> lazy nodes', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  const mount = async (data: any[]) => {
    const el = NX.create<NXTree>({ xtype: 'tree', data });
    document.body.append(el);
    await frames();
    return el;
  };
  const toggles = (el: NXTree) => Array.from(el.shadowRoot!.querySelectorAll('.nx-tree-toggle'));

  it('a lazy node can be opened even though it has no children yet, and says so', async () => {
    const el = await mount([{ id: 'a', text: 'Folder', lazy: true }, { id: 'b', text: 'File' }]);
    const seen: any[] = [];
    el.addEventListener('toggle', e => seen.push((e as CustomEvent).detail));
    expect(toggles(el).length).toBe(1);
    expect(el.shadowRoot!.querySelector('[role="treeitem"][aria-expanded="false"]')).toBeTruthy();
    (toggles(el)[0] as HTMLElement).click();
    await frames();
    expect(seen).toEqual([expect.objectContaining({ nodeId: 'a', expanded: true })]);
    // The app loads the children and sets the data again: they appear under the open node
    el.setData([{ id: 'a', text: 'Folder', expanded: true, children: [{ id: 'a1', text: 'Inside' }] }, { id: 'b', text: 'File' }]);
    await frames();
    expect(el.shadowRoot!.textContent).toContain('Inside');
  });

  it('the Right and Left keys open and close a lazy node too', async () => {
    const el = await mount([{ id: 'a', text: 'Folder', lazy: true }]);
    const events: boolean[] = [];
    el.addEventListener('toggle', e => events.push((e as CustomEvent).detail.expanded));
    const row = el.shadowRoot!.querySelector('[role="treeitem"]') as HTMLElement;
    row.focus();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await frames();
    (el.shadowRoot!.querySelector('[role="treeitem"]') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    await frames();
    expect(events).toEqual([true, false]);
  });

  it('a node that is not lazy and has no children cannot be opened', async () => {
    const el = await mount([{ id: 'b', text: 'File' }]);
    expect(toggles(el).length).toBe(0);
    expect(el.shadowRoot!.querySelector('[aria-expanded]')).toBeNull();
  });

  it('expandAll includes lazy nodes', async () => {
    const el = await mount([{ id: 'a', text: 'Folder', lazy: true }]);
    el.expandAll();
    await frames();
    expect(el.shadowRoot!.querySelector('[aria-expanded="true"]')).toBeTruthy();
  });
});

describe('TreeStore.toItems with lazy folders', () => {
  it('marks a folder whose children have not loaded, and stops marking it once they have', async () => {
    const store = new TreeStore({
      root: [{ id: 'f', name: 'Folder', leaf: false }, { id: 'x', name: 'x.txt', leaf: true }],
      proxy: { type: 'memory', data: [] }
    });
    expect(store.toItems({ text: 'name' }).map(i => [i.id, i.lazy])).toEqual([['f', true], ['x', undefined]]);
    store.appendChild({ id: 'c', name: 'child' }, 'f');
    expect(store.toItems({ text: 'name' })[0].lazy).toBeUndefined();
  });
});
