import { define } from '@/core/registry';
import { NXField, type FieldConfig } from '@/components/ui/form/field';
import { resolveCodeEngine, type CodeEngine, type CodeEngineOptions } from '@/core/code-engine';
import { codeLanguageForFile, findCodeLanguage, listCodeLanguages, resolveCodeLanguage, tokenizeCode, type CodeLanguage, type Token } from '@/core/code-languages';

export interface CodeEditorConfig extends FieldConfig {
  /** The text */
  value?: string;
  /** A language id or alias (`groovy`, `js`, `yml`…): see `listCodeLanguages()`. Colours the text, sets the comment and indent rules, and checks JSON, JSON with comments, XML and properties as you type. Default `text` */
  language?: string;
  /** A file name or path (`nightly.groovy`, `Dockerfile`): the language is taken from it when `language` is not set */
  filename?: string;
  /** Show a list in the status bar to change the language (`languages="json,yaml,xml"` limits the choices) */
  languageSelect?: boolean;
  /** Colour the text (default on; off with wrap, and for very long text) */
  highlight?: boolean;
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
  /** Do not check the text as it is typed (JSON, JSON with comments, XML, properties) */
  noCheck?: boolean;
}

const px = (v: unknown) => (typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v)) ? `${v}px` : String(v));

/**
 * A code editor that is a form field: `value`, `required`, validation, `name` and native form posting work as in
 * any other field. The built-in editor is a text area with line numbers, Tab and Shift+Tab indentation, auto-indent,
 * the cursor position, colours for dozens of languages, comment toggling (Ctrl/⌘+/), checks for JSON, XML and properties as you type, and an "Unsaved changes" mark; it works before any script runs. For highlighting,
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
    return ['name', 'label', 'helper-text', 'error-text', 'required', 'disabled', 'readonly', 'value', 'language', 'filename', 'language-select', 'languages', 'highlight', 'line-numbers', 'tab-size', 'wrap', 'height', 'placeholder', 'engine', 'no-check', 'no-json-check'];
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

  /** The language in force: `language`, else the one the `filename` says, else plain text. */
  private codeLanguage(): CodeLanguage {
    const named = this.getProp<string>('language');
    if (named) return resolveCodeLanguage(named);
    return codeLanguageForFile(this.getProp<string>('filename')) ?? resolveCodeLanguage('text');
  }

  /** The language ids this editor offers in its list. */
  private choices(): CodeLanguage[] {
    const wanted = String(this.getProp('languages', '') || '').split(/[\s,]+/).filter(Boolean).map(w => findCodeLanguage(w)).filter((l): l is CodeLanguage => !!l);
    return wanted.length ? wanted : listCodeLanguages();
  }

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
      language: this.codeLanguage().id,
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

  /** Whether the colours are drawn: on by default, off when wrapping (the layers would not line up) or for very long text. */
  private colours(text = this.currentValue): boolean {
    return !!this.getProp('highlight', true) && !this.getProp('wrap', false) && !!this.codeLanguage().rules?.length && text.length <= 200_000;
  }

  private highlightNodes(text: string): Node[] {
    const nodes: Node[] = tokenizeCode(text, this.codeLanguage()).map((t: Token) => {
      if (!t.type) return document.createTextNode(t.text);
      const span = document.createElement('span');
      span.className = `t-${t.type}`;
      span.textContent = t.text; // text, never markup: the content is user data
      return span;
    });
    // A text area shows an empty last line after a final newline: the layer needs the same height
    nodes.push(document.createTextNode('\n'));
    return nodes;
  }

  /** The editing surface: line numbers, the colour layer and the text area. */
  private surface(o: CodeEngineOptions): Node[] {
    const colours = this.colours();
    return [
      o.lineNumbers ? <div class="gutter" aria-hidden="true" /> as Node : null,
      (
        <div class={['edit', { coloured: colours }]} style={{ '--nx-tab': String(o.tabSize) }}>
          <pre class="hl" aria-hidden="true"><code>{colours ? this.highlightNodes(this.currentValue) : null}</code></pre>
          <textarea id={this.fieldId} part="input" class="code" spellcheck={false} autocapitalize="off" autocomplete="off" wrap={o.wrap ? 'soft' : 'off'}
                    name={this.getProp<string>('name')} placeholder={o.placeholder} required={!!this.getProp('required', false)}
                    disabled={!!this.getProp('disabled', false)} readonly={o.readOnly} aria-describedby={o.describedBy}
                    value={this.currentValue} />
        </div>
      ) as Node
    ].filter((n): n is Node => !!n);
  }

  protected render(): Node {
    const o = this.options();
    const height = px(this.getProp('height', '16rem'));
    const lang = this.codeLanguage();
    const select = !!this.getProp('language-select', false);
    return this.renderField(
      <div part="editor" class="editor" style={{ height }}>
        <div class="host">{this.surface(o)}</div>
        <div class="status" part="status">
          <span class="pos" />
          {select
            ? (
              <select class="lang-select" part="language" aria-label={this.t('code.language')} onChange={(e: Event) => this.chooseLanguage((e.target as HTMLSelectElement).value)}>
                {this.choices().map(l => <option value={l.id} selected={l.id === lang.id}>{l.label}</option>)}
              </select>
            )
            : <span class="lang">{lang.label}</span>}
          <span class="dirty" role="status" />
          <span class="hint" id={`${this.fieldId}-hint`}>{this.t('code.leaveHint')}</span>
        </div>
      </div>
    );
  }

  /** Change the language from the list in the status bar. */
  private chooseLanguage(id: string): void {
    this.setAttribute('language', id);
    this.emit('language-change', { language: id, label: resolveCodeLanguage(id).label });
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
    const lang = this.codeLanguage();
    const langEl = this.$('.lang') as HTMLElement | null;
    if (langEl) langEl.textContent = lang.label;
    const pick = this.$('.lang-select') as HTMLSelectElement | null;
    if (pick && pick.value !== lang.id) pick.value = lang.id;
    this.engine?.setLanguage?.(o.language);
    this.paintColours();
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
    const json = this.codeLanguage().id === 'json';
    if (!json || !this.value.trim() || this.codeLanguage().validate?.(this.value)) return false;
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
    host.replaceChildren(...this.surface(this.options()));
    this.engine = this.builtin(host);
  }

  /** Redraw the colour layer for the text as it is (and switch it off or on when the options say so). */
  private paintColours(): void {
    const edit = this.$('.edit') as HTMLElement | null;
    const code = this.$('.hl code') as HTMLElement | null;
    if (!edit || !code || this.custom) return;
    const text = this.value;
    const on = this.colours(text);
    edit.classList.toggle('coloured', on);
    edit.style.setProperty('--nx-tab', String(this.options().tabSize));
    code.replaceChildren(...(on ? this.highlightNodes(text) : []));
    const area = this.$('textarea.code') as HTMLTextAreaElement | null;
    const hl = this.$('.hl') as HTMLElement | null;
    if (area && hl) { hl.scrollTop = area.scrollTop; hl.scrollLeft = area.scrollLeft; }
  }

  private builtin(host: HTMLElement): CodeEngine {
    const area = host.querySelector('textarea.code') as HTMLTextAreaElement;
    const gutter = () => host.querySelector('.gutter') as HTMLElement | null;
    let tab = this.options().tabSize;
    let pending = 0;
    const paint = () => {
      const g = gutter();
      if (g) {
        const lines = area.value.split('\n').length;
        if (g.childElementCount !== lines) g.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
        g.scrollTop = area.scrollTop;
      }
      const hl = host.querySelector('.hl') as HTMLElement | null;
      if (hl) { hl.scrollTop = area.scrollTop; hl.scrollLeft = area.scrollLeft; }
    };
    /** Redraw the colours: at once for ordinary text, once a frame for long text */
    const colour = () => {
      if (area.value.length < 20_000) { this.paintColours(); return; }
      if (!pending) pending = requestAnimationFrame(() => { pending = 0; this.paintColours(); });
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
    /** Comment or uncomment the lines the selection touches: with `//` or `#` where the language has it, with a block marker otherwise */
    const toggleComment = (comment: NonNullable<CodeLanguage['comment']>) => {
      const { selectionStart: s, selectionEnd: en, value } = area;
      const from = lineStart(s);
      // A selection that ends at the very start of a line does not include that line
      const last = en > s && value[en - 1] === '\n' ? en - 1 : en;
      let to = value.indexOf('\n', last);
      if (to < 0) to = value.length;
      const block = value.slice(from, to);
      if (comment.line) {
        const marker = comment.line;
        const lines = block.split('\n');
        const live = lines.filter(l => l.trim());
        const commented = live.length > 0 && live.every(l => l.trimStart().startsWith(marker));
        const margin = Math.min(...live.map(l => /^[ \t]*/.exec(l)![0].length));
        const next = lines.map(l => {
          if (!l.trim()) return l;
          if (commented) return l.replace(new RegExp(`^([ \\t]*)${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ?`), '$1');
          return `${l.slice(0, margin)}${marker} ${l.slice(margin)}`;
        }).join('\n');
        insert(next, from, to, 'all');
      } else if (comment.block) {
        const [open, close] = comment.block;
        const wrapped = block.trim().startsWith(open) && block.trim().endsWith(close);
        const indent = /^[ \t]*/.exec(block)![0];
        let next: string;
        if (wrapped) {
          // Take the markers off, and the one space beside each
          const i = block.indexOf(open);
          let t = block.slice(0, i) + block.slice(i + open.length).replace(/^ /, '');
          const j = t.lastIndexOf(close);
          t = t.slice(0, j).replace(/ $/, '') + t.slice(j + close.length);
          next = t;
        } else {
          next = `${indent}${open} ${block.slice(indent.length)} ${close}`;
        }
        insert(next, from, to, 'all');
      }
    };

    area.addEventListener('input', () => { paint(); colour(); this.onEngineChange(area.value); });
    area.addEventListener('scroll', paint);
    area.addEventListener('keyup', cursor);
    area.addEventListener('click', cursor);
    area.addEventListener('select', cursor);
    area.addEventListener('focus', () => this.classList.add('focused'));
    area.addEventListener('blur', () => { this.escaped = false; this.classList.remove('focused'); });
    area.addEventListener('keydown', (e: KeyboardEvent) => {
      if (area.readOnly) return;
      if (e.key === 'Escape') { this.escaped = true; return; }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === '/' || e.code === 'Slash')) {
        const comment = this.codeLanguage().comment;
        if (!comment?.line && !comment?.block) return;
        e.preventDefault();
        toggleComment(comment);
        return;
      }
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
        const open = (this.codeLanguage().indentAfter ?? /[{[(]\s*$/).test(line);
        const close = /^\s*[}\])]/.test(area.value.slice(at));
        e.preventDefault();
        if (open && close) { insert(`\n${indent}${unit()}\n${indent}`); const p = at + 1 + indent.length + tab; area.setSelectionRange(p, p); }
        else insert(`\n${indent}${open ? unit() : ''}`);
      }
    });
    paint();
    return {
      getValue: () => area.value,
      setValue: v => { area.value = v; paint(); this.currentValue = v; this.paintColours(); },
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

  /** The text is checked as it is typed, for the languages that can be (JSON, JSON with comments, XML, properties); `no-check` turns it off. */
  validationMessage(): string {
    const lang = this.codeLanguage();
    if (lang.validate && !this.getProp('no-check', false) && !this.getProp('no-json-check', false)) {
      const problem = lang.validate(this.value);
      if (problem) {
        const message = this.t('code.invalid', { language: lang.label, message: problem.message, line: problem.line, column: problem.column });
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
      .edit { position: relative; flex: 1; min-width: 0; display: flex; }
      /* The colour layer sits under the text area, which keeps the caret, the selection and the typing. Same font, padding and tab size, so they line up */
      .hl { position: absolute; inset: 0; margin: 0; padding: 0.5rem 0.75rem; overflow: hidden; pointer-events: none; color: var(--color-text); white-space: pre; tab-size: var(--nx-tab, 2); font: 0.8125rem/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .hl code { font: inherit; }
      .hl:empty, .edit:not(.coloured) .hl { display: none; }
      textarea.code { position: relative; flex: 1; min-width: 0; margin: 0; padding: 0.5rem 0.75rem; border: 0; outline: 0; resize: none; background: transparent; color: var(--color-text); caret-color: var(--color-text); font: 0.8125rem/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; tab-size: var(--nx-tab, 2); white-space: pre; overflow: auto; }
      /* With colours on, the text area's own glyphs are not painted (its colour stays, so contrast checks and assistive technology see real text) */
      .edit.coloured textarea.code { -webkit-text-fill-color: transparent; }
      .edit.coloured textarea.code::placeholder { -webkit-text-fill-color: var(--color-text-secondary); }
      textarea.code::selection { background: color-mix(in srgb, var(--color-primary) 32%, transparent); }
      textarea.code[wrap="soft"] { white-space: pre-wrap; overflow-wrap: anywhere; }
      textarea.code::placeholder { color: var(--color-text-secondary); }
      @media (forced-colors: active) { .hl { display: none; } .edit.coloured textarea.code { -webkit-text-fill-color: currentcolor; } }
      /* Colours for light and dark (each at least 5.6:1 on the theme backgrounds). Override any of them from outside: nx-code-editor { --nx-code-keyword: #c0392b; } */
      :host {
        --nx-code-keyword: light-dark(#0550ae, #79c0ff);
        --nx-code-type: light-dark(#6639ba, #d2a8ff);
        --nx-code-literal: light-dark(#953800, #ffa657);
        --nx-code-string: light-dark(#116329, #7ee787);
        --nx-code-comment: light-dark(#59636e, #9198a1);
        --nx-code-removed: light-dark(#a40e26, #ff7b72);
      }
      .t-keyword { color: var(--nx-code-keyword); font-weight: 600; }
      .t-type { color: var(--nx-code-type); }
      .t-literal, .t-number, .t-variable { color: var(--nx-code-literal); }
      .t-string, .t-added { color: var(--nx-code-string); }
      .t-comment, .t-meta, .t-operator { color: var(--nx-code-comment); }
      .t-comment { font-style: italic; }
      .t-tag, .t-key, .t-attr { color: var(--nx-code-keyword); }
      .t-attr { font-style: italic; }
      .t-heading { font-weight: 700; }
      .t-emphasis { font-style: italic; }
      .t-removed { color: var(--nx-code-removed); }
      .lang-select { height: 1.375rem; max-width: 12rem; padding: 0 0.25rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 0.75rem; }
      .lang-select:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 1px; }
      .status { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 0.125rem 0.75rem; padding: 0.25rem 0.75rem; border-top: 1px solid var(--color-border); background: var(--color-muted); color: var(--color-text-secondary); font-size: 0.75rem; }
      .pos, .dirty, .lang { white-space: nowrap; }
      .lang { letter-spacing: 0.02em; }
      .dirty { color: var(--color-warning-text); font-weight: 600; }
      .dirty:empty { display: none; }
      .hint { margin-inline-start: auto; position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      :host(.focused) .hint { position: static; width: auto; height: auto; overflow: visible; clip-path: none; }
    `;
  }
}

define('nx-code-editor', NXCodeEditor);
