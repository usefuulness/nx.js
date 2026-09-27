import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseComponent, escapeHTML, toKebab } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { nextFrame } from '../utils';

class TestCounter extends BaseComponent {
  static get observedAttributes() {
    return ['label', 'page-size'];
  }
  clicks = 0;
  receivedItems: unknown = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {
    this.setState('count', 0);
  }

  protected render(): string {
    return `<button>${escapeHTML(this.getProp('label', 'Count'))}: ${this.getState('count')}</button>`;
  }

  protected afterRender(): void {
    this.on(this.$('button')!, 'click', () => {
      this.clicks++;
      this.setState('count', this.getState('count') + 1);
    });
  }

  setItemsList(value: unknown): void {
    this.receivedItems = value;
  }

  prop<T>(name: string, fallback?: T): T {
    return this.getProp(name, fallback);
  }
}
define('nx-test-counter', TestCounter);

describe('BaseComponent', () => {
  let el: TestCounter;

  beforeEach(() => {
    document.body.innerHTML = '';
    el = document.createElement('nx-test-counter') as TestCounter;
    document.body.appendChild(el);
  });

  it('renders into its shadow root on connect', () => {
    expect(el.shadowRoot!.textContent).toContain('Count: 0');
  });

  it('batches state updates into one render per frame', async () => {
    const button = el.shadowRoot!.querySelector('button')!;
    button.click();
    await nextFrame();
    expect(el.shadowRoot!.textContent).toContain('Count: 1');
  });

  it('does not stack listeners across re-renders', async () => {
    for (let i = 0; i < 3; i++) {
      el.shadowRoot!.querySelector('button')!.click();
      await nextFrame();
    }
    // One click → one handler call, no matter how many renders happened
    expect(el.clicks).toBe(3);
    expect(el.shadowRoot!.textContent).toContain('Count: 3');
  });

  describe('configure()', () => {
    it('maps primitives to kebab-cased attributes', () => {
      el.configure({ label: 'Hits', pageSize: 10 });
      expect(el.getAttribute('label')).toBe('Hits');
      expect(el.getAttribute('page-size')).toBe('10');
      expect(el.get('pageSize')).toBe(10);
    });

    it('keeps objects and explicit false as props', () => {
      const columns = [{ field: 'a' }];
      el.configure({ columns, visible: false });
      expect(el.prop('columns')).toBe(columns);
      expect(el.prop('visible', true)).toBe(false);
      expect(el.hasAttribute('columns')).toBe(false);
    });

    it('treats bare boolean attributes as true', () => {
      el.configure({ disabled: true });
      expect(el.getAttribute('disabled')).toBe('');
      expect(el.prop('disabled', false)).toBe(true);
    });

    it('wires handler, listeners and onXxx callbacks', () => {
      const handler = vi.fn();
      const listener = vi.fn();
      const onTabChange = vi.fn();
      el.configure({ handler, listeners: { custom: listener }, onTabChange });
      el.click();
      el.dispatchEvent(new CustomEvent('custom'));
      el.dispatchEvent(new CustomEvent('tab-change'));
      expect(handler).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledOnce();
      expect(onTabChange).toHaveBeenCalledOnce();
    });

    it('calls matching setXxx() methods', () => {
      el.configure({ itemsList: [1, 2] });
      expect(el.receivedItems).toEqual([1, 2]);
    });

    it('applies host-level keys', () => {
      el.configure({ id: 'x', cls: 'a b', style: { color: 'red' }, flex: 2, region: 'west', title: 'Hi' });
      expect(el.id).toBe('x');
      expect(el.classList.contains('a') && el.classList.contains('b')).toBe(true);
      expect(el.style.color).toBe('red');
      expect(el.style.flex).toContain('2');
      expect(el.slot).toBe('west');
      // no native tooltip
      expect(el.hasAttribute('title')).toBe(false);
      expect(el.get('title')).toBe('Hi');
    });
  });
});

describe('helpers', () => {
  it('toKebab', () => {
    expect(toKebab('pageSize')).toBe('page-size');
    expect(toKebab('already-kebab')).toBe('already-kebab');
  });

  it('escapeHTML', () => {
    expect(escapeHTML('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
    expect(escapeHTML(null)).toBe('');
  });
});

describe('configure() with undefined', () => {
  it('clears instead of calling setters with undefined', async () => {
    const { NX } = await import('@/index');
    const button = NX.create({ xtype: 'button', text: 'Hi' });
    expect(button.getAttribute('text')).toBe('Hi');
    (button as any).configure({ text: undefined });
    expect(button.hasAttribute('text')).toBe(false);
    const menu = NX.create({ xtype: 'menu', icon: 'more' });
    document.body.append(menu);
    const trigger = menu.shadowRoot!.querySelector('nx-button')!;
    expect(trigger.hasAttribute('text')).toBe(false);
  });
});
