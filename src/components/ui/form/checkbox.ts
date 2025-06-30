import { BaseComponent, ComponentState } from "@/components/abstracts/base";

export interface CheckboxConfig {
  name?: string;
  value?: string;
  checked?: boolean;
  label?: string;
  disabled?: boolean;
  indeterminate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (checked: boolean) => void;
}

/**
 * Checkbox component
 */
export class NXCheckbox extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['name', 'value', 'checked', 'label', 'disabled', 'indeterminate', 'size'];
  }

  protected initializeState(): void {
    this[ComponentState].set('checked', false);
    this[ComponentState].set('indeterminate', false);
  }

  protected render(): string {
    const name = this.getProp('name', '');
    const value = this.getProp('value', '');
    const label = this.getProp('label', '');
    const disabled = this.getProp('disabled', false);
    const size = this.getProp('size', 'md');
    
    const checked = this.getState('checked', this.getProp('checked', false));
    const indeterminate = this.getState('indeterminate', this.getProp('indeterminate', false));

    return `
      <label class="nx-checkbox nx-checkbox-${size} ${disabled ? 'disabled' : ''}" part="checkbox">
        <input type="checkbox"
               class="nx-checkbox-input"
               name="${name}"
               value="${value}"
               ${checked ? 'checked' : ''}
               ${disabled ? 'disabled' : ''}
               ${indeterminate ? 'indeterminate' : ''}>
        <span class="nx-checkbox-box">
          <svg class="nx-checkbox-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            ${indeterminate ? 
              '<path d="M5 12h14"/>' : 
              '<path d="M20 6L9 17l-5-5"/>'
            }
          </svg>
        </span>
        ${label ? `<span class="nx-checkbox-label">${label}</span>` : ''}
      </label>
    `;
  }

  protected styles(): string {
    return `
      :host {
        --checkbox-size: 1.25rem;
        display: inline-block;
      }

      .nx-checkbox {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        user-select: none;
      }

      .nx-checkbox.disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      /* Sizes */
      .nx-checkbox-sm {
        --checkbox-size: 1rem;
        font-size: 0.875rem;
      }

      .nx-checkbox-lg {
        --checkbox-size: 1.5rem;
        font-size: 1rem;
      }

      .nx-checkbox-input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }

      .nx-checkbox-box {
        width: var(--checkbox-size);
        height: var(--checkbox-size);
        border: 2px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: var(--color-surface);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .nx-checkbox-input:checked + .nx-checkbox-box {
        background: var(--color-primary);
        border-color: var(--color-primary);
      }

      .nx-checkbox-input:focus + .nx-checkbox-box {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .nx-checkbox-check {
        width: calc(var(--checkbox-size) - 6px);
        height: calc(var(--checkbox-size) - 6px);
        color: white;
        opacity: 0;
        transform: scale(0);
        transition: all 0.2s;
      }

      .nx-checkbox-input:checked + .nx-checkbox-box .nx-checkbox-check,
      .nx-checkbox-input:indeterminate + .nx-checkbox-box .nx-checkbox-check {
        opacity: 1;
        transform: scale(1);
      }

      .nx-checkbox-label {
        color: var(--color-text);
      }
    `;
  }

  protected afterRender(): void {
    const input = this.$('.nx-checkbox-input') as HTMLInputElement;
    if (!input) return;

    // Set indeterminate state
    const indeterminate = this.getState('indeterminate', false);
    if (indeterminate) {
      input.indeterminate = true;
    }

    input.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.setState('checked', checked);
      this.setState('indeterminate', false);
      
      const onChange = this.getState('onChange');
      if (onChange) onChange(checked);
      
      this.dispatchEvent(new CustomEvent('change', { detail: { checked } }));
    });
  }

  // Public API
  isChecked(): boolean {
    return this.getState('checked', false);
  }

  setChecked(checked: boolean): void {
    this.setState('checked', checked);
    this.setState('indeterminate', false);
    const input = this.$('.nx-checkbox-input') as HTMLInputElement;
    if (input) input.checked = checked;
  }

  setIndeterminate(indeterminate: boolean): void {
    this.setState('indeterminate', indeterminate);
    const input = this.$('.nx-checkbox-input') as HTMLInputElement;
    if (input) input.indeterminate = indeterminate;
  }

  toggle(): void {
    this.setChecked(!this.isChecked());
  }
}

customElements.define('nx-checkbox', NXCheckbox);
