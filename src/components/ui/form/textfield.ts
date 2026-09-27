/**
 * @file @/components/ui/form/textfield.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { escapeHTML } from '@/components/abstracts/base';
import { ComponentRegistry, define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { NXField, type FieldConfig } from '@/components/ui/form/field';

export interface TextFieldConfig extends FieldConfig {
  value?: string | number;
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number' | 'search' | 'date' | 'time' | 'datetime-local';
  placeholder?: string;
  /** Leading icon (name or SVG) */
  icon?: string;
  /** Show an × button when there is a value */
  clearable?: boolean;
  /** Render a `<textarea>` */
  multiline?: boolean;
  rows?: number;
  readonly?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  pattern?: string;
  autocomplete?: string;
  size?: 'sm' | 'md' | 'lg';
  errorText?: string;
}

/**
 * Text input (also: `xtype: 'textarea'`, `'numberfield'`, `'datefield'`, `'password'`, `'email'`).
 *
 * Fires the native `input` event on each keystroke and `change` (detail: `{ value }`)
 * on every change. Read the value with `field.value`.
 *
 * @example
 * ```typescript
 * { xtype: 'textfield', name: 'email', type: 'email', label: 'Email', required: true, icon: 'mail' }
 * ```
 */
export class NXTextField extends NXField {
  static get observedAttributes(): string[] {
    return [
      'name', 'type', 'placeholder', 'label', 'helper-text', 'error-text', 'icon',
      'required', 'disabled', 'readonly', 'minlength', 'maxlength', 'min', 'max', 'step',
      'pattern', 'size', 'clearable', 'multiline', 'rows', 'autocomplete', 'value'
    ];
  }

  private currentValue = '';

  get value(): string {
    return this.currentValue;
  }

  set value(value: string | number | null | undefined) {
    this.currentValue = value === null || value === undefined ? '' : String(value);
    const control = this.control() as HTMLInputElement | null;
    if (control && control.value !== this.currentValue) control.value = this.currentValue;
    this.syncClear();
    this.syncFormValue();
  }

  /** `number` fields: the value as a number (NaN when empty). */
  get valueAsNumber(): number {
    return this.currentValue === '' ? NaN : Number(this.currentValue);
  }

  select(): void {
    (this.control() as HTMLInputElement | null)?.select();
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
    const multiline = this.getProp('multiline', false);
    const icon = this.getProp<string>('icon');
    const attr = (name: string, value: unknown) =>
      value === undefined || value === null || value === '' || value === false ? '' : value === true ? name : `${name}="${escapeHTML(value)}"`;

    const common = [
      `id="${this.fieldId}"`,
      `part="input"`,
      attr('name', this.getProp('name')),
      attr('placeholder', this.getProp('placeholder')),
      attr('required', this.getProp('required', false)),
      attr('disabled', this.getProp('disabled', false)),
      attr('readonly', this.getProp('readonly', false)),
      attr('minlength', this.getProp('minlength') ?? this.getProp('min-length')),
      attr('maxlength', this.getProp('maxlength') ?? this.getProp('max-length')),
      attr('autocomplete', this.getProp('autocomplete')),
      `aria-describedby="${this.fieldId}-help"`
    ].filter(Boolean).join(' ');

    const control = multiline
      ? `<textarea ${common} rows="${this.getProp('rows', 3)}">${escapeHTML(this.currentValue)}</textarea>`
      : `<input ${common}
            type="${escapeHTML(this.getProp('type', 'text'))}"
            value="${escapeHTML(this.currentValue)}"
            ${attr('min', this.getProp('min'))}
            ${attr('max', this.getProp('max'))}
            ${attr('step', this.getProp('step'))}
            ${attr('pattern', this.getProp('pattern'))}>`;

    return this.renderField(`
      <div class="nx-control ${multiline ? 'multiline' : ''} size-${this.getProp('size', 'md')}" part="control">
        <slot name="prefix">${icon ? `<span class="nx-control-icon">${Icons.get(icon)}</span>` : ''}</slot>
        ${control}
        ${this.getProp('clearable', false) ? `
          <button type="button" class="nx-clear" part="clear" tabindex="-1" aria-label="Clear" hidden>${Icons.get('close')}</button>
        ` : ''}
        <slot name="suffix"></slot>
      </div>
    `);
  }

  private syncClear(): void {
    const clear = this.$('.nx-clear') as HTMLElement | null;
    if (clear) clear.hidden = !this.currentValue || !!this.getProp('disabled', false) || !!this.getProp('readonly', false);
  }

  protected afterRender(): void {
    super.afterRender();
    this.syncClear();
    const control = this.control()!;

    this.on(control, 'input', () => {
      this.currentValue = control.value;
      this.syncClear();
      this.syncFormValue();
      if (this.touched) this.showError(this.validationMessage());
    });

    this.on(control, 'change', () => this.changed());

    this.on(control, 'keydown', (e: Event) => {
      const key = (e as KeyboardEvent).key;
      if (key === 'Enter' && !(control instanceof HTMLTextAreaElement)) {
        this.emit('enter', { value: this.currentValue });
        this.closest('nx-form')?.dispatchEvent(new CustomEvent('nx-field-enter', { bubbles: false }));
      }
    });

    const clear = this.$('.nx-clear');
    if (clear) {
      this.on(clear, 'click', () => {
        this.value = '';
        this.changed();
        control.focus();
      });
    }
  }

  protected styles(): string {
    return `
      ${this.fieldStyles()}

      .multiline {
        align-items: stretch;
        padding: 0.5rem 0.75rem;
      }

      .multiline textarea {
        min-height: 4rem;
        resize: vertical;
        line-height: 1.5;
      }

      input[type="search"]::-webkit-search-cancel-button { display: none; }

      .nx-clear {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.25rem;
        height: 1.25rem;
        margin-right: -0.25rem;
        padding: 0;
        border: none;
        border-radius: 9999px;
        background: transparent;
        color: var(--color-text-secondary);
        font-size: 0.875rem;
        cursor: pointer;
      }

      .nx-clear:hover {
        background: var(--color-accent);
        color: var(--color-text);
      }

      .nx-clear[hidden] { display: none; }
    `;
  }
}

define('nx-textfield', NXTextField);

/** Shorthand xtypes that preconfigure a textfield. */
export const TEXTFIELD_VARIANTS: Record<string, Partial<TextFieldConfig>> = {
  textarea: { multiline: true },
  numberfield: { type: 'number' },
  number: { type: 'number' },
  datefield: { type: 'date' },
  datepicker: { type: 'date' },
  password: { type: 'password' },
  email: { type: 'email' },
  search: { type: 'search', icon: 'search', clearable: true }
};

Object.entries(TEXTFIELD_VARIANTS).forEach(([xtype, preset]) => {
  ComponentRegistry.registerFactory(xtype, ({ items: _items, ...config } = {}) =>
    ComponentRegistry.build({ ...preset, ...config, xtype: 'textfield' }) as any
  );
});
