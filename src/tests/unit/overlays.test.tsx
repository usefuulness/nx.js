import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Accordion, AccordionItem, Drawer, DrawerFooter, Button, Panel, type NXDrawer, type NXPanel } from '@/index';
import { nextFrame } from '../utils';

describe('accordion', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('builds sections from JSX children and toggles single-open', async () => {
    const onToggle = vi.fn();
    const acc = (
      <Accordion onToggle={onToggle}>
        <AccordionItem title="One" expanded><b>first</b></AccordionItem>
        <AccordionItem title="Two">second</AccordionItem>
      </Accordion>
    ) as HTMLElement;
    document.body.append(acc);
    await nextFrame();
    const triggers = () => Array.from(acc.shadowRoot!.querySelectorAll('.trigger')) as HTMLButtonElement[];
    expect(triggers().map(t => t.textContent)).toEqual(['One', 'Two']);
    expect(triggers().map(t => t.getAttribute('aria-expanded'))).toEqual(['true', 'false']);

    triggers()[1].click();
    await nextFrame();
    expect(triggers().map(t => t.getAttribute('aria-expanded'))).toEqual(['false', 'true']);
    expect(onToggle).toHaveBeenCalledOnce();
    expect(acc.querySelector('nx-accordion-item')!.hasAttribute('title')).toBe(false);
  });

  it('expandAll works with ids from data items', async () => {
    const acc = (<Accordion multiple items={[{ id: 'x', title: 'X' }, { id: 'y', title: 'Y' }]} />) as any;
    document.body.append(acc);
    acc.expandAll();
    await nextFrame();
    const states = Array.from(acc.shadowRoot!.querySelectorAll('.trigger')).map((t: any) => t.getAttribute('aria-expanded'));
    expect(states).toEqual(['true', 'true']);
  });
});

describe('drawer', () => {
  it('opens and closes as a modal dialog with title and footer', async () => {
    const onClose = vi.fn();
    const drawer = (
      <Drawer title="Filters" onClose={onClose}>
        body
        <DrawerFooter><Button>Apply</Button></DrawerFooter>
      </Drawer>
    ) as NXDrawer;
    document.body.append(drawer);
    const dialog = () => drawer.shadowRoot!.querySelector('dialog')!;
    expect(dialog().open).toBe(false);
    expect(drawer.shadowRoot!.querySelector('[part="footer"]')).not.toBeNull();

    drawer.open();
    expect(dialog().open).toBe(true);
    expect(drawer.hasAttribute('open')).toBe(true);

    (drawer.shadowRoot!.querySelector('[part="close"]') as HTMLElement).click();
    await new Promise(r => setTimeout(r, 250));
    expect(dialog().open).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('opens from the `open` attribute', async () => {
    const drawer = (<Drawer open title="x" />) as NXDrawer;
    document.body.append(drawer);
    await nextFrame();
    expect(drawer.opened).toBe(true);
    expect(drawer.shadowRoot!.querySelector('dialog')!.open).toBe(true);
  });
});

describe('panel', () => {
  it('collapses via its toggle button', async () => {
    const panel = (<Panel title="Nav" collapsible>content</Panel>) as NXPanel;
    document.body.append(panel);
    (panel.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement).click();
    await nextFrame();
    expect(panel.shadowRoot!.querySelector('.collapsed')).not.toBeNull();
  });
});

describe('dialog helpers', () => {
  // Footer buttons are rendered inside the modal's shadow root
  const button = (text: string) =>
    Array.from(document.querySelector('nx-modal')!.shadowRoot!.querySelectorAll('nx-button')).find(b => b.getAttribute('text') === text) as HTMLElement;

  it('NX.confirm resolves true/false and cleans up', async () => {
    const { NX } = await import('@/index');
    const yes = NX.confirm('Sure?', { confirmText: 'Yes' });
    await nextFrame();
    button('Yes').click();
    expect(await yes).toBe(true);
    await new Promise(r => setTimeout(r, 200));
    expect(document.querySelector('nx-modal')).toBeNull();

    const no = NX.confirm('Sure?', { cancelText: 'Nope' });
    await nextFrame();
    button('Nope').click();
    expect(await no).toBe(false);
  });

  it('NX.prompt returns the typed value', async () => {
    const { NX } = await import('@/index');
    const answer = NX.prompt('Name?', { defaultValue: 'Ada' });
    await nextFrame();
    button('OK').click();
    expect(await answer).toBe('Ada');
  });
});

describe('toast', () => {
  it('escapes strings, accepts JSX and runs actions', async () => {
    const { NX } = await import('@/index');
    const undo = vi.fn();
    NX.toast('<img src=x onerror=alert(1)>', { description: <b>bold</b>, action: { text: 'Undo', handler: undo }, duration: 0 });
    const root = document.querySelector('nx-toast')!.shadowRoot!;
    expect(root.querySelector('.message img')).toBeNull();
    expect(root.querySelector('.message')!.textContent).toContain('<img');
    expect(root.querySelector('.description b')!.textContent).toBe('bold');
    (root.querySelector('.action') as HTMLElement).click();
    expect(undo).toHaveBeenCalledOnce();
  });
});
