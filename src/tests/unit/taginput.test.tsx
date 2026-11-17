import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NX, type NXTagInput, type NXForm } from '@/index';
import '@/locales/es';

describe('<nx-tag-input>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('lang');
  });
  const mount = (config: Record<string, any> = {}) => {
    const el = NX.create<NXTagInput>({ xtype: 'tag-input', name: 'topics', label: 'Topics', ...config });
    document.body.appendChild(el);
    return el;
  };
  const entry = (el: NXTagInput) => el.shadowRoot!.querySelector('input.entry') as HTMLInputElement;
  const tags = (el: NXTagInput) => Array.from(el.shadowRoot!.querySelectorAll('.tag-text')).map(t => t.textContent);
  const key = (el: NXTagInput, k: string, init: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    entry(el).dispatchEvent(e);
    return e;
  };
  const type = (el: NXTagInput, text: string) => { entry(el).value = text; entry(el).dispatchEvent(new Event('input', { bubbles: true })); };
  const paste = (el: NXTagInput, text: string) => {
    const e = Object.assign(new Event('paste', { bubbles: true, cancelable: true }), { clipboardData: { getData: () => text } });
    entry(el).dispatchEvent(e);
    return e;
  };
  const note = (el: NXTagInput) => el.shadowRoot!.querySelector('.nx-field-helper')!.textContent;

  it('shows its tags as removable chips, from an array or a comma separated string', () => {
    expect(tags(mount({ value: ['css', 'html'] }))).toEqual(['css', 'html']);
    expect(tags(mount({ value: ' css , html,, css ' }))).toEqual(['css', 'html']); // trimmed, empties and repeats dropped
    expect(mount({ value: 'a,b' }).value).toEqual(['a', 'b']);
  });

  it('Enter adds the typed text and clears the box; empty Enter adds nothing', () => {
    const el = mount();
    const changed = vi.fn();
    el.addEventListener('change', changed);
    type(el, '  accessibility ');
    expect(key(el, 'Enter').defaultPrevented).toBe(true);
    expect(tags(el)).toEqual(['accessibility']);
    expect(entry(el).value).toBe('');
    expect((changed.mock.calls[0][0] as CustomEvent).detail.value).toEqual(['accessibility']);
    key(el, 'Enter');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('a separator key ends a tag, and separators are configurable', () => {
    const el = mount();
    type(el, 'css');
    expect(key(el, ',').defaultPrevented).toBe(true);
    expect(tags(el)).toEqual(['css']);
    const semi = mount({ separators: ';' });
    type(semi, 'a');
    key(semi, ';');
    type(semi, 'b');
    key(semi, ',');
    expect(tags(semi)).toEqual(['a']); // "," is no longer a separator here
    expect(entry(semi).value).toBe('b');
  });

  it('Backspace in the empty box removes the last tag; with text it edits as usual', () => {
    const el = mount({ value: 'a,b' });
    type(el, 'x');
    expect(key(el, 'Backspace').defaultPrevented).toBe(false);
    type(el, '');
    key(el, 'Backspace');
    expect(tags(el)).toEqual(['a']);
    expect(el.shadowRoot!.querySelector('.live')!.textContent).toBe('Removed b');
  });

  it('pasted text splits on separators and line breaks; a single word pastes as normal text', () => {
    const el = mount();
    expect(paste(el, 'css, html\njs').defaultPrevented).toBe(true);
    expect(tags(el)).toEqual(['css', 'html', 'js']);
    expect(paste(el, 'single').defaultPrevented).toBe(false);
  });

  it('refuses duplicates (ignoring case), over the max, and invalid tags, saying why and emitting reject', () => {
    const reject = vi.fn();
    const el = mount({ value: 'css', max: 2, validateTag: (t: string) => (t.length > 5 ? 'Too long' : true) });
    el.addEventListener('reject', reject);
    type(el, 'CSS');
    key(el, 'Enter');
    expect(note(el)).toBe('CSS is already added');
    type(el, 'toolong');
    key(el, 'Enter');
    expect(note(el)).toBe('Too long');
    type(el, 'js');
    key(el, 'Enter');
    type(el, 'ts');
    key(el, 'Enter');
    expect(note(el)).toBe('At most 2 tags are allowed');
    expect(tags(el)).toEqual(['css', 'js']);
    expect(reject.mock.calls.map(c => (c[0] as CustomEvent).detail.reason)).toEqual(['duplicate', 'invalid', 'max']);
    // The message goes away with the next edit
    type(el, 'x');
    expect(note(el)).not.toBe('At most 2 tags are allowed');
  });

  it('allowDuplicates lets a tag repeat', () => {
    const el = mount({ allowDuplicates: true });
    paste(el, 'a,a,b');
    expect(tags(el)).toEqual(['a', 'a', 'b']);
  });

  it('adds typed text when it loses focus, unless add-on-blur is off', () => {
    const el = mount();
    type(el, 'pending');
    entry(el).dispatchEvent(new FocusEvent('blur'));
    expect(tags(el)).toEqual(['pending']);
    const off = mount({ addOnBlur: false });
    type(off, 'pending');
    entry(off).dispatchEvent(new FocusEvent('blur'));
    expect(tags(off)).toEqual([]);
    expect(entry(off).value).toBe('pending');
  });

  it('removes a tag from its button, announces it, and keeps focus in the box', () => {
    const el = mount({ value: 'a,b' });
    const remove = el.shadowRoot!.querySelector('.tag-remove') as HTMLButtonElement;
    expect(remove.getAttribute('aria-label')).toBe('Remove a');
    remove.click();
    expect(tags(el)).toEqual(['b']);
    expect(el.shadowRoot!.querySelector('.live')!.textContent).toBe('Removed a');
    expect(el.shadowRoot!.activeElement).toBe(entry(el));
  });

  it('keeps typed text while tags change (the box is not redrawn)', () => {
    const el = mount({ value: 'a' });
    const input = entry(el);
    type(el, 'draft');
    el.addTags('b');
    expect(entry(el)).toBe(input);
    expect(input.value).toBe('draft');
  });

  it('is invalid until it has enough tags (required, min) and supports a validator', () => {
    const req = mount({ required: true });
    expect(req.validate()).toBe(false);
    expect(note(req)).toBe('Add at least one tag');
    req.addTags('a');
    expect(req.validate()).toBe(true);
    const min = mount({ min: 3, value: 'a' });
    expect(min.validationMessage()).toBe('Add at least 3 tags');
    const custom = mount({ value: 'a', validator: (v: string[]) => (v.includes('a') ? 'No "a"' : null) });
    expect(custom.validationMessage()).toBe('No "a"');
  });

  it('posts each tag as its own entry with an nx-form, and resets', () => {
    const form = NX.create<NXForm>({ xtype: 'form', items: [{ xtype: 'tag-input', name: 'topics', value: 'css,html' }] });
    document.body.appendChild(form);
    expect(form.formData().getAll('topics')).toEqual(['css', 'html']);
    expect(form.getValues().topics).toEqual(['css', 'html']);
    const field = form.getField<NXTagInput>('topics')!;
    field.reset();
    expect(field.value).toEqual([]);
    expect(form.formData().getAll('topics')).toEqual([]);
  });

  it('offers suggestions through a datalist', () => {
    const el = mount({ suggestions: 'css, html ,js' });
    const list = el.shadowRoot!.querySelector('datalist')!;
    expect(entry(el).getAttribute('list')).toBe(list.id);
    expect(Array.from(list.querySelectorAll('option')).map(o => o.value)).toEqual(['css', 'html', 'js']);
    expect(mount().shadowRoot!.querySelector('datalist')).toBeNull();
  });

  it('can be disabled', () => {
    const el = mount({ value: 'a', disabled: true });
    expect(entry(el).disabled).toBe(true);
    expect((el.shadowRoot!.querySelector('.tag-remove') as HTMLButtonElement).disabled).toBe(true);
    expect(el.addTags('b')).toBe(false);
    expect(tags(el)).toEqual(['a']);
  });

  it('speaks the page language', () => {
    document.documentElement.lang = 'es';
    const el = mount();
    expect(entry(el).placeholder).toBe('Añadir etiqueta…');
    el.addTags('uno');
    expect(el.shadowRoot!.querySelector('.live')!.textContent).toBe('Añadida uno');
  });
});
