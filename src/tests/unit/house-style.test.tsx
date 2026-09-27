/**
 * Keeps the CONTRIBUTING.md example honest: this is the documented way to write a component.
 */
import { describe, it, expect, vi } from 'vitest';
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { variants } from '@/core/variants';
import { NX, type Props } from '@/index';
import { nextFrame } from '../utils';

interface ChipConfig {
  variant?: 'default' | 'outline';
  selected?: boolean;
}

const chip = variants({
  base: 'chip',
  variants: { variant: { default: 'default', outline: 'outline' } },
  defaultVariants: { variant: 'default' }
});

class NXChip extends BaseComponent {
  static get observedAttributes() { return ['variant', 'selected']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState() {}

  protected render() {
    const selected = this.getProp('selected', false);
    return (
      <button part="chip" class={chip({ variant: this.getProp('variant') })} aria-pressed={String(selected)}
              onClick={() => this.emit('toggle', { selected: !selected })}>
        <slot />
      </button>
    );
  }

  protected styles() {
    return `.chip { height: 2rem; }`;
  }
}

define('nx-chip', NXChip);
const Chip = (props: Props<ChipConfig>) => <nx-chip {...props} />;

describe('house-style component (CONTRIBUTING.md)', () => {
  it('renders variants, reacts to attributes and emits events', async () => {
    const onToggle = vi.fn();
    const el = (<Chip variant="outline" onToggle={onToggle}>React</Chip>) as HTMLElement;
    document.body.append(el);
    const button = () => el.shadowRoot!.querySelector('button')!;

    expect(button().className).toBe('chip outline');
    expect(el.textContent).toBe('React');

    button().click();
    expect(onToggle.mock.calls[0][0].detail).toEqual({ selected: true });

    el.setAttribute('selected', '');
    await nextFrame();
    expect(button().getAttribute('aria-pressed')).toBe('true');
  });

  it('is also usable as a config', () => {
    const el = NX.create({ xtype: 'chip', variant: 'default' });
    document.body.append(el);
    expect(el.tagName).toBe('NX-CHIP');
    expect(el.shadowRoot!.querySelector('.chip.default')).not.toBeNull();
  });
});
