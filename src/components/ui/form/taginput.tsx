/**
 * @file @/components/ui/form/taginput.tsx
 */
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { NXField, type FieldConfig } from '@/components/ui/form/field';
import { NATIVE_ATTR } from '@/core/dom-utils';

export interface TagInputConfig extends FieldConfig {
  /** The tags (an array; in HTML a comma separated string) */
  value?: string[] | string;
  placeholder?: string;
  /** Most tags */
  max?: number;
  /** Fewest tags before the field is valid */
  min?: number;
  /** Characters that end a tag as you type or paste (default `,`); Enter always does */
  separators?: string;
  /** Allow the same tag twice (default false; comparison ignores case) */
  allowDuplicates?: boolean;
  /** Turn text typed but not confirmed into a tag when the field loses focus (default true) */
  addOnBlur?: boolean;
  /** Suggestions offered by the browser while typing (a native datalist) */
  suggestions?: string[] | string;
  /** Return a message to refuse a tag, or nothing to accept it */
  validateTag?: (tag: string) => string | true | null | undefined | void;
}

/**
 * Tag input: type a value and press **Enter** (or a separator such as a comma) to turn it into a
 * removable chip. Paste splits on separators and newlines. **Backspace** in the empty box removes the
 * last tag. Tags can also be removed with their × buttons. Additions and removals are announced.
 *
 * ```html
 * <nx-tag-input name="topics" label="Topics" value="css,html" max="5" suggestions="css,html,js"></nx-tag-input>
 * ```
 *
 * With JavaScript each tag posts as its own `name` entry. Before JavaScript loads, the server-rendered
 * box posts one comma-separated value, so a server should split every value of `name` on commas.
 *
 * Events: `change` (detail: `{ value }`, the array), `reject` (detail: `{ tag, reason }`, reason `duplicate`, `max` or `invalid`).
 */
export class NXTagInput extends NXField {
  static get observedAttributes(): string[] {
    return ['name', 'label', 'helper-text', 'error-text', 'required', 'disabled', 'placeholder', 'max', 'min', 'separators', 'allow-duplicates', 'add-on-blur', 'suggestions', 'value'];
  }

  private tags: string[] = [];
  private note = '';

  get value(): string[] {
    return this.tags;
  }

  set value(value: unknown) {
    const list = Array.isArray(value) ? value : String(value ?? '').split(',');
    const seen = new Set<string>();
    this.tags = list.map(t => String(t).trim()).filter(t => {
      const key = t.toLowerCase();
      if (!t || (!this.getProp('allow-duplicates', false) && seen.has(key))) return false;
      seen.add(key);
      return true;
    });
    this.refreshTags();
    this.syncFormValue();
  }

  protected defaultValue(): string[] {
    return [];
  }

  /** Text typed into the server's box before the upgrade goes back into the box (tags come from `value`). */
  private pendingText = '';

  protected hydrateState(): void {
    const text = this.querySelector(`:scope > input[type="text"][${NATIVE_ATTR}]`) as HTMLInputElement | null;
    this.pendingText = text?.value ?? '';
    this.querySelectorAll(`:scope > [${NATIVE_ATTR}]`).forEach(el => el.remove());
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

  formValue(): FormData | null {
    if (!this.tags.length) return null;
    const data = new FormData();
    this.tags.forEach(tag => data.append(this.name, tag));
    return data;
  }

  validationMessage(): string {
    const validator = this.getProp<(v: any, f: this) => unknown>('validator');
    const custom = typeof validator === 'function' ? validator(this.value, this) : null;
    const min = Number(this.getProp('min', 0)) || (this.getProp('required', false) ? 1 : 0);
    let message = '';
    if (this.tags.length < min) message = min === 1 ? this.t('tags.required') : this.t('tags.min', { count: min });
    else if (typeof custom === 'string') message = custom;
    if (message) this.internals?.setValidity({ valueMissing: true }, message, this.control() ?? undefined);
    else this.internals?.setValidity({});
    return message;
  }

  // ────────── Editing the list ──────────

  private separators(): string {
    return String(this.getProp('separators', ','));
  }

  /** Turn text into tags: split on separators and line breaks, check each, add what passes. */
  addTags(text: string): boolean {
    if (this.getProp('disabled', false)) return false;
    const separators = this.separators();
    const parts = text.split(new RegExp(`[${separators.replace(/[\]\\^-]/g, '\\$&')}\\n\\r]`)).map(p => p.trim()).filter(Boolean);
    const max = Number(this.getProp('max', Infinity)) || Infinity;
    const validate = this.getProp<TagInputConfig['validateTag']>('validate-tag');
    const added: string[] = [];
    this.note = '';

    for (const tag of parts) {
      const duplicate = !this.getProp('allow-duplicates', false) && [...this.tags, ...added].some(t => t.toLowerCase() === tag.toLowerCase());
      const verdict = typeof validate === 'function' ? validate(tag) : true;
      if (duplicate) this.refuse(tag, 'duplicate', this.t('tags.duplicate', { tag }));
      else if (this.tags.length + added.length >= max) this.refuse(tag, 'max', this.t('tags.max', { count: max }));
      else if (typeof verdict === 'string') this.refuse(tag, 'invalid', verdict);
      else added.push(tag);
    }
    if (added.length) {
      this.tags = [...this.tags, ...added];
      this.refreshTags();
      this.announce(this.t('tags.added', { tag: added.join(', ') }));
      this.touched = true;
      this.changed();
    }
    this.showNote();
    return added.length > 0 || parts.length === 0;
  }

  removeTag(tag: string): void {
    if (this.getProp('disabled', false)) return;
    const at = this.tags.indexOf(tag);
    if (at < 0) return;
    this.tags = this.tags.filter((_, i) => i !== at);
    this.note = '';
    this.refreshTags();
    this.announce(this.t('tags.removed', { tag }));
    this.touched = true;
    this.changed();
    this.showNote();
    this.control()?.focus({ preventScroll: true });
  }

  private refuse(tag: string, reason: 'duplicate' | 'max' | 'invalid', message: string): void {
    this.note = message;
    this.emit('reject', { tag, reason });
  }

  /** The reason a tag was refused shows as the field's message until the next edit. */
  private showNote(): void {
    this.showError(this.note || (this.touched ? this.validationMessage() : ''));
  }

  private announce(text: string): void {
    const region = this.$('.live');
    if (region) region.textContent = text;
  }

  private refreshTags(): void {
    const list = this.$('.tags');
    if (list) list.replaceChildren(...this.renderTags());
  }

  private renderTags(): Node[] {
    return this.tags.map(tag => (
      <span class="tag" part="tag">
        <span class="tag-text">{tag}</span>
        <button type="button" class="tag-remove" tabindex="-1" aria-label={this.t('tags.remove', { tag })}
                disabled={!!this.getProp('disabled', false)} html={Icons.get('close')} onClick={() => this.removeTag(tag)} />
      </span>
    ));
  }

  // ────────── Rendering ──────────

  private suggestions(): string[] {
    const raw = this.getProp<string[] | string>('suggestions', '');
    return (Array.isArray(raw) ? raw : String(raw).split(',')).map(s => String(s).trim()).filter(Boolean);
  }

  /**
   * Before JavaScript: a native text box takes the entry box's place (what is typed posts under
   * `name`), and one hidden input carries the tags comma separated, so servers split every value of
   * `name` on commas. The hidden input rides on the empty live region, so nothing read aloud is hidden.
   */
  nativeStandIns() {
    const entry = this.control();
    if (!entry) return [];
    const text = document.createElement('input');
    text.type = 'text';
    const standIns: import('@/core/dom-utils').NativeStandIn[] = [
      { original: entry, fallback: text, attrs: { name: this.name || null, value: null, 'aria-label': this.getProp<string>('label') || this.name || null, placeholder: entry.getAttribute('placeholder') || null } }
    ];
    const live = this.$('.live');
    if (live && this.tags.length && this.name) {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      standIns.push({ original: live, fallback: hidden, mode: 'overlay', attrs: { name: this.name, value: this.tags.join(','), 'aria-hidden': null, tabindex: null } });
    }
    return standIns;
  }

  protected render(): Node {
    const disabled = !!this.getProp('disabled', false);
    const suggestions = this.suggestions();
    const listId = `${this.fieldId}-list`;
    const addOnBlur = !!this.getProp('add-on-blur', true); // a default-true boolean: add-on-blur="false" turns it off

    const control = (
      <div part="control" class="nx-control tags-control" onClick={(e: MouseEvent) => {
        // Clicking the empty part of the box starts typing
        if ((e.target as HTMLElement).closest('.tag')) return;
        this.control()?.focus();
      }}>
        <span class="tags" part="tags">{this.renderTags()}</span>
        <input type="text" id={this.fieldId} part="input" class="entry" autocomplete="off"
               placeholder={this.getProp<string>('placeholder') || (this.tags.length ? '' : this.t('tags.placeholder'))}
               disabled={disabled} list={suggestions.length ? listId : undefined}
               aria-describedby={`${this.fieldId}-help`}
               onKeyDown={(e: KeyboardEvent) => {
                 const input = e.target as HTMLInputElement;
                 if (e.key === 'Enter' || (e.key.length === 1 && this.separators().includes(e.key) && !e.ctrlKey && !e.metaKey)) {
                   e.preventDefault();
                   if (input.value.trim()) {
                     if (this.addTags(input.value)) input.value = '';
                   } else if (e.key === 'Enter') {
                     this.implicitSubmit();
                   }
                 } else if (e.key === 'Backspace' && !input.value && this.tags.length) {
                   this.removeTag(this.tags[this.tags.length - 1]);
                 }
               }}
               onPaste={(e: ClipboardEvent) => {
                 const text = e.clipboardData?.getData('text') ?? '';
                 if (!new RegExp(`[${this.separators().replace(/[\]\\^-]/g, '\\$&')}\\n\\r]`).test(text)) return; // a single value pastes as text
                 e.preventDefault();
                 this.addTags(text);
               }}
               onInput={() => { if (this.note) { this.note = ''; this.showNote(); } }}
               onBlur={(e: FocusEvent) => {
                 const input = e.target as HTMLInputElement;
                 if (addOnBlur && input.value.trim() && this.addTags(input.value)) input.value = '';
               }} />
        {suggestions.length > 0 && <datalist id={listId}>{suggestions.map(s => <option value={s} />)}</datalist>}
        <span class="live" role="status" aria-live="polite" />
      </div>
    );
    return this.renderField(control);
  }

  protected afterRender(): void {
    super.afterRender();
    if (this.pendingText) {
      const entry = this.control() as HTMLInputElement | null;
      if (entry) entry.value = this.pendingText;
      this.pendingText = '';
    }
  }

  protected styles(): string {
    return `
      ${this.fieldStyles()}

      .tags-control { flex-wrap: wrap; align-items: center; gap: 0.375rem; padding-block: 0.3125rem; cursor: text; }
      .tags { display: contents; }

      .tag {
        display: inline-flex;
        align-items: center;
        gap: 0.125rem;
        max-width: 100%;
        height: 1.625rem;
        padding: 0 0.25rem 0 0.5rem;
        border-radius: var(--radius-sm);
        background: var(--color-secondary);
        color: var(--color-secondary-foreground);
        font-size: 0.8125rem;
      }

      .tag-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .tag-remove {
        display: inline-flex;
        padding: 0.125rem;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: inherit;
        opacity: 0.7;
        cursor: pointer;
      }

      .tag-remove:hover:not(:disabled) { opacity: 1; background: color-mix(in srgb, currentColor 15%, transparent); }

      .entry, ::slotted(input[type="text"]) { flex: 1 1 6rem; min-width: 6rem; height: 1.625rem !important; min-height: 0 !important; }
      /* Before JavaScript the server's native box stands in for the entry box */
      ::slotted(input[type="text"]) { padding: 0; border: none; outline: none; background: transparent; color: inherit; font: inherit; }

      /* The browser draws an arrow on a text box with a datalist; suggestions here are not a dropdown field */
      .entry::-webkit-calendar-picker-indicator { display: none !important; }

      .live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    `;
  }
}

define('nx-tag-input', NXTagInput);
