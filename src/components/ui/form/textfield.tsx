/**
 * @file @/components/ui/form/textfield.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
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

  protected render(): Node {
    const multiline = this.getProp('multiline', false);
    const icon = this.getProp<string>('icon');

    const common = {
      id: this.fieldId,
      part: 'input',
      name: this.getProp<string>('name'),
      placeholder: this.getProp<string>('placeholder'),
      required: !!this.getProp('required', false),
      disabled: !!this.getProp('disabled', false),
      readonly: !!this.getProp('readonly', false),
      minlength: this.getProp('minlength') ?? this.getProp('min-length'),
      maxlength: this.getProp('maxlength') ?? this.getProp('max-length'),
      autocomplete: this.getProp<AutoFill>('autocomplete'),
      value: this.currentValue,
      'aria-describedby': `${this.fieldId}-help`,
      onInput: (e: Event) => this.onInput(e.target as HTMLInputElement),
      onChange: () => this.changed(),
      onKeyDown: (e: KeyboardEvent) => this.onKeyDown(e)
    };

    return this.renderField(
      <div part="control" class={['nx-control', `size-${this.getProp('size', 'md')}`, { multiline }]}>
        <slot name="prefix">{icon && <span class="nx-control-icon" html={Icons.get(icon)} />}</slot>
        {multiline
          ? <textarea {...common} rows={this.getProp('rows', 3)} />
          : <input {...common} type={this.getProp('type', 'text')} min={this.getProp('min')} max={this.getProp('max')}
                   step={this.getProp('step')} pattern={this.getProp('pattern')} />}
        {this.getProp('clearable', false) && (
          <button type="button" class="nx-clear" part="clear" tabindex={-1} aria-label="Clear" hidden
                  html={Icons.get('close')} onClick={() => this.clear()} />
        )}
        <slot name="suffix" />
      </div>
    );
  }

  private onInput(control: HTMLInputElement | HTMLTextAreaElement): void {
    this.currentValue = control.value;
    this.syncClear();
    this.syncFormValue();
    if (this.touched) this.showError(this.validationMessage());
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Enter' || (e.target as Element).tagName === 'TEXTAREA') return;
    this.emit('enter', { value: this.currentValue });
    e.preventDefault();
    this.implicitSubmit();
  }

  /** Clear the value (like the × button). */
  clear(): void {
    this.value = '';
    this.changed();
    this.control()?.focus();
  }

  private syncClear(): void {
    const clear = this.$('.nx-clear') as HTMLElement | null;
    if (clear) clear.hidden = !this.currentValue || !!this.getProp('disabled', false) || !!this.getProp('readonly', false);
  }

  protected afterRender(): void {
    super.afterRender();
    this.syncClear();
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

/** `<nx-input>`: the HTML name matching `<Input>` in JSX. */
export class NXInput extends NXTextField {}
define('nx-input', NXInput);

/** `<nx-textarea>`: a multi-line text field, like `<Textarea>` in JSX. */
export class NXTextarea extends NXTextField {
  protected getProp<T = any>(name: string, defaultValue?: T): T {
    return name === 'multiline' ? (true as T) : super.getProp(name, defaultValue);
  }
}
define('nx-textarea', NXTextarea);

/** Shorthand xtypes that preconfigure a textfield. */
export const TEXTFIELD_VARIANTS: Record<string, Partial<TextFieldConfig>> = {
  textarea: { multiline: true },
  numberfield: { type: 'number' },
  number: { type: 'number' },
  datefield: { type: 'date' },
  password: { type: 'password' },
  email: { type: 'email' },
  search: { type: 'search', icon: 'search', clearable: true }
};

Object.entries(TEXTFIELD_VARIANTS).forEach(([xtype, preset]) => {
  ComponentRegistry.registerFactory(xtype, ({ items: _items, ...config } = {}) =>
    ComponentRegistry.build({ ...preset, ...config, xtype: 'textfield' }) as any
  );
});
