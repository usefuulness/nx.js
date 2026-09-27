/**
 * @file @/components/ui/form/checkbox.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { escapeHTML } from '@/components/abstracts/base';
import { ComponentRegistry, define } from '@/core/registry';
import { NXField, type FieldConfig } from '@/components/ui/form/field';

export interface CheckboxConfig extends FieldConfig {
  checked?: boolean;
  /** Value submitted when checked (default `'on'`); `form.getValues()` reports a boolean unless set */
  value?: string;
  indeterminate?: boolean;
  /** Render as a toggle switch (also: `xtype: 'switch'`) */
  switch?: boolean;
  description?: string;
}

/**
 * Checkbox or toggle switch.
 *
 * @example
 * ```typescript
 * { xtype: 'checkbox', name: 'terms', label: 'I accept the terms', required: true }
 * { xtype: 'switch', name: 'notifications', label: 'Email notifications', checked: true }
 * ```
 *
 * `change` detail: `{ value, checked }`.
 */
export class NXCheckbox extends NXField {
  static get observedAttributes(): string[] {
    return ['name', 'label', 'description', 'disabled', 'required', 'indeterminate', 'switch', 'checked', 'helper-text', 'error-text'];
  }

  private isChecked = false;

  get checked(): boolean {
    return this.isChecked;
  }

  set checked(checked: boolean) {
    this.isChecked = !!checked;
    const input = this.control() as HTMLInputElement | null;
    if (input) {
      input.checked = this.isChecked;
      input.indeterminate = false;
    }
    this.syncFormValue();
  }

  /** `true`/`false`, or the configured `value` string when checked (`''` when not). */
  get value(): any {
    const onValue = this.getAttribute('value');
    if (onValue === null) return this.isChecked;
    return this.isChecked ? onValue : '';
  }

  set value(value: any) {
    // Setting a boolean toggles; a string sets the submitted value
    if (typeof value === 'boolean') this.checked = value;
    else if (value !== null && value !== undefined) this.setAttribute('value', String(value));
  }

  toggle(force?: boolean): void {
    this.checked = force ?? !this.isChecked;
    this.changed();
  }

  setChecked(checked: boolean): void {
    this.checked = checked;
  }

  protected defaultValue(): any {
    return false;
  }

  reset(): void {
    super.reset();
    this.checked = false;
  }

  protected syncFormValue(): void {
    this.internals?.setFormValue(this.isChecked ? (this.getAttribute('value') ?? 'on') : null);
  }

  protected changed(): void {
    this.syncFormValue();
    if (this.touched) this.showError(this.validationMessage());
    this.emit('change', { value: this.value, checked: this.isChecked });
  }

  protected onAttributeChange(name: string, _old: string | null, value: string | null): void {
    if (name === 'checked') this.checked = value !== null && value !== 'false';
  }

  protected render(): string {
    const label = this.getProp<string>('label', '');
    const description = this.getProp<string>('description', '');
    const isSwitch = this.getProp('switch', false);
    const disabled = this.getProp('disabled', false);

    return this.renderField(`
      <label class="nx-check ${isSwitch ? 'switch' : 'box'}" part="control">
        <input type="checkbox" id="${this.fieldId}" part="input"
               ${isSwitch ? 'role="switch"' : ''}
               ${this.isChecked ? 'checked' : ''}
               ${disabled ? 'disabled' : ''}
               ${this.getProp('required', false) ? 'required' : ''}
               aria-describedby="${this.fieldId}-help">
        <span class="indicator" aria-hidden="true">
          ${isSwitch ? '<span class="thumb"></span>' : `
            <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            <svg class="dash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M5 12h14"/></svg>
          `}
        </span>
        ${label || description ? `
          <span class="text">
            ${label ? `<span class="label" part="label">${escapeHTML(label)}</span>` : ''}
            ${description ? `<span class="description" part="description">${escapeHTML(description)}</span>` : ''}
          </span>
        ` : '<slot></slot>'}
      </label>
    `, { inlineLabel: true });
  }

  protected afterRender(): void {
    super.afterRender();
    const input = this.control() as HTMLInputElement;
    if (this.getProp('indeterminate', false) && !this.isChecked) input.indeterminate = true;
    this.on(input, 'change', () => {
      this.isChecked = input.checked;
      this.changed();
    });
  }

  protected styles(): string {
    return `
      ${this.fieldStyles()}

      :host { display: block; }

      .nx-check {
        display: inline-flex;
        align-items: flex-start;
        gap: 0.625rem;
        cursor: pointer;
        user-select: none;
      }

      .disabled .nx-check { cursor: not-allowed; }

      input {
        position: absolute;
        opacity: 0;
        width: 1px;
        height: 1px;
        margin: 0;
        pointer-events: none;
      }

      .indicator {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-top: 0.0625rem;
        transition: background var(--transition-duration), border-color var(--transition-duration), box-shadow var(--transition-duration);
      }

      input:focus-visible + .indicator {
        box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring);
      }

      /* Checkbox */
      .box .indicator {
        width: 1.125rem;
        height: 1.125rem;
        border: 1px solid var(--color-border);
        border-radius: 0.3rem;
        background: var(--color-background);
        color: var(--color-primary-foreground);
        box-shadow: var(--shadow-sm);
      }

      .box:hover .indicator { border-color: var(--color-text-secondary); }

      .box input:checked + .indicator,
      .box input:indeterminate + .indicator {
        background: var(--color-primary);
        border-color: var(--color-primary);
      }

      .tick, .dash {
        position: absolute;
        width: 0.75rem;
        height: 0.75rem;
        opacity: 0;
        transform: scale(0.6);
        transition: opacity var(--transition-duration), transform var(--transition-duration);
      }

      input:checked + .indicator .tick,
      input:indeterminate + .indicator .dash {
        opacity: 1;
        transform: none;
      }

      /* Switch */
      .switch .indicator {
        width: 2.25rem;
        height: 1.25rem;
        padding: 0.125rem;
        justify-content: flex-start;
        border-radius: 9999px;
        background: var(--color-border);
      }

      .switch input:checked + .indicator {
        background: var(--color-primary);
      }

      .thumb {
        width: 1rem;
        height: 1rem;
        border-radius: 9999px;
        background: var(--color-background);
        box-shadow: var(--shadow-md);
        transition: transform 200ms var(--transition-easing);
      }

      .switch input:checked + .indicator .thumb {
        transform: translateX(1rem);
      }

      .text {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
      }

      .label {
        font-weight: 500;
        line-height: 1.25rem;
      }

      .description {
        color: var(--color-text-secondary);
        font-size: 0.8125rem;
      }

      .invalid .box .indicator { border-color: var(--color-error); }
    `;
  }
}

define('nx-checkbox', NXCheckbox);

ComponentRegistry.registerFactory('switch', ({ items: _items, ...config } = {}) =>
  ComponentRegistry.build({ ...config, switch: true, xtype: 'checkbox' }) as any
);
ComponentRegistry.registerFactory('toggle', ({ items: _items, ...config } = {}) =>
  ComponentRegistry.build({ ...config, switch: true, xtype: 'checkbox' }) as any
);
