/**
 * @file @/components/ui/form/combobox.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { hideTopLayer, keepInView, place, showTopLayer } from '@/core/position';
import { NXField, type FieldConfig } from '@/components/ui/form/field';
import { normalizeOptions, type SelectOption } from '@/components/ui/form/select';

export interface ComboboxConfig extends FieldConfig {
  value?: string | number;
  /** Options as objects, plain strings, or a `{ value: text }` map */
  options?: Array<SelectOption | string> | Record<string, string>;
  placeholder?: string;
  /** Shown when nothing matches (default "No results.") */
  emptyText?: string;
  /** Accept typed text that isn't an option */
  freeText?: boolean;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
  errorText?: string;
}

/**
 * Combobox: a text input that filters a list of options — a searchable select.
 *
 * ```html
 * <nx-combobox name="country" label="Country" placeholder="Search…">
 *   <option value="de">Germany</option><option value="fr">France</option>
 * </nx-combobox>
 * ```
 *
 * Type to filter, arrow keys to move, Enter to pick, Escape to close. Only
 * listed options are accepted unless `free-text` is set. Events: `change`.
 */
export class NXCombobox extends NXField {
  static get observedAttributes(): string[] {
    return ['name', 'label', 'placeholder', 'helper-text', 'error-text', 'icon', 'required', 'disabled', 'size', 'value', 'empty-text', 'free-text'];
  }

  private options: SelectOption[] = [];
  private childOptions = false;
  private currentValue = '';
  private query = '';
  private filtered: SelectOption[] = [];
  private active = -1;
  private isOpen = false;
  private observer: MutationObserver | null = null;

  get value(): string {
    return this.currentValue;
  }

  set value(value: string | number | null | undefined) {
    this.currentValue = value === null || value === undefined ? '' : String(value);
    this.syncInput();
    this.syncFormValue();
  }

  /** The option object for the current value. */
  get selectedOption(): SelectOption | null {
    return this.options.find(o => String(o.value) === this.currentValue) ?? null;
  }

  setOptions(options: ComboboxConfig['options']): void {
    this.childOptions = false;
    this.options = normalizeOptions(options);
    this.scheduleUpdate();
  }

  getOptions(): SelectOption[] {
    return this.options;
  }

  formValue(): string | null {
    return this.currentValue === '' ? null : this.currentValue;
  }

  protected onAttributeChange(name: string, _old: string | null, value: string | null): void {
    if (name === 'value') this.value = value ?? '';
  }

  protected applyConfig(key: string, value: any): void {
    if (key === 'value') {
      this.value = value;
      return;
    }
    super.applyConfig(key, value);
  }

  protected initialize(): void {
    // Server-rendered input holds the option text: map it back to a value
    const state = this.serverState?.value;
    const typed = Array.isArray(state) ? state[0] : state;
    if (typed !== undefined) {
      this.serverState = null;
      this.readChildOptions();
      const match = this.options.find(o => o.text === typed || String(o.value) === typed);
      if (match) this.currentValue = String(match.value);
      else if (this.getProp('free-text', false)) this.currentValue = typed;
    }
    super.initialize();
  }

  /** Before JavaScript: a native `<select>` of the options (or the text input with `free-text`). */
  nativeStandIns() {
    const input = this.input();
    if (!input || this.getProp('free-text', false)) return super.nativeStandIns();
    this.readChildOptions();
    const select = document.createElement('select');
    if (this.getProp('required', false)) select.required = true;
    if (this.getProp('disabled', false)) select.disabled = true;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = this.getProp<string>('placeholder') || '—';
    select.append(placeholder, ...this.options.map(o => {
      const option = document.createElement('option');
      option.value = String(o.value);
      option.textContent = o.text;
      option.disabled = !!o.disabled;
      option.selected = String(o.value) === this.currentValue;
      return option;
    }));
    return [{ original: input, fallback: select, attrs: { name: this.name || null, 'aria-label': this.getProp<string>('label') || null } }];
  }

  private input(): HTMLInputElement | null {
    return this.control() as HTMLInputElement | null;
  }

  private listbox(): HTMLElement | null {
    return this.$('.listbox') as HTMLElement | null;
  }

  private textFor(value: string): string {
    const option = this.options.find(o => String(o.value) === value);
    return option ? option.text : this.getProp('free-text', false) ? value : '';
  }

  /** Show the selected option's text in the input. */
  private syncInput(): void {
    const input = this.input();
    // Never overwrite what the user is typing
    if (input && !this.isOpen) input.value = this.textFor(this.currentValue);
  }

  private readChildOptions(): void {
    if (this.options.length && !this.childOptions) return;
    const children = Array.from(this.querySelectorAll('option'));
    if (!children.length) return;
    this.childOptions = true;
    this.options = children.map(o => ({ value: o.value, text: o.textContent ?? o.value, disabled: o.disabled }));
    if (!this.currentValue) this.currentValue = children.find(o => o.hasAttribute('selected'))?.value ?? '';
  }

  protected afterConnect(): void {
    this.observer ??= new MutationObserver(() => {
      if (this.childOptions || !this.options.length) this.scheduleUpdate();
    });
    this.observer.observe(this, { childList: true, subtree: true, characterData: true, attributes: true });
  }

  protected beforeDisconnect(): void {
    this.observer?.disconnect();
    this.close();
  }

  // ────────── Open / filter / pick ──────────

  open(): void {
    const listbox = this.listbox();
    const input = this.input();
    if (!listbox || !input || this.isOpen || this.getProp('disabled', false)) return;
    this.isOpen = true;
    this.filter(this.query);
    showTopLayer(listbox);
    listbox.style.minWidth = `${(this.$('.nx-control') as HTMLElement).offsetWidth}px`;
    place(listbox, this.$('.nx-control')!, 'bottom-start', 4);
    input.setAttribute('aria-expanded', 'true');
    window.addEventListener('resize', this.onViewportChange);
    window.addEventListener('scroll', this.onViewportChange, true);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    const listbox = this.listbox();
    if (listbox) hideTopLayer(listbox);
    this.input()?.setAttribute('aria-expanded', 'false');
    this.input()?.removeAttribute('aria-activedescendant');
    window.removeEventListener('resize', this.onViewportChange);
    window.removeEventListener('scroll', this.onViewportChange, true);
  }

  private onViewportChange = (e: Event): void => {
    // Scrolling the list itself is fine
    if (e.type === 'scroll' && this.listbox()?.contains(e.target as Node)) return;
    this.close();
  };

  private filter(query: string): void {
    this.query = query;
    const q = query.trim().toLowerCase();
    this.filtered = q ? this.options.filter(o => o.text.toLowerCase().includes(q)) : this.options.slice();
    const selected = this.filtered.findIndex(o => String(o.value) === this.currentValue);
    this.active = selected >= 0 && !q ? selected : this.filtered.findIndex(o => !o.disabled);
    this.renderOptions();
  }

  private pick(option: SelectOption): void {
    if (option.disabled) return;
    const changed = String(option.value) !== this.currentValue;
    this.currentValue = String(option.value);
    this.query = '';
    this.close();
    this.syncInput();
    if (changed) this.changed();
    else this.syncFormValue();
  }

  /** Leaving the field: keep a valid choice (or free text), drop half-typed text. */
  private commit(): void {
    const input = this.input();
    if (!input) return;
    const text = input.value.trim();
    const exact = this.options.find(o => o.text.toLowerCase() === text.toLowerCase());
    if (exact) {
      this.pick(exact);
      return;
    }
    const before = this.currentValue;
    if (!text) this.currentValue = '';
    else if (this.getProp('free-text', false)) this.currentValue = text;
    this.query = '';
    this.close();
    this.syncInput();
    if (before !== this.currentValue) this.changed();
  }

  private move(delta: number): void {
    if (!this.filtered.length) return;
    let index = this.active;
    for (let i = 0; i < this.filtered.length; i++) {
      index = (index + delta + this.filtered.length) % this.filtered.length;
      if (!this.filtered[index].disabled) break;
    }
    this.active = index;
    this.renderOptions();
  }

  private onKeyDown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        if (!this.isOpen) this.open();
        else this.move(e.key === 'ArrowDown' ? 1 : -1);
        break;
      case 'Home':
      case 'End':
        if (!this.isOpen) return;
        e.preventDefault();
        this.active = e.key === 'Home' ? -1 : 0;
        this.move(e.key === 'Home' ? 1 : -1);
        break;
      case 'Enter':
        if (this.isOpen && this.filtered[this.active]) {
          e.preventDefault();
          this.pick(this.filtered[this.active]);
        } else {
          this.commit();
          this.implicitSubmit();
        }
        break;
      case 'Escape':
        if (this.isOpen) {
          e.preventDefault();
          e.stopPropagation(); // don't close a surrounding dialog
          this.query = '';
          this.close();
          this.syncInput();
        }
        break;
      case 'Tab':
        this.commit();
        break;
    }
  }

  // ────────── Rendering ──────────

  /** Patch the option list in place (typing never re-renders the input). */
  private renderOptions(): void {
    const listbox = this.listbox();
    const input = this.input();
    if (!listbox || !input) return;
    const id = (i: number) => `${this.fieldId}-opt-${i}`;
    listbox.replaceChildren(...(this.filtered.length
      ? this.filtered.map((option, i) => (
          <div role="option" id={id(i)} part="option"
               class={['option', { active: i === this.active }]}
               aria-selected={String(String(option.value) === this.currentValue)}
               aria-disabled={option.disabled ? 'true' : undefined}
               // Keep focus in the input
               onPointerDown={(e: PointerEvent) => e.preventDefault()}
               onClick={() => this.pick(option)}>
            <span class="check" aria-hidden="true" html={Icons.get('check')} />
            {option.text}
          </div>
        ) as HTMLElement)
      : [<div class="empty" part="empty">{this.getProp('empty-text', 'No results.')}</div> as HTMLElement]));

    if (this.active >= 0 && this.filtered[this.active]) {
      input.setAttribute('aria-activedescendant', id(this.active));
      keepInView(listbox, listbox.children[this.active] as HTMLElement | undefined);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  protected render(): Node {
    this.readChildOptions();
    const icon = this.getProp<string>('icon');
    const listId = `${this.fieldId}-list`;

    return this.renderField(
      <div part="control" class={['nx-control', `size-${this.getProp('size', 'md')}`]}>
        {icon && <span class="nx-control-icon" html={Icons.get(icon)} />}
        <input id={this.fieldId} part="input" type="text" role="combobox" autocomplete="off"
               aria-autocomplete="list" aria-expanded="false" aria-controls={listId}
               aria-describedby={`${this.fieldId}-help`}
               placeholder={this.getProp<string>('placeholder')}
               required={!!this.getProp('required', false)} disabled={!!this.getProp('disabled', false)}
               value={this.textFor(this.currentValue)}
               onInput={(e: Event) => {
                 this.open();
                 this.filter((e.target as HTMLInputElement).value);
               }}
               onClick={() => this.open()}
               onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e)}
               onBlur={() => this.commit()} />
        <button type="button" class="toggle" part="toggle" tabindex={-1} aria-label="Show options"
                disabled={!!this.getProp('disabled', false)} html={Icons.get('chevron-down')}
                onPointerDown={(e: PointerEvent) => e.preventDefault()}
                onClick={() => {
                  if (this.isOpen) this.close();
                  else {
                    this.input()?.focus();
                    this.open();
                  }
                }} />
        <div id={listId} class="listbox" part="listbox" role="listbox" popover="manual"
             aria-label={this.getProp<string>('label') || this.getProp<string>('placeholder') || 'Options'} />
      </div>
    );
  }

  protected afterRender(): void {
    if (this.isOpen) this.renderOptions();
    super.afterRender();
  }

  protected styles(): string {
    return `
      ${this.fieldStyles()}

      .toggle {
        display: inline-flex;
        margin-right: -0.25rem;
        padding: 0.25rem;
        border: 0;
        background: none;
        color: var(--color-text-secondary);
        font-size: 1rem;
        cursor: pointer;
      }

      .listbox {
        position: fixed;
        inset: auto;
        margin: 0;
        max-height: min(18rem, 50vh);
        overflow-y: auto;
        padding: 0.25rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        box-shadow: var(--shadow-lg);
        font-size: 0.875rem;
      }

      .option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.375rem 0.5rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        user-select: none;
      }

      .option.active { background: var(--color-accent); }
      .option[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }

      .check {
        display: inline-flex;
        width: 1rem;
        visibility: hidden;
      }

      .option[aria-selected="true"] .check { visibility: visible; }

      .empty {
        padding: 0.75rem 0.5rem;
        color: var(--color-text-secondary);
        text-align: center;
      }
    `;
  }
}

define('nx-combobox', NXCombobox);
