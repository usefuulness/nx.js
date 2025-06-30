import { BaseComponent, ComponentState } from "@/components/abstracts/base";

export interface SelectOption {
  value: string | number;
  text: string;
  disabled?: boolean;
  selected?: boolean;
  group?: string;
}

export interface SelectConfig {
  name?: string;
  value?: string | number | (string | number)[];
  options?: SelectOption[];
  placeholder?: string;
  label?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  disabled?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  variant?: 'outlined' | 'filled' | 'underlined';
  size?: 'sm' | 'md' | 'lg';
  onChange?: (value: string | number | (string | number)[]) => void;
}

export class NXSelect extends BaseComponent {
  static get observedAttributes(): string[] {
    return [
      'name', 'value', 'placeholder', 'label', 'helper-text', 'error-text',
      'required', 'disabled', 'multiple', 'searchable', 'clearable',
      'variant', 'size'
    ];
  }

  private options: SelectOption[] = [];

  protected initializeState(): void {
    this[ComponentState].set('value', null);
    this[ComponentState].set('open', false);
    this[ComponentState].set('searchQuery', '');
    this[ComponentState].set('highlightedIndex', -1);
    this[ComponentState].set('focused', false);
  }

  constructor(config?: SelectConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    if (config?.options) {
      this.setOptions(config.options);
    }
  }

  setOptions(options: SelectOption[]): void {
    this.options = options;
    this.scheduleUpdate();
  }

  protected render(): string {
    const name = this.getProp('name', '');
    const value = this.getState('value');
    const placeholder = this.getProp('placeholder', 'Select...');
    const label = this.getProp('label');
    const helperText = this.getProp('helper-text');
    const errorText = this.getProp('error-text');
    const required = this.getProp('required', false);
    const disabled = this.getProp('disabled', false);
    const multiple = this.getProp('multiple', false);
    const searchable = this.getProp('searchable', false);
    const clearable = this.getProp('clearable', false);
    const variant = this.getProp('variant', 'outlined');
    const size = this.getProp('size', 'md');
    const open = this.getState('open', false);
    const searchQuery = this.getState<string>('searchQuery', '');
    const focused = this.getState('focused', false);

    const selectedOptions = this.getSelectedOptions();
    const displayText = selectedOptions.length > 0 
      ? selectedOptions.map(opt => opt.text).join(', ')
      : '';

    const filteredOptions = searchable && searchQuery
      ? this.options.filter(opt => 
          opt.text.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : this.options;

    const selectClasses = [
      'nx-select',
      `variant-${variant}`,
      `size-${size}`,
      open ? 'open' : '',
      focused ? 'focused' : '',
      errorText ? 'has-error' : '',
      disabled ? 'disabled' : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="${selectClasses}" part="container">
        ${label ? `
          <label class="nx-select-label" part="label">
            ${label}
            ${required ? '<span class="required">*</span>' : ''}
          </label>
        ` : ''}
        
        <div class="nx-select-control" part="control" tabindex="${disabled ? -1 : 0}">
          <input type="hidden" name="${name}" value="${value || ''}">
          
          ${searchable && open ? `
            <input
              type="text"
              class="nx-select-search"
              part="search"
              placeholder="${placeholder}"
              value="${searchQuery}"
            >
          ` : `
            <div class="nx-select-value" part="value">
              ${displayText || `<span class="placeholder">${placeholder}</span>`}
            </div>
          `}
          
          <div class="nx-select-icons">
            ${clearable && selectedOptions.length > 0 && !disabled ? `
              <button type="button" class="nx-select-clear" part="clear" tabindex="-1">
                <svg viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            ` : ''}
            
            <svg class="nx-select-arrow" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </div>
        </div>
        
        <div class="nx-select-dropdown ${open ? 'open' : ''}" part="dropdown">
          <div class="nx-select-options" part="options">
            ${filteredOptions.map((option, index) => `
              <div class="nx-select-option ${this.isSelected(option) ? 'selected' : ''} ${option.disabled ? 'disabled' : ''}"
                   part="option"
                   data-value="${option.value}"
                   data-index="${index}">
                ${multiple ? `
                  <input type="checkbox" ${this.isSelected(option) ? 'checked' : ''} tabindex="-1">
                ` : ''}
                <span>${option.text}</span>
              </div>
            `).join('')}
            
            ${filteredOptions.length === 0 ? `
              <div class="nx-select-empty" part="empty">No options found</div>
            ` : ''}
          </div>
        </div>
        
        ${helperText || errorText ? `
          <div class="nx-select-helper ${errorText ? 'error' : ''}" part="helper">
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

      .nx-select {
        position: relative;
      }

      .nx-select-label {
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

      .nx-select-control {
        position: relative;
        display: flex;
        align-items: center;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border-color);
        border-radius: 0.25rem;
        background: var(--bg-color);
        cursor: pointer;
        transition: all 0.2s;
      }

      .nx-select-control:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      .disabled .nx-select-control {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nx-select-value {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .placeholder {
        color: var(--text-color-secondary);
      }

      .nx-select-search {
        flex: 1;
        border: none;
        background: transparent;
        font-family: inherit;
        font-size: inherit;
        outline: none;
      }

      .nx-select-icons {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        margin-left: 0.5rem;
      }

      .nx-select-clear {
        padding: 0.25rem;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--text-color-secondary);
      }

      .nx-select-clear:hover {
        color: var(--text-color);
      }

      .nx-select-clear svg,
      .nx-select-arrow {
        width: 1rem;
        height: 1rem;
        fill: currentColor;
      }

      .nx-select-arrow {
        transition: transform 0.2s;
        color: var(--text-color-secondary);
      }

      .open .nx-select-arrow {
        transform: rotate(180deg);
      }

      .nx-select-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 0.25rem;
        background: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 0.25rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        opacity: 0;
        transform: translateY(-0.5rem);
        transition: all 0.2s;
        pointer-events: none;
      }

      .nx-select-dropdown.open {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .nx-select-options {
        max-height: 200px;
        overflow-y: auto;
        padding: 0.25rem;
      }

      .nx-select-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        border-radius: 0.25rem;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .nx-select-option:hover:not(.disabled) {
        background: var(--hover-bg);
      }

      .nx-select-option.selected {
        background: var(--selected-bg);
        color: var(--color-primary);
      }

      .nx-select-option.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nx-select-empty {
        padding: 1rem;
        text-align: center;
        color: var(--text-color-secondary);
      }

      .nx-select-helper {
        margin-top: 0.25rem;
        font-size: 0.75rem;
        color: var(--text-color-secondary);
      }

      .nx-select-helper.error {
        color: var(--color-danger);
      }
    `;
  }

  protected afterRender(): void {
    const control = this.$('.nx-select-control') as HTMLElement;
    const searchInput = this.$('.nx-select-search') as HTMLInputElement;

    // Control click
    if (control) {
      this.on(control, 'click', (e: Event) => {
        if (!(e.target as Element).closest('.nx-select-clear')) {
          this.toggle();
        }
      });

      this.on(control, 'keydown', (e: Event) => {
        this.handleKeyboard(e as KeyboardEvent);
      });

      this.on(control, 'focus', () => {
        this.setState('focused', true);
      });

      this.on(control, 'blur', () => {
        this.setState('focused', false);
      });
    }

    // Search input
    if (searchInput) {
      this.on(searchInput, 'input', () => {
        this.setState('searchQuery', searchInput.value);
      });

      this.on(searchInput, 'click', (e: Event) => {
        e.stopPropagation();
      });
    }

    // Clear button
    const clearBtn = this.$('.nx-select-clear');
    if (clearBtn) {
      this.on(clearBtn, 'click', (e: Event) => {
        e.stopPropagation();
        this.clear();
      });
    }

    // Options
    this.$$('.nx-select-option:not(.disabled)').forEach(option => {
      this.on(option, 'click', () => {
        const value = option.getAttribute('data-value');
        if (value !== null) {
          this.selectOption(value);
        }
      });
    });

    // Click outside
    this.on(document, 'click', (e: Event) => {
      if (!this.contains(e.target as Node)) {
        this.close();
      }
    });
  }

  private handleKeyboard(e: KeyboardEvent): void {
    const open = this.getState('open', false);

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open) {
          const highlightedIndex = this.getState('highlightedIndex', -1);
          if (highlightedIndex >= 0) {
            const option = this.options[highlightedIndex];
            if (option && !option.disabled) {
              this.selectOption(option.value);
            }
          }
        } else {
          this.open();
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.close();
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          this.open();
        } else {
          this.highlightNext();
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (open) {
          this.highlightPrevious();
        }
        break;
    }
  }

  private highlightNext(): void {
    const current = this.getState('highlightedIndex', -1);
    const next = Math.min(current + 1, this.options.length - 1);
    this.setState('highlightedIndex', next);
  }

  private highlightPrevious(): void {
    const current = this.getState('highlightedIndex', -1);
    const prev = Math.max(current - 1, 0);
    this.setState('highlightedIndex', prev);
  }

  private getSelectedOptions(): SelectOption[] {
    const value = this.getState('value');
    const multiple = this.getProp('multiple', false);

    if (!value) return [];

    if (multiple && Array.isArray(value)) {
      return this.options.filter(opt => value.includes(opt.value));
    }

    const option = this.options.find(opt => opt.value === value);
    return option ? [option] : [];
  }

  private isSelected(option: SelectOption): boolean {
    const value = this.getState('value');
    const multiple = this.getProp('multiple', false);

    if (!value) return false;

    if (multiple && Array.isArray(value)) {
      return value.includes(option.value);
    }

    return option.value === value;
  }

  private selectOption(optionValue: string | number): void {
    const multiple = this.getProp('multiple', false);
    const currentValue = this.getState('value');

    let newValue: string | number | (string | number)[];

    if (multiple) {
      const values = Array.isArray(currentValue) ? currentValue : [];
      if (values.includes(optionValue)) {
        newValue = values.filter(v => v !== optionValue);
      } else {
        newValue = [...values, optionValue];
      }
    } else {
      newValue = optionValue;
      this.close();
    }

    this.setState('value', newValue);
    this.emit('change', { value: newValue });
  }

  open(): void {
    if (!this.getProp('disabled')) {
      this.setState('open', true);
      const searchInput = this.$('.nx-select-search') as HTMLInputElement;
      searchInput?.focus();
    }
  }

  close(): void {
    this.setState('open', false);
    this.setState('searchQuery', '');
    this.setState('highlightedIndex', -1);
  }

  toggle(): void {
    if (this.getState('open', false)) {
      this.close();
    } else {
      this.open();
    }
  }

  clear(): void {
    this.setState('value', null);
    this.emit('change', { value: null });
  }

  getValue(): string | number | (string | number)[] | null {
    return this.getState('value', null);
  }

  setValue(value: string | number | (string | number)[] | null): void {
    this.setState('value', value);
  }
}

customElements.define('nx-select', NXSelect);
