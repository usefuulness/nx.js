import { define } from '@/core/registry';
import { NXField, type FieldConfig } from '@/components/ui/form/field';
import { resolveCodeEngine, type CodeEngine, type CodeEngineOptions } from '@/core/code-engine';

export interface CodeEditorConfig extends FieldConfig {
  /** The text */
  value?: string;
  /** `json` (checked as you type), `javascript`, `groovy`, `java`, `properties`, `text`, or any language the engine knows */
  language?: string;
  /** Show the text but do not allow edits */
  readonly?: boolean;
  /** Numbers in the margin (default on; off when `wrap` is on) */
  lineNumbers?: boolean;
  /** Spaces per indent (default 2) */
  tabSize?: number;
  /** Wrap long lines instead of scrolling sideways */
  wrap?: boolean;
  /** Height of the editor (CSS size or px number; default 16rem) */
  height?: number | string;
  placeholder?: string;
  /** Which registered engine edits the text (default: the built-in plain one). Loaded when first needed. */
  engine?: string;
  /** Do not check JSON as it is typed */
  noJsonCheck?: boolean;
}

const px = (v: unknown) => (typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v)) ? `${v}px` : String(v));

/**
 * Check JSON and say where it goes wrong. Browsers word (and place) JSON.parse errors differently, so the position
 * comes from a small scanner of our own: the same answer everywhere.
 */
function jsonProblem(text: string): { message: string; line: number; column: number } | null {
  if (!text.trim()) return null;
  let i = 0;
  const fail = (message: string, at = i): never => { throw { message, at }; };
  const ws = () => { while (i < text.length && /[ \t\r\n]/.test(text[i])) i++; };
  const describe = () => (i >= text.length ? 'the text ends too soon' : `unexpected "${text[i]}"`);
  const value = (): void => {
    ws();
    const c = text[i];
    if (c === '{') {
      i++; ws();
      if (text[i] === '}') { i++; return; }
      for (;;) {
        ws();
        if (text[i] !== '"') fail(`${describe()}, a name in quotes was expected`);
        string(); ws();
        if (text[i] !== ':') fail(`${describe()}, ":" was expected`);
        i++; value(); ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; return; }
        fail(`${describe()}, "," or "}" was expected`);
      }
    } else if (c === '[') {
      i++; ws();
      if (text[i] === ']') { i++; return; }
      for (;;) {
        value(); ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') { i++; return; }
        fail(`${describe()}, "," or "]" was expected`);
      }
    } else if (c === '"') string();
    else if (/-|\d/.test(c ?? '')) {
      const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
      if (!m) fail('not a valid number');
      i += m![0].length;
    } else {
      const word = /^(true|false|null)/.exec(text.slice(i));
      if (!word) fail(`${describe()}, a value was expected`);
      i += word![0].length;
    }
  };
  const string = (): void => {
    i++;
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\n') fail('a string cannot continue onto a new line');
      if (text[i] === '\\') { i++; if (!/["\\/bfnrtu]/.test(text[i] ?? '')) fail('unknown escape'); }
      i++;
    }
    if (text[i] !== '"') fail('a string is not closed');
    i++;
  };
  try {
    value(); ws();
    if (i < text.length) fail(`${describe()}, nothing should follow the value`);
    return null;
  } catch (e) {
    const err = e as { message: string; at: number };
    if (typeof err?.at !== 'number') throw e;
    const before = text.slice(0, Math.min(err.at, text.length));
    return { message: err.message, line: before.split('\n').length, column: before.length - before.lastIndexOf('\n') };
  }
}

/**
 * A code editor that is a form field: `value`, `required`, validation, `name` and native form posting work as in
 * any other field. The built-in editor is a text area with line numbers, Tab and Shift+Tab indentation, auto-indent,
 * the cursor position, JSON checking, and an "Unsaved changes" mark; it works before any script runs. For highlighting,
 * completion or find and replace, register an engine behind the contract in `nx.js` (`registerCodeEngineLoader`) and
 * name it with `engine`: it is loaded only when an editor asks for it, and disposed when the editor goes away.
 *
 * Tab inserts an indent. To leave the editor with the keyboard, press Escape, then Tab.
 *
 * ```tsx
 * <CodeEditor name="script" label="Script" language="json" value={text} onChange={e => …} />
 * ```
 *
 * Setting `value` from code is a fresh start (the text is clean); typing makes it dirty until `markClean()`.
 * Events: `change`, `dirty-change` (`detail.dirty`), `cursor` (`detail.line`, `detail.column`), `ready` (an engine is mounted), `engine-error`.
 */
export class NXCodeEditor extends NXField {
  static get observedAttributes(): string[] {
    return ['name', 'label', 'helper-text', 'error-text', 'required', 'disabled', 'readonly', 'value', 'language', 'line-numbers', 'tab-size', 'wrap', 'height', 'placeholder', 'engine', 'no-json-check'];
  }

  private currentValue = '';
  private baseline = '';
  private dirty = false;
  private engine: CodeEngine | null = null;
  private custom = false;
  private rendered = false;
  private escaped = false;
  private mountToken = 0;
  private cursor = { line: 1, column: 1 };

  // ────────── Value and unsaved changes ──────────

  get value(): string {
    return this.engine ? this.engine.getValue() : this.currentValue;
  }

  set value(value: string | null | undefined) {
    const text = value === null || value === undefined ? '' : String(value);
    this.currentValue = text;
    if (this.engine && this.engine.getValue() !== text) this.engine.setValue(text);
    this.baseline = text;
    this.setDirty(false);
    this.afterEdit(false);
  }

  /** Whether the text differs from the last value set or marked clean. */
  isDirty(): boolean {
    return this.dirty;
  }

  /** The text as it is now is the saved one (call it after saving). */
  markClean(): void {
    this.baseline = this.value;
    this.setDirty(false);
  }

  /** Go back to the saved text. */
  revert(): void {
    this.value = this.baseline;
    this.emit('change', { value: this.value });
  }

  private setDirty(dirty: boolean): void {
    if (dirty === this.dirty) return;
    this.dirty = dirty;
    this.toggleAttribute('dirty', dirty);
    this.syncStatus();
    this.emit('dirty-change', { dirty });
  }

  protected onAttributeChange(name: string, _old: string | null, value: string | null): void {
    if (name === 'value') this.value = value ?? '';
    if (name === 'engine' && this.rendered) void this.mountEngine();
  }

  protected applyConfig(key: string, value: any): void {
    if (key === 'value') { this.value = value; return; }
    super.applyConfig(key, value);
  }

  // ────────── Rendering ──────────

  private options(): CodeEngineOptions {
    const wrap = !!this.getProp('wrap', false);
    return {
      language: this.getProp<string>('language', 'text'),
      value: this.currentValue,
      readOnly: !!this.getProp('readonly', false) || !!this.getProp('disabled', false),
      lineNumbers: this.getProp<boolean>('line-numbers', true) && !wrap,
      tabSize: Math.max(1, Math.min(8, Number(this.getProp('tab-size', 2)) || 2)),
      wrap,
      placeholder: this.getProp<string>('placeholder'),
      labelledBy: undefined,
      describedBy: `${this.fieldId}-help ${this.fieldId}-hint`,
      onChange: v => this.onEngineChange(v),
      onCursor: (line, column) => { this.cursor = { line, column }; this.syncStatus(); this.emit('cursor', { line, column }); },
      onFocus: () => this.classList.add('focused'),
      onBlur: () => { this.escaped = false; this.classList.remove('focused'); }
    };
  }

  protected render(): Node {
    const o = this.options();
    const height = px(this.getProp('height', '16rem'));
    return this.renderField(
      <div part="editor" class="editor" style={{ height }}>
        <div class="host">
          {o.lineNumbers && <div class="gutter" aria-hidden="true" />}
          <textarea id={this.fieldId} part="input" class="code" spellcheck={false} autocapitalize="off" autocomplete="off" wrap={o.wrap ? 'soft' : 'off'}
                    name={this.getProp<string>('name')} placeholder={o.placeholder} required={!!this.getProp('required', false)}
                    disabled={!!this.getProp('disabled', false)} readonly={o.readOnly} aria-describedby={o.describedBy}
                    value={this.currentValue} />
        </div>
        <div class="status" part="status">
          <span class="pos" />
          <span class="lang">{o.language}</span>
          <span class="dirty" role="status" />
          <span class="hint" id={`${this.fieldId}-hint`}>{this.t('code.leaveHint')}</span>
        </div>
      </div>
    );
  }

  protected update(): void {
    // The engine owns the editing surface: after the first draw, changes are applied in place so it keeps focus, scroll and undo history
    if (this.rendered) { this.syncChrome(); return; }
    super.update();
  }

  protected afterRender(): void {
    super.afterRender();
    if (this.rendered) return;
    this.rendered = true;
    const host = this.$('.host') as HTMLElement;
    this.engine = this.builtin(host);
    this.syncChrome();
    this.syncStatus();
    this.setupResize(host);
    if (this.getProp('engine', 'textarea') !== 'textarea') void this.mountEngine();
  }

  protected afterConnect(): void {
    // Reconnected after being removed: bring a registered engine back (the built-in one never left)
    if (this.rendered && this.custom && !this.engine) void this.mountEngine();
  }

  protected cleanup(): void {
    this.resizer?.disconnect();
    this.resizer = null;
    if (this.custom && this.engine) {
      this.currentValue = this.engine.getValue();
      this.engine.dispose();
      this.engine = null;
    }
  }

  private resizer: ResizeObserver | null = null;
  private setupResize(host: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizer?.disconnect();
    this.resizer = new ResizeObserver(() => this.engine?.resize?.());
    this.resizer.observe(host);
  }

  /** Apply label, hint, error, size and the editing options in place. */
  private syncChrome(): void {
    const o = this.options();
    const label = this.$('.nx-field-label');
    if (label) label.firstChild && (label.firstChild.textContent = this.getProp<string>('label', ''));
    (this.$('.editor') as HTMLElement | null)?.style.setProperty('height', px(this.getProp('height', '16rem')));
    (this.$('.lang') as HTMLElement | null)?.replaceChildren(o.language);
    this.engine?.setLanguage?.(o.language);
    this.engine?.setReadOnly(o.readOnly);
    this.engine?.setDisabled?.(!!this.getProp('disabled', false));
    this.engine?.setOptions?.({ lineNumbers: o.lineNumbers, tabSize: o.tabSize, wrap: o.wrap, placeholder: o.placeholder });
    this.classList.toggle('disabled', !!this.getProp('disabled', false));
    this.showError(this.touched ? this.validationMessage() : '');
  }

  private syncStatus(): void {
    const pos = this.$('.pos');
    if (pos) pos.textContent = this.t('code.position', { line: this.cursor.line, column: this.cursor.column });
    const dirty = this.$('.dirty');
    if (dirty) dirty.textContent = this.dirty ? this.t('code.unsaved') : '';
  }

  // ────────── Engines ──────────

  private async mountEngine(): Promise<void> {
    const name = this.getProp<string>('engine', 'textarea');
    const token = ++this.mountToken;
    const host = this.$('.host') as HTMLElement | null;
    if (!host) return;
    if (!name || name === 'textarea') {
      // Back to the built-in editor
      if (this.custom) { this.currentValue = this.value; this.engine?.dispose(); this.custom = false; host.replaceChildren(); this.engine = null; this.showBuiltin(host); }
      return;
    }
    const factory = await resolveCodeEngine(name);
    if (token !== this.mountToken || !this.isConnected) return;
    if (!factory) { this.emit('engine-error', { engine: name, message: `No code engine named "${name}" is registered, or it failed to load` }); return; }
    const hadFocus = !!this.shadowRoot?.activeElement;
    const value = this.value;
    try {
      this.engine?.dispose();
      this.engine = null;
      host.replaceChildren();
      this.custom = true;
      const engine = await factory(host, { ...this.options(), value });
      if (token !== this.mountToken || !this.isConnected) { engine.dispose(); return; }
      this.engine = engine;
      this.currentValue = value;
      this.setupResize(host);
      this.syncChrome();
      if (hadFocus) engine.focus();
      this.emit('ready', { engine: name });
    } catch (e) {
      // The engine could not start: carry on with the built-in one, with the text intact
      this.custom = false;
      host.replaceChildren();
      this.currentValue = value;
      this.showBuiltin(host);
      this.emit('engine-error', { engine: name, message: (e as Error)?.message ?? String(e) });
    }
  }

  protected control(): HTMLInputElement | HTMLTextAreaElement | null {
    if (this.custom) return this.engine?.control?.() ?? null;
    return this.$('textarea.code') as HTMLTextAreaElement | null;
  }

  focus(options?: FocusOptions): void {
    if (this.engine) this.engine.focus();
    else super.focus(options);
  }

  undo(): void { this.engine?.undo?.() ?? this.native()?.focus(); if (!this.engine?.undo) (document as any).execCommand?.('undo'); }
  redo(): void { this.engine?.redo?.() ?? this.native()?.focus(); if (!this.engine?.redo) (document as any).execCommand?.('redo'); }
  /** Open the engine's find (the built-in editor has none). */
  find(): void { this.engine?.find?.(); }

  /** Pretty-print the text (JSON with the built-in editor; any language the engine can). */
  format(): boolean {
    if (this.engine?.format && this.custom) { this.engine.format(); this.afterEdit(true); return true; }
    if (this.getProp<string>('language', 'text') !== 'json' || jsonProblem(this.value) || !this.value.trim()) return false;
    const next = JSON.stringify(JSON.parse(this.value), null, this.options().tabSize);
    this.engine?.setValue(next);
    this.currentValue = next;
    this.afterEdit(true);
    return true;
  }

  private native(): HTMLTextAreaElement | null {
    return this.custom ? null : (this.$('textarea.code') as HTMLTextAreaElement | null);
  }

  // ────────── The built-in editor: a text area ──────────

  private showBuiltin(host: HTMLElement): void {
    const o = this.options();
    const gutter = o.lineNumbers ? <div class="gutter" aria-hidden="true" /> : null;
    const area = (
      <textarea id={this.fieldId} part="input" class="code" spellcheck={false} autocapitalize="off" autocomplete="off" wrap={o.wrap ? 'soft' : 'off'}
                name={this.getProp<string>('name')} placeholder={o.placeholder} required={!!this.getProp('required', false)}
                disabled={!!this.getProp('disabled', false)} readonly={o.readOnly} aria-describedby={o.describedBy} value={this.currentValue} />
    ) as HTMLTextAreaElement;
    host.replaceChildren(...(gutter ? [gutter as Node] : []), area);
    this.engine = this.builtin(host);
  }

  private builtin(host: HTMLElement): CodeEngine {
    const area = host.querySelector('textarea.code') as HTMLTextAreaElement;
    const gutter = () => host.querySelector('.gutter') as HTMLElement | null;
    let tab = this.options().tabSize;
    const paint = () => {
      const g = gutter();
      if (!g) return;
      const lines = area.value.split('\n').length;
      if (g.childElementCount !== lines) g.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
      g.scrollTop = area.scrollTop;
    };
    const cursor = () => {
      const upto = area.value.slice(0, area.selectionStart);
      const line = upto.split('\n').length;
      const column = area.selectionStart - (upto.lastIndexOf('\n') + 1) + 1;
      if (line !== this.cursor.line || column !== this.cursor.column) { this.cursor = { line, column }; this.syncStatus(); this.emit('cursor', { line, column }); }
    };
    /** Insert text where the selection is, as one undoable edit when the browser allows it */
    const insert = (text: string, start = area.selectionStart, end = area.selectionEnd, select: 'end' | 'all' = 'end') => {
      area.setSelectionRange(start, end);
      const done = typeof document.execCommand === 'function' && !!(() => { try { return document.execCommand('insertText', false, text); } catch { return false; } })();
      if (!done) { area.setRangeText(text, start, end, select === 'all' ? 'select' : 'end'); area.dispatchEvent(new Event('input', { bubbles: true })); }
      else if (select === 'all') area.setSelectionRange(start, start + text.length);
    };
    const lineStart = (i: number) => area.value.lastIndexOf('\n', i - 1) + 1;
    const unit = () => ' '.repeat(tab);

    area.addEventListener('input', () => { paint(); this.onEngineChange(area.value); });
    area.addEventListener('scroll', paint);
    area.addEventListener('keyup', cursor);
    area.addEventListener('click', cursor);
    area.addEventListener('select', cursor);
    area.addEventListener('focus', () => this.classList.add('focused'));
    area.addEventListener('blur', () => { this.escaped = false; this.classList.remove('focused'); });
    area.addEventListener('keydown', (e: KeyboardEvent) => {
      if (area.readOnly) return;
      if (e.key === 'Escape') { this.escaped = true; return; }
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Escape, then Tab, leaves the editor (otherwise a keyboard user would be trapped in it)
        if (this.escaped) { this.escaped = false; return; }
        e.preventDefault();
        const { selectionStart: s, selectionEnd: en, value } = area;
        const multi = value.slice(s, en).includes('\n');
        if (!multi && !e.shiftKey) { insert(unit()); return; }
        // Indent or outdent every line the selection touches
        const from = lineStart(s);
        const block = value.slice(from, en);
        const lines = block.split('\n');
        const next = lines.map(l => (e.shiftKey ? l.replace(new RegExp(`^( {1,${tab}}|\\t)`), '') : unit() + l)).join('\n');
        insert(next, from, en, 'all');
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && area.selectionStart === area.selectionEnd) {
        const at = area.selectionStart;
        const line = area.value.slice(lineStart(at), at);
        const indent = /^[ \t]*/.exec(line)![0];
        const open = /[{[(]\s*$/.test(line);
        const close = /^\s*[}\])]/.test(area.value.slice(at));
        e.preventDefault();
        if (open && close) { insert(`\n${indent}${unit()}\n${indent}`); const p = at + 1 + indent.length + tab; area.setSelectionRange(p, p); }
        else insert(`\n${indent}${open ? unit() : ''}`);
      }
    });
    paint();
    return {
      getValue: () => area.value,
      setValue: v => { area.value = v; paint(); },
      setReadOnly: r => { area.readOnly = r; },
      setDisabled: d => { area.disabled = d; },
      setOptions: o => {
        if (o.tabSize) tab = o.tabSize;
        if (o.wrap !== undefined) area.setAttribute('wrap', o.wrap ? 'soft' : 'off');
        if (o.placeholder !== undefined) area.placeholder = o.placeholder ?? '';
        if (o.lineNumbers !== undefined && !!gutter() !== o.lineNumbers) { this.showBuiltin(host); }
      },
      focus: () => area.focus(),
      control: () => area,
      dispose: () => { /* the text area is the component's own: nothing to release */ }
    };
  }

  // ────────── Changes ──────────

  private onEngineChange(value: string): void {
    this.currentValue = value;
    this.afterEdit(true);
  }

  private afterEdit(byUser: boolean): void {
    this.syncFormValue();
    if (byUser) {
      this.setDirty(this.value !== this.baseline);
      this.changed();
    }
  }

  /** JSON is checked as it is typed (turn it off with `no-json-check`). */
  validationMessage(): string {
    if (this.getProp<string>('language', 'text') === 'json' && !this.getProp('no-json-check', false)) {
      const problem = jsonProblem(this.value);
      if (problem) {
        const message = this.t('code.invalidJson', { message: problem.message, line: problem.line, column: problem.column });
        const control = this.control();
        control?.setCustomValidity(message);
        this.internals?.setValidity({ customError: true }, message, control ?? undefined);
        return message;
      }
    }
    return super.validationMessage();
  }

  protected defaultValue(): string {
    return '';
  }

  protected styles(): string {
    return `${this.fieldStyles()}
      :host { display: block; }
      .editor { display: flex; flex-direction: column; min-height: 6rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-background); overflow: hidden; resize: vertical; }
      :host(.focused) .editor { outline: 2px solid var(--color-ring); outline-offset: -1px; }
      .nx-field.invalid .editor { border-color: var(--color-error); }
      :host(.disabled) .editor { opacity: 0.6; }
      .host { flex: 1; min-height: 0; display: flex; }
      .gutter { flex: none; padding: 0.5rem 0.5rem 0.5rem 0.75rem; text-align: end; white-space: pre; overflow: hidden; user-select: none; color: var(--color-text-secondary); background: var(--color-muted); border-inline-end: 1px solid var(--color-border); font: 0.8125rem/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
      textarea.code { flex: 1; min-width: 0; margin: 0; padding: 0.5rem 0.75rem; border: 0; outline: 0; resize: none; background: transparent; color: var(--color-text); font: 0.8125rem/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; tab-size: 2; white-space: pre; overflow: auto; }
      textarea.code[wrap="soft"] { white-space: pre-wrap; overflow-wrap: anywhere; }
      textarea.code::placeholder { color: var(--color-text-secondary); }
      .status { flex: none; display: flex; align-items: center; gap: 0.75rem; padding: 0.25rem 0.75rem; border-top: 1px solid var(--color-border); background: var(--color-muted); color: var(--color-text-secondary); font-size: 0.75rem; }
      .lang { text-transform: uppercase; letter-spacing: 0.04em; }
      .dirty { color: var(--color-warning-text); font-weight: 600; }
      .dirty:empty { display: none; }
      .hint { margin-inline-start: auto; position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      :host(.focused) .hint { position: static; width: auto; height: auto; overflow: visible; clip-path: none; }
    `;
  }
}

define('nx-code-editor', NXCodeEditor);
