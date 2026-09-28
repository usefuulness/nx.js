/**
 * hydrate(): server-rendered HTML + the same JSX → interactive, without re-creating elements.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Button, Card, Menu, hydrate, type NXMenu } from '@/index';
import { nextFrame } from '../utils';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('hydrate', () => {
  it('attaches listeners, refs and function props to the existing elements', async () => {
    // As parsed from server HTML: no listeners anywhere
    const root = document.createElement('div');
    root.innerHTML = '<section><button class="plain">Plain</button><nx-button variant="outline">Save</nx-button></section>';
    document.body.append(root);
    await nextFrame();
    const serverButton = root.querySelector('button.plain')!;
    const serverNx = root.querySelector('nx-button')!;

    const clicks: string[] = [];
    const ref = { current: null as HTMLButtonElement | null };
    hydrate(() => (
      <section>
        <button class="plain" ref={ref} onClick={() => clicks.push('plain')}>Plain</button>
        <Button variant="outline" onClick={() => clicks.push('nx')}>Save</Button>
      </section>
    ), root);

    // Same elements, now interactive
    expect(root.querySelector('button.plain')).toBe(serverButton);
    expect(root.querySelector('nx-button')).toBe(serverNx);
    expect(ref.current).toBe(serverButton);
    (serverButton as HTMLElement).click();
    serverNx.shadowRoot!.querySelector('button')!.click();
    expect(clicks).toEqual(['plain', 'nx']);
  });

  it('restores handlers inside data items (menus) and skips generated children', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<nx-card title="C"><script type="application/json" data-nx-config>{"title":"C"}</script><nx-menu text="Actions"></nx-menu></nx-card>';
    document.body.append(root);
    await nextFrame();
    const handler = vi.fn();
    hydrate(() => (
      <Card title="C">
        <Menu text="Actions" items={[{ text: 'Delete', handler }]} />
      </Card>
    ), root);
    // The server menu (not a new one) now holds the handler
    const menu = root.querySelector('nx-menu') as NXMenu;
    expect(root.querySelectorAll('nx-menu')).toHaveLength(1);
    expect((menu.liveConfig() as { items: Array<{ handler: unknown }> }).items[0].handler).toBe(handler);
  });

  it('re-creates a subtree that does not match, and says so', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>old</p>';
    document.body.append(root);
    const onMismatch = vi.fn();
    hydrate(() => <div class="new">new</div>, root, { onMismatch });
    expect(onMismatch).toHaveBeenCalledOnce();
    expect(root.innerHTML).toBe('<div class="new">new</div>');
  });
});
