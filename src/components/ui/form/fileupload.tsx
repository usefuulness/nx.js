/**
 * @file @/components/ui/form/fileupload.tsx
 */
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { NXField, type FieldConfig } from '@/components/ui/form/field';
import { NATIVE_ATTR } from '@/core/dom-utils';

export interface FileUploadConfig extends FieldConfig {
  /** Allow more than one file */
  multiple?: boolean;
  /** Accepted types, like the native attribute: `".pdf,.docx"`, `"image/*"`, `"image/png,image/jpeg"` */
  accept?: string;
  /** Largest file: bytes, or text such as `"5MB"`, `"500 KB"` */
  maxSize?: number | string;
  /** Most files (with `multiple`) */
  maxFiles?: number;
}

/** `1048576`, `"5MB"`, `"500 kb"` → bytes; anything else → Infinity */
export function parseSize(value: unknown): number {
  if (typeof value === 'number') return value > 0 ? value : Infinity;
  const match = /^\s*([\d.]+)\s*(b|kb|mb|gb)?\s*$/i.exec(String(value ?? ''));
  if (!match) return Infinity;
  const unit = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[(match[2] ?? 'b').toLowerCase() as 'b'];
  return Number(match[1]) * unit || Infinity;
}

/** Whether `file` matches an `accept` list (`.pdf`, `image/*`, `image/png`). An empty list accepts anything. */
export function acceptsFile(file: { name: string; type: string }, accept: string): boolean {
  const tokens = accept.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return tokens.some(token =>
    token.startsWith('.') ? name.endsWith(token) : token.endsWith('/*') ? type.startsWith(token.slice(0, -1)) : type === token
  );
}

type Rejection = { file: File; reason: 'type' | 'size' | 'count' };

/**
 * File upload: a drop zone and a file list that behave like a form field. The zone is a real file
 * input underneath, so keyboard, screen readers and native pickers work, and a plain `<form>` posts
 * the files. Files are checked against `accept`, `max-size` and `max-files`; rejected ones are
 * announced and reported in the `reject` event.
 *
 * ```html
 * <nx-file-upload name="docs" label="Documents" multiple accept=".pdf,image/*" max-size="5MB"></nx-file-upload>
 * ```
 *
 * The value is an array of `File`s (`field.files`). Use `enctype="multipart/form-data"` to post.
 *
 * Keyboard: **Tab** to the zone, **Enter** or **Space** opens the picker; each file has a **Remove** button.
 *
 * Events: `change` (detail: `{ value }`, the files), `reject` (detail: `{ rejected: [{ file, reason }] }`).
 */
export class NXFileUpload extends NXField {
  static get observedAttributes(): string[] {
    return ['name', 'label', 'helper-text', 'error-text', 'required', 'disabled', 'multiple', 'accept', 'max-size', 'max-files'];
  }

  private selected: File[] = [];
  private rejected: Rejection[] = [];
  private dragging = false;

  get value(): File[] {
    return this.selected;
  }

  set value(value: unknown) {
    // Only files can be set; the string a native file input reports ("C:\fakepath\a.pdf") is not a file
    const list = Array.isArray(value) ? value : value instanceof File ? [value] : [];
    this.selected = list.filter((f): f is File => typeof File !== 'undefined' && f instanceof File);
    this.rejected = [];
    this.refreshList();
    this.syncFormValue();
  }

  get files(): File[] {
    return this.selected;
  }

  protected defaultValue(): File[] {
    return [];
  }

  /** Files picked in a native stand-in before this element upgraded survive the upgrade. */
  protected hydrateState(): void {
    const native = this.querySelector(`:scope > input[type="file"][${NATIVE_ATTR}]`) as HTMLInputElement | null;
    if (native?.files?.length) this.selected = Array.from(native.files);
    native?.remove();
  }

  formValue(): FormData | null {
    if (!this.selected.length) return null;
    const data = new FormData();
    this.selected.forEach(file => data.append(this.name, file));
    return data;
  }

  validationMessage(): string {
    const validator = this.getProp<(v: any, f: this) => unknown>('validator');
    const custom = typeof validator === 'function' ? validator(this.value, this) : null;
    const message = this.getProp('required', false) && !this.selected.length
      ? this.t('upload.required')
      : typeof custom === 'string' ? custom : '';
    if (message) this.internals?.setValidity({ valueMissing: true }, message, this.control() ?? undefined);
    else this.internals?.setValidity({});
    return message;
  }

  // ────────── Adding and removing files ──────────

  /** Add files the way a drop or the picker does: checked against the rules, rejects reported. */
  addFiles(incoming: File[]): void {
    if (this.getProp('disabled', false) || !incoming.length) return;
    const multiple = this.getProp('multiple', false);
    const accept = this.getProp<string>('accept', '');
    const maxSize = parseSize(this.getProp('max-size'));
    const maxFiles = multiple ? Number(this.getProp('max-files', Infinity)) || Infinity : 1;

    const rejected: Rejection[] = [];
    const accepted: File[] = [];
    for (const file of incoming) {
      if (!acceptsFile(file, accept)) rejected.push({ file, reason: 'type' });
      else if (file.size > maxSize) rejected.push({ file, reason: 'size' });
      else accepted.push(file);
    }
    // A single-file field swaps its file; a multiple one appends, skipping exact repeats
    let next = multiple ? [...this.selected, ...accepted.filter(f => !this.selected.some(s => s.name === f.name && s.size === f.size && s.lastModified === f.lastModified))] : accepted.slice(0, 1);
    if (!multiple && accepted.length > 1) accepted.slice(1).forEach(file => rejected.push({ file, reason: 'count' }));
    if (next.length > maxFiles) {
      next.slice(maxFiles).forEach(file => rejected.push({ file, reason: 'count' }));
      next = next.slice(0, maxFiles);
    }

    const changed = next.length !== this.selected.length || next.some((f, i) => f !== this.selected[i]);
    this.rejected = rejected;
    if (changed) this.selected = next;
    this.touched = true;
    this.refreshList();
    if (changed) this.changed();
    if (rejected.length) this.emit('reject', { rejected });
  }

  removeFile(file: File): void {
    this.selected = this.selected.filter(f => f !== file);
    this.rejected = [];
    this.refreshList();
    this.changed();
    // The remove button is gone: keep the keyboard user in the field
    this.control()?.focus({ preventScroll: true });
  }

  private rejectionText(r: Rejection): string {
    if (r.reason === 'size') return this.t('upload.tooLarge', { name: r.file.name, max: this.formatSize(parseSize(this.getProp('max-size'))) });
    if (r.reason === 'type') return this.t('upload.wrongType', { name: r.file.name });
    return this.t('upload.tooMany', { name: r.file.name, count: this.getProp('multiple', false) ? Number(this.getProp('max-files', 1)) : 1 });
  }

  private formatSize(bytes: number): string {
    const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'];
    let n = bytes;
    let u = 0;
    while (n >= 1024 && u < units.length - 1) {
      n /= 1024;
      u++;
    }
    try {
      return new Intl.NumberFormat(this.locale(), { style: 'unit', unit: units[u], unitDisplay: 'short', maximumFractionDigits: 1 }).format(n);
    } catch {
      return `${Math.round(n * 10) / 10} ${['B', 'KB', 'MB', 'GB'][u]}`;
    }
  }

  // ────────── Rendering ──────────

  /** Redraw only the file list and messages, so the zone (and its focus) stays put. */
  private refreshList(): void {
    const region = this.$('.results');
    if (region) region.replaceChildren(...this.renderResults());
  }

  private renderResults(): Node[] {
    const nodes: Node[] = [];
    if (this.selected.length) {
      nodes.push(
        <ul class="files" part="files">
          {this.selected.map(file => (
            <li class="file">
              <span class="file-icon" aria-hidden="true" html={Icons.get('file')} />
              <span class="file-name" title={file.name}>{file.name}</span>
              <span class="file-size">{this.formatSize(file.size)}</span>
              <button type="button" class="file-remove" aria-label={this.t('upload.remove', { name: file.name })}
                      disabled={!!this.getProp('disabled', false)} html={Icons.get('close')} onClick={() => this.removeFile(file)} />
            </li>
          ))}
        </ul>
      );
    }
    if (this.rejected.length) {
      nodes.push(
        <ul class="rejected" part="rejected" role="status">
          {this.rejected.map(r => <li>{this.rejectionText(r)}</li>)}
        </ul>
      );
    }
    return nodes;
  }

  protected render(): Node {
    const multiple = !!this.getProp('multiple', false);
    const disabled = !!this.getProp('disabled', false);
    const accept = this.getProp<string>('accept', '');

    const zone = (
      <div part="control" class="nx-upload">
        <label class={['zone', { dragging: this.dragging }]} part="zone" for={this.fieldId}
               onDragEnter={(e: DragEvent) => this.drag(e, true)}
               onDragOver={(e: DragEvent) => this.drag(e, true)}
               onDragLeave={(e: DragEvent) => this.drag(e, false)}
               onDrop={(e: DragEvent) => {
                 e.preventDefault();
                 this.drag(e, false);
                 this.addFiles(Array.from(e.dataTransfer?.files ?? []));
               }}>
          <span class="zone-icon" aria-hidden="true" html={Icons.get('upload')} />
          <span class="zone-text">{this.t(this.dragging ? 'upload.release' : multiple ? 'upload.drop' : 'upload.dropOne')}</span>
          {accept && <span class="zone-hint">{accept}</span>}
          <input type="file" id={this.fieldId} class="picker" part="input" name={this.name || undefined}
                 multiple={multiple} accept={accept || undefined} disabled={disabled}
                 aria-describedby={`${this.fieldId}-help`}
                 onChange={(e: Event) => {
                   const input = e.target as HTMLInputElement;
                   this.addFiles(Array.from(input.files ?? []));
                   input.value = ''; // picking the same file again must still fire change
                 }} />
        </label>
        <div class="results" aria-live="polite">{this.renderResults()}</div>
      </div>
    );
    return this.renderField(zone);
  }

  private drag(e: DragEvent, over: boolean): void {
    e.preventDefault();
    if (this.getProp('disabled', false) || this.dragging === over) return;
    // Leaving to a child of the zone isn't leaving the zone
    if (!over && e.relatedTarget && (e.currentTarget as Node).contains(e.relatedTarget as Node)) return;
    this.dragging = over;
    (this.$('.zone') as HTMLElement | null)?.classList.toggle('dragging', over);
    const text = this.$('.zone-text');
    if (text) text.textContent = this.t(over ? 'upload.release' : this.getProp('multiple', false) ? 'upload.drop' : 'upload.dropOne');
  }

  protected styles(): string {
    return `
      ${this.fieldStyles()}

      .nx-upload { display: flex; flex-direction: column; gap: 0.75rem; }

      .zone {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        padding: 1.5rem 1rem;
        border: 1px dashed var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-background);
        color: var(--color-text-secondary);
        text-align: center;
        cursor: pointer;
        transition: border-color var(--transition-duration), background-color var(--transition-duration);
      }

      .zone:hover { border-color: var(--color-ring); background: var(--color-accent); }
      .zone.dragging { border-style: solid; border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 8%, var(--color-background)); }
      .zone:focus-within { border-color: var(--color-ring); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-ring) 25%, transparent); }
      .disabled .zone { cursor: not-allowed; opacity: 0.6; }
      .invalid .zone { border-color: var(--color-error); }
      .zone-icon { display: inline-flex; font-size: 1.5rem; }
      .zone-text { color: var(--color-text); font-weight: 500; }
      .zone-hint { font-size: 0.75rem; }

      /* The real input stays focusable (and clickable through the label) but invisible */
      .picker { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: inherit; }
      .picker:disabled { cursor: not-allowed; }
      /* Before JavaScript the server's native input stands in for the picker: the same invisible
         overlay, so the zone looks and measures the same before and after the upgrade */
      ::slotted(input) { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: inherit; }

      .files, .rejected { margin: 0; padding: 0; list-style: none; }
      .files { display: flex; flex-direction: column; gap: 0.375rem; }

      .file {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 2.25rem;
        padding: 0 0.5rem 0 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-background);
      }

      .file-icon { display: inline-flex; color: var(--color-text-secondary); }
      .file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .file-size { color: var(--color-text-secondary); font-size: 0.8125rem; font-variant-numeric: tabular-nums; white-space: nowrap; }

      .file-remove {
        display: inline-flex;
        padding: 0.25rem;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
      }

      .file-remove:hover:not(:disabled) { background: var(--color-accent); color: var(--color-text); }
      .file-remove:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring); }
      .rejected { color: var(--color-error-text); font-size: 0.8125rem; }
    `;
  }
}

define('nx-file-upload', NXFileUpload);
