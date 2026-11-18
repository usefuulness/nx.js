import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateProvider } from '@/core/state';
import { debounce, throttle, startTask, stopAllTasks, Format } from '@/core/util';
import { Controller, createController } from '@/core/controller';
import { createViewModel } from '@/core/viewmodel';
import '@/locales/es';

describe('StateProvider', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it('saves JSON values and reads them back, with a fallback', () => {
    const s = new StateProvider();
    expect(s.get('a', 5)).toBe(5);
    expect(s.set('a', { x: [1, 2] })).toBe(true);
    expect(s.get('a')).toEqual({ x: [1, 2] });
    expect(localStorage.getItem('nx-state:a')).toBe('{"x":[1,2]}');
    s.set('a', undefined);
    expect(s.get('a', 'gone')).toBe('gone');
  });

  it('can use session storage and another prefix', () => {
    const s = new StateProvider({ storage: 'session', prefix: 'p:' });
    s.set('k', 1);
    expect(sessionStorage.getItem('p:k')).toBe('1');
    expect(localStorage.length).toBe(0);
  });

  it('ignores something else that wrote there', () => {
    localStorage.setItem('nx-state:bad', '{nope');
    expect(new StateProvider().get('bad', 'ok')).toBe('ok');
  });

  it('keeps working in memory when storage throws', () => {
    const s = new StateProvider();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(s.set('a', 1)).toBe(false);
    expect(s.get('a')).toBe(1);
    set.mockRestore();
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(s.get('a')).toBe(1); // from memory
    expect(s.get('zzz', 'd')).toBe('d');
    get.mockRestore();
  });

  it('notifies listeners of changes and removals, and clears only its own', () => {
    const s = new StateProvider();
    const seen: unknown[] = [];
    const off = s.on('k', v => seen.push(v));
    s.set('k', 1); s.set('k', 2); s.remove('k');
    off();
    s.set('k', 3);
    expect(seen).toEqual([1, 2, undefined]);
    localStorage.setItem('other', 'keep');
    s.set('a', 1); s.set('b', 2);
    s.clear();
    expect(s.get('a')).toBeUndefined();
    expect(localStorage.getItem('other')).toBe('keep');
    expect(localStorage.length).toBe(1);
  });

  it('a listener that throws does not stop the others or the save', () => {
    const s = new StateProvider();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok = vi.fn();
    s.on('k', () => { throw new Error('x'); }); s.on('k', ok);
    s.set('k', 1);
    expect(ok).toHaveBeenCalled();
    expect(s.get('k')).toBe(1);
    error.mockRestore();
  });
});

describe('debounce and throttle', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('debounce calls once after quiet, with the last arguments; cancel and flush', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1); vi.advanceTimersByTime(50); d(2); vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    expect(d.pending()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(2);
    d(3); d.cancel(); vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
    d(4); d.flush();
    expect(fn).toHaveBeenLastCalledWith(4);
    d.flush(); // nothing waiting
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throttle runs the first call at once and the last one at the end of the window', () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t(1); t(2); t(3);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(1);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
    vi.advanceTimersByTime(500);
    t(4);
    expect(fn).toHaveBeenLastCalledWith(4);
    t(5); t.cancel(); vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('startTask', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { stopAllTasks(); vi.useRealTimers(); });

  it('runs on an interval with a count, stops at the repeat limit or on false', async () => {
    const run = vi.fn();
    const t = startTask({ run, interval: 10, repeat: 3 });
    await vi.advanceTimersByTimeAsync(100);
    expect(run.mock.calls.map(c => c[0])).toEqual([1, 2, 3]);
    expect(t.running).toBe(false);
    let n = 0;
    startTask({ run: () => (++n < 2 ? true : false), interval: 10 });
    await vi.advanceTimersByTimeAsync(100);
    expect(n).toBe(2);
  });

  it('never overlaps a slow run, survives errors, and can be stopped and restarted', async () => {
    let active = 0, max = 0;
    const slow = startTask({ run: async () => { active++; max = Math.max(max, active); await new Promise(r => setTimeout(r, 35)); active--; }, interval: 10 });
    await vi.advanceTimersByTimeAsync(200);
    slow.stop();
    expect(max).toBe(1);
    const errors: unknown[] = [];
    const bad = startTask({ run: () => { throw new Error('x'); }, interval: 10, onError: e => errors.push(e) });
    await vi.advanceTimersByTimeAsync(55);
    expect(errors.length).toBeGreaterThan(2);
    expect(bad.running).toBe(true);
    bad.stop();
    const before = errors.length;
    await vi.advanceTimersByTimeAsync(100);
    expect(errors.length).toBe(before);
    bad.start();
    await vi.advanceTimersByTimeAsync(25);
    expect(errors.length).toBeGreaterThan(before);
  });

  it('stopAllTasks stops them all', async () => {
    const a = startTask({ run: () => {}, interval: 10 }), b = startTask({ run: () => {}, interval: 10 });
    stopAllTasks();
    expect([a.running, b.running]).toEqual([false, false]);
  });
});

describe('Format', () => {
  it('numbers, currency, percent', () => {
    expect(Format.number(1234.5)).toBe('1,234.5');
    expect(Format.number(1234.5, { decimals: 2 })).toBe('1,234.50');
    expect(Format.number('x')).toBe('');
    expect(Format.number(null)).toBe('');
    expect(Format.number(1234.5, { locale: 'de' })).toBe('1.234,5');
    expect(Format.currency(1234.5)).toBe('$1,234.50');
    expect(Format.currency(5, 'EUR', 'de')).toMatch(/5,00\s?€/);
    expect(Format.currency('')).toBe('');
    expect(Format.percent(0.256, 1)).toBe('25.6%');
    expect(Format.percent(undefined)).toBe('');
  });

  it('follows the page\'s language when none is given', () => {
    document.documentElement.setAttribute('lang', 'de');
    expect(Format.number(1234.5)).toBe('1.234,5');
    document.documentElement.removeAttribute('lang');
  });

  it('file sizes, durations', () => {
    expect(Format.fileSize(0)).toBe('0 B');
    expect(Format.fileSize(1536)).toBe('1.5 KB');
    expect(Format.fileSize(5 * 1024 ** 3)).toBe('5 GB');
    expect(Format.fileSize(-1)).toBe('');
    expect(Format.duration(500)).toBe('500ms');
    expect(Format.duration(3725000)).toBe('1h 2m 5s');
    expect(Format.duration(60000)).toBe('1m');
    expect(Format.duration(90061000)).toBe('1d 1h 1m 1s');
    expect(Format.duration('x')).toBe('');
  });

  it('dates and relative times', () => {
    expect(Format.date('2026-03-04T12:00:00Z', 'medium', { locale: 'en' })).toMatch(/Mar 4, 2026/);
    expect(Format.date('2026-03-04T12:00:00Z', 'short', { time: true, locale: 'en' })).toMatch(/3\/4\/26.*(\d{1,2}):\d{2}/);
    expect(Format.date('nonsense')).toBe('');
    expect(Format.date(null)).toBe('');
    const now = Date.UTC(2026, 2, 4, 12);
    expect(Format.relativeTime(now - 3 * 60000, now, 'en')).toBe('3 minutes ago');
    expect(Format.relativeTime(now + 2 * 86400000, now, 'en')).toBe('in 2 days');
    expect(Format.relativeTime(now - 1000, now, 'en')).toBe('1 second ago');
    expect(Format.relativeTime(now, now, 'en')).toBe('now');
    expect(Format.relativeTime(now - 86400000, now, 'es')).toBe('ayer');
    expect(Format.relativeTime('x')).toBe('');
  });

  it('text helpers', () => {
    expect(Format.ellipsis('abcdefghij', 5)).toBe('abcd…');
    expect(Format.ellipsis('abc', 5)).toBe('abc');
    expect(Format.ellipsis('😀😀😀😀', 3)).toBe('😀😀…');
    expect(Format.ellipsis(null, 3)).toBe('');
    expect(Format.capitalize('ada')).toBe('Ada');
    expect(Format.capitalize('')).toBe('');
    expect(Format.plural(1, { one: 'item', other: 'items' }, 'en')).toBe('item');
    expect(Format.plural(2, { one: 'item', other: 'items' }, 'en')).toBe('items');
    expect(Format.plural(0, { one: 'item', other: 'items' }, 'en')).toBe('items');
  });

  it('encodes and decodes HTML, and decoding does not undo more than encoding did', () => {
    const raw = `<img src="x" onerror='a&b'>`;
    const enc = Format.htmlEncode(raw);
    expect(enc).toBe('&lt;img src=&quot;x&quot; onerror=&#39;a&amp;b&#39;&gt;');
    expect(Format.htmlDecode(enc)).toBe(raw);
    expect(Format.htmlDecode('&amp;lt;')).toBe('&lt;'); // one level only
    expect(Format.htmlDecode('&nbsp;')).toBe('&nbsp;');
    expect(Format.htmlEncode(null)).toBe('');
  });
});

describe('Controller', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('div');
    root.innerHTML = '<button class="save" reference="saveBtn">Save</button><button class="cancel">Cancel</button><input reference="name" bind-value="name"><span><b class="deep">x</b></span>';
    document.body.append(root);
  });
  const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

  it('handles events by selector, and for elements added later', () => {
    const save = vi.fn(), any = vi.fn();
    const c = new Controller({ root, control: { 'button.save': { click: save }, button: { click: any } } });
    click(root.querySelector('.save')!);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toBe(root.querySelector('.save'));
    expect(save.mock.calls[0][2]).toBe(c);
    expect(any).toHaveBeenCalledTimes(1);
    const late = document.createElement('button'); late.className = 'save'; root.append(late);
    click(late);
    expect(save).toHaveBeenCalledTimes(2);
    click(root.querySelector('.cancel')!);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('finds the matching ancestor of the element that was clicked', () => {
    const fn = vi.fn();
    createController({ root, control: { span: { click: fn } } });
    click(root.querySelector('.deep')!);
    expect(fn.mock.calls[0][1].tagName).toBe('SPAN');
  });

  it('runs every handler in a list, and one failing does not stop the others', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = vi.fn(() => { throw new Error('boom'); }), b = vi.fn();
    createController({ root, control: { '.save': { click: [a, b] } } });
    click(root.querySelector('.save')!);
    expect(b).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('ignores a selector the browser rejects, and events from outside the root', () => {
    const fn = vi.fn();
    createController({ root, control: { '!!!': { click: vi.fn() }, '.save': { click: fn } } });
    click(root.querySelector('.save')!);
    expect(fn).toHaveBeenCalledTimes(1);
    const outside = document.createElement('button'); outside.className = 'save'; document.body.append(outside);
    click(outside);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('sees through shadow roots: an event from inside a component finds its host', () => {
    const host = document.createElement('x-host');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button id="inner">in</button>';
    root.append(host);
    const fn = vi.fn();
    createController({ root, control: { 'x-host': { click: fn } } });
    click(shadow.querySelector('#inner')!);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][1]).toBe(host);
  });

  it('catches events that do not bubble', () => {
    const fn = vi.fn();
    createController({ root, control: { input: { focus: fn } } });
    root.querySelector('input')!.dispatchEvent(new FocusEvent('focus'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('looks elements up by reference, and by selector', () => {
    const c = new Controller({ root });
    expect(c.lookup('saveBtn')!.textContent).toBe('Save');
    expect(c.lookup('nope')).toBeNull();
    expect(c.query('button').length).toBe(2);
    root.setAttribute('reference', 'me');
    expect(c.lookup('me')).toBe(root);
  });

  it('owns a view model from a config, binds the markup, and cleans up on destroy', async () => {
    const c = new Controller({ root, viewModel: { data: { name: 'Ada' } } });
    await Promise.resolve();
    expect((root.querySelector('input') as HTMLInputElement).value).toBe('Ada');
    c.destroy();
    c.viewModel!.set('name', 'Bob');
    await Promise.resolve();
    expect((root.querySelector('input') as HTMLInputElement).value).toBe('Ada');
  });

  it('shares a view model it was given without destroying it, and can skip binding', async () => {
    const vm = createViewModel({ data: { name: 'Ada' } });
    const c = new Controller({ root, viewModel: vm, bind: false });
    await Promise.resolve();
    expect((root.querySelector('input') as HTMLInputElement).value).toBe('');
    c.destroy();
    const fn = vi.fn();
    vm.bind('name', fn);
    await Promise.resolve();
    expect(fn).toHaveBeenCalled();
  });

  it('stops listening when destroyed', () => {
    const fn = vi.fn();
    const c = new Controller({ root, control: { '.save': { click: fn } } });
    c.destroy();
    click(root.querySelector('.save')!);
    expect(fn).not.toHaveBeenCalled();
  });
});
