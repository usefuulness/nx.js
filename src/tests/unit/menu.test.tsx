import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NX, Button, Menu } from '@/index';

const popup = () => document.querySelector('nx-menu-popup')!;
const item = (text: string) =>
  Array.from(popup().shadowRoot!.querySelectorAll('.item')).find(el => el.querySelector('.text')!.textContent === text) as HTMLElement;

describe('menus', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('runs the handler of the clicked submenu item, not a top-level one with the same index', () => {
    const top = vi.fn();
    const nested = vi.fn();
    NX.menu([{ text: 'First', handler: top }, { text: 'More', items: [{ text: 'Nested first', handler: nested }] }], { x: 0, y: 0 });
    item('Nested first').click();
    expect(nested).toHaveBeenCalledOnce();
    expect(top).not.toHaveBeenCalled();
    expect(document.querySelector('nx-menu-popup')).toBeNull(); // closes after selection
  });

  it('opens from <Menu>, emits select and supports keyboard', () => {
    const onSelect = vi.fn();
    const menu = (<Menu text="Actions" items={[{ text: 'Edit' }, '-', { text: 'Delete', danger: true }]} onSelect={onSelect} />) as any;
    document.body.append(menu);
    menu.open(true);
    const root = popup().shadowRoot!;
    expect(root.activeElement!.textContent).toContain('Edit');
    root.querySelector('.list')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    expect(root.activeElement!.textContent).toContain('Delete'); // skips the divider
    root.querySelector('.list')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    expect(onSelect.mock.calls[0][0].detail.item.text).toBe('Delete');
  });

  it('gives buttons a dropdown via `menu`', () => {
    const csv = vi.fn();
    const button = (<Button menu={[{ text: 'CSV', handler: csv }]}>Export</Button>) as HTMLElement;
    document.body.append(button);
    button.click();
    item('CSV').click();
    expect(csv).toHaveBeenCalledOnce();
  });
});
