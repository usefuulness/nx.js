import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface TextFieldConfig {
  name?: string;
  value?: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number' | 'search';
  placeholder?: string;
  label?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  maxLength?: number;
  pattern?: string;
  variant?: 'outlined' | 'filled' | 'underlined';
  size?: 'sm' | 'md' | 'lg';
  prefixIcon?: string;
  suffixIcon?: string;
  clearable?: boolean;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
}

export class NXTextField extends BaseComponent {
  static get observedAttributes(): string[] {
    return [
      'name', 'value', 'type', 'placeholder', 'label', 'helper-text', 
      'error-text', 'required', 'disabled', 'readonly', 'maxlength', 
      'pattern', 'variant', 'size', 'clearable'
    ];
  }

  protected initializeState(): void {
    this[ComponentState].set('value', '');
    this[ComponentState].set('focused', false);
    this[ComponentState].set('touched', false);
    this[ComponentState].set('error', '');
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected render(): string {
    const name = this.getProp('name', '');
    const value = this.getState('value', '');
    const type = this.getProp('type', 'text');
    const placeholder = this.getProp('placeholder', '');
    const label = this.getProp('label');
    const helperText = this.getProp('helper-text');
    const errorText = this.getProp('error-text') || this.getState('error');
    const required = this.getProp('required', false);
    const disabled = this.getProp('disabled', false);
    const readonly = this.getProp('readonly', false);
    const maxLength = this.getProp('maxlength');
    const pattern = this.getProp('pattern');
    const variant = this.getProp('variant', 'outlined');
    const size = this.getProp('size', 'md');
    const clearable = this.getProp('clearable', false);
    const focused = this.getState('focused', false);
    const hasValue = !!value;

    const fieldClasses = [
      'nx-textfield',
      `variant-${variant}`,
      `size-${size}`,
      focused ? 'focused' : '',
      hasValue ? 'has-value' : '',
      errorText ? 'has-error' : '',
      disabled ? 'disabled' : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="${fieldClasses}" part="container">
        ${label ? `
          <label class="nx-textfield-label" part="label" for="input">
            ${label}
            ${required ? '<span class="required">*</span>' : ''}
          </label>
        ` : ''}
        
        <div class="nx-textfield-input-wrapper" part="input-wrapper">
          <slot name="prefix"></slot>
          
          <input
            id="input"
            part="input"
            class="nx-textfield-input"
            type="${type}"
            name="${name}"
            value="${value}"
            placeholder="${placeholder}"
            ${required ? 'required' : ''}
            ${disabled ? 'disabled' : ''}
            ${readonly ? 'readonly' : ''}
            ${maxLength ? `maxlength="${maxLength}"` : ''}
            ${pattern ? `pattern="${pattern}"` : ''}
          >
          
          ${clearable && hasValue && !disabled && !readonly ? `
            <button type="button" class="nx-textfield-clear" part="clear" tabindex="-1">
              <svg viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          ` : ''}
          
          <slot name="suffix"></slot>
        </div>
        
        ${helperText || errorText ? `
          <div class="nx-textfield-helper ${errorText ? 'error' : ''}" part="helper">
            ${errorText || helperText}
          </div>
        ` : ''}
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        display: block;
      }

      * {
        box-sizing: border-box;
      }

      .nx-textfield {
        position: relative;
      }

      .nx-textfield-label {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text-color);
      }

      .required {
        color: var(--color-danger);
        margin-left: 0.25rem;
      }

      .nx-textfield-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .nx-textfield-input {
        flex: 1;
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border-color);
        border-radius: 0.25rem;
        font-family: inherit;
        font-size: 1rem;
        background: var(--bg-color);
        color: var(--text-color);
        transition: all 0.2s;
      }

      /* Sizes */
      .size-sm .nx-textfield-input {
        padding: 0.375rem 0.625rem;
        font-size: 0.875rem;
      }

      .size-lg .nx-textfield-input {
        padding: 0.75rem 1rem;
        font-size: 1.125rem;
      }

      /* Variants */
      .variant-filled .nx-textfield-input {
        background: var(--surface-color);
        border-color: transparent;
        border-bottom-color: var(--border-color);
      }

      .variant-underlined .nx-textfield-input {
        border: none;
        border-bottom: 1px solid var(--border-color);
        border-radius: 0;
        padding-left: 0;
        padding-right: 0;
      }

      /* States */
      .nx-textfield-input:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      .variant-filled .nx-textfield-input:focus {
        border-bottom-color: var(--color-primary);
      }

      .has-error .nx-textfield-input {
        border-color: var(--color-danger);
      }

      .disabled .nx-textfield-input {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Clear button */
      .nx-textfield-clear {
        position: absolute;
        right: 0.5rem;
        padding: 0.25rem;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--text-color-secondary);
        transition: color 0.2s;
      }

      .nx-textfield-clear:hover {
        color: var(--text-color);
      }

      .nx-textfield-clear svg {
        width: 1rem;
        height: 1rem;
        fill: currentColor;
      }

      /* Helper text */
      .nx-textfield-helper {
        margin-top: 0.25rem;
        font-size: 0.75rem;
        color: var(--text-color-secondary);
      }

      .nx-textfield-helper.error {
        color: var(--color-danger);
      }

      /* With prefix/suffix */
      ::slotted([slot="prefix"]),
      ::slotted([slot="suffix"]) {
        flex-shrink: 0;
        margin: 0 0.5rem;
      }
    `;
  }

  protected afterRender(): void {
    const input = this.$('input') as HTMLInputElement;
    if (input) {
      this.on(input, 'input', () => {
        this.setState('value', input.value);
        this.validateInput();
        this.emit('input', { value: input.value });
      });

      this.on(input, 'change', () => {
        this.emit('change', { value: input.value });
      });

      this.on(input, 'focus', () => {
        this.setState('focused', true);
        this.emit('focus');
      });

      this.on(input, 'blur', () => {
        this.setState('focused', false);
        this.setState('touched', true);
        this.validateInput();
        this.emit('blur');
      });
    }

    const clearBtn = this.$('.nx-textfield-clear');
    if (clearBtn) {
      this.on(clearBtn, 'click', () => {
        this.setValue('');
        input?.focus();
      });
    }
  }

  private validateInput(): void {
    const input = this.$('input') as HTMLInputElement;
    if (input && !input.checkValidity()) {
      this.setState('error', input.validationMessage);
    } else {
      this.setState('error', '');
    }
  }

  getValue(): string {
    return this.getState('value', '');
  }

  setValue(value: string): void {
    this.setState('value', value);
    const input = this.$('input') as HTMLInputElement;
    if (input) {
      input.value = value;
    }
  }

  focus(): void {
    const input = this.$('input') as HTMLInputElement;
    input?.focus();
  }

  blur(): void {
    const input = this.$('input') as HTMLInputElement;
    input?.blur();
  }

  protected onAttributeChange(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'value' && newValue !== null) {
      this.setValue(newValue);
    }
  }
}

customElements.define('nx-textfield', NXTextField);
