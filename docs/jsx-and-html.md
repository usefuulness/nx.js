# JSX, configs and HTML

The same component can be written three ways. All three go through one code path (`BaseComponent.configure()`), so a prop behaves identically however you set it.

```tsx
<Button variant="outline" icon="plus" onClick={add}>New</Button>              // JSX
{ xtype: 'button', variant: 'outline', icon: 'plus', text: 'New', handler: add }  // config
<nx-button variant="outline" icon="plus">New</nx-button>                         // HTML
```

| JSX prop | HTML attribute | Config key |
| --- | --- | --- |
| `iconPosition="right"` | `icon-position="right"` | `iconPosition: 'right'` |
| `loading` (or `loading={true}`) | `loading` | `loading: true` |
| `pageSize={10}` | `page-size="10"` | `pageSize: 10` |
| `data={rows}` | JSON in a `data-nx-config` script (see [Plain HTML](#plain-html)) | `data: rows` |
| `onRowClick={fn}` | `addEventListener('row-click', fn)` | `onRowClick: fn` or `listeners: { 'row-click': fn }` |

## JSX

JSX creates real DOM. `<div class="x" onClick={fn}>` is a `div` with a listener, `<Button>` is an `<nx-button>` element, and you can `append()` either anywhere. Nothing re-renders behind your back.

```tsx
const panel = (
  <section class={['panel', { active: isActive }]} style={{ padding: 16, '--accent': 'tomato' }}>
    <h2>Hello</h2>
    <input type="email" placeholder="you@example.com" onInput={e => console.log((e.target as HTMLInputElement).value)} />
    {items.map(item => <li>{item.name}</li>)}
    {loading && <Spinner />}
  </section>
);
document.body.append(panel);
```

| You write | You get |
| --- | --- |
| `class="a"`, `class={['a', cond && 'b', { c: on }]}`, `className` | joined class names (`cn()` rules) |
| `style="…"` or `style={{ marginTop: 8, '--x': 1 }}` | inline styles; numbers get `px` |
| `onClick`, `onKeyDown`, `onInput` | native listeners (`click`, `keydown`, `input`) |
| `onTabChange`, `onRowClick`, `onSelectionChange` | component events (`tab-change`, `row-click`, …) |
| `ref={el => …}` or `ref={{ current: null }}` | the created element |
| `html={markup}` | `innerHTML`: you own the escaping |
| `<>…</>` | a `DocumentFragment` |
| `(props) => <div/>` | a function component |

Text children are always escaped. Only `html={…}` inserts markup.

### Components

PascalCase components wrap the `<nx-*>` elements with typed props, so you get autocompletion, and `variant="nope"` is a type error.

| Group | Components |
| --- | --- |
| Actions | `Button`, `Menu`, `MenuBar`, `Command` |
| Display | `Badge`, `Avatar`, `Alert`, `Progress`, `Spinner`, `Skeleton`, `Divider` |
| Layout | `Box`, `HStack`, `VStack`, `Grid`, `Spacer`, `Separator`, `Panel`, `Card`, `CardFooter`, `CardActions`, `Toolbar`, `Viewport`, `Outlet` |
| Navigation | `Tabs`, `Tab`, `Tree`, `Breadcrumb`, `Accordion`, `AccordionItem` |
| Data | `DataGrid` (alias `DataTable`) |
| Forms | `Form`, `Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `Switch`, `RadioGroup`, `Slider`, `DatePicker` |
| Overlays | `Dialog`, `DialogFooter`, `Drawer`, `DrawerFooter`, `Popover`, `PopoverTrigger`, `Tooltip`, plus `NX.toast()`, `NX.confirm()`, `NX.command()`… |
| Helpers | `Show`, `Fragment`, `cn()`, `variants()` |

The tags are typed in JSX too: `<nx-button variant="outline">`.

### Composition and state

Composition is plain functions:

```tsx
const Stat = ({ label, value }: { label: string; value: string }) => (
  <Card>
    <p class="muted">{label}</p>
    <strong style={{ fontSize: 28 }}>{value}</strong>
  </Card>
);

<Grid minColumnWidth={220} gap={16}>
  <Stat label="Revenue" value="$45,231" />
  <Stat label="Customers" value="2,350" />
</Grid>
```

JSX builds the DOM once. To change it later, keep a `ref` and update the element (`progress.current.setAttribute('value', '80')`, `grid.current.setData(rows)`), or write a [custom component](custom-components.md) with state.

## Config objects

Every component can be described as data, which suits generated UIs, JSON-driven screens and `<script>`-tag usage. Configs and JSX elements mix freely in `items`.

```ts
const button = NX.create({
  xtype: 'button',        // 'button', 'nx-button', or any HTML tag such as 'div'
  id: 'save',             // host element id → NX.get('save')
  text: 'Save',           // primitives become attributes (camelCase → kebab-case)
  icon: 'save',
  handler: () => save(),  // click
  onFocus: e => {},       // onXxx listens to 'xxx' ('onTabChange' → 'tab-change')
  listeners: { blur: e => {} },
  cls: 'my-class',
  style: { marginTop: '1rem' },   // or a CSS string
  flex: 1,
  hidden: false
});
```

| Key | Effect |
| --- | --- |
| `xtype` | Component to create. Defaults to `html` when `html`/`text` is given, else `container`. |
| `items` | Children, built recursively. Containers decide what items mean: a tab panel makes tabs, a menu takes data. |
| `id`, `cls`, `style`, `flex`, `hidden`, `region` | Applied to the host element. |
| `handler` | Click listener. |
| `onXxx`, `listeners` | Event listeners. |
| `html` | Light-DOM content. |
| anything with a `setXxx()` method | Passed to it (`data` → `setData()`, `columns` → `setColumns()`, `options` → `setOptions()`). |
| other primitives | Attributes (`pageSize: 10` → `page-size="10"`). |
| other objects and functions | Props, read with `getProp()`. |

Items can be shorthand strings: `'->'` is a flexible spacer, `'-'` or `'|'` a separator, and any other string is HTML. `null` and `false` are skipped, so `cond && {...}` works. Change things later with `set()` or `configure()`:

```ts
NX.get('save').set('loading', true);
NX.get('save').configure({ text: 'Saved', icon: 'check', loading: false });
```

Common xtypes and their tags: `button`, `input` (`nx-textfield`), `textarea`, `email`, `password`, `numberfield`, `datefield` (native date input), `datepicker` (calendar), `select`, `combobox`, `checkbox`, `switch`, `radio`, `slider`, `form`, `grid`, `tabs`, `tree`, `menu`, `modal`/`dialog`, `drawer`, `card`, `panel`, `toolbar`, `container`/`hbox`/`vbox`. Any unknown xtype without a dash (`'section'`, `'h1'`) creates that plain element.

## Plain HTML

Every component is a custom element named like its JSX component: `<Input>` is `<nx-input>`, and `<RadioGroup>` is `<nx-radio-group>`. Attributes are the kebab-case props. Anything richer than a string is JSON: in an attribute, or in a `<script type="application/json" data-nx-config>` child that is applied when the element upgrades.

```html
<nx-card title="Welcome">
  <p>Plain HTML works too.</p>
  <nx-button slot="footer" variant="outline" icon="plus">New</nx-button>
</nx-card>

<nx-tabs>
  <nx-tab title="Account" icon="user">…</nx-tab>
  <nx-tab title="Password" icon="lock">…</nx-tab>
</nx-tabs>

<nx-select label="Role" name="role">
  <option>Admin</option><option selected>Editor</option>
</nx-select>

<nx-radio-group name="plan" label="Plan" value="pro" variant="cards">
  <option value="free" data-description="For side projects">Free</option>
  <option value="pro" data-description="For growing teams">Pro</option>
</nx-radio-group>

<nx-grid title="Users" columns='[{"field":"name","header":"Name"}]'>
  <script type="application/json" data-nx-config>{"data": [{"name": "Ada"}]}</script>
</nx-grid>
```

Listen to events with `addEventListener` (`row-click`, `change`, `select`…), and reach an element's methods through the DOM or `NX.get(id)`. The longer names from the config world (`nx-textfield`, `nx-tabpanel`, `nx-modal`) keep working.

Choices come from `<option>` children in `nx-select`, `nx-combobox` and `nx-radio-group`, as in HTML. Children added later are picked up too.

## Editor support

Every tag, attribute and allowed value (`variant="…"`) autocompletes in HTML and template files:

- **VS Code:** add `"html.customData": ["./node_modules/nx.js/dist/html-custom-data.json"]` to `.vscode/settings.json`.
- **JetBrains, Storybook and other tools** read the [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest) at `nx.js/custom-elements.json` (`"customElements"` in `package.json`).

Both, and the [component reference](components.md), are generated from the component sources by `scripts/custom-elements.ts`.
