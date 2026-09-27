# Nexaro

shadcn-style web components you write like HTML. JSX without React, zero runtime dependencies, light and dark themes built in, and the same components also work from plain HTML or config objects.

```tsx
import { NX, Button, Card, CardFooter, Input } from 'nx.js';

NX.render(
  <Card title="Create project" subtitle="Deploy your new project in one click.">
    <Input name="name" label="Name" placeholder="my-app" required />
    <CardFooter>
      <Button variant="outline">Cancel</Button>
      <Button onClick={() => NX.toast.success('Deployed!')}>Deploy</Button>
    </CardFooter>
  </Card>,
  '#root'
);
```

JSX here creates **real DOM elements**. There is no virtual DOM and no framework to learn: `<div class="x" onClick={fn}>` is a `div`, `<Button>` is an `<nx-button>` custom element, and you can `append()` either anywhere.

## Contents

- [Getting started](#getting-started)
- [Writing UI with JSX](#writing-ui-with-jsx)
- [Config objects](#the-config-model) (the same components, as data)
- [App shell and routing](#app-shell-and-routing)
- [Layout](#layout)
- [Components](#components)
- [Data grid and stores](#data-grid-and-stores)
- [Forms](#forms)
- [Dialogs and toasts](#dialogs-and-toasts)
- [Menus](#menus)
- [Theming](#theming)
- [Icons](#icons)
- [Custom components](#custom-components)
- [Using it from HTML](#using-it-from-html)
- [Development](#development)

## Getting started

```bash
pnpm install
pnpm dev        # demo app at http://localhost:5173 (src/main.tsx)
pnpm build      # library → dist/ (ESM, CJS, UMD, .d.ts)
```

Point TypeScript (or esbuild, Vite, Bun…) at the JSX runtime:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "nx.js"
  }
}
```

No CSS import is needed. Design tokens and base styles are injected on load.

**Script tag** (no build step, use config objects or `NX.h`):

```html
<div id="root"></div>
<script src="dist/nx.umd.js"></script>
<script>
  NX.render({ xtype: 'button', text: 'Hello', handler: () => NX.toast('Hi!') }, '#root');
</script>
```

## Writing UI with JSX

Write it like HTML. Attributes, `class`, `style`, events and children all do what you'd expect:

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
| `html={markup}` | `innerHTML` (you own the escaping) |
| `<>…</>` | a `DocumentFragment` |
| `(props) => <div/>` | a function component |

**Components** are PascalCase wrappers around the `<nx-*>` elements, with typed props (autocomplete, and `variant="nope"` is a type error):

| Group | Components |
| --- | --- |
| Actions | `Button`, `Menu`, `MenuBar`, `Badge` |
| Layout | `Box`, `HStack`, `VStack`, `Grid`, `Spacer`, `Separator`, `Divider`, `Panel`, `Card`, `CardFooter`, `CardActions`, `Toolbar`, `Viewport`, `Outlet` |
| Navigation | `Tabs`, `Tab`, `Tree`, `Breadcrumb`, `Accordion`, `Drawer` |
| Data | `DataGrid` (alias `DataTable`) |
| Forms | `Form`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch` |
| Feedback | `Dialog`, `DialogFooter`, `Progress`, `Spinner`, `Skeleton`, plus `NX.toast()` / `NX.confirm()` / … |
| Helpers | `Show`, `Fragment`, `cn()`, `variants()` |

You can also use the tags directly, which are typed too: `<nx-button variant="outline">`.

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

For state, use a component (see [Custom components](#custom-components)) or keep a `ref` and update the element. JSX builds the DOM once, and nothing re-renders behind your back.

## The config model

Every component can also be described as data, which is handy for generated UIs, JSON-driven screens or script-tag usage. JSX props and config keys are the same thing: `<Button variant="outline" onClick={fn}>` equals `{ xtype: 'button', variant: 'outline', handler: fn }`. Configs and JSX elements can be mixed freely in `items`.

```ts
const button = NX.create({
  xtype: 'button',        // which component ('button', 'nx-button', or any HTML tag like 'div')
  id: 'save',             // host element id → NX.get('save')
  text: 'Save',           // primitives become attributes (camelCase → kebab-case)
  icon: 'save',
  variant: 'primary',
  handler: () => save(),  // click
  onFocus: e => {},       // onXxx → listens to 'xxx' ('onTabChange' → 'tab-change')
  listeners: { blur: e => {} },
  cls: 'my-class',
  style: { marginTop: '1rem' },   // or a CSS string
  flex: 1,
  hidden: false
});
```

The rules:

| Key | Effect |
| --- | --- |
| `xtype` | Component to create. Defaults to `html` when `html`/`text` is given, else `container`. |
| `items` | Children, recursively built. Containers decide what items mean (the tab panel makes tabs, a menu takes data). |
| `id`, `cls`, `style`, `flex`, `hidden`, `region` | Applied to the host element. |
| `handler` | Click listener. |
| `onXxx`, `listeners` | Event listeners. |
| `html` | Light-DOM content. |
| anything with a `setXxx()` method | Passed to it (`data` → `setData()`, `columns` → `setColumns()`, `options` → `setOptions()`). |
| other primitives | Attributes (`pageSize: 10` → `page-size="10"`). |
| other objects and functions | Props, read with `getProp()`. |

Items can also be shorthand strings: `'->'` is a flexible spacer, `'-'` or `'|'` is a separator, and any other string is HTML. `null` and `false` are skipped, so `cond && {...}` works.

Change things at runtime with `set()` / `configure()`:

```ts
NX.get('save').set('loading', true);
NX.get('save').configure({ text: 'Saved', icon: 'check', loading: false });
```

## App shell and routing

`NX.app()` builds a full-screen border layout. Put children in regions with `region="north" | "south" | "west" | "east" | "center"`. Children without a region go to the center.

```tsx
const app = NX.app({
  el: '#app',                 // default: document.body
  title: 'Admin',             // document title; route titles become "Users · Admin"
  theme: 'dark',              // default theme; a theme the user picked wins
  stores: { users: { data } },

  items: [
    <Toolbar region="north">
      <Button icon="menu" class="nx-mobile-only" onClick={() => app.toggleRegion('west')} />
      <strong>Admin</strong>
      <Spacer />
      <Button icon="moon" onClick={() => NX.theme.toggle()} />
    </Toolbar>,
    <Panel region="west" width={240}>
      <Tree data={[{ text: 'Home', icon: 'home', route: '/' }, { text: 'Users', icon: 'users', route: '/users' }]} />
    </Panel>,
    <Outlet region="center" />
  ],

  router: [
    { path: '/', view: () => <HomePage /> },
    { path: '/users/:id', title: 'User', view: route => <UserPage id={route.params.id} /> }, // may be async
    { path: '*', view: () => <p>Not found</p> }
  ],
  ready: app => {}
});

app.navigate('/users/42');
app.toggleRegion('west');   // open the side nav on phones, collapse a collapsible panel on desktop
```

- Routes render their `view` into the `<Outlet />`.
- Tree nodes with a `route` navigate when clicked, and the tree highlights the node for the current route.
- Below 768px, `west`/`east` regions turn into off-canvas drawers. Use `class="nx-mobile-only"` / `"nx-desktop-only"` to show things per screen size.

## Layout

```tsx
<HStack gap={8} align="center">…</HStack>                   // row
<VStack gap={16} padding={24}>…</VStack>                     // column
<Grid columns={3} gap={16}>…</Grid>                          // fixed grid
<Grid minColumnWidth={240} gap={16}>…</Grid>                 // responsive grid
<Panel title="Details" icon="file" collapsible closable bodyPadding={0}>…</Panel>
<Card title="Revenue" subtitle="Last 30 days" icon="chart">…</Card>
```

`align` (`start` | `center` | `end` | `stretch` | `baseline`) and `pack` (`start` | `center` | `end` | `between` | `around` | `evenly`) map to flexbox alignment. The config equivalents are `{ xtype: 'hbox' | 'vbox' | 'container', layout: 'grid', … }`.

## Components

| xtype | Highlights |
| --- | --- |
| `button` | `text`, `icon`, `variant` (`primary` `secondary` `outline` `ghost` `danger` `link`), `size` (`sm` `md` `lg`), `loading`, `disabled`, `href`, `tooltip`, `iconPosition`, `fullWidth`. Icon-only buttons become square automatically. |
| `toolbar` | Items are components; buttons default to `ghost`. `'->'` pushes items right. Arrow-key navigation. |
| `panel` | `title`, `icon`, `collapsible`, `collapsed`, `closable`, `resizable`, `width`, `height`, `bodyPadding`, `border`. In a region it draws only the inner edge. West/east panels collapse to a rail. |
| `card` | `title`, `subtitle`, `icon`, `elevation`, `padding`. Slots: `header-actions`, `footer`. |
| `tabpanel` | Each item is a tab: `title`, `icon`, `closable`, `disabled`; the rest of the item is the tab body. `variant` (`default` `pills` `underlined`), `position`. Events: `tab-change`, `tab-close`. |
| `tree` | `data: TreeNode[]` (`text`, `icon`, `children`, `expanded`, `route`, …), `checkboxes`, `multiSelect`. Full keyboard support. Events: `select`, `toggle`, `check` (detail includes the `node`). |
| `grid` | See [below](#data-grid-and-stores). |
| `form`, `textfield`, `select`, `checkbox`, `switch` | See [Forms](#forms). |
| `modal` | See [Dialogs](#dialogs-and-toasts). |
| `progress` | `value`, `max`, `variant`, `size`, `indeterminate`, `striped`. |
| `accordion`, `breadcrumb`, `menu`, `menubar` | `items` as data. |
| `drawer` | `position`, `size`; `open()`, `close()`. |
| `spinner`, `loader`, `skeleton` | Loading states. |
| `divider`, `spacer`, `separator` | Rules and spacing. |
| `outlet` | Router outlet. |

Any unknown `xtype` without a dash (`'section'`, `'h1'`) creates that plain element; `text`, `html`, attributes and listeners still apply.

## Data grid and stores

```ts
{
  xtype: 'grid',
  title: 'Users',
  store: 'users',              // a registered store name or a Store; or use `data: [...]`
  search: true,                // quick filter across columns
  pageSize: 20,
  checkboxSelection: true,     // or selectable: 'single' | 'multiple'
  striped: true, dense: false,
  columns: [
    { field: 'name', header: 'Name' },
    { field: 'address.city', header: 'City' },                  // dot paths
    { field: 'role', header: 'Role', type: 'badge', badges: { Admin: 'info', Banned: 'error' } },
    { field: 'revenue', header: 'Revenue', type: 'currency', width: 120 }, // number | currency | percent | date | boolean
    { field: 'name', header: '', sortable: false, width: 90,
      renderer: (v, row) => <Button size="sm" variant="ghost" onClick={() => open(row)}>Open</Button> }
      // renderer returns JSX (or an HTML string you escape yourself); formatter returns text
  ],
  onRowClick: e => console.log(e.detail.row),
  onSelectionChange: e => console.log(e.detail.selected)
}
```

Clicks on buttons, links and inputs inside cells don't select the row. The grid API: `getSelected()`, `select(rows)`, `selectAll()`, `clearSelection()`, `sort(field, dir)`, `setFilter(text)`, `setPage(n)`, `setData(rows)`, `exportCSV(filename)`. Events: `row-click`, `row-dblclick`, `selection-change`, `sort-change`. Cell values are always escaped. Only a `renderer` that returns an HTML string bypasses that.

Stores hold records and notify bound components:

```ts
const users = NX.store('users', { data: [...] });   // create and register
NX.store('users').add({ name: 'Ada' });             // look up and add; bound grids update
users.remove(users.getRange().filter(r => r.data.banned));
users.sort({ property: 'name', direction: 'ASC' });

// Remote data
NX.store('orders', { proxy: { type: 'rest', url: '/api/orders' }, autoLoad: true });
```

## Forms

```ts
{
  xtype: 'form',
  id: 'profile',
  columns: 2,                                   // collapses to 1 column on phones
  values: { first: 'Ada', newsletter: true },
  items: [
    { xtype: 'textfield', name: 'first', label: 'First name', required: true },
    { xtype: 'email', name: 'email', label: 'Email', icon: 'mail', helperText: 'We never share it.' },
    { xtype: 'password', name: 'password', label: 'Password', minLength: 8,
      validator: v => !v || /\d/.test(v) || 'Include a number' },
    { xtype: 'select', name: 'role', label: 'Role', options: ['Admin', 'Editor'] },
    { xtype: 'numberfield', name: 'age', label: 'Age', min: 0 },
    { xtype: 'textarea', name: 'bio', label: 'Bio', style: 'grid-column: 1 / -1' },
    { xtype: 'switch', name: 'newsletter', label: 'Newsletter', description: 'Weekly, no spam.' },
    { xtype: 'checkbox', name: 'terms', label: 'I accept the terms', required: true }
  ],
  buttons: [
    { xtype: 'button', text: 'Reset', type: 'reset', variant: 'ghost' },
    { xtype: 'button', text: 'Save', type: 'submit' }
  ],
  onSubmit: e => save(e.detail.values)     // only fires when every field is valid
}
```

- Field xtypes: `textfield` (set `type` for `url`, `tel`, `time`, …), `textarea`, `email`, `password`, `numberfield`, `datefield`, `search`, `select`, `checkbox`, `switch`.
- Common field options: `name`, `label`, `helperText`, `errorText`, `required`, `disabled`, `placeholder`, `icon`, `clearable`, `validator`, `size`.
- The form API: `getValues()`, `setValues()`, `validate()`, `isValid()`, `submit()`, `reset()`, `getField(name)`.
- Errors appear after a field is touched or on submit. Enter in a single-line field submits.
- Fields are form-associated custom elements, so they also work inside a native `<form>`.

## Dialogs and toasts

Everything returns a promise:

```ts
await NX.alert('Saved.');
if (await NX.confirm('Delete 3 users?', { title: 'Are you sure?', confirmText: 'Delete', danger: true })) { … }
const name = await NX.prompt('Project name', { defaultValue: 'Untitled' });   // null when cancelled

const values = await NX.dialog({
  title: 'Invite',
  description: 'They will get an email.',
  size: 'md',                                 // sm | md | lg | xl | full
  items: [{ xtype: 'form', id: 'invite', items: [...] }],
  buttons: [
    { text: 'Cancel', variant: 'outline' },
    { text: 'Send', variant: 'primary', handler: modal => {
        const v = NX.get('invite').submit();
        if (v) modal.close(v);
        return false;                          // false keeps the dialog open
    } }
  ]
});
```

Dialogs use the native `<dialog>` element, so focus trapping, Escape handling and the inert background come from the browser.

```ts
NX.toast('Event created', { description: 'Sunday at 9:00' });
NX.toast.success('Saved');
NX.toast.error('Upload failed', { action: { text: 'Retry', handler: retry }, duration: 0 });
```

## Menus

```tsx
<Menu text="Actions" items={[
  { text: 'Edit', icon: 'edit', shortcut: '⌘E', handler: edit },
  { text: 'Share', items: [{ text: 'Email' }, { text: 'Copy link' }] },   // submenu
  '-',
  { heading: 'Danger zone' },
  { text: 'Delete', icon: 'trash', danger: true, handler: remove }
]} />

<Button variant="outline" menu={[{ text: 'CSV' }, { text: 'JSON' }]}>Export</Button>

<div onContextMenu={e => { e.preventDefault(); NX.menu([{ text: 'Copy' }, { text: 'Paste' }], e); }} />

<MenuBar items={[{ text: 'File', items: [...] }, { text: 'Edit', items: [...] }]} />
```

Menus render in the browser's top layer, so `overflow: hidden` containers never clip them. They flip when there is no room and support full keyboard navigation and type-ahead. Item options are `checked`, `disabled` and `href`.

## Theming

Three themes ship built in: `light`, `dark` and `midnight`. The user's choice persists in localStorage. With no choice saved, the app's `theme` applies, then the OS preference.

```ts
NX.theme.toggle();
NX.theme.set('midnight');
NX.theme.onChange(name => …);

NX.theme.extend('brand', 'light', { colors: { primary: '#7c3aed', primaryDark: '#6d28d9', ring: '#a78bfa' } });
NX.theme.set('brand');
```

Components only read CSS custom properties, so you can also override them yourself:

```css
:root {
  --color-primary: #7c3aed;
  --radius-md: 0.75rem;
  --font-family: 'Inter', sans-serif;
}
```

Tokens: `--color-{primary,primary-dark,primary-foreground,secondary,secondary-foreground,background,surface,muted,accent,text,text-secondary,border,ring,error,success,warning,info}`, `--radius-{sm,md,lg,xl,full}`, `--shadow-{sm,md,lg,xl}`, `--font-family`, `--font-mono`.

Every component also exposes `::part()`s (`button`, `header`, `body`, `input`, …) for deeper styling.

## Icons

About 60 icons are built in, all 24px stroke icons: `menu`, `close`, `plus`, `trash`, `edit`, `save`, `search`, `settings`, `users`, `user`, `dashboard`, `chart`, `mail`, `bell`, `sun`, `moon`, `check`, the chevrons, `info`, `success`, `warning`, `error` and more. The full list is `NX.icons.names()`.

```ts
NX.icons.register('rocket', '<path d="…"/>');   // inner markup of a 24x24 stroke icon, or a full <svg>
{ xtype: 'button', icon: 'rocket' }
{ xtype: 'button', icon: '<svg>…</svg>' }        // raw SVG works anywhere too
```

## Custom components

The house style (the shadcn "copy a file you own" approach): a class with a shadow root, a `variants()` map for the look, a JSX `render()` and token-based styles. `src/components/ui/badge.tsx` is the reference implementation, and [CONTRIBUTING.md](CONTRIBUTING.md) walks through it.

```tsx
import { BaseComponent, define, variants } from 'nx.js';

const counter = variants({
  base: 'counter',
  variants: { tone: { neutral: '', brand: 'brand' } },
  defaultVariants: { tone: 'neutral' }
});

class Counter extends BaseComponent {
  static get observedAttributes() { return ['label', 'tone']; }

  constructor() { super(); this.attachShadow({ mode: 'open' }); }

  protected initializeState() { this.setState('count', 0); }

  protected render() {
    return (
      <button class={counter({ tone: this.getProp('tone') })}
              onClick={() => this.setState('count', this.getState('count') + 1)}>
        {this.getProp('label', 'Clicks')}: {this.getState('count')}
      </button>
    );
  }

  protected styles() {
    return `
      .counter { padding: .5rem 1rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); }
      .brand { background: var(--color-primary); color: var(--color-primary-foreground); }
    `;
  }
}
define('x-counter', Counter);

export const CounterButton = (props: { label?: string; tone?: 'neutral' | 'brand' }) => <x-counter {...props} />;
```

- `setState()` re-renders on the next frame. Handlers in JSX are attached to the new nodes, so nothing leaks or doubles up.
- Keyboard focus and the text caret survive re-renders.
- Props arrive through attributes or `configure()`. Implement `setXxx()` to receive rich values (`setData`, `setColumns`), and `applyItems(items, build)` to control how children given as `items` are built.
- Every built-in component is written this way. `render()` may still return an HTML string, for legacy code.

Quick one-offs can use `NX.define('stat', { render() { return <b>{this.getProp('value')}</b>; } })`.

## Using it from HTML

Every component is a custom element:

```html
<nx-card title="Welcome">
  <p>Plain HTML works too.</p>
  <nx-button slot="footer" variant="outline" icon="plus">New</nx-button>
</nx-card>

<nx-tabpanel>
  <nx-tab title="Account" icon="user">…</nx-tab>
  <nx-tab title="Password" icon="lock">…</nx-tab>
</nx-tabpanel>

<nx-container layout="hbox" gap="8">
  <nx-textfield label="Name" name="name" required></nx-textfield>
  <nx-select label="Role" name="role">
    <option>Admin</option><option selected>Editor</option>
  </nx-select>
</nx-container>
```

## Development

```bash
pnpm dev          # demo with HMR (src/main.ts)
pnpm test         # unit tests (Vitest + jsdom)
pnpm test:e2e     # end-to-end tests against the demo (Playwright)
pnpm typecheck
pnpm build        # library → dist/ (index + jsx-runtime entries, ESM/CJS/UMD, .d.ts)
pnpm build:demo   # demo → dist-demo/
```

```
src/
  index.ts              public entry point (exports + element definitions)
  app.ts                NX facade, application, router outlet
  jsx/                  JSX runtime + PascalCase components
  core/                 registry/builder, theme, icons, router
  components/abstracts  BaseComponent
  components/ui         buttons, tabs, tree, dialogs, toasts, form fields …
  layout/               container, panel, viewport
  data/                 store, grid
  main.tsx              demo app (the reference for app code)
  tests/                unit + e2e
```
