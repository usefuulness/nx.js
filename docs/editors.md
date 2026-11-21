# Editors: code and typed objects

Two components for admin tools that edit scripts and definitions: `<nx-code-editor>` for text, and `<nx-property-grid>` for an object described by a schema. Both are form-friendly and work before any script runs.

## The code editor

```tsx
<CodeEditor name="script" label="nightly.groovy" language="groovy" value={text} height="16rem"
            onDirtyChange={e => setUnsaved(e.detail.dirty)} />
```

It is a form field: `name`, `required`, `disabled`, `readonly`, `value`, validation and posting work as in any other field, and the text is in server HTML as a native `<textarea>`.

| What | How |
| --- | --- |
| The text | `value` (a string). Setting it from code is a fresh start: the text is clean. Typing makes it dirty |
| Unsaved changes | `isDirty()`, `markClean()` (after a save), `revert()`; the attribute `dirty`; the event `dirty-change`; an "Unsaved changes" mark in the status bar |
| Language | `language`: `json` is checked as you type (the message says the line and column; `no-json-check` turns it off); others are labels the engine can use |
| Indentation | **Tab** indents (`tab-size`, default 2); with several lines selected, Tab and **Shift+Tab** indent and outdent them; **Enter** keeps the indent and adds a level after `{`, `[` or `(` |
| Leaving with the keyboard | Tab is taken by the editor, so press **Escape**, then **Tab**, to move on. The hint is announced and shown while the editor has focus |
| Position | the status bar shows "Line 3, column 8"; the event `cursor` carries `line` and `column` |
| Format | `format()` pretty-prints valid JSON (returns whether it did); an engine can format other languages |
| Undo, redo | the text area's own (Ctrl/⌘+Z); `undo()` and `redo()` for buttons |
| Size | `height` (the editor can also be resized vertically); `wrap` wraps long lines (and hides the line numbers) |

The editor keeps the same editing surface when its attributes change, so focus, scroll and undo history survive a new label, language or read-only state.

### Engines: highlighting, completion, find and replace

The built-in editor is deliberately plain. For syntax highlighting, completion, snippets or find and replace, register an engine (Ace, CodeMirror, Monaco) behind the contract in `nx.js` and name it with `engine`:

```ts
import { registerCodeEngineLoader, type CodeEngineFactory } from 'nx.js';

// Loaded only when an editor asks for it
registerCodeEngineLoader('ace', async () => (await import('./ace-engine')).createAceEngine);
```

```html
<nx-code-editor engine="ace" language="groovy" name="script" label="Script"></nx-code-editor>
```

An engine is a factory `(host, options) => CodeEngine`. The editor gives it an empty `host` element and the options (`language`, `value`, `readOnly`, `lineNumbers`, `tabSize`, `wrap`, `placeholder`, `labelledBy`, `describedBy`) and callbacks (`onChange`, `onCursor`, `onFocus`, `onBlur`); the engine returns:

| Method | Required | |
| --- | --- | --- |
| `getValue()`, `setValue(text)` | yes | `setValue` must not call `onChange` |
| `setReadOnly(boolean)`, `focus()`, `dispose()` | yes | `dispose` removes listeners, workers and DOM |
| `setLanguage()`, `setDisabled()`, `setOptions()` | no | called when the attributes change |
| `resize()` | no | called when the editor's size changes |
| `control()` | no | a native text control inside the engine, for `required` and validity |
| `undo()`, `redo()`, `find()`, `format()` | no | the editor's methods pass through to them |

The lifecycle is explicit: the built-in editor shows first (so there is no empty box while an engine loads), the engine is created with the current text, focus moves across if the editor had it, `ready` is emitted, and `dispose()` is called when the editor is removed or the engine is swapped. A failed load can be tried again by the next editor; an engine that throws on start leaves the built-in editor in place with the text intact and emits `engine-error`.

nx.js does not ship an Ace (or any other) adapter: it would pull a large dependency into a library that has none. The adapter belongs to the app that has the dependency, and is small. A sketch of the shape, to be checked against your Ace version:

```ts
export const createAceEngine: CodeEngineFactory = async (host, o) => {
  const ace = (await import('ace-builds')).default;
  const editor = ace.edit(host, { value: o.value, readOnly: o.readOnly, tabSize: o.tabSize, showLineNumbers: o.lineNumbers, wrap: o.wrap });
  editor.session.setMode(`ace/mode/${o.language}`);
  editor.on('change', () => o.onChange(editor.getValue()));
  editor.on('focus', () => o.onFocus?.());
  editor.on('blur', () => o.onBlur?.());
  editor.selection.on('changeCursor', () => { const { row, column } = editor.getCursorPosition(); o.onCursor?.(row + 1, column + 1); });
  return {
    getValue: () => editor.getValue(),
    setValue: v => { editor.setValue(v, -1); },
    setLanguage: l => editor.session.setMode(`ace/mode/${l}`),
    setReadOnly: r => editor.setReadOnly(r),
    focus: () => editor.focus(),
    resize: () => editor.resize(),
    undo: () => editor.undo(), redo: () => editor.redo(),
    dispose: () => editor.destroy()
  };
};
```

Test an engine with your own tests: the contract is small, and the editor's behaviour with a fake engine is covered in nx.js's tests.

## The property grid

A typed editor for an object, built from a schema with the library's own fields:

```tsx
<PropertyGrid label="Job" schema={[
  { name: 'name', label: 'Name', required: true, help: 'Shown in lists' },
  { name: 'kind', label: 'Kind', type: 'select', options: ['scheduled', 'on demand'] },
  { name: 'schedule', label: 'Schedule', hidden: v => v.kind === 'on demand', pattern: '[0-9*/,-]+( [0-9*/,-]+){4}' },
  { name: 'script', label: 'Script', type: 'reference', required: true, picker: openScriptBrowser },
  { name: 'retries', label: 'Retries', type: 'number', min: 0, max: 5, default: 0 },
  { name: 'enabled', label: 'Enabled', type: 'boolean' },
  { name: 'settings', label: 'Settings', type: 'json', group: 'Advanced' }
]} value={job} onChange={e => …} />
```

| Field property | |
| --- | --- |
| `type` | `text` (default), `password`, `number`, `boolean`, `select`, `date`, `textarea`, `json`, `code` (with `language`), `reference` |
| `required`, `min`, `max`, `pattern` | checked by `validate()` with translated messages |
| `validate(value, values)` | your own rule; it sees every value, so fields can depend on each other |
| `readonly`, `hidden` | `true`, or a function of the values: a field can lock or hide when another changes. The grid-level `readonly` locks everything |
| `default` | the value when the object has none (`grid.value` includes it) |
| `group` | gathers fields under a heading |
| `reference` | `picker(current)` opens your own picker (an asset browser, a dialog) and resolves with `{ value, text }`; `display(value)` names a stored value before anything was picked |

| Grid | |
| --- | --- |
| `value` | the values (set it to load a record; `grid.value` is a copy with defaults and typed values: numbers are numbers, JSON is parsed) |
| `validate()` | checks every shown field, shows the problems next to them, focuses the first, and returns `{ valid, errors }` |
| `setErrors({ name: ['…'] })` | shows a server's complaints next to their fields; editing a field clears its complaint |
| `isDirty()`, `markClean()` | unsaved-changes tracking, and the event `dirty-change` |
| `change` event | `detail.name`, `detail.value`, `detail.values` |

Fields that have no read-only look (`select`, `boolean`, `date`) are switched off when read-only. Controls are built once and updated in place, so focus and caret survive changes in other fields.

### Showing what the server refused

The data layer reads the common error shapes (Spring Boot, Spring Data REST, RFC 7807) into field complaints, so a failed save can go straight to the form:

```ts
try {
  await job.save();
} catch (e) {
  grid.setErrors(parseApiError(e).fields);   // or job.serverErrors after a failed model save
  toast.error(parseApiError(e).message);
}
```

See [Data and logic](data.md#server-errors).
