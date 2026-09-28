/**
 * @file @/components/ui/form/field.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * Shared base for form fields: label, helper/error text, validation and
 * form association. Fields render once and then patch the DOM in place, so
 * typing never re-renders (and never loses focus).
 */
import { BaseComponent } from '@/components/abstracts/base';

export type Validator = (value: any, field: NXField) => string | true | null | undefined | void;

export interface FieldConfig {
  name?: string;
  label?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  /** Return an error message, or nothing when valid */
  validator?: Validator;
  onChange?: (e: CustomEvent<{ value: any }>) => void;
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

let fieldSeq = 0;

/** Every Nexaro form field tag, HTML aliases included (for `matches()`/`querySelector()`). */
export const FIELD_TAGS = 'nx-textfield, nx-input, nx-textarea, nx-select, nx-checkbox, nx-switch, nx-radio-group, nx-combobox';

export abstract class NXField extends BaseComponent {
  static formAssociated = true;

  protected internals: ElementInternals | null = null;
  protected touched = false;
  protected readonly fieldId = `f${++fieldSeq}`;

  /** What the user typed into server-rendered HTML before this element upgraded. */
  protected serverState: { value?: string; checked?: boolean } | null = null;

  constructor() {
    super();
    // A declarative shadow root (server rendering) is readable until attachShadow() clears it
    const ssrControl = this.shadowRoot?.querySelector('input, select, textarea') as HTMLInputElement | null;
    if (ssrControl?.type === 'radio') {
      const checked = this.shadowRoot!.querySelector('input[type=radio]:checked') as HTMLInputElement | null;
      this.serverState = { value: checked?.value ?? '' };
    } else if (ssrControl) {
      this.serverState = ssrControl.type === 'checkbox' ? { checked: ssrControl.checked } : { value: ssrControl.value };
    }
    this.attachShadow({ mode: 'open', delegatesFocus: true });
    try {
      const internals = this.attachInternals();
      // Partial implementations (older browsers, jsdom) lack the form APIs
      this.internals = typeof internals.setFormValue === 'function' ? internals : null;
    } catch {
      this.internals = null;
    }

    // A native <form> found this field invalid on submit: show why
    this.addEventListener('invalid', () => {
      this.touched = true;
      this.showError(this.validationMessage());
    });
  }

  /** The `<form>` this field belongs to (native forms, not `<nx-form>`). */
  get form(): HTMLFormElement | null {
    return this.internals?.form ?? null;
  }

  protected initializeState(): void {}

  protected initialize(): void {
    // Keep input typed before hydration (it wins over the server-rendered value)
    if (this.serverState?.value !== undefined) this.value = this.serverState.value;
    super.initialize();
  }

  /** Current value */
  abstract get value(): any;
  abstract set value(value: any);

  /** The native control inside the shadow root */
  protected control(): Control | null {
    return this.$('input, select, textarea') as Control | null;
  }

  get name(): string {
    return this.getAttribute('name') ?? '';
  }

  getValue(): any {
    return this.value;
  }

  setValue(value: any): void {
    this.value = value;
  }

  setValidator(validator: Validator): void {
    this.setProp('validator', validator);
  }

  /** Run validation, show the error (if any) and return validity. */
  validate(): boolean {
    this.touched = true;
    const message = this.validationMessage();
    this.showError(message);
    return !message;
  }

  /** Validation message without touching the UI; '' when valid. */
  validationMessage(): string {
    const control = this.control();
    const validator = this.getProp<Validator>('validator');
    const custom = typeof validator === 'function' ? validator(this.value, this) : null;
    const customMessage = typeof custom === 'string' ? custom : '';

    if (control) {
      control.setCustomValidity(customMessage);
      if (!control.checkValidity()) {
        this.internals?.setValidity({ customError: true }, control.validationMessage, control);
        return control.validationMessage || 'Invalid value';
      }
    } else if (customMessage) {
      return customMessage;
    }

    this.internals?.setValidity({});
    return '';
  }

  /** Clear value and validation state. */
  reset(): void {
    this.touched = false;
    this.value = this.defaultValue();
    this.showError('');
  }

  protected defaultValue(): any {
    return '';
  }

  focus(options?: FocusOptions): void {
    this.control()?.focus(options);
  }

  blur(): void {
    this.control()?.blur();
  }

  /** Forms call this when their `reset()` runs. */
  formResetCallback(): void {
    this.reset();
  }

  formDisabledCallback(disabled: boolean): void {
    this.toggleAttribute('disabled', disabled);
  }

  /** Browsers restore form state (back/forward, autofill) through this. */
  formStateRestoreCallback(state: unknown): void {
    if (typeof state === 'string') this.value = state;
  }

  /** What this field submits with a native form; `null` submits nothing. */
  formValue(): string | FormData | null {
    const value = this.value;
    if (value === null || value === undefined) return null;
    if (!Array.isArray(value)) return String(value);
    // Repeated entries, like <select multiple>
    const data = new FormData();
    value.forEach(item => data.append(this.name, String(item)));
    return data;
  }

  /** Keep the native form value and validity in sync, so `<form>` posts and validates it. */
  protected syncFormValue(): void {
    if (!this.internals) return;
    this.internals.setFormValue(this.formValue());
    this.validationMessage();
  }

  /** Enter in a single-line field submits the surrounding form, like native inputs. */
  protected implicitSubmit(): void {
    const nxForm = this.closest('nx-form');
    if (nxForm) nxForm.dispatchEvent(new CustomEvent('nx-field-enter', { bubbles: false }));
    else this.form?.requestSubmit();
  }

  /** Called by subclasses when the user changed the value. */
  protected changed(): void {
    this.syncFormValue();
    if (this.touched) this.showError(this.validationMessage());
    this.emit('change', { value: this.value });
  }

  protected showError(message: string): void {
    const helper = this.$('.nx-field-helper') as HTMLElement | null;
    const wrapper = this.$('.nx-field');
    const helperText = this.getProp<string>('helper-text', '');
    const errorText = this.getProp<string>('error-text', '');
    const text = errorText || message || helperText;
    wrapper?.classList.toggle('invalid', !!(errorText || message));
    this.control()?.setAttribute('aria-invalid', String(!!(errorText || message)));
    if (helper) {
      helper.textContent = text;
      helper.hidden = !text;
    }
  }

  /** Wrap a control with label and helper/error text. */
  protected renderField(control: Node, options: { inlineLabel?: boolean } = {}): Node {
    const label = this.getProp<string>('label');
    const helperText = this.getProp<string>('helper-text', '');
    const errorText = this.getProp<string>('error-text', '');
    const text = errorText || helperText;

    return (
      <div part="field" class={['nx-field', { invalid: errorText, disabled: this.getProp('disabled', false) }]}
           // Validate once the user leaves the field
           onFocusOut={() => {
             this.touched = true;
             this.showError(this.validationMessage());
           }}>
        {label && !options.inlineLabel && (
          <label class="nx-field-label" part="label" for={this.fieldId}>
            {label}{this.getProp('required', false) && <span class="required" aria-hidden="true">*</span>}
          </label>
        )}
        {control}
        <div class="nx-field-helper" part="helper" id={`${this.fieldId}-help`} hidden={!text}>{text}</div>
      </div>
    );
  }

  protected afterRender(): void {
    this.syncFormValue();
  }

  protected fieldStyles(): string {
    return `
      :host {
        display: block;
        font-size: 0.875rem;
      }

      .nx-field {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }

      .nx-field-label {
        font-weight: 500;
        color: var(--color-text);
        line-height: 1.25;
      }

      .required {
        margin-left: 0.125rem;
        color: var(--color-error);
      }

      .nx-field-helper {
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
      }

      .nx-field-helper[hidden] {
        display: none;
      }

      .invalid .nx-field-helper {
        color: var(--color-error-text);
      }

      .disabled {
        opacity: 0.6;
      }

      .nx-control {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 2.25rem;
        padding: 0 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-background);
        color: var(--color-text);
        box-shadow: var(--shadow-sm);
        transition: border-color var(--transition-duration), box-shadow var(--transition-duration);
      }

      .nx-control:focus-within {
        border-color: var(--color-ring);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-ring) 25%, transparent);
      }

      .invalid .nx-control {
        border-color: var(--color-error);
      }

      .invalid .nx-control:focus-within {
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error) 20%, transparent);
      }

      .disabled .nx-control {
        cursor: not-allowed;
        background: var(--color-muted);
      }

      .nx-control input,
      .nx-control select,
      .nx-control textarea {
        flex: 1;
        min-width: 0;
        height: 100%;
        min-height: 2.125rem;
        padding: 0;
        border: none;
        outline: none;
        background: transparent;
        color: inherit;
        font: inherit;
      }

      .nx-control :disabled {
        cursor: not-allowed;
      }

      .nx-control-icon {
        display: inline-flex;
        flex-shrink: 0;
        color: var(--color-text-secondary);
        font-size: 1rem;
      }

      .size-sm .nx-control { min-height: 2rem; font-size: 0.8125rem; }
      .size-sm .nx-control :is(input, select) { min-height: 1.875rem; }
      .size-lg .nx-control { min-height: 2.75rem; font-size: 0.9375rem; }
      .size-lg .nx-control :is(input, select) { min-height: 2.625rem; }
    `;
  }
}
