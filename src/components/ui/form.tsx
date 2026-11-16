/**
 * @file @/components/ui/form.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { ComponentRegistry, define, type ItemConfig } from '@/core/registry';
import { NXField } from '@/components/ui/form/field';
import { NXCheckbox } from '@/components/ui/form/checkbox';
import { submitForm } from '@/core/forms';
import { NATIVE_ATTR } from '@/core/dom-utils';

export interface FormConfig {
  items?: ItemConfig[];
  /** Initial values, keyed by field name */
  values?: Record<string, any>;
  /** Lay fields out in N columns */
  columns?: number;
  /** Space between fields (px number or CSS length) */
  gap?: number | string;
  /** Footer buttons; `{ type: 'submit' }` submits, `{ type: 'reset' }` resets */
  buttons?: ItemConfig[];
  /** Called with the values when the form is valid and submitted */
  onSubmit?: (e: CustomEvent<{ values: Record<string, any> }>) => void;
  /** Post to the server like a native form (after validation, unless `submit` is prevented) */
  action?: string;
  /** HTTP method used with `action` */
  method?: 'get' | 'post' | 'dialog';
  /** Encoding used with `action` (`multipart/form-data` for file uploads) */
  enctype?: 'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain';
  /** Where the response of `action` opens */
  target?: string;
  /**
   * Post with `fetch` instead of navigating: the page stays put, the form is busy meanwhile, and
   * a JSON error response is shown on the fields it names (see the `error` event). Still posts
   * natively when JavaScript is off or hasn't loaded.
   */
  enhance?: boolean;
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
 * Pressing Enter in a single-line field submits. Events: `submit` (detail: `{ values }`,
 * cancelable), `invalid` (detail: `{ fields }`), `reset`, `change`.
 *
 * With `action` it posts to the server like a native form (server apps, no JS
 * handler needed); call `preventDefault()` on `submit` to handle it in JS instead.
 * Add `enhance` to post with `fetch` and show server validation errors on the fields
 * (`{ "errors": { "email": "Already taken" } }` with a 4xx status). Events then also
 * include `success` and `error`.
 * ```html
 * <nx-form action="/users" method="post">
 *   <nx-input name="email" type="email" label="Email" required></nx-input>
 *   <nx-button slot="buttons" type="submit">Save</nx-button>
 * </nx-form>
 * ```
 */
export class NXForm extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['columns', 'gap', 'action', 'method', 'enctype', 'target', 'enhance'];
  }

  private pendingValues: Record<string, any> | null = null;
  private inFlight: AbortController | null = null;
  private formError = '';

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
        this.submit(button);
      } else if (type === 'reset') {
        e.preventDefault();
        this.reset();
      }
    });

    this.addEventListener('nx-field-enter', () => this.submit());

    // An error from the server goes away once the user changes that field
    const clearServerError = (e: Event) => {
      const field = e.target as HTMLElement | null;
      if (!field?.hasAttribute?.('data-nx-server-error')) return;
      field.removeAttribute('data-nx-server-error');
      if (field instanceof NXField) field.removeAttribute('error-text');
      else (field as HTMLInputElement).setCustomValidity?.('');
    };
    this.addEventListener('change', clearServerError);
    this.addEventListener('input', clearServerError);
  }

  /** The hidden native form that server-rendered stand-ins posted with. */
  protected hydrateState(): void {
    this.querySelectorAll(`:scope > form[${NATIVE_ATTR}]`).forEach(el => el.remove());
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
        } else if (field instanceof NXCheckbox) {
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

  /**
   * Validate and, if valid, fire `submit` with the values. Unless the event was
   * prevented, it then posts natively: to `action`, or through the `<form>`
   * this one sits in. Returns the values or null.
   */
  submit(submitter?: HTMLElement | null): Record<string, any> | null {
    if (!this.validate()) return null;
    const values = this.getValues();
    const proceed = this.dispatchEvent(new CustomEvent('submit', {
      detail: { values },
      bubbles: true,
      composed: true,
      cancelable: true
    }));
    if (proceed) {
      const outer = this.parentElement?.closest('form');
      if (this.hasAttribute('action')) {
        if (this.hasAttribute('enhance') && this.attr('method', submitter ?? null)?.toLowerCase() !== 'dialog') void this.submitEnhanced(submitter ?? null);
        else this.submitNative(submitter ?? null);
      }
      else if (outer) submitForm(outer, submitter);
    }
    return values;
  }

  /** Entries as a native form would submit them (checked boxes only, repeated names, files). */
  formData(submitter?: HTMLElement | null): FormData {
    const data = new FormData();
    this.fields().forEach(field => {
      const name = this.fieldName(field);
      if (!name || field.hasAttribute('disabled') || (field as HTMLInputElement).disabled) return;
      if (field instanceof NXField) {
        const value = field.formValue();
        if (value instanceof FormData) value.forEach(v => data.append(name, v));
        else if (value !== null) data.append(name, value);
      } else if (field instanceof HTMLInputElement) {
        if ((field.type === 'checkbox' || field.type === 'radio') && !field.checked) return;
        if (field.type === 'file') Array.from(field.files ?? []).forEach(file => data.append(name, file));
        else data.append(name, field.value);
      } else if (field instanceof HTMLSelectElement) {
        Array.from(field.selectedOptions).forEach(option => data.append(name, option.value));
      } else {
        data.append(name, (field as HTMLTextAreaElement).value);
      }
    });
    const submitName = submitter?.getAttribute('name');
    if (submitName) data.append(submitName, submitter!.getAttribute('value') ?? '');
    return data;
  }

  /** A submit attribute, letting the submit button's `formaction`, `formmethod`… win like they do natively. */
  private attr(name: string, submitter: HTMLElement | null): string | null {
    return submitter?.getAttribute(`form${name}`) ?? this.getAttribute(name);
  }

  /** Whether a submission is in flight (the form is `aria-busy` and its submit buttons are disabled). */
  isSubmitting(): boolean {
    return this.inFlight !== null;
  }

  /** Cancel a submission that is still waiting for the server. */
  abort(): void {
    this.inFlight?.abort();
  }

  private setBusy(busy: boolean): void {
    if (busy) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');
    this.querySelectorAll('[slot="buttons"]').forEach(button => {
      if (button.getAttribute('type') !== 'submit') return;
      // Only re-enable buttons this method disabled
      if (busy && !button.hasAttribute('disabled')) {
        button.setAttribute('disabled', '');
        button.setAttribute('data-nx-busy', '');
      } else if (!busy && button.hasAttribute('data-nx-busy')) {
        button.removeAttribute('disabled');
        button.removeAttribute('data-nx-busy');
      }
    });
  }

  private async submitEnhanced(submitter: HTMLElement | null): Promise<void> {
    if (this.inFlight) return; // a double click must not post twice
    const controller = (this.inFlight = new AbortController());
    const method = (this.attr('method', submitter) ?? 'get').toUpperCase();
    const url = new URL(this.attr('action', submitter) ?? '', location.href);
    const data = this.formData(submitter);
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'nx-form' };
    const init: RequestInit = { method, headers, credentials: 'same-origin', signal: controller.signal };

    if (method === 'GET' || method === 'HEAD') {
      data.forEach((value, name) => typeof value === 'string' && url.searchParams.append(name, value));
    } else {
      const hasFile = Array.from(data.values()).some(value => typeof value !== 'string');
      const enctype = this.attr('enctype', submitter);
      if (hasFile || enctype === 'multipart/form-data') {
        init.body = data; // the browser sets the multipart boundary
      } else {
        const params = new URLSearchParams();
        data.forEach((value, name) => params.append(name, value as string));
        init.body = params;
        if (enctype === 'text/plain') headers['Content-Type'] = 'text/plain';
      }
    }

    this.clearServerErrors();
    this.setFormError('');
    this.setBusy(true);
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      this.inFlight = null;
      this.setBusy(false);
      if (controller.signal.aborted) return;
      this.setFormError("Couldn't reach the server. Check your connection and try again.");
      this.emit('error', { error, status: 0, errors: {} });
      return;
    }

    let body: any = null;
    try {
      body = /json/.test(response.headers.get('content-type') ?? '') ? await response.json() : await response.text();
    } catch {
      // An unreadable body is treated as empty
    }
    this.inFlight = null;
    this.setBusy(false);

    if (response.ok) {
      const proceed = this.dispatchEvent(new CustomEvent('success', {
        detail: { response, status: response.status, data: body },
        bubbles: true,
        composed: true,
        cancelable: true
      }));
      // Like a native post: a redirect response moves the page
      if (proceed && response.redirected) location.assign(response.url);
      return;
    }

    const { fields, general } = this.readErrors(body);
    const shown = this.showServerErrors(fields);
    const message = general || (shown ? '' : `The server couldn't process the form (${response.status}).`);
    this.setFormError(message);
    this.emit('error', { status: response.status, errors: fields, data: body });
  }

  /** `{ errors: { field: 'msg' | ['msg'] } }` or `{ errors: [{ field, message }] }`, plus a general `message`. */
  private readErrors(body: any): { fields: Record<string, string>; general: string } {
    const fields: Record<string, string> = {};
    let general = typeof body === 'object' && body && typeof body.message === 'string' ? body.message : '';
    const errors = typeof body === 'object' && body ? body.errors : null;
    const add = (name: unknown, message: unknown) => {
      const text = Array.isArray(message) ? message.join(' ') : String(message ?? '');
      if (!text) return;
      if (!name || name === '_form') general = text;
      else fields[String(name)] = text;
    };
    if (Array.isArray(errors)) errors.forEach(item => add(item?.field ?? item?.name, item?.message));
    else if (errors && typeof errors === 'object') Object.entries(errors).forEach(([name, message]) => add(name, message));
    return { fields, general };
  }

  /** Put each message on its field; returns whether any field took one. Focus goes to the first. */
  private showServerErrors(errors: Record<string, string>): boolean {
    let first: HTMLElement | null = null;
    Object.entries(errors).forEach(([name, message]) => {
      const field = this.getField(name);
      if (!field) return;
      field.setAttribute('data-nx-server-error', '');
      if (field instanceof NXField) field.setAttribute('error-text', message);
      else (field as unknown as HTMLInputElement).setCustomValidity?.(message);
      first ??= field;
    });
    // The field re-renders with its message; focus it after that
    if (first) setTimeout(() => (first as HTMLElement).focus(), 0);
    return first !== null;
  }

  private clearServerErrors(): void {
    this.querySelectorAll('[data-nx-server-error]').forEach(field => {
      field.removeAttribute('data-nx-server-error');
      if (field instanceof NXField) field.removeAttribute('error-text');
      else (field as HTMLInputElement).setCustomValidity?.('');
    });
  }

  private setFormError(message: string): void {
    if (message === this.formError) return;
    this.formError = message;
    const el = this.$('.form-error') as HTMLElement | null;
    if (!el) return this.scheduleUpdate();
    el.textContent = message;
    el.hidden = !message;
  }

  /** Navigate like a native form submission (a temporary light-DOM <form>). */
  private submitNative(submitter: HTMLElement | null): void {
    const form = document.createElement('form');
    form.hidden = true;
    form.noValidate = true;
    const attr = (name: string) => this.attr(name, submitter);
    form.action = attr('action') ?? '';
    form.method = attr('method') ?? 'get';
    form.target = attr('target') ?? '';
    const enctype = attr('enctype');
    if (enctype) form.enctype = enctype;

    const data = this.formData(submitter);
    data.forEach((value, name) => {
      const input = document.createElement('input');
      input.name = name;
      if (typeof value === 'string') {
        input.type = 'hidden';
        input.value = value;
      } else {
        // Files: carry them over with a file input (needs multipart)
        input.type = 'file';
        const transfer = new DataTransfer();
        transfer.items.add(value);
        input.files = transfer.files;
        form.enctype = 'multipart/form-data';
      }
      form.appendChild(input);
    });

    document.body.appendChild(form);
    try {
      form.submit();
    } finally {
      form.remove();
    }
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
        <div class="form-error" part="error" role="alert" hidden={!this.formError}>{this.formError}</div>
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

      .form-error {
        padding: 0.625rem 0.75rem;
        border: 1px solid var(--color-error);
        border-radius: var(--radius-md);
        color: var(--color-error-text);
        font-size: 0.875rem;
      }

      .form-error[hidden] { display: none; }

      .buttons {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
    `;
  }
}

define('nx-form', NXForm);
