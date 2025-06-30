import { ComponentState, BaseComponent } from "@/components/abstracts/base";
import { NXTextField } from "./textfield";

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

/**
 * Select dropdown component
 */
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
    
    if (config) {
      this.configure(config);
    }
  }

  configure(config: SelectConfig): void {
    if (config.options) {
      this.setOptions(config.options);
    }
    
    Object.entries(config).forEach(([key, value]) => {
      if (key === 'onChange') {
        this[ComponentState].set(key, value);
      } else if (key !== 'options') {
        const attrName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        this.setAttribute(attrName, String(value));
      }
    });
  }

  setOptions(options: SelectOption[]): void {
    this.options = options;
    
    // Set initial value from options if any are selected
    const selected = options.filter(opt => opt.selected);
    if (selected.length > 0) {
      const multiple = this.getProp('multiple', false);
      if (multiple) {
        this.setState('value', selected.map(opt => opt.value));
      } else {
        this.setState('value', selected[0].value);
      }
    }
    
    this.update();
  }

  protected render(): string {
    const label = this.getProp('label');
    const placeholder = this.getProp('placeholder', 'Select...');
    const helperText = this.getProp('helper-text');
    const errorText = this.getProp('error-text');
    const required = this.getProp('required', false);
    const disabled = this.getProp('disabled', false);
    const multiple = this.getProp('multiple', false);
    const searchable = this.getProp('searchable', false);
    const clearable = this.getProp('clearable', false);
    const variant = this.getProp('variant', 'outlined');
    const size = this.getProp('size', 'md');
    
    const value = this.getState('value');
    const open = this.getState('open', false);
    const searchQuery = this.getState('searchQuery', '');
    const hasError = !!errorText;
    
    const selectedOptions = this.getSelectedOptions();
    const displayText = this.getDisplayText(selectedOptions);
    const filteredOptions = this.getFilteredOptions();

    return `
      <div class="nx-select nx-select-${variant} nx-select-${size}
                  ${open ? 'open' : ''}
                  ${hasError ? 'has-error' : ''}
                  ${disabled ? 'disabled' : ''}"
           part="select">
        ${label ? `
          <label class="nx-select-label" part="label">
            ${label}
            ${required ? '<span class="nx-select-required">*</span>' : ''}
          </label>
        ` : ''}
        
        <div class="nx-select-wrapper" part="wrapper">
          <div class="nx-select-trigger" 
               role="combobox"
               aria-expanded="${open}"
               aria-haspopup="listbox"
               tabindex="${disabled ? -1 : 0}">
            ${searchable && open ? `
              <input class="nx-select-search"
                     type="text"
                     value="${searchQuery}"
                     placeholder="${placeholder}"
                     aria-label="Search options">
            ` : `
              <span class="nx-select-value ${!displayText ? 'placeholder' : ''}">
                ${displayText || placeholder}
              </span>
            `}
            
            <div class="nx-select-actions">
              ${clearable && value && !disabled ? `
                <button class="nx-select-clear" 
                        type="button"
                        aria-label="Clear selection"
                        tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M15 9l-6 6M9 9l6 6"/>
                  </svg>
                </button>
              ` : ''}
              
              <span class="nx-select-arrow ${open ? 'open' : ''}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </span>
            </div>
          </div>
          
          <div class="nx-select-dropdown ${open ? 'open' : ''}" 
               role="listbox"
               aria-multiselectable="${multiple}">
            ${filteredOptions.length > 0 ? 
              this.renderOptions(filteredOptions) : 
              '<div class="nx-select-empty">No options available</div>'
            }
          </div>
        </div>
        
        ${helperText || errorText ? `
          <div class="nx-select-helper ${hasError ? 'error' : ''}" 
               part="helper-text">
            ${errorText || helperText}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderOptions(options: SelectOption[]): string {
    const value = this.getState('value');
    const multiple = this.getProp('multiple', false);
    const highlightedIndex = this.getState('highlightedIndex', -1);
    
    // Group options if needed
    const groups = new Map<string | null, SelectOption[]>();
    options.forEach(opt => {
      const group = opt.group || null;
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(opt);
    });
    
    let html = '';
    let index = 0;
    
    groups.forEach((groupOptions, groupName) => {
      if (groupName) {
        html += `<div class="nx-select-group-label">${groupName}</div>`;
      }
      
      groupOptions.forEach(opt => {
        const isSelected = multiple ? 
          (Array.isArray(value) && value.includes(opt.value)) :
          value === opt.value;
        
        html += `
          <div class="nx-select-option 
                      ${isSelected ? 'selected' : ''} 
                      ${opt.disabled ? 'disabled' : ''}
                      ${index === highlightedIndex ? 'highlighted' : ''}"
               role="option"
               aria-selected="${isSelected}"
               data-value="${opt.value}"
               data-index="${index}">
            ${multiple ? `
              <input type="checkbox" 
                     class="nx-select-checkbox"
                     ${isSelected ? 'checked' : ''}
                     ${opt.disabled ? 'disabled' : ''}
                     tabindex="-1">
            ` : ''}
            <span class="nx-select-option-text">${opt.text}</span>
          </div>
        `;
        index++;
      });
    });
    
    return html;
  }

  protected styles(): string {
    return `
      ${NXTextField.prototype.styles.call(this)}
      
      /* Select specific styles */
      .nx-select {
        position: relative;
      }

      .nx-select-wrapper {
        position: relative;
      }

      .nx-select-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: var(--field-height);
        padding: var(--field-padding);
        background: var(--field-bg);
        border: var(--field-border-width) solid var(--field-border-color);
        border-radius: var(--field-radius);
        cursor: pointer;
        transition: all 0.2s;
      }

      .nx-select.open .nx-select-trigger {
        border-color: var(--field-border-focus);
      }

      .nx-select.disabled .nx-select-trigger {
        opacity: 0.6;
        cursor: not-allowed;
        background: var(--color-background);
      }

      .nx-select-value {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .nx-select-value.placeholder {
        color: var(--color-text-secondary);
        opacity: 0.8;
      }

      .nx-select-search {
        flex: 1;
        background: none;
        border: none;
        outline: none;
        font-size: var(--field-font-size);
        font-family: inherit;
        color: var(--color-text);
      }

      .nx-select-actions {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .nx-select-clear {
        width: 1.25rem;
        height: 1.25rem;
        padding: 0.125rem;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        border-radius: var(--radius-sm);
        transition: all 0.2s;
      }

      .nx-select-clear:hover {
        background: var(--color-background);
        color: var(--color-text);
      }

      .nx-select-arrow {
        width: 1.25rem;
        height: 1.25rem;
        color: var(--color-text-secondary);
        transition: transform 0.2s;
      }

      .nx-select-arrow.open {
        transform: rotate(180deg);
      }

      .nx-select-arrow svg {
        width: 100%;
        height: 100%;
      }

      /* Dropdown */
      .nx-select-dropdown {
        position: absolute;
        top: calc(100% + 0.25rem);
        left: 0;
        right: 0;
        max-height: 300px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        overflow-y: auto;
        z-index: 1000;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-0.5rem);
        transition: all 0.2s;
      }

      .nx-select-dropdown.open {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      .nx-select-option {
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        transition: background-color 0.15s;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .nx-select-option:hover:not(.disabled) {
        background: var(--color-background);
      }

      .nx-select-option.highlighted {
        background: var(--color-background);
      }

      .nx-select-option.selected {
        color: var(--color-primary);
        font-weight: 500;
      }

      .nx-select-option.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nx-select-checkbox {
        width: 1rem;
        height: 1rem;
      }

      .nx-select-group-label {
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .nx-select-empty {
        padding: 1rem;
        text-align: center;
        color: var(--color-text-secondary);
      }
    `;
  }

  private getSelectedOptions(): SelectOption[] {
    const value = this.getState('value');
    if (!value) return [];
    
    const multiple = this.getProp('multiple', false);
    const values = multiple ? (value as (string | number)[]) : [value];
    
    return this.options.filter(opt => values.includes(opt.value));
  }

  private getDisplayText(selectedOptions: SelectOption[]): string {
    if (selectedOptions.length === 0) return '';
    
    const multiple = this.getProp('multiple', false);
    if (multiple) {
      return `${selectedOptions.length} selected`;
    }
    
    return selectedOptions[0].text;
  }

  private getFilteredOptions(): SelectOption[] {
    const searchQuery = this.getState('searchQuery', '').toLowerCase();
    if (!searchQuery) return this.options;
    
    return this.options.filter(opt => 
      opt.text.toLowerCase().includes(searchQuery)
    );
  }

  protected afterRender(): void {
    const trigger = this.$('.nx-select-trigger') as HTMLElement;
    const searchInput = this.$('.nx-select-search') as HTMLInputElement;
    
    // Trigger clicks
    trigger?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.nx-select-clear')) return;
      if (this.getProp('disabled')) return;
      
      this.toggleDropdown();
    });

    // Keyboard navigation
    trigger?.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });

    // Search input
    searchInput?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      this.setState('searchQuery', query);
      this.setState('highlightedIndex', 0);
    });

    searchInput?.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });

    // Option clicks
    this.$$('.nx-select-option').forEach((option, index) => {
      option.addEventListener('click', () => {
        const value = (option as HTMLElement).dataset.value;
        if (!value || option.classList.contains('disabled')) return;
        
        this.selectOption(value);
      });

      option.addEventListener('mouseenter', () => {
        this.setState('highlightedIndex', index);
      });
    });

    // Clear button
    this.on('.nx-select-clear', 'click', (e: Event) => {
      e.stopPropagation();
      this.clear();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });
  }

  private handleKeyboard(e: KeyboardEvent): void {
    const open = this.getState('open', false);
    const filteredOptions = this.getFilteredOptions();
    const highlightedIndex = this.getState('highlightedIndex', -1);

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open && highlightedIndex >= 0) {
          const option = filteredOptions[highlightedIndex];
          if (option && !option.disabled) {
            this.selectOption(option.value);
          }
        } else if (!open) {
          this.openDropdown();
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        this.closeDropdown();
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          this.openDropdown();
        } else {
          const newIndex = Math.min(highlightedIndex + 1, filteredOptions.length - 1);
          this.setState('highlightedIndex', newIndex);
        }
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        if (open) {
          const newIndex = Math.max(highlightedIndex - 1, 0);
          this.setState('highlightedIndex', newIndex);
        }
        break;
        
      case 'Home':
        if (open) {
          e.preventDefault();
          this.setState('highlightedIndex', 0);
        }
        break;
        
      case 'End':
        if (open) {
          e.preventDefault();
          this.setState('highlightedIndex', filteredOptions.length - 1);
        }
        break;
    }
  }

  private selectOption(value: string | number): void {
    const multiple = this.getProp('multiple', false);
    
    if (multiple) {
      const currentValue = this.getState('value', []) as (string | number)[];
      const newValue = [...currentValue];
      const index = newValue.indexOf(value);
      
      if (index >= 0) {
        newValue.splice(index, 1);
      } else {
        newValue.push(value);
      }
      
      this.setState('value', newValue);
    } else {
      this.setState('value', value);
      this.closeDropdown();
    }
    
    const onChange = this.getState('onChange');
    if (onChange) onChange(this.getState('value'));
    
    this.dispatchEvent(new CustomEvent('change', { 
      detail: { value: this.getState('value') } 
    }));
  }

  private toggleDropdown(): void {
    const open = this.getState('open', false);
    if (open) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  private openDropdown(): void {
    this.setState('open', true);
    this.setState('highlightedIndex', 0);
    
    const searchInput = this.$('.nx-select-search') as HTMLInputElement;
    searchInput?.focus();
  }

  private closeDropdown(): void {
    this.setState('open', false);
    this.setState('searchQuery', '');
    this.setState('highlightedIndex', -1);
  }

  // Public API
  getValue(): string | number | (string | number)[] | null {
    return this.getState('value', null);
  }

  setValue(value: string | number | (string | number)[]): void {
    this.setState('value', value);
  }

  clear(): void {
    const multiple = this.getProp('multiple', false);
    this.setState('value', multiple ? [] : null);
    
    const onChange = this.getState('onChange');
    if (onChange) onChange(this.getState('value'));
    
    this.dispatchEvent(new CustomEvent('clear'));
  }
}

customElements.define('nx-select', NXSelect);
