import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NX, registerCodeEngine, registerCodeEngineLoader, type NXCodeEditor, type CodeEngine } from '@/index';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };

describe('<nx-code-editor>', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  const mount = async (config: Record<string, any> = {}) => {
    const el = NX.create<NXCodeEditor>({ xtype: 'code-editor', label: 'Script', ...config });
    document.body.append(el);
    await frames();
    return el;
  };
  const area = (el: NXCodeEditor) => el.shadowRoot!.querySelector('textarea.code') as HTMLTextAreaElement;
  const type = (el: NXCodeEditor, text: string) => { area(el).value = text; area(el).dispatchEvent(new Event('input', { bubbles: true })); };
  const key = (el: NXCodeEditor, k: string, init: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    area(el).dispatchEvent(e);
    return e;
  };

  it('is a labelled field with a text area, line numbers, a status bar and the leave hint', async () => {
    const el = await mount({ value: 'a\nb\nc', language: 'groovy' });
    expect(el.shadowRoot!.querySelector('label')!.textContent).toContain('Script');
    expect(area(el).value).toBe('a\nb\nc');
    expect(el.shadowRoot!.querySelector('.gutter')!.textContent).toBe('1\n2\n3');
    expect(el.shadowRoot!.querySelector('.lang')!.textContent).toBe('groovy');
    expect(el.shadowRoot!.querySelector('.pos')!.textContent).toBe('Line 1, column 1');
    expect(area(el).getAttribute('aria-describedby')).toContain('-hint');
    expect(el.shadowRoot!.querySelector('.hint')!.textContent).toBe('Press Escape, then Tab, to leave the editor');
  });

  it('typing updates the value, the line numbers, the form value and says change', async () => {
    const el = await mount();
    const seen: string[] = [];
    el.addEventListener('change', e => seen.push((e as CustomEvent).detail.value));
    type(el, 'one\ntwo');
    expect(el.value).toBe('one\ntwo');
    expect(el.shadowRoot!.querySelector('.gutter')!.textContent).toBe('1\n2');
    expect(seen).toEqual(['one\ntwo']);
  });

  it('unsaved changes: typing is dirty, saving cleans, setting the value is a fresh start, revert goes back', async () => {
    const el = await mount({ value: 'saved' });
    const flips: boolean[] = [];
    el.addEventListener('dirty-change', e => flips.push((e as CustomEvent).detail.dirty));
    expect(el.isDirty()).toBe(false);
    type(el, 'saved!');
    expect(el.isDirty()).toBe(true);
    expect(el.hasAttribute('dirty')).toBe(true);
    expect(el.shadowRoot!.querySelector('.dirty')!.textContent).toBe('Unsaved changes');
    el.markClean();
    expect(el.isDirty()).toBe(false);
    expect(el.shadowRoot!.querySelector('.dirty')!.textContent).toBe('');
    type(el, 'again');
    el.revert();
    expect(el.value).toBe('saved!');
    expect(el.isDirty()).toBe(false);
    el.value = 'loaded from the server';
    expect(el.isDirty()).toBe(false);
    expect(flips).toEqual([true, false, true, false]);
  });

  it('Tab indents; Shift+Tab outdents the lines in the selection; Escape then Tab leaves', async () => {
    const el = await mount({ value: 'a\nb', tabSize: 2 });
    const t = area(el);
    t.focus();
    t.setSelectionRange(1, 1);
    expect(key(el, 'Tab').defaultPrevented).toBe(true);
    expect(el.value).toBe('a  \nb');
    t.value = 'a\nb';
    t.setSelectionRange(0, 3); // both lines
    key(el, 'Tab');
    expect(el.value).toBe('  a\n  b');
    t.setSelectionRange(0, t.value.length);
    key(el, 'Tab', { shiftKey: true });
    expect(el.value).toBe('a\nb');
    // Escape, then Tab: the key is left alone so focus moves on
    key(el, 'Escape');
    expect(key(el, 'Tab').defaultPrevented).toBe(false);
    expect(key(el, 'Tab').defaultPrevented).toBe(true);
  });

  it('Enter keeps the indentation, adds a level after an opening bracket and splits a pair', async () => {
    const el = await mount({ value: '  if (x) {' });
    const t = area(el);
    t.setSelectionRange(t.value.length, t.value.length);
    key(el, 'Enter');
    expect(el.value).toBe('  if (x) {\n    ');
    t.value = '{}';
    t.setSelectionRange(1, 1);
    key(el, 'Enter');
    expect(el.value).toBe('{\n  \n}');
    expect(t.selectionStart).toBe(4);
  });

  it('reports the cursor position', async () => {
    const el = await mount({ value: 'ab\ncde' });
    const seen: any[] = [];
    el.addEventListener('cursor', e => seen.push((e as CustomEvent).detail));
    area(el).setSelectionRange(5, 5);
    area(el).dispatchEvent(new Event('click'));
    expect(seen.at(-1)).toEqual({ line: 2, column: 3 });
    expect(el.shadowRoot!.querySelector('.pos')!.textContent).toBe('Line 2, column 3');
  });

  it('checks JSON as it is typed, and says where', async () => {
    const el = await mount({ language: 'json', value: '{"a": 1}' });
    expect(el.validationMessage()).toBe('');
    type(el, '{\n  "a": 1,\n  "b": }');
    const message = el.validationMessage();
    expect(message).toMatch(/^Not valid JSON: /);
    expect(message).toMatch(/line 3, column 8\)$/);
    expect(el.validate()).toBe(false);
    expect(el.shadowRoot!.querySelector('.nx-field-helper')!.textContent).toBe(message);
    type(el, '{"ok": true}');
    expect(el.validate()).toBe(true);
    const off = await mount({ language: 'json', noJsonCheck: true, value: '{nope' });
    expect(off.validationMessage()).toBe('');
  });

  it('JSON problems are found the same way for every kind of mistake, and valid JSON of every shape passes', async () => {
    const el = await mount({ language: 'json' });
    const problem = (text: string) => { type(el, text); return el.validationMessage().replace(/^Not valid JSON: /, ''); };
    expect(problem('[1,]')).toMatch(/unexpected "\]".*\(line 1, column 4\)$/);
    expect(problem('{"a": 1 "b": 2}')).toMatch(/"," or "}" was expected \(line 1, column 9\)$/);
    expect(problem('{"a": "oops}')).toMatch(/a string is not closed/);
    expect(problem('{"a": 1} x')).toMatch(/nothing should follow the value \(line 1, column 10\)$/);
    expect(problem('{a: 1}')).toMatch(/a name in quotes was expected \(line 1, column 2\)$/);
    expect(problem('[\n  1,\n  2')).toMatch(/the text ends too soon.*\(line 3, column 4\)$/);
    for (const ok of ['null', '0', '-1.5e+3', '"x\\n\\u00e9"', '[]', '{}', '[1, [2, {"a": [true, false, null]}]]', ' \n {"a" : 1 } \n']) expect(problem(ok), ok).toBe('');
  });

  it('format() pretty-prints valid JSON, and leaves invalid text alone', async () => {
    const el = await mount({ language: 'json', value: '{"a":[1,2],"b":{"c":true}}', tabSize: 2 });
    expect(el.format()).toBe(true);
    expect(el.value).toBe('{\n  "a": [\n    1,\n    2\n  ],\n  "b": {\n    "c": true\n  }\n}');
    type(el, '{bad');
    expect(el.format()).toBe(false);
    expect(el.value).toBe('{bad');
  });

  it('required, read-only and disabled', async () => {
    const el = await mount({ required: true });
    expect(el.validate()).toBe(false);
    type(el, 'x');
    expect(el.validate()).toBe(true);
    const ro = await mount({ readonly: true, value: 'fixed' });
    expect(area(ro).readOnly).toBe(true);
    expect(key(ro, 'Tab').defaultPrevented).toBe(false); // read-only: Tab moves on
    ro.removeAttribute('readonly');
    await frames();
    expect(area(ro).readOnly).toBe(false);
    ro.setAttribute('disabled', '');
    await frames();
    expect(area(ro).disabled).toBe(true);
  });

  it('keeps the same text area (focus, scroll, undo) when attributes change', async () => {
    const el = await mount({ value: 'x', language: 'json' });
    const before = area(el);
    el.setAttribute('language', 'groovy');
    el.setAttribute('label', 'Renamed');
    el.setAttribute('height', '20rem');
    await frames();
    expect(area(el)).toBe(before);
    expect(el.shadowRoot!.querySelector('.lang')!.textContent).toBe('groovy');
    expect(el.shadowRoot!.querySelector('label')!.textContent).toContain('Renamed');
    expect((el.shadowRoot!.querySelector('.editor') as HTMLElement).style.height).toBe('20rem');
  });
});

describe('code engines', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  const fake = () => {
    const log: string[] = [];
    let value = '';
    let opts: any;
    const factory = (host: HTMLElement, options: any): CodeEngine => {
      opts = options;
      value = options.value;
      log.push(`create:${options.language}`);
      const surface = document.createElement('div');
      surface.className = 'fake-engine';
      surface.tabIndex = 0;
      host.append(surface);
      return {
        getValue: () => value,
        setValue: v => { value = v; log.push('setValue'); },
        setLanguage: l => log.push(`language:${l}`),
        setReadOnly: r => log.push(`readonly:${r}`),
        focus: () => surface.focus(),
        resize: () => log.push('resize'),
        dispose: () => { log.push('dispose'); surface.remove(); }
      };
    };
    return { factory, log, typed: (v: string) => { value = v; opts.onChange(v); } };
  };
  const mount = async (config: Record<string, any>) => {
    const el = NX.create<NXCodeEditor>({ xtype: 'code-editor', label: 'Script', ...config });
    document.body.append(el);
    await frames(4);
    return el;
  };

  it('a registered engine takes over the surface, keeps the text, and tells the editor about changes', async () => {
    const e = fake();
    registerCodeEngine('fake', e.factory);
    const el = await mount({ engine: 'fake', value: 'hello', language: 'groovy' });
    expect(el.shadowRoot!.querySelector('.fake-engine')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('textarea.code')).toBeNull();
    expect(e.log).toContain('create:groovy');
    expect(el.value).toBe('hello');
    const seen: string[] = [];
    el.addEventListener('change', ev => seen.push((ev as CustomEvent).detail.value));
    e.typed('hello world');
    expect(el.value).toBe('hello world');
    expect(seen).toEqual(['hello world']);
    expect(el.isDirty()).toBe(true);
    el.setAttribute('readonly', '');
    await frames();
    expect(e.log).toContain('readonly:true');
  });

  it('a loader is called once, only when an editor asks, and is disposed with the editor', async () => {
    const e = fake();
    const loader = vi.fn(async () => ({ default: e.factory }));
    registerCodeEngineLoader('lazy', loader);
    expect(loader).not.toHaveBeenCalled();
    const a = await mount({ engine: 'lazy', value: 'a' });
    const b = await mount({ engine: 'lazy', value: 'b' });
    expect(loader).toHaveBeenCalledTimes(1);
    const ready: string[] = [];
    a.addEventListener('ready', ev => ready.push((ev as CustomEvent).detail.engine));
    a.remove();
    b.remove();
    expect(e.log.filter(l => l === 'dispose')).toHaveLength(2);
  });

  it('the built-in editor shows first and the text carries over to the engine, and an unknown engine says so and leaves the text editable', async () => {
    const el = NX.create<NXCodeEditor>({ xtype: 'code-editor', engine: 'nothing-registered', value: 'keep me' });
    const errors: any[] = [];
    el.addEventListener('engine-error', ev => errors.push((ev as CustomEvent).detail));
    document.body.append(el);
    await frames(4);
    expect(errors[0].engine).toBe('nothing-registered');
    expect(el.shadowRoot!.querySelector('textarea.code')).toBeTruthy();
    expect(el.value).toBe('keep me');
  });

  it('an engine that fails to start falls back to the built-in editor with the text intact', async () => {
    registerCodeEngine('broken', () => { throw new Error('worker blocked'); });
    const el = NX.create<NXCodeEditor>({ xtype: 'code-editor', engine: 'broken', value: 'still here' });
    const errors: any[] = [];
    el.addEventListener('engine-error', ev => errors.push((ev as CustomEvent).detail));
    document.body.append(el);
    await frames(4);
    expect(errors[0].message).toBe('worker blocked');
    expect(el.shadowRoot!.querySelector('textarea.code')).toBeTruthy();
    expect((el.shadowRoot!.querySelector('textarea.code') as HTMLTextAreaElement).value).toBe('still here');
  });

  it('a failed load can be tried again', async () => {
    let calls = 0;
    registerCodeEngineLoader('flaky', async () => { calls++; if (calls === 1) throw new Error('offline'); return fake().factory; });
    const first = await mount({ engine: 'flaky' });
    expect(first.shadowRoot!.querySelector('.fake-engine')).toBeNull();
    const second = await mount({ engine: 'flaky' });
    expect(second.shadowRoot!.querySelector('.fake-engine')).toBeTruthy();
  });
});
