/**
 * @file @/components/ui/form/radio.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { define } from '@/core/registry';
import { NXField, type FieldConfig } from '@/components/ui/form/field';
import { normalizeOptions, type SelectOption } from '@/components/ui/form/select';

export interface RadioOption extends SelectOption {
  /** Secondary line under the option text */
  description?: string;
}

export interface RadioGroupConfig extends FieldConfig {
  value?: string | number;
  /** Options as objects, plain strings, or a `{ value: text }` map */
  options?: Array<RadioOption | string> | Record<string, string>;
  orientation?: 'vertical' | 'horizontal';
  /** `cards` draws each option as a bordered, selectable card */
  variant?: 'default' | 'cards';
  errorText?: string;
}

/**
 * Radio group: pick one of a few options. Native radios inside, so arrow keys,
 * form posting and validation (`required`) behave like HTML.
 *
 * @example
 * ```typescript
 * { xtype: 'radio', name: 'plan', label: 'Plan', value: 'pro', options: { free: 'Free', pro: 'Pro' } }
 * ```
 * ```html
 * <nx-radio-group name="plan" label="Plan" value="pro" variant="cards">
 *   <option value="free" data-description="For side projects">Free</option>
 *   <option value="pro" data-description="For teams">Pro</option>
 * </nx-radio-group>
 * ```
 */
export class NXRadioGroup extends NXField {
  static get observedAttributes(): string[] {
    return ['name', 'label', 'helper-text', 'error-text', 'required', 'disabled', 'orientation', 'variant', 'value'];
  }

  private options: RadioOption[] = [];
  private currentValue = '';
  private childOptions = false;
  private observer: MutationObserver | null = null;

  get value(): string {
    return this.currentValue;
  }

  set value(value: string | number | null | undefined) {
    this.currentValue = value === null || value === undefined ? '' : String(value);
    this.syncSelection();
    this.syncFormValue();
  }

  setOptions(options: RadioGroupConfig['options']): void {
    this.childOptions = false;
    this.options = normalizeOptions(options);
    this.scheduleUpdate();
  }

  getOptions(): RadioOption[] {
    return this.options;
  }

  formValue(): string | null {
    return this.currentValue === '' ? null : this.currentValue;
  }

  /** Focus the checked option (or the first), like a native radio group. */
  focus(options?: FocusOptions): void {
    (this.checkedInput() ?? this.control())?.focus(options);
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

  private checkedInput(): HTMLInputElement | null {
    return this.$('input:checked') as HTMLInputElement | null;
  }

  private syncSelection(): void {
    this.$$('input').forEach(input => ((input as HTMLInputElement).checked = (input as HTMLInputElement).value === this.currentValue));
  }

  /** HTML usage: `<option>` children (`data-description` for a second line). */
  private readChildOptions(): void {
    if (this.options.length && !this.childOptions) return;
    const children = Array.from(this.querySelectorAll('option'));
    if (!children.length) return;
    this.childOptions = true;
    this.options = children.map(o => ({
      value: o.value,
      text: o.textContent ?? o.value,
      disabled: o.disabled,
      description: o.dataset.description
    }));
    if (!this.currentValue) this.currentValue = children.find(o => o.hasAttribute('selected'))?.value ?? '';
  }

  protected afterConnect(): void {
    this.observer ??= new MutationObserver(() => {
      if (this.childOptions || !this.options.length) this.scheduleUpdate();
    });
    this.observer.observe(this, { childList: true, subtree: true, characterData: true, attributes: true });
  }

  protected beforeDisconnect(): void {
    this.observer?.disconnect();
  }

  protected afterRender(): void {
    this.syncSelection();
    super.afterRender();
  }

  protected render(): Node {
    this.readChildOptions();
    const label = this.getProp<string>('label');
    const required = !!this.getProp('required', false);
    const disabled = !!this.getProp('disabled', false);

    return this.renderField(
      <div part="control" role="radiogroup" class="nx-radio-group"
           aria-labelledby={label ? `${this.fieldId}-label` : undefined}
           aria-describedby={`${this.fieldId}-help`} aria-required={required ? 'true' : undefined}>
        {label && (
          <span class="nx-field-label" part="label" id={`${this.fieldId}-label`}>
            {label}{required && <span class="required" aria-hidden="true">*</span>}
          </span>
        )}
        <div part="options" class={['options', this.getProp('orientation', 'vertical'), this.getProp('variant', 'default')]}>
          {this.options.map((option, i) => (
            <label part="option" class={['option', { disabled: disabled || option.disabled }]}>
              <input type="radio" id={i === 0 ? this.fieldId : undefined} name={this.fieldId} value={String(option.value)}
                     checked={String(option.value) === this.currentValue} required={required}
                     disabled={disabled || !!option.disabled}
                     onChange={(e: Event) => {
                       this.currentValue = (e.target as HTMLInputElement).value;
                       this.changed();
                     }} />
              <span class="indicator" aria-hidden="true" />
              <span class="text">
                <span class="option-label">{option.text}</span>
                {option.description && <span class="description">{option.description}</span>}
              </span>
            </label>
          ))}
        </div>
      </div>,
      { inlineLabel: true }
    );
  }

  protected styles(): string {
    return `
      ${this.fieldStyles()}

      .nx-radio-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .options {
        display: flex;
        flex-direction: column;
        gap: 0.625rem;
      }

      .options.horizontal {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 0.625rem 1.25rem;
      }

      .option {
        display: inline-flex;
        align-items: flex-start;
        gap: 0.625rem;
        cursor: pointer;
        user-select: none;
      }

      .option.disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

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
        flex-shrink: 0;
        width: 1.125rem;
        height: 1.125rem;
        margin-top: 0.0625rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        background: var(--color-background);
        box-shadow: var(--shadow-sm);
        transition: border-color var(--transition-duration), box-shadow var(--transition-duration);
      }

      .indicator::after {
        content: '';
        position: absolute;
        inset: 0.25rem;
        border-radius: var(--radius-full);
        background: var(--color-primary);
        transform: scale(0);
        transition: transform var(--transition-duration) var(--transition-easing);
      }

      .option:hover .indicator { border-color: var(--color-text-secondary); }
      input:checked + .indicator { border-color: var(--color-primary); }
      input:checked + .indicator::after { transform: scale(1); }

      input:focus-visible + .indicator {
        box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring);
      }

      .text {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
      }

      .option-label {
        font-weight: 500;
        line-height: 1.25rem;
      }

      .description {
        color: var(--color-text-secondary);
        font-size: 0.8125rem;
      }

      /* Cards */
      .cards .option {
        flex: 1 1 12rem;
        padding: 0.875rem 1rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        transition: border-color var(--transition-duration), box-shadow var(--transition-duration);
      }

      .cards .option:hover { border-color: var(--color-text-secondary); }
      .cards .option:has(input:checked) {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 1px var(--color-primary);
      }

      .invalid .indicator { border-color: var(--color-error); }
    `;
  }
}

define('nx-radio-group', NXRadioGroup);

