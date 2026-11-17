import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NX, acceptsFile, parseSize, type NXFileUpload, type NXForm } from '@/index';
import '@/locales/es';
import { nextFrame } from '../utils';

const file = (name: string, size = 10, type = 'text/plain', lastModified = 1) =>
  Object.assign(new File(['x'.repeat(size)], name, { type, lastModified }));

describe('helpers', () => {
  it('parseSize reads bytes and unit text', () => {
    expect(parseSize(2048)).toBe(2048);
    expect(parseSize('5MB')).toBe(5 * 1024 ** 2);
    expect(parseSize('500 kb')).toBe(500 * 1024);
    expect(parseSize('1.5GB')).toBe(1.5 * 1024 ** 3);
    expect([parseSize(undefined), parseSize('big'), parseSize(0), parseSize('')]).toEqual([Infinity, Infinity, Infinity, Infinity]);
  });

  it('acceptsFile matches extensions, wildcards and exact types, ignoring case', () => {
    const png = { name: 'Photo.PNG', type: 'image/png' };
    expect([acceptsFile(png, ''), acceptsFile(png, '.png'), acceptsFile(png, 'image/*'), acceptsFile(png, 'image/png'), acceptsFile(png, '.pdf, image/jpeg')]).toEqual([true, true, true, true, false]);
    expect(acceptsFile({ name: 'a.pdf', type: '' }, '.pdf')).toBe(true); // browsers often give no type
    expect(acceptsFile({ name: 'a.pdf', type: 'application/pdf' }, 'image/*')).toBe(false);
  });
});

describe('<nx-file-upload>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('lang');
  });
  const mount = (config: Record<string, any> = {}) => {
    const el = NX.create<NXFileUpload>({ xtype: 'file-upload', name: 'docs', label: 'Documents', ...config });
    document.body.appendChild(el);
    return el;
  };
  const input = (el: NXFileUpload) => el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  const pick = (el: NXFileUpload, ...files: File[]) => {
    Object.defineProperty(input(el), 'files', { value: files, configurable: true });
    input(el).dispatchEvent(new Event('change', { bubbles: true }));
  };
  const names = (el: NXFileUpload) => Array.from(el.shadowRoot!.querySelectorAll('.file-name')).map(n => n.textContent);
  const rejections = (el: NXFileUpload) => Array.from(el.shadowRoot!.querySelectorAll('.rejected li')).map(n => n.textContent);

  it('is a labelled file input inside a drop zone', () => {
    const el = mount({ multiple: true, accept: '.pdf,image/*' });
    expect(input(el).multiple).toBe(true);
    expect(input(el).getAttribute('accept')).toBe('.pdf,image/*');
    expect(el.shadowRoot!.querySelector('label.nx-field-label')!.getAttribute('for')).toBe(input(el).id);
    expect(el.shadowRoot!.querySelector('.zone')!.getAttribute('for')).toBe(input(el).id);
    expect(el.shadowRoot!.querySelector('.zone-text')!.textContent).toBe('Drop files here or click to choose');
    expect(el.shadowRoot!.querySelector('.zone-hint')!.textContent).toBe('.pdf,image/*');
    expect(mount().shadowRoot!.querySelector('.zone-text')!.textContent).toBe('Drop a file here or click to choose');
  });

  it('lists picked files with their sizes, emits change, and exposes the files and form value', () => {
    const el = mount({ multiple: true });
    const changed = vi.fn();
    el.addEventListener('change', changed);
    pick(el, file('a.txt', 2048), file('b.txt', 3 * 1024 ** 2));
    expect(names(el)).toEqual(['a.txt', 'b.txt']);
    expect(Array.from(el.shadowRoot!.querySelectorAll('.file-size')).map(s => s.textContent)).toEqual(['2 kB', '3 MB']);
    expect(el.files).toHaveLength(2);
    expect((changed.mock.calls[0][0] as CustomEvent).detail.value).toHaveLength(2);
    const data = el.formValue()!;
    expect(data.getAll('docs').map(f => (f as File).name)).toEqual(['a.txt', 'b.txt']);
    expect(mount().formValue()).toBeNull(); // nothing chosen posts nothing
  });

  it('single mode keeps one file and swaps it; multiple appends and skips exact repeats', () => {
    const one = mount();
    pick(one, file('a.txt'));
    pick(one, file('b.txt'));
    expect(names(one)).toEqual(['b.txt']);
    pick(one, file('c.txt'), file('d.txt')); // two dropped on a single field: first wins, the other is reported
    expect(names(one)).toEqual(['c.txt']);
    expect(rejections(one)).toEqual(['d.txt was not added: only 1 file is allowed']);

    const many = mount({ multiple: true });
    pick(many, file('a.txt'));
    pick(many, file('a.txt'), file('b.txt'));
    expect(names(many)).toEqual(['a.txt', 'b.txt']);
  });

  it('rejects by type, size and count, announces why, and reports them', () => {
    const el = mount({ multiple: true, accept: '.txt', maxSize: '1KB', maxFiles: 2 });
    const reject = vi.fn();
    el.addEventListener('reject', reject);
    pick(el, file('ok.txt', 100), file('huge.txt', 5000), file('pic.png', 10, 'image/png'), file('two.txt', 100), file('three.txt', 100));
    expect(names(el)).toEqual(['ok.txt', 'two.txt']);
    expect(rejections(el)).toEqual([
      'huge.txt is larger than 1 kB',
      'pic.png is not an accepted file type',
      'three.txt was not added: only 2 files are allowed'
    ]);
    expect(el.shadowRoot!.querySelector('.rejected')!.getAttribute('role')).toBe('status');
    expect((reject.mock.calls[0][0] as CustomEvent).detail.rejected.map((r: any) => r.reason)).toEqual(['size', 'type', 'count']);
    // The next change clears the old messages
    pick(el, file('ok.txt', 100));
    expect(rejections(el)).toEqual([]);
  });

  it('removes a file from its button, emits change, and returns focus to the field', () => {
    const el = mount({ multiple: true });
    pick(el, file('a.txt'), file('b.txt'));
    const changed = vi.fn();
    el.addEventListener('change', changed);
    const remove = el.shadowRoot!.querySelector('.file-remove') as HTMLButtonElement;
    expect(remove.getAttribute('aria-label')).toBe('Remove a.txt');
    remove.focus();
    remove.click();
    expect(names(el)).toEqual(['b.txt']);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(el.shadowRoot!.activeElement).toBe(input(el));
  });

  it('is required: invalid until a file is chosen, and the message shows', async () => {
    const el = mount({ required: true });
    expect(el.validate()).toBe(false);
    expect(el.shadowRoot!.querySelector('.nx-field-helper')!.textContent).toBe('Choose at least one file');
    pick(el, file('a.txt'));
    expect(el.validate()).toBe(true);
    el.reset();
    expect(el.files).toEqual([]);
    expect(names(el)).toEqual([]);
  });

  it('supports a custom validator', () => {
    const el = mount({ validator: (files: File[]) => (files.length ? 'No thanks' : null) });
    pick(el, file('a.txt'));
    expect(el.validationMessage()).toBe('No thanks');
  });

  it('takes dropped files, highlights the zone while dragging, and ignores drops when disabled', () => {
    const el = mount({ multiple: true });
    const zone = el.shadowRoot!.querySelector('.zone') as HTMLElement;
    zone.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    expect(zone.classList.contains('dragging')).toBe(true);
    expect(el.shadowRoot!.querySelector('.zone-text')!.textContent).toBe('Release to add');
    const drop = Object.assign(new Event('drop', { bubbles: true, cancelable: true }), { dataTransfer: { files: [file('dropped.txt')] } });
    zone.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true); // the browser must not open the file
    expect(zone.classList.contains('dragging')).toBe(false);
    expect(names(el)).toEqual(['dropped.txt']);

    const off = mount({ disabled: true });
    off.shadowRoot!.querySelector('.zone')!.dispatchEvent(Object.assign(new Event('drop', { bubbles: true, cancelable: true }), { dataTransfer: { files: [file('x.txt')] } }));
    expect(off.files).toEqual([]);
    expect(input(off).disabled).toBe(true);
  });

  it('posts its files with an nx-form', () => {
    const form = NX.create<NXForm>({
      xtype: 'form',
      items: [{ xtype: 'textfield', name: 'title', value: 'Q1' }, { xtype: 'file-upload', name: 'attachments', multiple: true }]
    });
    document.body.appendChild(form);
    pick(form.getField<NXFileUpload>('attachments')!, file('a.txt'), file('b.txt'));
    const data = form.formData();
    expect(data.get('title')).toBe('Q1');
    expect(data.getAll('attachments').map(f => (f as File).name)).toEqual(['a.txt', 'b.txt']);
  });

  it('speaks the page language, formatting sizes for it', async () => {
    document.documentElement.lang = 'es';
    const el = mount({ multiple: true, maxSize: '1KB' });
    expect(el.shadowRoot!.querySelector('.zone-text')!.textContent).toBe('Suelte los archivos aquí o haga clic para elegir');
    pick(el, file('grande.txt', 5000));
    expect(rejections(el)).toEqual(['grande.txt supera 1 kB']);
  });

  it('ignores string values (what a native file input reports) and non-files', () => {
    const el = mount();
    (el as any).value = 'C:\\fakepath\\a.pdf';
    expect(el.files).toEqual([]);
    (el as any).value = [file('a.txt'), 'nope', 3];
    expect(names(el)).toEqual(['a.txt']);
  });
});
