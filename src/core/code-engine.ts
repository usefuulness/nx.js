/**
 * The contract between `<nx-code-editor>` and an editing engine.
 *
 * The editor ships with a plain one (a text area with line numbers, indentation and a cursor position). A project that
 * wants highlighting, completion, snippets or find and replace registers a richer one (Ace, CodeMirror, Monaco) behind
 * this contract, by name, optionally loaded only when an editor asks for it:
 *
 * ```ts
 * registerCodeEngineLoader('ace', async () => (await import('./ace-engine')).createAceEngine);
 * // <nx-code-editor engine="ace" language="groovy">
 * ```
 *
 * The engine owns the DOM inside `host`. The editor owns everything around it (label, hint, errors, status bar, form
 * value, validation) and calls `dispose()` when the editor is removed or the engine is swapped. No DOM at load.
 */

export interface CodeEngineOptions {
  /** `javascript`, `groovy`, `java`, `json`, `properties`, `text`, or whatever the engine knows */
  language: string;
  value: string;
  readOnly: boolean;
  lineNumbers: boolean;
  tabSize: number;
  wrap: boolean;
  placeholder?: string;
  /** The id of the element that names the editor, and of the one that describes it (set them on your focusable element) */
  labelledBy?: string;
  describedBy?: string;
  /** Tell the editor the text changed (it updates the form value, validity and the unsaved-changes mark) */
  onChange(value: string): void;
  /** Tell the editor where the cursor is (1-based) */
  onCursor?(line: number, column: number): void;
  onFocus?(): void;
  onBlur?(): void;
}

export interface CodeEngine {
  getValue(): string;
  /** Replace the text without calling `onChange` */
  setValue(value: string): void;
  setLanguage?(language: string): void;
  setReadOnly(readOnly: boolean): void;
  setDisabled?(disabled: boolean): void;
  /** Apply new options (`lineNumbers`, `tabSize`, `wrap`) */
  setOptions?(options: Partial<Pick<CodeEngineOptions, 'lineNumbers' | 'tabSize' | 'wrap' | 'placeholder'>>): void;
  focus(): void;
  /** The element's size changed */
  resize?(): void;
  /** A native text control inside the engine, when it has one: the editor uses it for `required` and its validity */
  control?(): HTMLInputElement | HTMLTextAreaElement | null;
  /** Optional commands the editor's methods pass through to */
  undo?(): void;
  redo?(): void;
  find?(): void;
  /** Pretty-print (`format()` on the editor falls back to its own for JSON) */
  format?(): void;
  /** Remove everything the engine added: listeners, workers, DOM */
  dispose(): void;
}

export type CodeEngineFactory = (host: HTMLElement, options: CodeEngineOptions) => CodeEngine | Promise<CodeEngine>;
export type CodeEngineLoader = () => Promise<CodeEngineFactory | { default: CodeEngineFactory }>;

const factories = new Map<string, CodeEngineFactory>();
const loaders = new Map<string, CodeEngineLoader>();
const loading = new Map<string, Promise<CodeEngineFactory | null>>();

/** Register an engine by name, ready to use (`<nx-code-editor engine="name">`). */
export function registerCodeEngine(name: string, factory: CodeEngineFactory): void {
  factories.set(name, factory);
  loaders.delete(name);
  loading.delete(name);
}

/** Register an engine that is loaded the first time an editor asks for it (a dynamic `import()`). */
export function registerCodeEngineLoader(name: string, loader: CodeEngineLoader): void {
  loaders.set(name, loader);
  factories.delete(name);
  loading.delete(name);
}

/** The factory for a name, loading it if need be; `null` when none is registered or the load failed. */
export function resolveCodeEngine(name: string): Promise<CodeEngineFactory | null> {
  const ready = factories.get(name);
  if (ready) return Promise.resolve(ready);
  const loader = loaders.get(name);
  if (!loader) return Promise.resolve(null);
  let pending = loading.get(name);
  if (!pending) {
    pending = loader().then(
      mod => {
        const factory = typeof mod === 'function' ? mod : mod?.default;
        if (typeof factory !== 'function') return null;
        factories.set(name, factory);
        return factory;
      },
      () => { loading.delete(name); return null; } // a failed load can be tried again
    );
    loading.set(name, pending);
  }
  return pending;
}
