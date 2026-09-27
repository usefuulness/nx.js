/**
 * @file @/components/ui/form/select.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { NXField, type FieldConfig } from '@/components/ui/form/field';

export interface SelectOption {
  value: string | number;
  text: string;
  disabled?: boolean;
  group?: string;
}

export interface SelectConfig extends FieldConfig {
  value?: string | number | (string | number)[];
  /** Options as objects, plain strings, or a `{ value: text }` map */
  options?: Array<SelectOption | string> | Record<string, string>;
  placeholder?: string;
  multiple?: boolean;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
  errorText?: string;
}

/**
 * Select, styled around the native `<select>` (accessible, mobile friendly,
 * never clipped by overflow containers).
 *
 * @example
 * ```typescript
 * { xtype: 'select', name: 'role', label: 'Role', options: ['Admin', 'Editor', 'Viewer'], value: 'Editor' }
 * { xtype: 'select', options: [{ value: 1, text: 'One' }, { value: 2, text: 'Two', group: 'More' }] }
 * ```
 * ```html
 * <nx-select name="role" label="Role" value="Editor">
 *   <option>Admin</option><option>Editor</option>
 *   <optgroup label="More"><option value="ro">Viewer</option></optgroup>
 * </nx-select>
 * ```
 */
export class NXSelect extends NXField {
  static get observedAttributes(): string[] {
    return [
      'name', 'placeholder', 'label', 'helper-text', 'error-text', 'icon',
      'required', 'disabled', 'multiple', 'size', 'value'
    ];
  }

  private options: SelectOption[] = [];
  private currentValue: string | string[] = '';
  /** Options come from <option> children (HTML/template usage) and follow them */
  private childOptions = false;
  private observer: MutationObserver | null = null;

  constructor(config?: SelectConfig) {
    super();
    if (config) this.configure(config);
  }

  setOptions(options: SelectConfig['options']): void {
    this.childOptions = false;
    this.options = normalizeOptions(options);
    this.scheduleUpdate();
  }

  getOptions(): SelectOption[] {
    return this.options;
  }

  get value(): string | string[] {
    return this.currentValue;
  }

  set value(value: string | number | (string | number)[] | null | undefined) {
    this.currentValue = Array.isArray(value)
      ? value.map(String)
      : value === null || value === undefined ? '' : String(value);

    this.syncSelection();
    this.syncFormValue();
  }

  private syncSelection(): void {
    const select = this.control() as HTMLSelectElement | null;
    if (!select) return;
    const values = new Set(Array.isArray(this.currentValue) ? this.currentValue : [this.currentValue]);
    Array.from(select.options).forEach(option => (option.selected = values.has(option.value)));
    select.classList.toggle('placeholder', !this.currentValue.length);
  }

  /** Read `<option>`/`<optgroup>` children; they may be parsed after the element upgraded. */
  private readChildOptions(): void {
    if (this.options.length && !this.childOptions) return;
    const children = Array.from(this.querySelectorAll('option'));
    if (!children.length) return;
    this.childOptions = true;
    this.options = children.map(o => ({
      value: o.value,
      text: o.textContent ?? o.value,
      disabled: o.disabled,
      group: o.parentElement?.localName === 'optgroup' ? o.parentElement.getAttribute('label') ?? undefined : undefined
    }));
    if (!this.currentValue.length) {
      const selected = children.filter(o => o.hasAttribute('selected')).map(o => o.value);
      if (selected.length) this.currentValue = this.getProp('multiple', false) ? selected : selected[0];
    }
  }

  protected afterConnect(): void {
    this.observer ??= new MutationObserver(() => {
      if (this.childOptions || !this.options.length) this.scheduleUpdate();
    });
    this.observer.observe(this, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value', 'selected', 'disabled', 'label'] });
  }

  protected beforeDisconnect(): void {
    this.observer?.disconnect();
  }

  protected afterRender(): void {
    // Explicit selection: an option's `selected` set before insertion isn't kept everywhere
    this.syncSelection();
    super.afterRender();
  }

  /** The selected option object(s). */
  get selectedOption(): SelectOption | SelectOption[] | null {
    const values = Array.isArray(this.currentValue) ? this.currentValue : [this.currentValue];
    const selected = this.options.filter(o => values.includes(String(o.value)));
    return this.getProp('multiple', false) ? selected : selected[0] ?? null;
  }

  protected defaultValue(): any {
    return this.getProp('multiple', false) ? [] : '';
  }

  protected onAttributeChange(name: string, _old: string | null, value: string | null): void {
    if (name === 'value') this.value = value ?? '';
  }

  protected applyConfig(key: string, value: any): void {
    if (key === 'value') {
      this.value = value;
      return;
    }
    super.applyConfig(key, value);
  }

  protected render(): Node {
    // HTML usage: <nx-select><option>…</option></nx-select>
    this.readChildOptions();

    const multiple = this.getProp('multiple', false);
    const placeholder = this.getProp<string>('placeholder', multiple ? '' : 'Select…');
    const icon = this.getProp<string>('icon');
    const values = new Set(Array.isArray(this.currentValue) ? this.currentValue : [this.currentValue]);

    const option = (o: SelectOption) => (
      <option value={String(o.value)} selected={values.has(String(o.value))} disabled={!!o.disabled}>{o.text}</option>
    );

    const groups = new Map<string, SelectOption[]>();
    const ungrouped: SelectOption[] = [];
    this.options.forEach(o => {
      if (o.group) {
        if (!groups.has(o.group)) groups.set(o.group, []);
        groups.get(o.group)!.push(o);
      } else {
        ungrouped.push(o);
      }
    });

    return this.renderField(
      <div part="control" class={['nx-control', `size-${this.getProp('size', 'md')}`, { multiple }]}>
        {icon && <span class="nx-control-icon" html={Icons.get(icon)} />}
        <select id={this.fieldId} part="select" name={this.name} multiple={!!multiple}
                required={!!this.getProp('required', false)} disabled={!!this.getProp('disabled', false)}
                class={{ placeholder: !this.currentValue.length }} aria-describedby={`${this.fieldId}-help`}
                onChange={(e: Event) => this.onSelectChange(e.target as HTMLSelectElement)}>
          {!multiple && placeholder && (
            <option value="" selected={!this.currentValue} disabled={!!this.getProp('required', false)}>{placeholder}</option>
          )}
          {ungrouped.map(option)}
          {Array.from(groups).map(([group, opts]) => <optgroup label={group}>{opts.map(option)}</optgroup>)}
        </select>
        {!multiple && <span class="chevron" aria-hidden="true" html={Icons.get('chevron-down')} />}
      </div>
    );
  }

  private onSelectChange(select: HTMLSelectElement): void {
    this.currentValue = select.multiple ? Array.from(select.selectedOptions).map(o => o.value) : select.value;
    select.classList.toggle('placeholder', !this.currentValue.length);
    this.changed();
  }

  protected styles(): string {
    return `
      ${this.fieldStyles()}

      .nx-control { position: relative; padding-right: 0; }

      select {
        appearance: none;
        padding-right: 2.25rem !important;
        cursor: pointer;
      }

      select.placeholder { color: var(--color-text-secondary); }
      option { color: var(--color-text); background: var(--color-surface); }

      .chevron {
        position: absolute;
        right: 0.75rem;
        display: inline-flex;
        color: var(--color-text-secondary);
        pointer-events: none;
      }

      .multiple { padding: 0.25rem; }
      .multiple select { padding: 0 !important; min-height: 6rem; }
      .multiple option { padding: 0.375rem 0.5rem; border-radius: var(--radius-sm); }
    `;
  }
}

export function normalizeOptions(options: SelectConfig['options']): SelectOption[] {
  if (!options) return [];
  if (!Array.isArray(options)) {
    return Object.entries(options).map(([value, text]) => ({ value, text }));
  }
  return options.map(o => (typeof o === 'string' ? { value: o, text: o } : o));
}

define('nx-select', NXSelect);
