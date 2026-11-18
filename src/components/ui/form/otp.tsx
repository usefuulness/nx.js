/**
 * @file @/components/ui/form/otp.tsx
 */
import { define } from '@/core/registry';
import { inlineStep } from '@/core/dom-utils';
import { NXField, type FieldConfig } from '@/components/ui/form/field';

export interface OtpInputConfig extends FieldConfig {
  /** The code typed so far */
  value?: string;
  /** Number of characters (default 6, from 2 to 12) */
  length?: number;
  /** `numeric` (default) takes digits only; `text` takes letters and digits */
  type?: 'numeric' | 'text';
  /** Error shown under the field (for example from the server); marks it invalid */
  errorText?: string;
}

const MIN = 2;
const MAX = 12;

/**
 * One-time code input: a box per character that moves on as you type, steps back on **Backspace**,
 * and takes a pasted code (or the one your phone offers) in one go. The code posts as a single
 * value, and the first box asks the browser for `one-time-code` autofill.
 *
 * ```html
 * <nx-otp-input name="code" label="Verification code" length="6" required></nx-otp-input>
 * ```
 *
 * Keys: **←** **→** move between boxes (following the reading direction), **Home** **End** go to the first
 * and last. Events: `input` (detail: `{ value }`), `change` (when it is complete or edited), `complete`
 * (detail: `{ value }`, once every box is filled).
 */
export class NXOtpInput extends NXField {
  static get observedAttributes(): string[] {
    return ['name', 'label', 'helper-text', 'error-text', 'required', 'disabled', 'length', 'type', 'value'];
  }

  private chars: string[] = [];

  private size(): number {
    const n = Math.floor(Number(this.getProp('length', 6)));
    return Math.min(MAX, Math.max(MIN, Number.isFinite(n) ? n : 6));
  }

  private numeric(): boolean {
    return this.getProp<string>('type', 'numeric') !== 'text';
  }

  /** Keep what the box accepts (digits, or letters and digits), and no more than fits */
  private clean(text: string): string[] {
    const re = this.numeric() ? /[0-9]/ : /[A-Za-z0-9]/;
    return Array.from(String(text ?? '')).filter(c => re.test(c)).slice(0, this.size());
  }

  get value(): string {
    return this.chars.join('');
  }

  set value(value: string | number | null | undefined) {
    this.chars = this.clean(value === null || value === undefined ? '' : String(value));
    this.syncCells();
    this.syncFormValue();
  }

  formValue(): string | null {
    return this.value === '' ? null : this.value;
  }

  validationMessage(): string {
    const validator = this.getProp<(v: any, f: this) => unknown>('validator');
    const custom = typeof validator === 'function' ? validator(this.value, this) : null;
    let message = '';
    if (this.getProp('required', false) && this.value.length < this.size()) message = this.t('otp.required', { count: this.size() });
    else if (typeof custom === 'string') message = custom;
    if (message) this.internals?.setValidity({ valueMissing: true }, message, this.cells()[0]);
    else this.internals?.setValidity({});
    return message;
  }

  protected onAttributeChange(name: string, _old: string | null, value: string | null): void {
    if (name === 'value') this.value = value;
  }

  protected applyConfig(key: string, value: any): void {
    if (key === 'value') {
      this.value = value;
      return;
    }
    super.applyConfig(key, value);
  }

  /** Focus the first empty box (or the last), like a code field should. */
  focus(options?: FocusOptions): void {
    const cells = this.cells();
    (cells[Math.min(this.chars.length, cells.length - 1)] ?? cells[0])?.focus(options);
  }

  private cells(): HTMLInputElement[] {
    return Array.from(this.shadowRoot?.querySelectorAll('input.cell') ?? []) as HTMLInputElement[];
  }

  private syncCells(): void {
    this.cells().forEach((cell, i) => (cell.value = this.chars[i] ?? ''));
  }

  /** The browser's autofill and the paste event hand over a whole code: spread it from box `from`. */
  private fill(text: string, from: number): void {
    const incoming = this.clean(text);
    if (!incoming.length) return;
    const next = [...this.chars];
    while (next.length < from) next.push('');
    incoming.forEach((c, k) => { if (from + k < this.size()) next[from + k] = c; });
    this.chars = next.slice(0, this.size());
    this.syncCells();
    this.committed(Math.min(from + incoming.length, this.size() - 1));
  }

  private committed(focusIndex: number): void {
    this.cells()[focusIndex]?.focus();
    this.cells()[focusIndex]?.select();
    this.syncFormValue();
    this.emit('input', { value: this.value });
    this.changed();
    if (this.value.length === this.size() && !this.chars.includes('')) this.emit('complete', { value: this.value });
  }

  private onInput(e: Event, i: number): void {
    const cell = e.target as HTMLInputElement;
    const typed = this.clean(cell.value);
    // Two or more characters at once (autofill, a fast typist): treat them as a paste from this box
    if (typed.length > 1) {
      this.fill(cell.value, i);
      return;
    }
    const next = [...this.chars];
    while (next.length < i) next.push('');
    if (typed.length === 0) next[i] = '';
    else next[i] = typed[0];
    this.chars = next;
    // Drop trailing blanks, so the value never holds gaps at its end
    while (this.chars.length && this.chars[this.chars.length - 1] === '') this.chars.pop();
    cell.value = typed[0] ?? '';
    if (typed.length) this.committed(Math.min(i + 1, this.size() - 1));
    else { this.syncFormValue(); this.emit('input', { value: this.value }); this.changed(); }
  }

  private onKey(e: KeyboardEvent, i: number): void {
    const cells = this.cells();
    const go = (n: number) => { e.preventDefault(); cells[Math.max(0, Math.min(cells.length - 1, n))]?.focus(); cells[Math.max(0, Math.min(cells.length - 1, n))]?.select(); };
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') go(i + inlineStep(e.key, this));
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(cells.length - 1);
    else if (e.key === 'Backspace' && !cells[i].value && i > 0) {
      // Empty box: step back and clear the previous one, as people expect
      e.preventDefault();
      this.chars[i - 1] = '';
      while (this.chars.length && this.chars[this.chars.length - 1] === '') this.chars.pop();
      this.syncCells();
      cells[i - 1].focus();
      this.syncFormValue();
      this.emit('input', { value: this.value });
      this.changed();
    }
  }

  protected afterRender(): void {
    this.syncCells();
    super.afterRender();
  }

  protected control(): HTMLInputElement | null {
    return this.cells()[0] ?? null;
  }

  /**
   * Server HTML: the first box is a real text input that carries the whole code, so the form posts
   * without JavaScript. It is sized like a box, so upgrading moves nothing. The other boxes have no
   * name and post nothing.
   */
  nativeStandIns() {
    const first = this.cells()[0];
    if (!first) return [];
    const text = document.createElement('input');
    text.type = 'text';
    return [
      { original: first, fallback: text, attrs: { name: this.name || null, value: this.value || null, maxlength: String(this.size()), autocomplete: 'one-time-code', 'aria-label': this.getProp<string>('label') || this.name || null } }
    ];
  }

  protected render(): Node {
    const label = this.getProp<string>('label');
    const required = !!this.getProp('required', false);
    const disabled = !!this.getProp('disabled', false);
    const n = this.size();

    return this.renderField(
      <div part="control" role="group" class="otp" aria-labelledby={label ? `${this.fieldId}-label` : undefined}
           aria-describedby={`${this.fieldId}-help`}>
        {label && (
          <span class="nx-field-label" part="label" id={`${this.fieldId}-label`}>
            {label}{required && <span class="required" aria-hidden="true">*</span>}
          </span>
        )}
        <div class="cells" dir="ltr">
          {Array.from({ length: n }, (_, i) => (
            <input class="cell" part="cell" type="text" id={i === 0 ? this.fieldId : undefined}
                   inputmode={this.numeric() ? 'numeric' : 'text'} pattern={this.numeric() ? '[0-9]*' : undefined}
                   autocomplete={i === 0 ? 'one-time-code' : 'off'} autocapitalize="off" spellcheck={false}
                   maxlength={i === 0 ? String(n) : '1'} disabled={disabled}
                   aria-label={this.t('otp.digit', { n: i + 1, total: n })}
                   aria-required={required ? 'true' : undefined}
                   onInput={(e: Event) => this.onInput(e, i)}
                   onKeyDown={(e: KeyboardEvent) => this.onKey(e, i)}
                   onFocus={(e: Event) => (e.target as HTMLInputElement).select()}
                   onPaste={(e: ClipboardEvent) => { e.preventDefault(); this.fill(e.clipboardData?.getData('text') ?? '', i); }} />
          ))}
        </div>
      </div>,
      { inlineLabel: true }
    );
  }

  protected styles(): string {
    return `
      ${this.fieldStyles()}

      .otp { display: flex; flex-direction: column; gap: 0.5rem; }
      .cells { display: flex; gap: 0.5rem; }

      .cell {
        flex: 0 1 2.75rem;
        min-width: 0;
        width: 2.75rem;
        height: 3rem;
        padding: 0;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-background);
        box-shadow: var(--shadow-sm);
        color: var(--color-text);
        font: inherit;
        font-size: 1.25rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        text-align: center;
        transition: border-color var(--transition-duration), box-shadow var(--transition-duration);
      }

      .cell, ::slotted(input) { box-sizing: border-box; }
      ::slotted(input) { flex: 0 1 2.75rem; min-width: 0; width: 2.75rem; height: 3rem; padding: 0; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-background); color: var(--color-text); font: inherit; font-size: 1.25rem; font-weight: 600; text-align: center; }
      .cell:hover:not(:disabled) { border-color: var(--color-text-secondary); }
      .cell:focus-visible { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring); }
      .cell:disabled { cursor: not-allowed; opacity: 0.5; }
      .invalid .cell { border-color: var(--color-error); }
    `;
  }
}

define('nx-otp-input', NXOtpInput);
