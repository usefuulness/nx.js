/**
 * @file @/components/ui/form/select.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { escapeHTML } from '@/components/abstracts/base';
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

  constructor(config?: SelectConfig) {
    super();
    if (config) this.configure(config);
  }

  setOptions(options: SelectConfig['options']): void {
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

    const select = this.control() as HTMLSelectElement | null;
    if (select) {
      const values = new Set(Array.isArray(this.currentValue) ? this.currentValue : [this.currentValue]);
      Array.from(select.options).forEach(option => (option.selected = values.has(option.value)));
      select.classList.toggle('placeholder', !this.currentValue.length);
    }
    this.syncFormValue();
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

  protected render(): string {
    // Pick up <option> children for HTML usage: <nx-select><option>…</option></nx-select>
    if (!this.options.length && this.querySelector('option')) {
      this.options = Array.from(this.querySelectorAll('option')).map(o => ({
        value: o.value,
        text: o.textContent ?? o.value,
        disabled: o.disabled
      }));
      if (!this.currentValue) {
        const selected = this.querySelector('option[selected]') as HTMLOptionElement | null;
        if (selected) this.currentValue = selected.value;
      }
    }

    const multiple = this.getProp('multiple', false);
    const placeholder = this.getProp<string>('placeholder', multiple ? '' : 'Select…');
    const icon = this.getProp<string>('icon');
    const values = new Set(Array.isArray(this.currentValue) ? this.currentValue : [this.currentValue]);

    const option = (o: SelectOption) =>
      `<option value="${escapeHTML(o.value)}" ${values.has(String(o.value)) ? 'selected' : ''} ${o.disabled ? 'disabled' : ''}>${escapeHTML(o.text)}</option>`;

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

    const optionsHtml = [
      !multiple && placeholder ? `<option value="" ${this.currentValue ? '' : 'selected'} ${this.getProp('required', false) ? 'disabled' : ''}>${escapeHTML(placeholder)}</option>` : '',
      ...ungrouped.map(option),
      ...Array.from(groups).map(([group, opts]) => `<optgroup label="${escapeHTML(group)}">${opts.map(option).join('')}</optgroup>`)
    ].join('');

    return this.renderField(`
      <div class="nx-control ${multiple ? 'multiple' : ''} size-${this.getProp('size', 'md')}" part="control">
        ${icon ? `<span class="nx-control-icon">${Icons.get(icon)}</span>` : ''}
        <select id="${this.fieldId}" part="select"
                ${this.name ? `name="${escapeHTML(this.name)}"` : ''}
                ${multiple ? 'multiple' : ''}
                ${this.getProp('required', false) ? 'required' : ''}
                ${this.getProp('disabled', false) ? 'disabled' : ''}
                class="${this.currentValue.length ? '' : 'placeholder'}"
                aria-describedby="${this.fieldId}-help">
          ${optionsHtml}
        </select>
        ${multiple ? '' : `<span class="chevron" aria-hidden="true">${Icons.get('chevron-down')}</span>`}
      </div>
    `);
  }

  protected afterRender(): void {
    super.afterRender();
    const select = this.control() as HTMLSelectElement;
    this.on(select, 'change', () => {
      this.currentValue = select.multiple
        ? Array.from(select.selectedOptions).map(o => o.value)
        : select.value;
      select.classList.toggle('placeholder', !this.currentValue.length);
      this.changed();
    });
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

function normalizeOptions(options: SelectConfig['options']): SelectOption[] {
  if (!options) return [];
  if (!Array.isArray(options)) {
    return Object.entries(options).map(([value, text]) => ({ value, text }));
  }
  return options.map(o => (typeof o === 'string' ? { value: o, text: o } : o));
}

define('nx-select', NXSelect);
