// src/components/form/textfield.ts
import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface TextFieldConfig {
  name?: string;
  value?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'search' | 'number';
  label?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  autocomplete?: string;
  prefix?: string;
  suffix?: string;
  icon?: string;
  clearable?: boolean;
  showPasswordToggle?: boolean;
  variant?: 'outlined' | 'filled' | 'underlined';
  size?: 'sm' | 'md' | 'lg';
  onChange?: (value: string) => void;
  onEnter?: (value: string) => void;
}

/**
 * Text field component with validation and styling
 */
export class NXTextField extends BaseComponent {
  static get observedAttributes(): string[] {
    return [
      'name', 'value', 'placeholder', 'type', 'label', 'helper-text', 'error-text',
      'required', 'disabled', 'readonly', 'maxlength', 'minlength', 'pattern',
      'autocomplete', 'prefix', 'suffix', 'icon', 'clearable', 'show-password-toggle',
      'variant', 'size'
    ];
  }

  protected initializeState(): void {
    this[ComponentState].set('value', '');
    this[ComponentState].set('focused', false);
    this[ComponentState].set('showPassword', false);
    this[ComponentState].set('touched', false);
    this[ComponentState].set('errors', []);
  }

  constructor(config?: TextFieldConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    
    if (config) {
      this.configure(config);
    }
  }

  configure(config: TextFieldConfig): void {
    Object.entries(config).forEach(([key, value]) => {
      if (key === 'onChange' || key === 'onEnter') {
        this[ComponentState].set(key, value);
      } else {
        const attrName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        this.setAttribute(attrName, String(value));
      }
    });
  }

  protected render(): string {
    const type = this.getProp('type', 'text');
    const label = this.getProp('label');
    const placeholder = this.getProp('placeholder', '');
    const helperText = this.getProp('helper-text');
    const errorText = this.getProp('error-text');
    const required = this.getProp('required', false);
    const disabled = this.getProp('disabled', false);
    const readonly = this.getProp('readonly', false);
    const prefix = this.getProp('prefix');
    const suffix = this.getProp('suffix');
    const icon = this.getProp('icon');
    const clearable = this.getProp('clearable', false);
    const showPasswordToggle = this.getProp('show-password-toggle', false);
    const variant = this.getProp('variant', 'outlined');
    const size = this.getProp('size', 'md');
    
    const value = this.getState('value', this.getProp('value', ''));
    const focused = this.getState('focused', false);
    const showPassword = this.getState('showPassword', false);
    const hasValue = value && value.length > 0;
    const hasError = !!errorText || this.getState('errors', []).length > 0;

    const inputType = type === 'password' && showPassword ? 'text' : type;

    return `
      <div class="nx-field nx-field-${variant} nx-field-${size} 
                  ${focused ? 'focused' : ''} 
                  ${hasValue ? 'has-value' : ''} 
                  ${hasError ? 'has-error' : ''}
                  ${disabled ? 'disabled' : ''}"
           part="field">
        ${label ? `
          <label class="nx-field-label" part="label">
            ${label}
            ${required ? '<span class="nx-field-required">*</span>' : ''}
          </label>
        ` : ''}
        
        <div class="nx-field-wrapper" part="wrapper">
          ${icon ? `
            <span class="nx-field-icon nx-field-icon-leading" part="icon">
              ${this.renderIcon(icon)}
            </span>
          ` : ''}
          
          ${prefix ? `
            <span class="nx-field-addon nx-field-prefix" part="prefix">
              ${prefix}
            </span>
          ` : ''}
          
          <input class="nx-field-input"
                 part="input"
                 type="${inputType}"
                 name="${this.getProp('name', '')}"
                 placeholder="${placeholder}"
                 value="${value}"
                 ${required ? 'required' : ''}
                 ${disabled ? 'disabled' : ''}
                 ${readonly ? 'readonly' : ''}
                 ${this.getProp('maxlength') ? `maxlength="${this.getProp('maxlength')}"` : ''}
                 ${this.getProp('minlength') ? `minlength="${this.getProp('minlength')}"` : ''}
                 ${this.getProp('pattern') ? `pattern="${this.getProp('pattern')}"` : ''}
                 ${this.getProp('autocomplete') ? `autocomplete="${this.getProp('autocomplete')}"` : ''}
                 aria-label="${label || placeholder}"
                 aria-invalid="${hasError}"
                 aria-describedby="${helperText || errorText ? 'helper-text' : ''}">
          
          ${suffix ? `
            <span class="nx-field-addon nx-field-suffix" part="suffix">
              ${suffix}
            </span>
          ` : ''}
          
          <div class="nx-field-actions">
            ${clearable && hasValue && !disabled ? `
              <button class="nx-field-action nx-field-clear" 
                      type="button"
                      aria-label="Clear"
                      part="clear-button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M15 9l-6 6M9 9l6 6"/>
                </svg>
              </button>
            ` : ''}
            
            ${showPasswordToggle && type === 'password' ? `
              <button class="nx-field-action nx-field-toggle-password" 
                      type="button"
                      aria-label="${showPassword ? 'Hide password' : 'Show password'}"
                      part="password-toggle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  ${showPassword ? `
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  ` : `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  `}
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
        
        ${helperText || errorText ? `
          <div class="nx-field-helper ${hasError ? 'error' : ''}" 
               id="helper-text"
               part="helper-text">
            ${errorText || helperText}
          </div>
        ` : ''}
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        --field-height: 2.5rem;
        --field-padding: 0.5rem 0.75rem;
        --field-font-size: 0.875rem;
        --field-border-width: 1px;
        --field-border-color: var(--color-border);
        --field-border-focus: var(--color-primary);
        --field-bg: var(--color-surface);
        --field-radius: var(--radius-md);
        --field-gap: 0.5rem;
        display: block;
      }

      /* Field container */
      .nx-field {
        display: flex;
        flex-direction: column;
        gap: var(--field-gap);
      }

      /* Sizes */
      .nx-field-sm {
        --field-height: 2rem;
        --field-padding: 0.375rem 0.625rem;
        --field-font-size: 0.8125rem;
      }

      .nx-field-lg {
        --field-height: 3rem;
        --field-padding: 0.625rem 1rem;
        --field-font-size: 1rem;
      }

      /* Label */
      .nx-field-label {
        font-size: var(--field-font-size);
        font-weight: 500;
        color: var(--color-text);
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .nx-field-required {
        color: var(--color-error);
      }

      /* Wrapper */
      .nx-field-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        height: var(--field-height);
        background: var(--field-bg);
        border: var(--field-border-width) solid var(--field-border-color);
        border-radius: var(--field-radius);
        transition: all 0.2s;
        overflow: hidden;
      }

      .nx-field.focused .nx-field-wrapper {
        border-color: var(--field-border-focus);
        outline: 2px solid rgba(59, 130, 246, 0.2);
        outline-offset: -1px;
      }

      .nx-field.has-error .nx-field-wrapper {
        border-color: var(--color-error);
      }

      .nx-field.disabled .nx-field-wrapper {
        opacity: 0.6;
        cursor: not-allowed;
        background: var(--color-background);
      }

      /* Variants */
      .nx-field-filled .nx-field-wrapper {
        background: var(--color-background);
        border-color: transparent;
        border-bottom-color: var(--field-border-color);
        border-radius: var(--field-radius) var(--field-radius) 0 0;
      }

      .nx-field-underlined .nx-field-wrapper {
        background: transparent;
        border: none;
        border-bottom: var(--field-border-width) solid var(--field-border-color);
        border-radius: 0;
      }

      /* Input */
      .nx-field-input {
        flex: 1;
        height: 100%;
        padding: var(--field-padding);
        background: transparent;
        border: none;
        font-size: var(--field-font-size);
        font-family: inherit;
        color: var(--color-text);
        outline: none;
      }

      .nx-field-input::placeholder {
        color: var(--color-text-secondary);
        opacity: 0.8;
      }

      .nx-field-input:disabled {
        cursor: not-allowed;
      }

      /* Remove number input spinners */
      .nx-field-input[type="number"]::-webkit-inner-spin-button,
      .nx-field-input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      .nx-field-input[type="number"] {
        -moz-appearance: textfield;
      }

      /* Icons and addons */
      .nx-field-icon,
      .nx-field-addon {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--color-text-secondary);
      }

      .nx-field-icon {
        width: var(--field-height);
        flex-shrink: 0;
      }

      .nx-field-addon {
        padding: 0 0.75rem;
        background: var(--color-background);
        border-right: 1px solid var(--field-border-color);
        font-size: var(--field-font-size);
      }

      .nx-field-suffix {
        border-right: none;
        border-left: 1px solid var(--field-border-color);
      }

      /* Actions */
      .nx-field-actions {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding-right: 0.5rem;
      }

      .nx-field-action {
        width: 1.5rem;
        height: 1.5rem;
        padding: 0.25rem;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        border-radius: var(--radius-sm);
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .nx-field-action:hover {
        background: var(--color-background);
        color: var(--color-text);
      }

      .nx-field-action svg {
        width: 100%;
        height: 100%;
      }

      /* Helper text */
      .nx-field-helper {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
        padding: 0 0.25rem;
      }

      .nx-field-helper.error {
        color: var(--color-error);
      }

      /* Floating label animation */
      .nx-field-outlined .nx-field-label {
        position: absolute;
        top: 50%;
        left: 0.75rem;
        transform: translateY(-50%);
        background: var(--field-bg);
        padding: 0 0.25rem;
        pointer-events: none;
        transition: all 0.2s;
      }

      .nx-field-outlined.focused .nx-field-label,
      .nx-field-outlined.has-value .nx-field-label {
        top: 0;
        transform: translateY(-50%);
        font-size: 0.75rem;
      }
    `;
  }

  private renderIcon(icon: string): string {
    if (icon.startsWith('<svg')) {
      return icon;
    } else if (icon.startsWith('icon-')) {
      return `<i class="${icon}"></i>`;
    } else {
      return icon;
    }
  }

  protected afterRender(): void {
    const input = this.$('.nx-field-input') as HTMLInputElement;
    if (!input) return;

    // Set initial value
    const value = this.getState('value', this.getProp('value', ''));
    if (value) {
      input.value = value;
    }

    // Input events
    input.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      this.setState('value', value);
      this.setState('touched', true);
      this.validate();
      
      const onChange = this.getState('onChange');
      if (onChange) onChange(value);
      
      this.dispatchEvent(new CustomEvent('change', { detail: { value } }));
    });

    // Focus events
    input.addEventListener('focus', () => {
      this.setState('focused', true);
      this.dispatchEvent(new CustomEvent('focus'));
    });

    input.addEventListener('blur', () => {
      this.setState('focused', false);
      this.setState('touched', true);
      this.validate();
      this.dispatchEvent(new CustomEvent('blur'));
    });

    // Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const value = (e.target as HTMLInputElement).value;
        const onEnter = this.getState('onEnter');
        if (onEnter) onEnter(value);
        this.dispatchEvent(new CustomEvent('enter', { detail: { value } }));
      }
    });

    // Clear button
    this.on('.nx-field-clear', 'click', () => {
      this.setState('value', '');
      input.value = '';
      input.focus();
      
      const onChange = this.getState('onChange');
      if (onChange) onChange('');
      
      this.dispatchEvent(new CustomEvent('clear'));
      this.dispatchEvent(new CustomEvent('change', { detail: { value: '' } }));
    });

    // Password toggle
    this.on('.nx-field-toggle-password', 'click', () => {
      const showPassword = !this.getState('showPassword', false);
      this.setState('showPassword', showPassword);
    });
  }

  private validate(): void {
    const input = this.$('.nx-field-input') as HTMLInputElement;
    if (!input) return;

    const errors: string[] = [];
    
    if (!input.validity.valid) {
      if (input.validity.valueMissing) {
        errors.push('This field is required');
      }
      if (input.validity.tooShort) {
        errors.push(`Minimum length is ${input.minLength}`);
      }
      if (input.validity.tooLong) {
        errors.push(`Maximum length is ${input.maxLength}`);
      }
      if (input.validity.typeMismatch) {
        errors.push(`Please enter a valid ${input.type}`);
      }
      if (input.validity.patternMismatch) {
        errors.push('Please match the requested format');
      }
    }
    
    this.setState('errors', errors);
    
    if (errors.length > 0 && !this.getProp('error-text')) {
      this.setAttribute('error-text', errors[0]);
    } else if (errors.length === 0 && !this.getProp('error-text')) {
      this.removeAttribute('error-text');
    }
    
    this.dispatchEvent(new CustomEvent('validate', { 
      detail: { valid: errors.length === 0, errors } 
    }));
  }

  // Public API
  getValue(): string {
    return this.getState('value', '');
  }

  setValue(value: string): void {
    this.setState('value', value);
    const input = this.$('.nx-field-input') as HTMLInputElement;
    if (input) input.value = value;
  }

  clear(): void {
    this.setValue('');
  }

  focus(): void {
    const input = this.$('.nx-field-input') as HTMLInputElement;
    input?.focus();
  }

  blur(): void {
    const input = this.$('.nx-field-input') as HTMLInputElement;
    input?.blur();
  }

  checkValidity(): boolean {
    const input = this.$('.nx-field-input') as HTMLInputElement;
    return input?.checkValidity() ?? true;
  }
}

customElements.define('nx-textfield', NXTextField);
