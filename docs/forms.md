# Forms

Nexaro's fields are **form-associated custom elements**. They behave like native inputs: they post their values with a `<form>`, take part in the browser's validation, reset with the form, and restore on back/forward. On top of that they draw a label, helper text and error messages, and support custom validators.

## Fields

| JSX | Tag | xtype | For |
| --- | --- | --- | --- |
| `Input` | `nx-input` (`nx-textfield`) | `input`, `textfield`, `email`, `password`, `numberfield`, `search`, `datefield` | single-line text; set `type` for `email`, `number`, `url`, `tel`, `date`… |
| `Textarea` | `nx-textarea` | `textarea` | multi-line text |
| `Select` | `nx-select` | `select` | a native select, styled; `multiple` for several |
| `Combobox` | `nx-combobox` | `combobox`, `autocomplete` | a searchable select; `freeText` accepts any text |
| `Checkbox` | `nx-checkbox` | `checkbox` | a yes/no choice; posts `value` (default `on`) when checked |
| `Switch` | `nx-switch` | `switch`, `toggle` | an on/off setting |
| `RadioGroup` | `nx-radio-group` | `radio`, `radiogroup` | one of a few options; `variant="cards"` for plan pickers |
| `Slider` | `nx-slider` | `slider`, `range` | a number in a range |
| `DatePicker` | `nx-datepicker` | `datepicker`, `date` | a calendar; the value is `YYYY-MM-DD` |

Every field takes `name`, `label`, `helperText`, `errorText`, `required`, `disabled` and `validator`, plus its own attributes; see the [component reference](components.md).

Options for `Select`, `Combobox` and `RadioGroup` come from an `options` prop (strings, `{ value, text }` objects, or a `{ value: text }` map) or from `<option>` children in HTML:

```tsx
<Select name="role" label="Role" options={['Admin', 'Editor', 'Viewer']} />
<Combobox name="country" label="Country" options={{ de: 'Germany', fr: 'France' }} />
<RadioGroup name="plan" label="Plan" value="pro" variant="cards" orientation="horizontal" options={[
  { value: 'free', text: 'Free', description: 'For side projects' },
  { value: 'pro', text: 'Pro', description: 'For growing teams' }
]} />
```

## `<Form>`: collect, validate, submit

```tsx
<Form columns={2} values={{ first: 'Ada', newsletter: true }}
      onSubmit={(e: CustomEvent) => save(e.detail.values)}   // only when every field is valid
      onInvalid={() => NX.toast.error('Please fix the highlighted fields')}>
  <Input name="first" label="First name" required />
  <Input name="email" type="email" label="Email" required />
  <Input name="password" type="password" label="Password" minLength={8}
         validator={(v: string) => (v && !/\d/.test(v) ? 'Include a number' : undefined)} />
  <DatePicker name="start" label="Start date" min="2025-01-01" />
  <Checkbox name="terms" label="I accept the terms" required style="grid-column: 1 / -1" />
  <Button slot="buttons" type="reset" variant="ghost">Reset</Button>
  <Button slot="buttons" type="submit">Save</Button>
</Form>
```

- `getValues()` returns an object keyed by `name`. Checkboxes report booleans (or their `value`), repeated names collect into arrays, and number inputs report numbers.
- `setValues()`, `validate()`, `isValid()`, `submit()`, `reset()` and `getField(name)` do what they say.
- Errors appear once a field is touched, or on submit; the first invalid field receives focus. Enter in a single-line field submits.
- A `validator` returns an error message, or nothing when the value is valid.
- `columns` lays fields out in a grid that collapses to one column on phones.

## Posting to a server

**Inside a native `<form>`** the fields post like native inputs, and `<nx-button type="submit">` submits like a `<button>`, including its `name`, `value` and `formaction`:

```html
<form method="post" action="/invites">
  <nx-input name="email" type="email" label="Email" required></nx-input>
  <nx-select name="role" label="Role"><option>Editor</option><option>Admin</option></nx-select>
  <nx-button type="submit" name="intent" value="send">Send invite</nx-button>
</form>
```

The browser blocks the post while a field is invalid and shows that field's error.

**`<nx-form action>`** validates, fires a cancelable `submit`, then posts natively. Call `e.preventDefault()` in `onSubmit` to handle it in JavaScript instead. An `<nx-form>` without `action` inside a native `<form>` hands the submission to that form.

```html
<nx-form action="/subscribe" method="post" columns="2">
  <nx-input name="name" label="Name"></nx-input>
  <nx-input name="email" type="email" label="Email" required></nx-input>
  <nx-button slot="buttons" type="submit">Subscribe</nx-button>
</nx-form>
```

**Errors from the server** come back through `error-text`, which marks the field invalid:

```twig
<nx-input name="email" label="Email" value="{{ old.email }}" error-text="{{ errors.email }}"></nx-input>
```

## Before JavaScript loads

When a page is [server-rendered](server-rendering.md), every field carries a **native stand-in**: a real `<input>`, `<select>` or date input in the light DOM, slotted exactly where the component's control appears. A visitor can fill in and submit the form the moment it appears, with the browser's own validation (`required`, `type="email"`, `min`, `max`…). The combobox stands in with a native `<select>`, the date picker with `<input type="date">`, and submit buttons with an invisible native button over the visible one.

When `nx.js` loads, each component takes over what was typed and removes its stand-in. Nothing moves on screen.

## Values in detail

| Field | `value` | Posts |
| --- | --- | --- |
| Input, Textarea | string | the text |
| Select | string, or string[] with `multiple` | each selected value |
| Combobox | the selected option's value (or the text with `freeText`) | the value |
| Checkbox, Switch | `true`/`false`, or the `value` attribute when checked | `value` (default `on`) when checked |
| RadioGroup | the selected option's value | the value |
| Slider | number | the number |
| DatePicker | `YYYY-MM-DD` (`valueAsDate` gives a `Date`) | the ISO date |
