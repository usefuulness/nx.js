import { describe, it, expect, vi } from 'vitest';
import { ViewModel, createViewModel, sameData } from '@/core/viewmodel';
import { Store } from '@/data/store';

const tick = () => new Promise<void>(r => queueMicrotask(r));

describe('sameData', () => {
  it('compares inside objects, arrays and dates', () => {
    expect(sameData({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(sameData({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameData([1, 2], [1, 2, 3])).toBe(false);
    expect(sameData([], {})).toBe(false);
    expect(sameData(new Date(5), new Date(5))).toBe(true);
    expect(sameData(new Date(5), new Date(6))).toBe(false);
    expect(sameData(NaN, NaN)).toBe(true);
    expect(sameData(null, undefined)).toBe(false);
    const s = new Store();
    expect(sameData(s, s)).toBe(true);
    expect(sameData(new Store(), new Store())).toBe(false);
  });
});

describe('ViewModel: data', () => {
  it('gets and sets by path, creating what is missing', () => {
    const vm = createViewModel({ data: { user: { name: 'Ada' }, n: 1 } });
    expect(vm.get('user.name')).toBe('Ada');
    expect(vm.get('user.missing.deep')).toBeUndefined();
    expect(vm.get('nope')).toBeUndefined();
    vm.set('user.address.city', 'Oslo');
    expect(vm.get('user.address.city')).toBe('Oslo');
    vm.set({ n: 2, 'user.name': 'Bob' });
    expect([vm.get('n'), vm.get('user.name')]).toEqual([2, 'Bob']);
    expect(vm.has('user.anything')).toBe(true);
    expect(vm.has('other')).toBe(false);
  });

  it('does not touch the object it was given, and survives odd paths', () => {
    const data = { a: { b: 1 } };
    const vm = new ViewModel({ data });
    vm.set('a.b', 2);
    expect(data.a.b).toBe(1);
    expect(() => vm.set('', 1)).not.toThrow();
    expect(vm.get('')).toBeUndefined();
    vm.set('a.b.c', 5); // a.b was a number: it becomes an object
    expect(vm.get('a.b.c')).toBe(5);
  });
});

describe('ViewModel: binding', () => {
  it('calls once there is a value, then on every change, batched', async () => {
    const vm = createViewModel({ data: { n: 1 } });
    const seen: any[] = [];
    vm.bind('n', (v, old) => seen.push([v, old]));
    expect(seen).toEqual([]); // not before the next microtask
    await tick();
    expect(seen).toEqual([[1, undefined]]);
    vm.set('n', 2); vm.set('n', 3); vm.set('n', 4);
    await tick();
    expect(seen).toEqual([[1, undefined], [4, 1]]);
  });

  it('does not call for a set to the same value, and can be immediate', async () => {
    const vm = createViewModel({ data: { n: 1 } });
    const fn = vi.fn();
    vm.bind('n', fn, { immediate: true });
    expect(fn).toHaveBeenCalledTimes(1);
    vm.set('n', 1);
    await tick();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits while a value is undefined', async () => {
    const vm = createViewModel();
    const fn = vi.fn();
    vm.bind('later', fn);
    await tick();
    expect(fn).not.toHaveBeenCalled();
    vm.set('later', 'now');
    await tick();
    expect(fn).toHaveBeenCalledWith('now', undefined);
  });

  it('a binding on a path hears about changes inside it and above it', async () => {
    const vm = createViewModel({ data: { user: { name: 'Ada', age: 30 } } });
    const whole = vi.fn(), name = vi.fn();
    vm.bind('user', whole); vm.bind('user.name', name);
    await tick();
    vm.set('user.age', 31);
    await tick();
    expect(whole).toHaveBeenCalledTimes(2);
    expect(name).toHaveBeenCalledTimes(1);
    vm.set('user', { name: 'Bob', age: 31 });
    await tick();
    expect(name).toHaveBeenLastCalledWith('Bob', 'Ada');
  });

  it('a path is not confused with another that starts the same way', async () => {
    const vm = createViewModel({ data: { user: 1, users: 1 } });
    const fn = vi.fn();
    vm.bind('user', fn);
    await tick();
    vm.set('users', 2);
    await tick();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('templates, negation, raw braces and lists', async () => {
    const vm = createViewModel({ data: { first: 'Ada', last: 'Lovelace', on: true, count: 3 } });
    const out: any = {};
    vm.bind('Hello {first} {last}!', v => (out.t = v));
    vm.bind('!on', v => (out.neg = v));
    vm.bind('!{on}', v => (out.neg2 = v));
    vm.bind('{count}', v => (out.raw = v));
    vm.bind(['first', '!on'], v => (out.list = v));
    await tick();
    expect(out).toEqual({ t: 'Hello Ada Lovelace!', neg: false, neg2: false, raw: 3, list: ['Ada', false] });
    vm.set('on', false); vm.set('first', 'Grace');
    await tick();
    expect(out.t).toBe('Hello Grace Lovelace!');
    expect(out.neg).toBe(true);
  });

  it('a template never shows "undefined", and null shows as nothing', async () => {
    const vm = createViewModel({ data: { a: 'x', b: null } });
    const seen: string[] = [];
    vm.bind('{a}-{b}-{c}', v => seen.push(v));
    await tick();
    expect(seen).toEqual([]);
    vm.set('c', 'z');
    await tick();
    expect(seen).toEqual(['x--z']);
  });

  it('stops when destroyed, and one failing callback does not stop the others', async () => {
    const vm = createViewModel({ data: { n: 1 } });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const good = vi.fn();
    vm.bind('n', () => { throw new Error('boom'); });
    const b = vm.bind('n', good);
    await tick();
    expect(good).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    b.destroy();
    vm.set('n', 2);
    await tick();
    expect(good).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('a callback that sets data is handled, and flush() runs things now', async () => {
    const vm = createViewModel({ data: { a: 1, b: 0 } });
    vm.bind('a', v => vm.set('b', v * 2));
    const seen: number[] = [];
    vm.bind('b', v => seen.push(v));
    vm.flush();
    await tick(); await tick();
    expect(seen.at(-1)).toBe(2);
    vm.set('a', 5);
    await tick(); await tick();
    expect(seen.at(-1)).toBe(10);
  });
});

describe('ViewModel: formulas', () => {
  it('computes from data, follows changes, and binds like data', async () => {
    const vm = createViewModel({
      data: { first: 'Ada', last: 'Lovelace' },
      formulas: { full: get => `${get('first')} ${get('last')}` }
    });
    expect(vm.get('full')).toBe('Ada Lovelace');
    const seen: string[] = [];
    vm.bind('full', v => seen.push(v));
    await tick();
    vm.set('last', 'Byron');
    await tick();
    expect(seen).toEqual(['Ada Lovelace', 'Ada Byron']);
    expect(vm.get('full')).toBe('Ada Byron');
  });

  it('formulas can depend on formulas, and only call when the result changes', async () => {
    const vm = createViewModel({
      data: { n: 3 },
      formulas: { double: get => get('n') * 2, big: get => get('double') > 10 }
    });
    const big = vi.fn();
    vm.bind('big', big);
    await tick();
    expect(big).toHaveBeenLastCalledWith(false, undefined);
    vm.set('n', 4); // double changes, big does not
    await tick();
    expect(big).toHaveBeenCalledTimes(1);
    vm.set('n', 6);
    await tick();
    expect(big).toHaveBeenLastCalledWith(true, false);
  });

  it('a formula that depends on a path inside another object follows it', async () => {
    const vm = createViewModel({ data: { user: { age: 17 } }, formulas: { adult: get => get('user.age') >= 18 } });
    const fn = vi.fn();
    vm.bind('adult', fn);
    await tick();
    vm.set('user.age', 18);
    await tick();
    expect(fn).toHaveBeenLastCalledWith(true, false);
  });

  it('is read only unless it says how to be set', () => {
    const vm = createViewModel({
      data: { celsius: 0 },
      formulas: { fahrenheit: { get: get => get('celsius') * 9 / 5 + 32, set: (v, set) => set('celsius', (v - 32) * 5 / 9) }, ro: () => 1 }
    });
    vm.set('ro', 99);
    expect(vm.get('ro')).toBe(1);
    vm.set('fahrenheit', 212);
    expect(vm.get('celsius')).toBe(100);
    expect(vm.get('fahrenheit')).toBe(212);
  });

  it('a formula that throws gives undefined and says so', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const vm = createViewModel({ formulas: { bad: () => { throw new Error('x'); } } });
    expect(vm.get('bad')).toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('formulas that feed each other forever are stopped', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const vm = createViewModel({ data: { seed: 0 }, formulas: { a: get => (get('b') ?? 0) + get('seed') + 1, b: get => (get('a') ?? 0) + 1 } });
    vm.bind('a', () => {});
    await tick(); await tick();
    expect(() => vm.set('seed', 1)).not.toThrow();
    await tick(); await tick();
    error.mockRestore();
  });
});

describe('ViewModel: parent and children, stores', () => {
  it('a child sees the parent\'s data and formulas, and follows its changes', async () => {
    const parent = createViewModel({ data: { name: 'Ada' }, formulas: { shout: get => get('name').toUpperCase() } });
    const child = parent.createChild({ data: { own: 1 } });
    expect(child.get('name')).toBe('Ada');
    expect(child.get('shout')).toBe('ADA');
    expect(child.get('own')).toBe(1);
    expect(parent.get('own')).toBeUndefined();
    const fn = vi.fn();
    child.bind('shout', fn);
    await tick();
    parent.set('name', 'Bob');
    await tick();
    expect(fn).toHaveBeenLastCalledWith('BOB', 'ADA');
  });

  it('setting data that belongs to the parent changes the parent; its own data shadows', async () => {
    const parent = createViewModel({ data: { name: 'Ada', mode: 'p' } });
    const child = parent.createChild({ data: { mode: 'c' } });
    child.set('name', 'Bob');
    expect(parent.get('name')).toBe('Bob');
    child.set('mode', 'c2');
    expect(parent.get('mode')).toBe('p');
    const fn = vi.fn();
    child.bind('mode', fn);
    await tick();
    parent.set('mode', 'p2'); // shadowed: the child does not care
    await tick();
    expect(fn).toHaveBeenCalledTimes(1);
    child.set('brandnew', 1); // nobody has it: the child keeps it
    expect(parent.get('brandnew')).toBeUndefined();
  });

  it('destroying a parent destroys its children; a destroyed model is quiet', async () => {
    const parent = createViewModel({ data: { n: 1 } });
    const child = parent.createChild();
    const fn = vi.fn();
    child.bind('n', fn);
    parent.destroy();
    parent.set('n', 2);
    await tick();
    expect(fn).not.toHaveBeenCalled();
  });

  it('makes stores on demand, once, and children find them', () => {
    const vm = createViewModel({ stores: { users: { data: [{ id: 1 }] } } });
    const a = vm.getStore('users')!;
    expect(a).toBeInstanceOf(Store);
    expect(vm.getStore('users')).toBe(a);
    expect(vm.get('users')).toBe(a);
    expect(vm.createChild().getStore('users')).toBe(a);
    expect(vm.getStore('nope')).toBeUndefined();
    const given = new Store({ data: [] });
    expect(createViewModel({ stores: { s: given } }).getStore('s')).toBe(given);
  });
});

describe('ViewModel: elements', () => {
  const html = (s: string) => { const d = document.createElement('div'); d.innerHTML = s; document.body.append(d); return d; };

  it('binds text as text, never markup', async () => {
    const vm = createViewModel({ data: { name: '<img src=x onerror=alert(1)>' } });
    const el = html('<p></p>').firstElementChild!;
    vm.bindElement(el, { text: 'Hi {name}' });
    await tick();
    expect(el.textContent).toBe('Hi <img src=x onerror=alert(1)>');
    expect(el.querySelector('img')).toBeNull();
  });

  it('binds hidden, disabled, classes and attributes', async () => {
    const vm = createViewModel({ data: { open: false, user: 'a' } });
    const el = html('<button></button>').firstElementChild!;
    vm.bindElement(el, { hidden: '!open', disabled: 'open', 'class:active': 'open', 'attr:data-user': 'user', 'attr:aria-expanded': 'open', title: 'user' });
    await tick();
    expect(el.hasAttribute('hidden')).toBe(true);
    expect(el.hasAttribute('disabled')).toBe(false);
    expect(el.classList.contains('active')).toBe(false);
    expect(el.getAttribute('data-user')).toBe('a');
    expect(el.hasAttribute('aria-expanded')).toBe(false); // false removes it
    expect((el as HTMLElement).title).toBe('a');
    vm.set('open', true);
    await tick();
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.classList.contains('active')).toBe(true);
    expect(el.getAttribute('aria-expanded')).toBe('');
  });

  it('value is two-way on inputs, checked on checkboxes; destroying stops both', async () => {
    const vm = createViewModel({ data: { name: 'Ada', agree: false } });
    const root = html('<input id="i"><input id="c" type="checkbox">');
    const input = root.querySelector('#i') as HTMLInputElement;
    const box = root.querySelector('#c') as HTMLInputElement;
    const b1 = vm.bindElement(input, { value: 'name' });
    vm.bindElement(box, { checked: 'agree' });
    await tick();
    expect(input.value).toBe('Ada');
    input.value = 'Bob';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(vm.get('name')).toBe('Bob');
    vm.set('name', 'Cleo');
    await tick();
    expect(input.value).toBe('Cleo');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(vm.get('agree')).toBe(true);
    b1.destroy();
    input.value = 'ignored';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(vm.get('name')).toBe('Cleo');
  });

  it('negated and template expressions are one-way (they cannot be written back)', async () => {
    const vm = createViewModel({ data: { on: true } });
    const input = html('<input type="checkbox">').firstElementChild as HTMLInputElement;
    vm.bindElement(input, { checked: '!on' });
    await tick();
    expect(input.checked).toBe(false);
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(vm.get('on')).toBe(true);
  });

  it('bindAll reads bind-… attributes, including on the root itself', async () => {
    const vm = createViewModel({ data: { name: 'Ada', ready: true, link: '/a' } });
    const root = html('<section bind-class-ready="ready"><input bind-value="name"><span bind-text="Hi {name}"></span><a bind-attr-href="link">x</a><button bind-disabled="!ready"></button></section>').firstElementChild!;
    const b = vm.bindAll(root);
    await tick();
    expect(root.classList.contains('ready')).toBe(true);
    expect((root.querySelector('input') as HTMLInputElement).value).toBe('Ada');
    expect(root.querySelector('span')!.textContent).toBe('Hi Ada');
    expect(root.querySelector('a')!.getAttribute('href')).toBe('/a');
    expect(root.querySelector('button')!.hasAttribute('disabled')).toBe(false);
    vm.set('ready', false);
    await tick();
    expect(root.querySelector('button')!.hasAttribute('disabled')).toBe(true);
    b.destroy();
    vm.set('name', 'Bob');
    await tick();
    expect(root.querySelector('span')!.textContent).toBe('Hi Ada');
  });
});
