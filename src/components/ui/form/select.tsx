/**
 * @file @/components/ui/form/select.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { NXField, type FieldConfig } from '@/components/ui/form/field';
import { place, showTopLayer, hideTopLayer, keepInView } from '@/core/position';

export interface SelectOption {
  value: string | number;
  text: string;
  disabled?: boolean;
  group?: string;
}

export interface SelectConfig extends FieldConfig {
  /** Current value */
  value?: string | number | (string | number)[];
  /** Options as objects, plain strings, or a `{ value: text }` map */
  options?: Array<SelectOption | string> | Record<string, string>;
  /** Text shown while empty */
  placeholder?: string;
  /** Allow several selections (the value becomes an array) */
  multiple?: boolean;
  /** Icon name from the built-in set (`NX.icons.names()`) or raw SVG */
  icon?: string;
  /** Control height */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Which list opens: `auto` (default) uses the browser's own list when it can be themed (Chromium 135+) or on touch
   * screens, and a themed list of ours elsewhere; `custom` and `native` force one.
   */
  popup?: 'auto' | 'custom' | 'native';
  /** Error shown under the field (for example from the server); marks it invalid */
  errorText?: string;
}

/**
 * Select, styled around the native `<select>` (accessible, mobile friendly,
 * never clipped by overflow containers).
 *
 * @example
 * ```typescript
 * { xtype: 'select', name: 'role', label: 'Role', options: ['Admin', 'Editor', 'Viewer'], value: 'Editor' }
 * { xtype: 'select', options: [{ value: 1, text: 'One' }, { value: 2, text: 'Two', group: 'More' }] }
 * ```
 * ```html
 * <nx-select name="role" label="Role" value="Editor">
 *   <option>Admin</option><option>Editor</option>
 *   <optgroup label="More"><option value="ro">Viewer</option></optgroup>
 * </nx-select>
 * ```
 */
export class NXSelect extends NXField {
  static get observedAttributes(): string[] {
    return [
      'name', 'placeholder', 'label', 'helper-text', 'error-text', 'icon',
      'required', 'disabled', 'multiple', 'size', 'popup', 'value'
    ];
  }

  private options: SelectOption[] = [];
  private currentValue: string | string[] = '';
  /** Options come from <option> children (HTML/template usage) and follow them */
  private childOptions = false;
  private observer: MutationObserver | null = null;
  /** The themed list while it is open (browsers that cannot theme the native one) */
  private listbox: HTMLElement | null = null;
  private active = -1;
  private typed = '';
  private typedAt = 0;
  private closeOnOutside: ((e: Event) => void) | null = null;

  constructor(config?: SelectConfig) {
    super();
    if (config) this.configure(config);
  }

  setOptions(options: SelectConfig['options']): void {
    this.childOptions = false;
    this.options = normalizeOptions(options);
    this.scheduleUpdate();
  }

  getOptions(): SelectOption[] {
    return this.options;
  }

  get value(): string | string[] {
    return this.currentValue;
  }

  set value(value: string | number | (string | number)[] | null | undefined) {
    this.currentValue = Array.isArray(value)
      ? value.map(String)
      : value === null || value === undefined ? '' : String(value);

    this.syncSelection();
    this.syncFormValue();
  }

  private syncSelection(): void {
    const select = this.control() as HTMLSelectElement | null;
    if (!select) return;
    const values = new Set(Array.isArray(this.currentValue) ? this.currentValue : [this.currentValue]);
    Array.from(select.options).forEach(option => (option.selected = values.has(option.value)));
    select.classList.toggle('placeholder', !this.currentValue.length);
  }

  /** Read `<option>`/`<optgroup>` children; they may be parsed after the element upgraded. */
  private readChildOptions(): void {
    if (this.options.length && !this.childOptions) return;
    const children = Array.from(this.querySelectorAll('option'));
    if (!children.length) return;
    this.childOptions = true;
    this.options = children.map(o => ({
      value: o.value,
      text: o.textContent ?? o.value,
      disabled: o.disabled,
      group: o.parentElement?.localName === 'optgroup' ? o.parentElement.getAttribute('label') ?? undefined : undefined
    }));
    if (!this.currentValue.length) {
      const selected = children.filter(o => o.hasAttribute('selected')).map(o => o.value);
      if (selected.length) this.currentValue = this.getProp('multiple', false) ? selected : selected[0];
    }
  }

  protected afterConnect(): void {
    this.observer ??= new MutationObserver(() => {
      if (this.childOptions || !this.options.length) this.scheduleUpdate();
    });
    this.observer.observe(this, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value', 'selected', 'disabled', 'label'] });
  }

  protected beforeDisconnect(): void {
    this.observer?.disconnect();
    this.closeList(false);
  }

  /** A redraw replaces the shadow root, and the list with it */
  protected update(): void {
    this.closeList(false);
    super.update();
  }

  protected afterRender(): void {
    // Explicit selection: an option's `selected` set before insertion isn't kept everywhere
    this.syncSelection();
    super.afterRender();
  }

  /** The selected option object(s). */
  get selectedOption(): SelectOption | SelectOption[] | null {
    const values = Array.isArray(this.currentValue) ? this.currentValue : [this.currentValue];
    const selected = this.options.filter(o => values.includes(String(o.value)));
    return this.getProp('multiple', false) ? selected : selected[0] ?? null;
  }

  protected defaultValue(): any {
    return this.getProp('multiple', false) ? [] : '';
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

  protected render(): Node {
    // HTML usage: <nx-select><option>…</option></nx-select>
    this.readChildOptions();

    const multiple = this.getProp('multiple', false);
    const placeholder = this.getProp<string>('placeholder', multiple ? '' : this.t('select.placeholder'));
    const icon = this.getProp<string>('icon');
    const values = new Set(Array.isArray(this.currentValue) ? this.currentValue : [this.currentValue]);

    const option = (o: SelectOption) => (
      <option value={String(o.value)} selected={values.has(String(o.value))} disabled={!!o.disabled}>{o.text}</option>
    );

    const groups = new Map<string, SelectOption[]>();
    const ungrouped: SelectOption[] = [];
    this.options.forEach(o => {
      if (o.group) {
        if (!groups.has(o.group)) groups.set(o.group, []);
        groups.get(o.group)!.push(o);
      } else {
        ungrouped.push(o);
      }
    });

    return this.renderField(
      <div part="control" class={['nx-control', `size-${this.getProp('size', 'md')}`, { multiple }]}>
        {icon && <span class="nx-control-icon" html={Icons.get(icon)} />}
        <select id={this.fieldId} part="select" name={this.name} multiple={!!multiple}
                required={!!this.getProp('required', false)} disabled={!!this.getProp('disabled', false)}
                class={{ placeholder: !this.currentValue.length }} aria-describedby={`${this.fieldId}-help`}
                onChange={(e: Event) => this.onSelectChange(e.target as HTMLSelectElement)}
                onMouseDown={(e: MouseEvent) => this.onSelectMouseDown(e)}
                onKeyDown={(e: KeyboardEvent) => this.onSelectKey(e)}>
          {!multiple && placeholder && (
            <option value="" selected={!this.currentValue} disabled={!!this.getProp('required', false)}>{placeholder}</option>
          )}
          {ungrouped.map(option)}
          {Array.from(groups).map(([group, opts]) => <optgroup label={group}>{opts.map(option)}</optgroup>)}
        </select>
        {!multiple && <span class="chevron" aria-hidden="true" html={Icons.get('chevron-down')} />}
      </div>
    );
  }

  // ────────── The themed list (where the browser cannot theme its own) ──────────

  /** Our list replaces the native popup, except on touch screens, where the native picker is better. */
  private usesCustomList(): boolean {
    if (this.getProp('multiple', false)) return false;
    const mode = this.getProp<string>('popup', 'auto');
    if (mode === 'custom') return true;
    if (mode === 'native') return false;
    try {
      if (typeof CSS !== 'undefined' && CSS.supports?.('appearance', 'base-select')) return false;
      return !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    } catch {
      return false;
    }
  }

  private nativeSelect(): HTMLSelectElement | null {
    return this.control() as HTMLSelectElement | null;
  }

  private onSelectMouseDown(e: MouseEvent): void {
    if (e.button !== 0 || !this.usesCustomList() || this.getProp('disabled', false)) return;
    e.preventDefault(); // no native popup
    this.nativeSelect()?.focus();
    if (this.listbox) this.closeList(true);
    else this.openList();
  }

  private onSelectKey(e: KeyboardEvent): void {
    if (!this.usesCustomList() || this.getProp('disabled', false)) return;
    const opens = e.key === 'Enter' || e.key === ' ' || ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.altKey);
    if (!opens) return;
    e.preventDefault();
    this.openList();
  }

  private optionEls(): HTMLElement[] {
    return Array.from(this.listbox?.querySelectorAll('[role="option"]') ?? []) as HTMLElement[];
  }

  private openList(): void {
    const select = this.nativeSelect();
    if (!select || this.listbox) return;
    const make = (o: HTMLOptionElement, i: number): HTMLElement => (
      <div role="option" id={`${this.fieldId}-o${i}`} class={['opt', { placeholder: o.value === '' }]} data-value={o.value}
           aria-selected={String(o.selected)} aria-disabled={o.disabled ? 'true' : undefined}
           onMouseMove={() => this.setActive(i)}
           onMouseDown={(ev: Event) => ev.preventDefault()}
           onClick={() => this.pick(i)}>
        <span class="check" aria-hidden="true" html={Icons.get('check')} />
        <span class="opt-text">{o.textContent}</span>
      </div> as HTMLElement
    );
    let n = 0;
    const children: HTMLElement[] = [];
    Array.from(select.children).forEach(child => {
      if (child instanceof HTMLOptionElement) children.push(make(child, n++));
      else if (child instanceof HTMLOptGroupElement) {
        const gid = `${this.fieldId}-g${n}`;
        children.push(
          <div role="group" aria-labelledby={gid}>
            <div class="group" id={gid}>{child.label}</div>
            {Array.from(child.children).map(o => make(o as HTMLOptionElement, n++))}
          </div> as HTMLElement
        );
      }
    });
    const label = this.getProp<string>('label') || this.getProp<string>('placeholder') || this.name || undefined;
    const box = (
      <div part="listbox" class="listbox" role="listbox" tabindex="-1" aria-label={label}
           onKeyDown={(e: KeyboardEvent) => this.onListKey(e)}
           onBlur={(e: FocusEvent) => { if (!this.listbox?.contains(e.relatedTarget as Node | null) && e.relatedTarget !== select) this.closeList(false); }}>
        {children}
      </div> as HTMLElement
    );
    this.listbox = box;
    this.$('.nx-control')?.append(box);
    box.style.minWidth = `${select.offsetWidth}px`;
    showTopLayer(box);
    place(box, select, 'bottom-start', 4);
    // Anything outside the list closes it, and so does moving the page under it
    this.closeOnOutside = (ev: Event) => {
      if (ev.type === 'scroll' && box.contains(ev.target as Node)) return;
      if (ev.type === 'pointerdown' && ev.composedPath().some(n => n === box || n === select)) return;
      this.closeList(false);
    };
    document.addEventListener('pointerdown', this.closeOnOutside, true);
    window.addEventListener('scroll', this.closeOnOutside, true);
    window.addEventListener('resize', this.closeOnOutside);
    const els = this.optionEls();
    this.setActive(Math.max(0, els.findIndex(el => el.getAttribute('aria-selected') === 'true')));
    box.focus({ preventScroll: true });
    keepInView(box, els[this.active]);
  }

  private closeList(refocus: boolean): void {
    const box = this.listbox;
    if (!box) return;
    this.listbox = null;
    if (this.closeOnOutside) {
      document.removeEventListener('pointerdown', this.closeOnOutside, true);
      window.removeEventListener('scroll', this.closeOnOutside, true);
      window.removeEventListener('resize', this.closeOnOutside);
      this.closeOnOutside = null;
    }
    hideTopLayer(box);
    box.remove();
    if (refocus) this.nativeSelect()?.focus({ preventScroll: true });
  }

  private setActive(index: number): void {
    const els = this.optionEls();
    if (!els[index]) return;
    this.active = index;
    els.forEach((el, i) => el.classList.toggle('active', i === index));
    this.listbox?.setAttribute('aria-activedescendant', els[index].id);
  }

  /** The next enabled option from `from` in direction `step` (stays put at the ends) */
  private step(from: number, step: 1 | -1): number {
    const els = this.optionEls();
    for (let i = from + step; i >= 0 && i < els.length; i += step) if (els[i].getAttribute('aria-disabled') !== 'true') return i;
    return from;
  }

  private pick(index: number): void {
    const el = this.optionEls()[index];
    const select = this.nativeSelect();
    if (!el || !select || el.getAttribute('aria-disabled') === 'true') return;
    select.value = el.dataset.value ?? '';
    this.closeList(true);
    this.onSelectChange(select);
  }

  private onListKey(e: KeyboardEvent): void {
    const els = this.optionEls();
    const go = (i: number) => { e.preventDefault(); this.setActive(i); keepInView(this.listbox!, els[i]); };
    switch (e.key) {
      case 'ArrowDown': return go(this.step(this.active, 1));
      case 'ArrowUp': return go(this.step(this.active, -1));
      case 'Home': return go(this.step(-1, 1));
      case 'End': return go(this.step(els.length, -1));
      case 'Enter':
      case ' ':
        e.preventDefault();
        return this.pick(this.active);
      case 'Escape':
        // Closes the list only: a second Escape reaches an enclosing dialog
        e.preventDefault();
        e.stopPropagation();
        return this.closeList(true);
      case 'Tab':
        return this.closeList(true); // focus carries on from the select
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          // Type-ahead: letters typed together jump to the next option that starts with them
          const now = Date.now();
          this.typed = now - this.typedAt > 700 ? e.key.toLowerCase() : this.typed + e.key.toLowerCase();
          this.typedAt = now;
          const texts = els.map(el => (el.textContent ?? '').trim().toLowerCase());
          const from = this.typed.length === 1 ? this.active + 1 : this.active;
          const hit = [...texts.keys()].map(k => (from + k) % texts.length).find(k => texts[k].startsWith(this.typed) && els[k].getAttribute('aria-disabled') !== 'true');
          if (hit !== undefined) go(hit);
        }
    }
  }

  private onSelectChange(select: HTMLSelectElement): void {
    this.currentValue = select.multiple ? Array.from(select.selectedOptions).map(o => o.value) : select.value;
    select.classList.toggle('placeholder', !this.currentValue.length);
    this.changed();
  }

  protected styles(): string {
    return `
      ${this.fieldStyles()}

      .nx-control { position: relative; padding-inline-end: 0; }

      select {
        appearance: none;
        padding-inline-end: 2.25rem !important;
        cursor: pointer;
      }

      select.placeholder { color: var(--color-text-secondary); }
      option { color: var(--color-text); background: var(--color-surface); }

      .chevron {
        position: absolute;
        inset-inline-end: 0.75rem;
        display: inline-flex;
        color: var(--color-text-secondary);
        pointer-events: none;
      }

      /*
       * Browsers with customizable selects (Chromium 135+) let us style the dropdown itself: it matches
       * the theme and the field's width instead of showing the operating system's list. Elsewhere the
       * native popup is used, unchanged: nothing depends on this.
       */
      @supports (appearance: base-select) {
        select:not([multiple]),
        select:not([multiple])::picker(select) { appearance: base-select; }

        select:not([multiple])::picker-icon { display: none; }

        /* A base-select field lays out its value as flex content: centre it like the other fields */
        select:not([multiple]) { display: flex; align-items: center; }

        /* The list lines up with the field, not with the padding inside it: the select fills the whole control */
        .nx-control:not(.multiple):not(:has(.nx-control-icon)) { padding-inline-start: 0; }
        .nx-control:not(.multiple):not(:has(.nx-control-icon)) select { padding-inline-start: 0.75rem !important; }

        select:not([multiple])::picker(select) {
          box-sizing: border-box;
          min-width: anchor-size(width);
          margin-block: 0.25rem;
          padding: 0.25rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-background);
          color: var(--color-text);
          box-shadow: var(--shadow-lg);
          font: inherit;
        }

        select:not([multiple]) option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-height: 2rem;
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--color-text);
          font: inherit;
          cursor: pointer;
        }

        select:not([multiple]) option:hover,
        select:not([multiple]) option:focus-visible { background: var(--color-accent); outline: none; }
        select:not([multiple]) option:checked { font-weight: 600; }
        select:not([multiple]) option:disabled { color: var(--color-text-secondary); cursor: default; }
        select:not([multiple]) option:disabled:hover { background: transparent; }
        select:not([multiple]) option::checkmark { color: var(--color-primary); }
      }

      /* The themed list, used where the browser cannot theme its own */
      .listbox {
        box-sizing: border-box;
        position: fixed;
        inset: auto;
        max-height: min(20rem, 60vh);
        overflow-y: auto;
        margin: 0;
        padding: 0.25rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-background);
        color: var(--color-text);
        box-shadow: var(--shadow-lg);
        font: inherit;
        outline: none;
      }

      .listbox .group { padding: 0.375rem 0.5rem 0.125rem; color: var(--color-text-secondary); font-size: 0.75rem; font-weight: 600; }

      .opt {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 2rem;
        padding: 0.25rem 0.5rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
      }

      .opt.active { background: var(--color-accent); }
      .opt[aria-selected="true"] { font-weight: 600; }
      .opt[aria-disabled="true"] { color: var(--color-text-secondary); cursor: default; }
      .opt.placeholder { color: var(--color-text-secondary); }
      .check { display: inline-flex; width: 1rem; height: 1rem; flex: none; color: var(--color-primary); visibility: hidden; }
      .opt[aria-selected="true"] .check { visibility: visible; }
      .check svg { width: 100%; height: 100%; }
      .opt-text { min-width: 0; overflow-wrap: anywhere; }

      .multiple { padding: 0.25rem; }
      .multiple select { padding: 0 !important; min-height: 6rem; }
      .multiple option { padding: 0.375rem 0.5rem; border-radius: var(--radius-sm); }
    `;
  }
}

export function normalizeOptions(options: SelectConfig['options']): SelectOption[] {
  if (!options) return [];
  if (!Array.isArray(options)) {
    return Object.entries(options).map(([value, text]) => ({ value, text }));
  }
  return options.map(o => (typeof o === 'string' ? { value: o, text: o } : o));
}

define('nx-select', NXSelect);
