import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import type { NXField } from '@/components/ui/form/field';

export type PropertyType = 'text' | 'password' | 'number' | 'boolean' | 'select' | 'date' | 'textarea' | 'json' | 'code' | 'reference';

export interface PropertyField {
  /** The key in the values object (a dotted path is not followed: one level) */
  name: string;
  label?: string;
  type?: PropertyType;
  /** Choices for `select` */
  options?: Array<string | { value: string | number; text: string }>;
  required?: boolean;
  /** Not editable: `true`, or a function of the current values (a field can be locked by another field's value) */
  readonly?: boolean | ((values: Record<string, any>) => boolean);
  /** Not shown: `true`, or a function of the current values */
  hidden?: boolean | ((values: Record<string, any>) => boolean);
  /** The value when the object has none */
  default?: unknown;
  /** A hint under the field */
  help?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  pattern?: string;
  /** A heading to gather fields under */
  group?: string;
  /** `code`: the language */
  language?: string;
  /** `reference`: how to show a stored value before anything was picked (an id to a name) */
  display?: (value: any) => string;
  /** `reference`: open your picker (a dialog, a file browser) and resolve with the choice, or nothing if cancelled */
  picker?: (current: any) => Promise<{ value: any; text: string } | undefined | null> | { value: any; text: string } | undefined | null;
  /** Return an error message, or nothing when valid; gets every value, so fields can depend on each other */
  validate?: (value: any, values: Record<string, any>) => string | true | void | null | undefined;
}

export interface PropertyGridConfig {
  /** What can be edited */
  schema: PropertyField[];
  /** The values (an object keyed by field name) */
  value?: Record<string, any>;
  /** Nothing can be edited */
  readonly?: boolean;
  /** Columns (default: as many as fit) */
  columns?: number;
  /** Accessible name of the group */
  label?: string;
}

type Control = HTMLElement & Partial<NXField> & { value?: any; checked?: boolean };

const isBlank = (v: unknown) => v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v));
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/**
 * A typed editor for an object: you describe the fields (type, required, read-only, hidden, help, validation that
 * can look at the other values) and it builds the form from the library's own fields. Types: `text`, `password`,
 * `number`, `boolean`, `select`, `date`, `textarea`, `json` and `code` (the code editor), and `reference` (a value you
 * choose with your own picker, such as an asset browser). Read-only can differ per field and follow the other values,
 * and fields can group under headings. The server's complaints can be shown next to their fields with `setErrors()`.
 *
 * ```tsx
 * <PropertyGrid schema={[
 *   { name: 'name', label: 'Name', required: true },
 *   { name: 'kind', label: 'Kind', type: 'select', options: ['job', 'extension'] },
 *   { name: 'script', label: 'Script', type: 'reference', picker: openScriptPicker },
 *   { name: 'config', label: 'Settings', type: 'json', group: 'Advanced' }
 * ]} value={record} onChange={e => …} />
 * ```
 *
 * Events: `change` (`detail.name`, `detail.value`, `detail.values`), `dirty-change`.
 */
export class NXPropertyGrid extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['schema', 'value', 'readonly', 'columns', 'label'];
  }

  private values: Record<string, any> = {};
  private baseline: Record<string, any> = {};
  private dirty = false;
  private serverErrors: Record<string, string[]> = {};
  private controls = new Map<string, { row: HTMLElement; control: Control; field: PropertyField }>();
  private shown = new Map<string, string>(); // `reference` text, by field
  private rendered: PropertyField[] | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  private get schema(): PropertyField[] {
    const s = this.getProp<PropertyField[]>('schema', []);
    return Array.isArray(s) ? s : [];
  }

  // ────────── Values ──────────

  /** The values, with each field's default where there is none (a copy). */
  get value(): Record<string, any> {
    const out: Record<string, any> = { ...this.values };
    for (const f of this.schema) if (out[f.name] === undefined && f.default !== undefined) out[f.name] = f.default;
    return out;
  }

  set value(values: Record<string, any> | null | undefined) {
    this.values = { ...(values ?? {}) };
    this.baseline = clone(this.values);
    this.serverErrors = {};
    this.setDirty(false);
    this.sync();
  }

  protected onAttributeChange(name: string, _old: string | null, value: string | null): void {
    if (name === 'value' && value) { try { this.value = JSON.parse(value); } catch { /* not JSON: ignore */ } }
  }

  protected applyConfig(key: string, value: any): void {
    if (key === 'value') { this.value = value; return; }
    super.applyConfig(key, value);
  }

  isDirty(): boolean { return this.dirty; }

  /** The values as they are now are the saved ones. */
  markClean(): void {
    this.baseline = clone(this.values);
    this.setDirty(false);
  }

  private setDirty(dirty: boolean): void {
    if (dirty === this.dirty) return;
    this.dirty = dirty;
    this.toggleAttribute('dirty', dirty);
    this.emit('dirty-change', { dirty });
  }

  // ────────── Checking ──────────

  private messageFor(f: PropertyField, value: unknown): string {
    if (this.fieldHidden(f)) return '';
    const server = this.serverErrors[f.name]?.[0];
    if (isBlank(value)) return f.required ? this.t('property.required') : '';
    if (f.type === 'number') {
      const n = Number(value);
      if (Number.isNaN(n)) return this.t('property.number');
      if (f.min !== undefined && n < f.min) return this.t('property.min', { min: f.min });
      if (f.max !== undefined && n > f.max) return this.t('property.max', { max: f.max });
    }
    if (f.pattern && typeof value === 'string') { try { if (!new RegExp(`^(?:${f.pattern})$`).test(value)) return this.t('property.pattern'); } catch { /* a pattern JavaScript does not read */ } }
    if (f.validate) {
      const r = f.validate(value, this.value);
      if (typeof r === 'string' && r) return r;
    }
    return server ?? '';
  }

  /** Check every shown field, show what is wrong next to it, put focus on the first problem. */
  validate(): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    let first: Control | null = null;
    for (const [name, { control, field }] of this.controls) {
      const message = field.type === 'json' || field.type === 'code' ? (control.validationMessage?.() || this.messageFor(field, this.values[name])) : this.messageFor(field, this.values[name]);
      this.showMessage(name, message);
      if (message) { errors[name] = message; first ??= control; }
    }
    (first as any)?.focus?.();
    return { valid: Object.keys(errors).length === 0, errors };
  }

  /** Show the server's complaints next to their fields (`{ name: ['already taken'] }`, as `parseApiError` gives them). Editing a field clears its complaint. */
  setErrors(errors: Record<string, string[] | string>): void {
    this.serverErrors = Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]));
    for (const name of this.controls.keys()) this.showMessage(name, this.serverErrors[name]?.[0] ?? '');
  }

  private showMessage(name: string, message: string): void {
    const entry = this.controls.get(name);
    if (!entry) return;
    if (message) entry.control.setAttribute('error-text', message); else entry.control.removeAttribute('error-text');
    entry.row.querySelector('.ref-error')?.replaceChildren(message);
  }

  // ────────── Building ──────────

  private fieldHidden(f: PropertyField): boolean {
    return typeof f.hidden === 'function' ? !!f.hidden(this.value) : !!f.hidden;
  }

  private fieldReadonly(f: PropertyField): boolean {
    if (this.getProp('readonly', false)) return true;
    return typeof f.readonly === 'function' ? !!f.readonly(this.value) : !!f.readonly;
  }

  private commit(f: PropertyField, raw: unknown): void {
    let value: unknown = raw;
    if (f.type === 'number') value = isBlank(raw) ? undefined : Number(raw);
    else if (f.type === 'json') {
      if (typeof raw === 'string') { try { value = raw.trim() ? JSON.parse(raw) : undefined; } catch { value = this.values[f.name]; } }
    } else if (raw === '') value = undefined;
    // Typing and then leaving a field both come here: the second finds nothing new
    if (JSON.stringify(value) === JSON.stringify(this.values[f.name])) return;
    if (this.serverErrors[f.name]) { const { [f.name]: _gone, ...rest } = this.serverErrors; this.serverErrors = rest; this.showMessage(f.name, ''); }
    this.values = { ...this.values, [f.name]: value };
    this.setDirty(JSON.stringify(this.values) !== JSON.stringify(this.baseline));
    this.sync(f.name);
    this.emit('change', { name: f.name, value, values: this.value });
  }

  private build(f: PropertyField): { row: HTMLElement; control: Control } {
    const type = f.type ?? 'text';
    // Everything a field shows is there from the first draw (the server's HTML carries it, and hydration moves nothing)
    const all = this.value;
    const readonly = this.fieldReadonly(f);
    const shown = type === 'json' ? (all[f.name] === undefined ? '' : JSON.stringify(all[f.name], null, 2)) : all[f.name] ?? '';
    const common: Record<string, unknown> = { label: f.label ?? f.name, 'helper-text': f.help, required: !!f.required, placeholder: f.placeholder, value: shown, readonly: readonly || undefined };
    const on = {
      onChange: (e: CustomEvent) => { e.stopPropagation(); this.commit(f, e.detail?.value ?? (e.target as any).value); },
      // Text is taken as it is typed, so what depends on it (hidden fields, locks, a server's complaint) follows at once
      onInput: (e: Event) => { if (['text', 'password', 'number', 'textarea', undefined].includes(f.type)) this.commit(f, (e.target as any).value); }
    };
    let control: HTMLElement;
    if (type === 'boolean') control = <nx-switch label={f.label ?? f.name} helper-text={f.help} checked={!!all[f.name]} disabled={readonly || undefined} onChange={(e: CustomEvent) => { e.stopPropagation(); this.commit(f, (e.target as any).checked); }} /> as HTMLElement;
    else if (type === 'select') control = <nx-select {...common} readonly={undefined} disabled={readonly || undefined} options={f.options ?? []} {...on} /> as HTMLElement;
    else if (type === 'date') control = <nx-datepicker {...common} readonly={undefined} disabled={readonly || undefined} {...on} /> as HTMLElement;
    else if (type === 'textarea') control = <nx-textarea {...common} rows={4} {...on} /> as HTMLElement;
    else if (type === 'json' || type === 'code') control = <nx-code-editor {...common} language={type === 'json' ? 'json' : f.language ?? 'text'} height="9rem" {...on} /> as HTMLElement;
    else if (type === 'reference') control = this.buildReference(f);
    else control = <nx-input {...common} type={type === 'number' ? 'number' : type === 'password' ? 'password' : 'text'} min={f.min} max={f.max} {...on} /> as HTMLElement;
    return { row: (<div class="row" part="row" data-name={f.name} hidden={this.fieldHidden(f) || undefined}>{control}</div>) as HTMLElement, control: control as Control };
  }

  private referenceText(f: PropertyField): string {
    const v = this.value[f.name];
    const text = this.shown.get(f.name) ?? (v !== undefined && f.display ? f.display(v) : v !== undefined ? String(v) : '');
    return text || '—';
  }

  /** A value chosen with your own picker: its name, a Choose button, and a way to clear it. */
  private buildReference(f: PropertyField): HTMLElement {
    const id = `pg-${f.name}`;
    const choose = async () => {
      const picked = await f.picker?.(this.values[f.name]);
      if (!picked) return;
      this.shown.set(f.name, picked.text);
      this.commit(f, picked.value);
    };
    const el = (
      <div class="reference" part="reference">
        <label class="ref-label" for={id}>{f.label ?? f.name}{f.required && <span class="req" aria-hidden="true"> *</span>}</label>
        <div class="ref-line">
          <output class="ref-text" id={id} aria-describedby={`${id}-err`}>{this.referenceText(f)}</output>
          <button type="button" class="ref-choose" disabled={this.fieldReadonly(f) || undefined} onClick={choose}>{this.t('property.choose')}</button>
          <button type="button" class="ref-clear" hidden={this.fieldReadonly(f) || this.value[f.name] === undefined || undefined} onClick={() => { this.shown.delete(f.name); this.commit(f, undefined); }}>{this.t('property.clear')}</button>
        </div>
        {f.help && <div class="ref-help">{f.help}</div>}
        <div class="ref-error" id={`${id}-err`} role="alert" />
      </div>
    ) as HTMLElement;
    // A field-like surface for the grid's checks: value, focus, error text
    Object.assign(el, { focus: () => (el.querySelector('.ref-choose') as HTMLElement).focus(), validationMessage: () => '' });
    return el;
  }

  protected render(): Node {
    const fields = this.schema;
    this.rendered = fields;
    this.controls.clear();
    const groups = new Map<string, PropertyField[]>();
    for (const f of fields) (groups.get(f.group ?? '') ?? groups.set(f.group ?? '', []).get(f.group ?? '')!).push(f);
    const columns = Number(this.getProp('columns', 0));
    const sections = [...groups.entries()].map(([group, list]) => {
      const rows = list.map(f => { const built = this.build(f); this.controls.set(f.name, { ...built, field: f }); return built.row; });
      return (
        <section class="group" part="group">
          {group && <h3 class="heading" part="heading">{group}</h3>}
          <div class="fields" style={columns > 0 ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>{rows}</div>
        </section>
      );
    });
    queueMicrotask(() => this.sync());
    return <div class="grid" part="grid" role="group" aria-label={this.getProp('label') || undefined}>{sections}</div>;
  }

  protected update(): void {
    // The controls hold focus, caret and undo history: only a new schema rebuilds them
    if (this.rendered && this.rendered === this.schema) { this.sync(); return; }
    super.update();
  }

  /** Push the values, read-only and hidden states into the controls (`except` is the field being typed in). */
  private sync(except?: string): void {
    const all = this.value;
    for (const [name, { row, control, field }] of this.controls) {
      row.hidden = this.fieldHidden(field);
      const readonly = this.fieldReadonly(field);
      const type = field.type ?? 'text';
      if (type === 'reference') {
        control.querySelector('.ref-text')!.textContent = this.referenceText(field);
        (control.querySelector('.ref-choose') as HTMLButtonElement).disabled = readonly;
        (control.querySelector('.ref-clear') as HTMLButtonElement).hidden = readonly || all[name] === undefined;
        continue;
      }
      if (type === 'boolean') { if (control.checked !== !!all[name]) control.checked = !!all[name]; }
      else if (name !== except) {
        const shown = type === 'json' ? (all[name] === undefined ? '' : JSON.stringify(all[name], null, 2)) : all[name] ?? '';
        if (control.value !== shown && String(control.value ?? '') !== String(shown)) control.value = shown;
      }
      // Fields without a read-only look are switched off instead
      if (['text', 'password', 'number', 'textarea', 'json', 'code'].includes(type)) control.toggleAttribute('readonly', readonly);
      else control.toggleAttribute('disabled', readonly);
    }
  }

  protected styles(): string {
    return `
      :host { display: block; font-size: 0.875rem; }
      .grid { display: flex; flex-direction: column; gap: 1.5rem; }
      .heading { margin: 0 0 0.75rem; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-secondary); }
      .fields { display: grid; gap: 1rem 1.25rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr)); align-items: start; }
      .row[hidden] { display: none; }
      .row:has(nx-code-editor), .row:has(nx-textarea), .row:has(.reference) { grid-column: 1 / -1; }
      .reference { display: flex; flex-direction: column; gap: 0.375rem; }
      .ref-label { font-weight: 500; line-height: 1.25; }
      .ref-line { display: flex; align-items: center; gap: 0.5rem; min-height: 2.25rem; padding: 0 0.5rem 0 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-background); }
      .ref-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ref-choose, .ref-clear { height: 1.75rem; padding: 0 0.625rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 0.8125rem; cursor: pointer; }
      .ref-choose:hover, .ref-clear:hover { background: var(--color-accent); }
      .ref-choose:disabled { opacity: 0.5; cursor: default; }
      .ref-choose:focus-visible, .ref-clear:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 1px; }
      .ref-help { font-size: 0.8125rem; color: var(--color-text-secondary); }
      .ref-error { font-size: 0.8125rem; color: var(--color-error-text); }
      .ref-error:empty { display: none; }
    `;
  }
}

define('nx-property-grid', NXPropertyGrid);
