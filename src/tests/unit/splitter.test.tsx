import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NX, type NXSplitter } from '@/index';
import { nextFrame } from '../utils';

/** jsdom has no layout: give the splitter and its dividers sizes, so percentages can be checked. */
function layout(el: HTMLElement, width = 1008, height = 508, gutter = 8) {
  el.getBoundingClientRect = () => ({ width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON() {} }) as DOMRect;
  el.querySelectorAll('[data-nx-generated]').forEach(g => {
    (g as HTMLElement).getBoundingClientRect = () => ({ width: gutter, height: gutter, x: 0, y: 0, top: 0, left: 0, right: gutter, bottom: gutter, toJSON() {} }) as DOMRect;
  });
}

describe('<nx-splitter>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });
  const mount = (html: string, attrs = '') => {
    document.body.innerHTML = `<nx-splitter ${attrs}>${html}</nx-splitter>`;
    const el = document.querySelector('nx-splitter') as NXSplitter;
    layout(el);
    return el;
  };
  const gutters = (el: NXSplitter) => Array.from(el.querySelectorAll('[data-nx-generated]')) as HTMLElement[];
  const key = (g: HTMLElement, k: string, init: KeyboardEventInit = {}) => g.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));

  it('puts a divider between each pair of panes, as focusable separators with ARIA values', () => {
    const el = mount('<div size="30">A</div><div>B</div><div>C</div>');
    expect(gutters(el)).toHaveLength(2);
    expect(el.children[1].hasAttribute('data-nx-generated')).toBe(true);
    expect(el.children[3].hasAttribute('data-nx-generated')).toBe(true);
    const g = gutters(el)[0];
    expect(g.getAttribute('role')).toBe('separator');
    expect(g.getAttribute('tabindex')).toBe('0');
    expect(g.getAttribute('aria-orientation')).toBe('vertical'); // a divider between side-by-side panes is a vertical line
    expect(g.getAttribute('aria-valuenow')).toBe('30');
    expect(g.getAttribute('aria-controls')).toBe((el.children[0] as HTMLElement).id);
    expect(g.getAttribute('aria-label')).toBe('Resize panes');
  });

  it('shares size by each pane\'s `size`, splitting what is left equally', () => {
    expect(mount('<div size="30">A</div><div>B</div>').getSizes()).toEqual([30, 70]);
    expect(mount('<div>A</div><div>B</div><div>C</div><div>D</div>').getSizes()).toEqual([25, 25, 25, 25]);
    expect(mount('<div size="50">A</div><div size="25">B</div><div>C</div>').getSizes()).toEqual([50, 25, 25]);
    const el = mount('<div size="1">A</div><div size="3">B</div>'); // relative, not percentages
    expect(el.getSizes()).toEqual([25, 75]);
    // (the pane's share is written into its style as a fraction; real widths are checked in the browser tests)
    expect(el.getSizes()).toEqual([25, 75]);
  });

  it('keeps dividers the server wrote, and adds none twice', () => {
    const el = mount('<div>A</div><div data-nx-generated role="separator" tabindex="0" class="nx-gutter"></div><div>B</div>');
    expect(gutters(el)).toHaveLength(1);
    el.appendChild(document.createElement('div'));
    return nextFrame().then(() => {
      expect(gutters(el)).toHaveLength(2);
    });
  });

  it('adds and removes dividers when panes come and go', async () => {
    const el = mount('<div>A</div><div>B</div>');
    el.appendChild(document.createElement('section'));
    await new Promise(r => setTimeout(r, 0));
    expect(gutters(el)).toHaveLength(2);
    el.querySelector('section')!.remove();
    await new Promise(r => setTimeout(r, 0));
    expect(gutters(el)).toHaveLength(1);
    expect(el.getSizes()).toHaveLength(2);
  });

  it('moves with arrow keys (2%, Shift 10%), emits resize, and updates aria-valuenow', () => {
    const el = mount('<div size="50">A</div><div size="50">B</div>');
    const resized = vi.fn();
    el.addEventListener('resize', resized);
    const g = gutters(el)[0];
    key(g, 'ArrowRight');
    expect(el.getSizes()).toEqual([52, 48]);
    key(g, 'ArrowRight', { shiftKey: true });
    expect(el.getSizes()).toEqual([62, 38]);
    key(g, 'ArrowLeft');
    expect(el.getSizes()).toEqual([60, 40]);
    expect(g.getAttribute('aria-valuenow')).toBe('60');
    expect((resized.mock.calls[2][0] as CustomEvent).detail.sizes).toEqual([60, 40]);
    // A key it doesn't use is left alone
    const other = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
    g.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
  });

  it('uses the vertical arrows when vertical', () => {
    const el = mount('<div size="50">A</div><div size="50">B</div>', 'orientation="vertical"');
    const g = gutters(el)[0];
    expect(g.getAttribute('aria-orientation')).toBe('horizontal');
    key(g, 'ArrowRight');
    expect(el.getSizes()).toEqual([50, 50]); // horizontal arrows do nothing in a vertical stack
    key(g, 'ArrowDown');
    expect(el.getSizes()).toEqual([52, 48]);
    key(g, 'ArrowUp', { shiftKey: true });
    expect(el.getSizes()).toEqual([42, 58]);
  });

  it('respects each pane\'s minimum size, with Home and End reaching the limits', () => {
    // 1000px of pane space: min 200px = 20%, min 100px = 10%
    const el = mount('<div size="50" min-size="200">A</div><div size="50" min-size="100">B</div>');
    const g = gutters(el)[0];
    key(g, 'Home');
    expect(el.getSizes()).toEqual([20, 80]);
    expect(g.getAttribute('aria-valuemin')).toBe('20');
    key(g, 'ArrowLeft', { shiftKey: true });
    expect(el.getSizes()).toEqual([20, 80]); // already at the minimum
    key(g, 'End');
    expect(el.getSizes()).toEqual([90, 10]);
    expect(g.getAttribute('aria-valuemax')).toBe('90');
  });

  it('Enter collapses the pane before the divider, and brings it back', () => {
    const el = mount('<div size="40" min-size="100">A</div><div size="60">B</div>');
    const g = gutters(el)[0];
    key(g, 'Enter');
    expect(el.getSizes()).toEqual([10, 90]);
    key(g, 'Enter');
    expect(el.getSizes()).toEqual([40, 60]);
  });

  it('Enter restores a pane that is collapsed to its minimum even if it got there another way', () => {
    const el = mount('<div size="40" min-size="100">A</div><div size="60">B</div>');
    const g = gutters(el)[0];
    key(g, 'Home'); // collapsed by Home: nothing was remembered
    expect(el.getSizes()).toEqual([10, 90]);
    key(g, 'Enter');
    expect(el.getSizes()).toEqual([40, 60]); // the size the markup asked for
  });

  it('drags with the pointer: the divider follows, within the limits', () => {
    const el = mount('<div size="50" min-size="100">A</div><div size="50" min-size="100">B</div>');
    const g = gutters(el)[0];
    g.setPointerCapture = vi.fn();
    const ptr = (type: string, x: number) => g.dispatchEvent(Object.assign(new Event(type, { bubbles: true, cancelable: true }), { clientX: x, clientY: 0, button: 0, pointerId: 1 }));
    const resized = vi.fn();
    el.addEventListener('resize', resized);
    ptr('pointerdown', 500);
    expect(g.hasAttribute('data-dragging')).toBe(true);
    ptr('pointermove', 600); // 100px of 1000
    expect(el.getSizes()).toEqual([60, 40]);
    ptr('pointermove', 5000); // far past the end: stops at B's minimum
    expect(el.getSizes()).toEqual([90, 10]);
    expect(resized).not.toHaveBeenCalled(); // events wait for the end of the drag
    ptr('pointerup', 5000);
    expect(g.hasAttribute('data-dragging')).toBe(false);
    expect(resized).toHaveBeenCalledTimes(1);
  });

  it('ignores a right-click, and double-click restores the starting sizes', () => {
    const el = mount('<div size="50">A</div><div size="50">B</div>');
    const g = gutters(el)[0];
    g.setPointerCapture = vi.fn();
    g.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true, cancelable: true }), { clientX: 0, button: 2, pointerId: 1 }));
    expect(g.hasAttribute('data-dragging')).toBe(false);
    key(g, 'ArrowRight', { shiftKey: true });
    expect(el.getSizes()).toEqual([60, 40]);
    g.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(el.getSizes()).toEqual([50, 50]);
  });

  it('remembers sizes under state-key', () => {
    const first = mount('<div size="50">A</div><div size="50">B</div>', 'state-key="layout"');
    key(gutters(first)[0], 'ArrowRight', { shiftKey: true });
    expect(JSON.parse(localStorage.getItem('nx-splitter:layout')!)).toEqual([60, 40]);
    const second = mount('<div size="50">A</div><div size="50">B</div>', 'state-key="layout"');
    expect(second.getSizes()).toEqual([60, 40]);
    // Saved sizes for a different number of panes are ignored
    const third = mount('<div>A</div><div>B</div><div>C</div>', 'state-key="layout"');
    expect(third.getSizes().length).toBe(3);
  });

  it('setSizes sets relative sizes and refuses a wrong count', () => {
    const el = mount('<div>A</div><div>B</div>');
    el.setSizes([1, 3]);
    expect(el.getSizes()).toEqual([25, 75]);
    el.setSizes([1, 2, 3]);
    expect(el.getSizes()).toEqual([25, 75]);
  });

  it('follows the reading direction: in right-to-left, Left grows the pane before the divider', () => {
    // (jsdom doesn't derive CSS direction from the dir attribute, so set the property)
    const el = mount('<div size="50">A</div><div size="50">B</div>');
    el.style.direction = 'rtl';
    const g = gutters(el)[0];
    key(g, 'ArrowLeft'); // forward in RTL
    expect(el.getSizes()).toEqual([52, 48]);
    key(g, 'ArrowRight');
    expect(el.getSizes()).toEqual([50, 50]);
  });
});
