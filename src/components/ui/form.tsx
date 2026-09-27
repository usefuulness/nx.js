/**
 * @file @/components/ui/form.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { ComponentRegistry, define, type ItemConfig } from '@/core/registry';
import { NXField } from '@/components/ui/form/field';

export interface FormConfig {
  items?: ItemConfig[];
  /** Initial values, keyed by field name */
  values?: Record<string, any>;
  /** Lay fields out in N columns */
  columns?: number;
  gap?: number | string;
  /** Footer buttons; `{ type: 'submit' }` submits, `{ type: 'reset' }` resets */
  buttons?: ItemConfig[];
  /** Called with the values when the form is valid and submitted */
  onSubmit?: (e: CustomEvent<{ values: Record<string, any> }>) => void;
}

type AnyField = HTMLElement & { name?: string; value?: any; validate?: () => boolean; reset?: () => void; checked?: boolean };

/**
 * Form container: collects values from named fields, validates, and fires `submit`.
 * Works with nx fields and plain `<input>`/`<select>`/`<textarea>` elements.
 *
 * @example
 * ```typescript
 * {
 *   xtype: 'form',
 *   columns: 2,
 *   items: [
 *     { xtype: 'textfield', name: 'first', label: 'First name', required: true },
 *     { xtype: 'textfield', name: 'last', label: 'Last name' },
 *     { xtype: 'email', name: 'email', label: 'Email', required: true, style: 'grid-column: 1 / -1' }
 *   ],
 *   buttons: [
 *     { xtype: 'button', text: 'Reset', type: 'reset', variant: 'ghost' },
 *     { xtype: 'button', text: 'Save', type: 'submit' }
 *   ],
 *   onSubmit: (e) => save(e.detail.values)
 * }
 * ```
 *
 * Pressing Enter in a single-line field submits. Events: `submit` (detail: `{ values }`),
 * `invalid` (detail: `{ fields }`), `reset`, `change`.
 */
export class NXForm extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['columns', 'gap', 'disabled'];
  }

  private pendingValues: Record<string, any> | null = null;

  protected initializeState(): void {}

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // nx-button[type=submit] lives in its own shadow root, so wire it up here
    this.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('nx-button, button') as HTMLElement | null;
      if (!button || !this.contains(button)) return;
      const type = button.getAttribute('type');
      if (type === 'submit') {
        e.preventDefault();
        this.submit();
      } else if (type === 'reset') {
        e.preventDefault();
        this.reset();
      }
    });

    this.addEventListener('nx-field-enter', () => this.submit());
  }

  setButtons(buttons: ItemConfig[]): void {
    this.querySelectorAll(':scope > [slot="buttons"]').forEach(el => el.remove());
    buttons.forEach(config => {
      const button = ComponentRegistry.build(config);
      if (button) {
        button.slot = 'buttons';
        this.appendChild(button);
      }
    });
    this.scheduleUpdate();
  }

  setValues(values: Record<string, any>): void {
    // Fields may not exist yet when configured declaratively
    this.pendingValues = { ...(this.pendingValues ?? {}), ...values };
    this.applyPendingValues();
  }

  private applyPendingValues(): void {
    if (!this.pendingValues) return;
    const fields = this.fields();
    if (!fields.length) return;
    Object.entries(this.pendingValues).forEach(([name, value]) => {
      fields.filter(f => this.fieldName(f) === name).forEach(field => {
        if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) {
          field.checked = field.type === 'radio' ? field.value === String(value) : !!value;
        } else if (field.tagName === 'NX-CHECKBOX') {
          (field as any).checked = !!value;
        } else {
          field.value = value;
        }
      });
    });
    this.pendingValues = null;
  }

  /** All named fields inside the form. */
  fields(): AnyField[] {
    return Array.from(this.querySelectorAll('[name]')).filter(el =>
      el instanceof NXField || el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement
    ) as AnyField[];
  }

  getField<T extends HTMLElement = HTMLElement>(name: string): T | null {
    return (this.fields().find(f => this.fieldName(f) === name) as unknown as T) ?? null;
  }

  private fieldName(field: AnyField): string {
    return field.getAttribute('name') ?? '';
  }

  /** Values keyed by field name. Checkboxes report booleans; repeated names collect into arrays. */
  getValues(): Record<string, any> {
    const values: Record<string, any> = {};
    this.fields().forEach(field => {
      const name = this.fieldName(field);
      if (!name) return;
      let value: any;
      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        value = field.checked;
      } else if (field instanceof HTMLInputElement && field.type === 'radio') {
        if (!field.checked) return;
        value = field.value;
      } else {
        value = field.value;
      }
      if (field instanceof HTMLInputElement && field.type === 'number' || field.getAttribute('type') === 'number') {
        value = value === '' ? null : Number(value);
      }
      if (name in values) {
        values[name] = Array.isArray(values[name]) ? [...values[name], value] : [values[name], value];
      } else {
        values[name] = value;
      }
    });
    return values;
  }

  /** @deprecated use getValues() */
  getData(): Record<string, any> {
    return this.getValues();
  }

  /** @deprecated use setValues() */
  setData(values: Record<string, any>): void {
    this.setValues(values);
  }

  /** Validate every field; shows errors and focuses the first invalid one. */
  validate(): boolean {
    const invalid = this.fields().filter(field => {
      if (typeof field.validate === 'function') return !field.validate();
      return !(field as HTMLInputElement).checkValidity?.();
    });
    if (invalid.length) {
      invalid[0].focus();
      this.emit('invalid', { fields: invalid });
    }
    return invalid.length === 0;
  }

  isValid(): boolean {
    return this.fields().every(field =>
      field instanceof NXField ? !field.validationMessage() : (field as HTMLInputElement).checkValidity?.() ?? true
    );
  }

  /** Validate and, if valid, fire `submit` with the values. Returns the values or null. */
  submit(): Record<string, any> | null {
    if (!this.validate()) return null;
    const values = this.getValues();
    this.emit('submit', { values });
    return values;
  }

  reset(): void {
    this.fields().forEach(field => {
      if (typeof field.reset === 'function') field.reset();
      else if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) field.checked = field.defaultChecked;
      else (field as HTMLInputElement).value = (field as HTMLInputElement).defaultValue ?? '';
    });
    this.emit('reset');
  }

  protected afterConnect(): void {
    // Children are appended after configure(); apply initial values once they exist
    queueMicrotask(() => this.applyPendingValues());
  }

  protected render(): Node {
    const hasButtons = !!this.querySelector(':scope > [slot="buttons"]');
    return (
      <form part="form" novalidate>
        <div class="fields" part="fields"><slot /></div>
        {hasButtons && <div class="buttons" part="buttons"><slot name="buttons" /></div>}
      </form>
    );
  }

  protected styles(): string {
    const columns = Number(this.getProp('columns', 1)) || 1;
    const gap = this.getProp('gap', 16);
    const gapCss = typeof gap === 'number' ? `${gap}px` : gap;

    return `
      :host { display: block; }

      form {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .fields {
        display: grid;
        grid-template-columns: repeat(${columns}, minmax(0, 1fr));
        gap: ${gapCss};
      }

      @media (max-width: 640px) {
        .fields { grid-template-columns: minmax(0, 1fr); }
      }

      .buttons {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
    `;
  }
}

define('nx-form', NXForm);
