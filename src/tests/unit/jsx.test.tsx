import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NX, BaseComponent, define, cn, variants,
  Button, Card, CardFooter, Tabs, Tab, Toolbar, Input, Form, DataGrid, Badge,
  type NXTabPanel, type NXForm, type NXTextField
} from '@/index';
import { nextFrame } from '../utils';

describe('JSX runtime', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates plain elements like HTML', () => {
    const onClick = vi.fn();
    const el = (
      <div id="x" class={['a', { b: true, c: false }]} style={{ marginTop: 4, '--gap': '2px' }} data-role="box" aria-label="Box">
        <span>Hello {'world'}</span>
        {null}{false}{[1, 2].map(n => <i>{n}</i>)}
        <button type="button" disabled onClick={onClick}>Go</button>
      </div>
    ) as HTMLDivElement;

    expect(el.id).toBe('x');
    expect(el.className).toBe('a b');
    expect(el.style.marginTop).toBe('4px');
    expect(el.style.getPropertyValue('--gap')).toBe('2px');
    expect(el.dataset.role).toBe('box');
    expect(el.getAttribute('aria-label')).toBe('Box');
    expect(el.querySelector('span')!.textContent).toBe('Hello world');
    expect(el.querySelectorAll('i')).toHaveLength(2);
    const button = el.querySelector('button')!;
    expect(button.disabled).toBe(true);
    button.disabled = false;
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('uses the right event names', () => {
    const keydown = vi.fn();
    const custom = vi.fn();
    const el = (<div onKeyDown={keydown} onTabChange={custom} />) as HTMLElement;
    el.dispatchEvent(new KeyboardEvent('keydown'));
    el.dispatchEvent(new CustomEvent('tab-change'));
    expect(keydown).toHaveBeenCalledOnce();
    expect(custom).toHaveBeenCalledOnce();
  });

  it('supports fragments, refs, svg and function components', () => {
    let ref: HTMLElement | null = null;
    const Greeting = ({ name }: { name: string }) => <p ref={(el: HTMLElement) => (ref = el)}>Hi {name}</p>;
    const frag = (
      <>
        <Greeting name="Ada" />
        <svg viewBox="0 0 24 24"><path d="M0 0h24" /></svg>
      </>
    ) as DocumentFragment;
    document.body.append(frag);
    expect(ref!.textContent).toBe('Hi Ada');
    expect(document.querySelector('path')!.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('configures nx components exactly like xtype configs', () => {
    const onClick = vi.fn();
    const button = (<Button variant="outline" icon="plus" onClick={onClick}>New</Button>) as HTMLElement;
    document.body.append(button);
    expect(button.tagName).toBe('NX-BUTTON');
    expect(button.getAttribute('variant')).toBe('outline');
    expect(button.textContent).toBe('New');
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('slots children, including named slots', () => {
    const card = (
      <Card title="Hello">
        <p>Body</p>
        <CardFooter><Button>OK</Button></CardFooter>
      </Card>
    ) as HTMLElement;
    document.body.append(card);
    expect(card.shadowRoot!.querySelector('[part="footer"]')).not.toBeNull();
    expect(card.querySelector('[slot="footer"] nx-button')).not.toBeNull();
    expect(card.hasAttribute('title')).toBe(false);
  });

  it('builds tabs from <Tab> children', async () => {
    const tabs = (
      <Tabs>
        <Tab title="One">first</Tab>
        <Tab title="Two" active>second</Tab>
      </Tabs>
    ) as NXTabPanel;
    document.body.append(tabs);
    await nextFrame();
    const titles = Array.from(tabs.shadowRoot!.querySelectorAll('.nx-tab-title')).map(t => t.textContent);
    expect(titles).toEqual(['One', 'Two']);
    expect(tabs.getActiveTab()).toBe(1);
    expect(tabs.querySelector('nx-tab')!.hasAttribute('title')).toBe(false);
  });

  it('defaults toolbar child buttons to ghost', () => {
    const bar = (<Toolbar><Button>A</Button><Button variant="primary">B</Button></Toolbar>) as HTMLElement;
    document.body.append(bar);
    const [a, b] = Array.from(bar.children);
    expect(a.getAttribute('variant')).toBe('ghost');
    expect(b.getAttribute('variant')).toBe('primary');
  });

  it('works for forms and data props', async () => {
    const rows = [{ name: 'Ada' }, { name: 'Linus' }];
    const onSubmit = vi.fn();
    const form = (
      <Form onSubmit={onSubmit} values={{ email: 'a@b.co' }}>
        <Input name="email" type="email" required />
      </Form>
    ) as NXForm;
    const grid = (<DataGrid data={rows} columns={[{ field: 'name', header: 'Name' }]} />) as HTMLElement;
    document.body.append(form, grid);
    await nextFrame();
    expect(form.submit()).toEqual({ email: 'a@b.co' });
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(grid.shadowRoot!.querySelectorAll('tbody tr')).toHaveLength(2);
    expect((form.getField('email') as NXTextField).value).toBe('a@b.co');
  });

  it('NX.render / NX.app accept JSX', () => {
    document.body.innerHTML = '<div id="root"></div>';
    NX.render(<Badge variant="success">Paid</Badge>, '#root');
    expect(document.querySelector('#root nx-badge')!.shadowRoot!.querySelector('.success')).not.toBeNull();
  });
});

describe('components authored with JSX', () => {
  class Counter extends BaseComponent {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    protected initializeState() {
      this.setState('count', 0);
      this.setState('text', '');
    }
    protected render() {
      return (
        <div>
          <button onClick={() => this.setState('count', this.getState('count') + 1)}>{this.getState('count')}</button>
          <input value={this.getState('text')} onInput={(e: Event) => this.setState('text', (e.target as HTMLInputElement).value)} />
        </div>
      );
    }
  }
  define('x-jsx-counter', Counter);

  it('re-renders with inline handlers, without stacking listeners', async () => {
    const el = document.createElement('x-jsx-counter');
    document.body.append(el);
    for (let i = 0; i < 3; i++) {
      (el.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
      await nextFrame();
    }
    expect(el.shadowRoot!.querySelector('button')!.textContent).toBe('3');
  });

  it('keeps focus and caret in inputs across re-renders', async () => {
    const el = document.createElement('x-jsx-counter');
    document.body.append(el);
    const input = el.shadowRoot!.querySelector('input')!;
    input.focus();
    input.value = 'abc';
    input.setSelectionRange(2, 2);
    input.dispatchEvent(new Event('input'));
    await nextFrame();
    const next = el.shadowRoot!.querySelector('input')!;
    expect(next).not.toBe(input); // re-rendered…
    expect(el.shadowRoot!.activeElement).toBe(next); // …but still focused
    expect(next.value).toBe('abc');
    expect(next.selectionStart).toBe(2);
  });
});

describe('cn / variants', () => {
  it('cn joins conditionally', () => {
    expect(cn('a', false, ['b', null, ['c']], { d: 1, e: 0 })).toBe('a b c d');
  });

  it('variants picks classes with defaults and compounds', () => {
    const button = variants({
      base: 'btn',
      variants: { variant: { primary: 'p', outline: 'o' }, size: { sm: 's', lg: 'l' } },
      compoundVariants: [{ variant: 'outline', size: 'sm', class: 'os' }],
      defaultVariants: { variant: 'primary' }
    });
    expect(button()).toBe('btn p');
    expect(button({ variant: 'outline', size: 'sm', class: 'x' })).toBe('btn o s os x');
  });
});

describe('variants with booleans', () => {
  it('accepts real booleans for true/false keys', () => {
    const v = variants({ base: 'x', variants: { active: { true: 'on', false: 'off' } }, compoundVariants: [{ active: true, class: 'both' }] });
    expect(v({ active: true })).toBe('x on both');
    expect(v({ active: false })).toBe('x off');
  });
});
