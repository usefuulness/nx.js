# Component reference

<!-- Generated from the component sources by `pnpm docs:reference`. Do not edit by hand. -->

Every component is an HTML tag and, in JSX, a PascalCase component. Attributes are the kebab-case form of the
JSX props (`icon-position` ↔ `iconPosition`), and `{ xtype }` configs use the same names as JSX. Boolean
attributes are on when present (`<nx-button loading>`). Rich values (arrays, objects) are JSON in an attribute or a
`<script type="application/json" data-nx-config>` child; see [Using it from HTML](jsx-and-html.md#plain-html).

| Tag | JSX | What it is |
| --- | --- | --- |
| [`<nx-accordion>`](#nx-accordion) | `Accordion` | Collapsible sections. |
| [`<nx-accordion-item>`](#nx-accordion-item) | `AccordionItem` | A section inside `<nx-accordion>`: `<nx-accordion-item title="…" expanded>…</nx-accordion-item>` |
| [`<nx-alert>`](#nx-alert) | `Alert` | Alert: an inline callout for important messages on the page. |
| [`<nx-avatar>`](#nx-avatar) | `Avatar` | Avatar: a user image with initials as the fallback (also while loading, and when the image fails). |
| [`<nx-badge>`](#nx-badge) | `Badge` | Small status label. |
| [`<nx-breadcrumb>`](#nx-breadcrumb) | `Breadcrumb` | Breadcrumb trail. The last item is the current page. |
| [`<nx-button>`](#nx-button) | `Button` | Button. |
| [`<nx-card>`](#nx-card) | `Card` | Card with optional header, body and footer. |
| [`<nx-checkbox>`](#nx-checkbox) | `Checkbox` | Checkbox or toggle switch. |
| [`<nx-combobox>`](#nx-combobox) | `Combobox` | Combobox: a text input that filters a list of options — a searchable select. |
| [`<nx-command>`](#nx-command) | `Command` | Command menu: a search box over a list of actions (shadcn's Command / ⌘K). Type to filter, arrow keys to move, Enter to run. |
| [`<nx-container>`](#nx-container) | `Box`, `HStack`, `VStack`, `Grid` | Flex/grid layout box. Children are regular light-DOM elements. |
| [`<nx-data-table>`](#nx-data-table) | — | `<nx-data-table>` — kept for compatibility; identical to `<nx-grid>`. |
| [`<nx-datepicker>`](#nx-datepicker) | `DatePicker` | Date picker: a button that opens a calendar. Full keyboard support in the calendar grid (arrows, Home/End, Page Up/Down for months, with Shift for years), localized names, `min`/`max`, and a `YYYY-MM-DD` form value. |
| [`<nx-dialog>`](#nx-dialog) | `Dialog` | `<nx-dialog>`: the HTML name matching `<Dialog>` in JSX. |
| [`<nx-divider>`](#nx-divider) | `Divider` | Horizontal rule, optionally with a label. |
| [`<nx-drawer>`](#nx-drawer) | `Drawer` | Slide-in panel (a "sheet"), built on the native `<dialog>` element: focus trap, Escape, top layer and inert background come from the browser. |
| [`<nx-form>`](#nx-form) | `Form` | Form container: collects values from named fields, validates, and fires `submit`. Works with nx fields and plain `<input>`/`<select>`/`<textarea>` elements. |
| [`<nx-grid>`](#nx-grid) | `DataGrid` | Data grid: sorting, search, selection, paging, store binding. |
| [`<nx-input>`](#nx-input) | `Input` | `<nx-input>`: the HTML name matching `<Input>` in JSX. |
| [`<nx-loader>`](#nx-loader) | — | Loading indicator, optionally covering its container or the whole page. |
| [`<nx-menu>`](#nx-menu) | `Menu` | A trigger button with a dropdown menu. |
| [`<nx-menubar>`](#nx-menubar) | `MenuBar` | Application menu bar (File / Edit / View …). Once a menu is open, hovering or arrowing to a neighbour switches menus, like a desktop app. |
| [`<nx-modal>`](#nx-modal) | — | Modal dialog built on the native `<dialog>` element (focus trap, Escape, top layer and inert background for free). |
| [`<nx-panel>`](#nx-panel) | `Panel` | General-purpose container with an optional header. Inside a viewport, set `region` to dock it (`north`, `west`, `center`, ...). |
| [`<nx-popover>`](#nx-popover) | `Popover` | Popover: a panel of rich content anchored to a trigger. Click the trigger to toggle; Escape, clicking outside or opening another popover closes it. |
| [`<nx-progress>`](#nx-progress) | `Progress` | Progress bar. |
| [`<nx-radio-group>`](#nx-radio-group) | `RadioGroup` | Radio group: pick one of a few options. Native radios inside, so arrow keys, form posting and validation (`required`) behave like HTML. |
| [`<nx-select>`](#nx-select) | `Select` | Select, styled around the native `<select>` (accessible, mobile friendly, never clipped by overflow containers). |
| [`<nx-separator>`](#nx-separator) | `Separator` | Vertical separator for toolbars / hboxes. Shorthand in items arrays: `'-'`. |
| [`<nx-skeleton>`](#nx-skeleton) | `Skeleton` | Loading placeholder. |
| [`<nx-slider>`](#nx-slider) | `Slider` | Slider: pick a number in a range. A native range input underneath, so arrow keys, Page Up/Down, Home/End, touch and form posting all work. |
| [`<nx-spacer>`](#nx-spacer) | `Spacer` | Flexible space. In a toolbar or hbox, pushes following items to the end. Shorthand in items arrays: `'->'`. |
| [`<nx-spinner>`](#nx-spinner) | `Spinner` | Loading spinner. |
| [`<nx-switch>`](#nx-switch) | `Switch` | `<nx-switch>`: a toggle switch, like `<Switch>` in JSX. |
| [`<nx-tab>`](#nx-tab) | `Tab` | A tab inside `<nx-tabpanel>`: `<nx-tab title="Account" icon="user" closable>…</nx-tab>`. |
| [`<nx-tabpanel>`](#nx-tabpanel) | — | Tabs. Each item is a tab: `title`/`icon`/`closable`/`disabled` configure the tab button, everything else (`xtype`, `items`, `html`) is the tab's content. |
| [`<nx-tabs>`](#nx-tabs) | `Tabs` | `<nx-tabs>`: the HTML name matching `<Tabs>` in JSX. |
| [`<nx-textarea>`](#nx-textarea) | `Textarea` | `<nx-textarea>`: a multi-line text field, like `<Textarea>` in JSX. |
| [`<nx-textfield>`](#nx-textfield) | — | Text input (also: `xtype: 'textarea'`, `'numberfield'`, `'datefield'`, `'password'`, `'email'`). |
| [`<nx-toast>`](#nx-toast) | — | Toast notifications: short messages that stack in a corner and dismiss themselves. Created on demand by the helpers, so you rarely write the tag: |
| [`<nx-toolbar>`](#nx-toolbar) | `Toolbar` | Horizontal bar of controls. Items are regular components; buttons default to the `ghost` variant. Use `'->'` to push the rest to the right and `'-'` for a separator. |
| [`<nx-tooltip>`](#nx-tooltip) | `Tooltip` | Tooltip: a short hint shown on hover and keyboard focus. Wrap the trigger: `<nx-tooltip content="Save changes"><nx-button icon="save" aria-label="Save"></nx-button></nx-tooltip>` (buttons also take `tooltip="…"` directly). |
| [`<nx-tree>`](#nx-tree) | `Tree` | Tree view with keyboard navigation (arrow keys, Home/End, type-ahead), optional checkboxes and multi-select. Nodes can carry a `route` to navigate on select. |
| [`<nx-viewport>`](#nx-viewport) | `Viewport` | Full-page app shell. Children go into regions with `region="north\|south\|east\|west\|center"`; side regions collapse into a drawer on small screens. |

## nx-accordion

`<nx-accordion>` · JSX: `<Accordion>` · [source](../src/components/ui/accordion.tsx)

Collapsible sections.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `collapsible` | `collapsible` | `boolean` | Allow closing the open section (default true) |
| `multiple` | `multiple` | `boolean` | Allow several sections open at once |

**Events:** `toggle`

## nx-accordion-item

`<nx-accordion-item>` · JSX: `<AccordionItem>` · [source](../src/components/ui/accordion.tsx)

A section inside `<nx-accordion>`: `<nx-accordion-item title="…" expanded>…</nx-accordion-item>`

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `disabled` | `disabled` | `boolean` | Can't be toggled |
| `expanded` | `expanded` | `boolean` | Open |
| `title` | `title` |  | Header text |

## nx-alert

`<nx-alert>` · JSX: `<Alert>` · [source](../src/components/ui/alert.tsx)

Alert: an inline callout for important messages on the page.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `dismissible` | `dismissible` | `boolean` | Show an × that removes the alert and emits `dismiss` |
| `icon` | `icon` | `string` | Icon name; each variant has a default (`false`/`"none"` hides it) |
| `title` | `title` | `string` | Bold first line |
| `variant` | `variant` | `default` `info` `success` `warning` `destructive` | Color and icon by meaning |

**Events:** `dismiss`

## nx-avatar

`<nx-avatar>` · JSX: `<Avatar>` · [source](../src/components/ui/avatar.tsx)

Avatar: a user image with initials as the fallback (also while loading, and when the image fails).

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `alt` | `alt` | `string` | Person or thing shown — the accessible name, and the source of the initials |
| `fallback` | `fallback` | `string` | Text shown when there is no image (default: initials of `alt`) |
| `shape` | `shape` | `circle` `square` | Circle or rounded square |
| `size` | `size` | `sm` `md` `lg` `xl` | Avatar size |
| `src` | `src` | `string` | Image URL |
| `status` | `status` | `online` `away` `busy` `offline` | Presence dot |

## nx-badge

`<nx-badge>` · JSX: `<Badge>` · [source](../src/components/ui/badge.tsx)

Small status label.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `icon` | `icon` | `string` | Icon before the text |
| `removable` | `removable` | `boolean` | Show an × that emits `remove` |
| `variant` | `variant` | `default` `info` `success` `warning` `destructive` `secondary` `outline` | Color by meaning |

## nx-breadcrumb

`<nx-breadcrumb>` · JSX: `<Breadcrumb>` · [source](../src/components/ui/breadcrumb.tsx)

Breadcrumb trail. The last item is the current page.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `separator` | `separator` | `string` | Separator text, or an icon name (default: chevron-right) |

## nx-button

`<nx-button>` · JSX: `<Button>` · [source](../src/components/ui/button.tsx)

Button.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `aria-label` | `ariaLabel` |  | Accessible name, for when there is no visible text |
| `disabled` | `disabled` | `boolean` | Not interactive |
| `full-width` | `fullWidth` | `boolean` | Stretch to the full width of the container |
| `href` | `href` | `string` | Link target — renders the button as an `<a>` |
| `icon` | `icon` | `string` | Icon name from the built-in set (see `Icons.names()`) or raw SVG |
| `icon-position` | `iconPosition` | `left` `right` | Icon before or after the text |
| `loading` | `loading` | `boolean` | Shows a spinner and ignores clicks |
| `name` | `name` | `string` | Submitted with the form when this button submits it, like `<button name value>` |
| `size` | `size` | `sm` `md` `lg` `icon` | `icon` makes a square icon-only button |
| `tabindex` | `tabindex` |  | Position in the tab order, as for any HTML element |
| `text` | `text` | `string` | Label text (or put it between the tags) |
| `tooltip` | `tooltip` | `string` | Hint shown on hover and keyboard focus (also the accessible name of icon-only buttons) |
| `tooltip-placement` | `tooltipPlacement` | `left` `right` `top` `bottom` `left-start` `right-start` `top-start` `bottom-start` `left-end` `right-end` `top-end` `bottom-end` | Where the tooltip appears |
| `type` | `type` | `button` `submit` `reset` | `submit`/`reset` work inside `<nx-form>` and native `<form>` alike |
| `value` | `value` | `string` | Submitted with `name` when this button submits a form |
| `variant` | `variant` | `secondary` `outline` `primary` `ghost` `danger` `link` | Visual style; `danger` for destructive actions |

## nx-card

`<nx-card>` · JSX: `<Card>` · [source](../src/components/ui/card.tsx)

Card with optional header, body and footer.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `elevation` | `elevation` | `0 \| 1 \| 2 \| 3` | Shadow depth 0–3 (default 1) |
| `icon` | `icon` | `string` | Icon shown in a tile next to the title |
| `padding` | `padding` | `boolean` | Pad the body (default true) |
| `subtitle` | `subtitle` | `string` | Secondary line under the title |
| `title` | `title` | `string` | Card heading |

## nx-checkbox

`<nx-checkbox>` · JSX: `<Checkbox>` · [source](../src/components/ui/form/checkbox.tsx)

Checkbox or toggle switch.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `checked` | `checked` | `boolean` | Checked |
| `description` | `description` | `string` | Secondary text under the title or label |
| `disabled` | `disabled` | `boolean` | Not interactive (fields are also left out when a form posts) |
| `error-text` | `errorText` | `string` | Error shown under the field (for example from the server); marks it invalid |
| `helper-text` | `helperText` | `string` | Hint shown under the field |
| `indeterminate` | `indeterminate` | `boolean` | Shows a dash for "partly checked"; cleared when the user toggles it |
| `label` | `label` | `string` | Label shown with the field |
| `name` | `name` | `string` | Field name: the key in form values, and the name it posts under |
| `required` | `required` | `boolean` | A value is required before the form can submit |
| `switch` | `switch` | `boolean` | Render as a toggle switch (also: `xtype: 'switch'`) |
| `value` | `value` | `string` | Value submitted when checked (default `'on'`); `form.getValues()` reports a boolean unless set |

## nx-combobox

`<nx-combobox>` · JSX: `<Combobox>` · [source](../src/components/ui/form/combobox.tsx)

Combobox: a text input that filters a list of options — a searchable select.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `disabled` | `disabled` | `boolean` | Not interactive (fields are also left out when a form posts) |
| `empty-text` | `emptyText` | `string` | Shown when nothing matches (default "No results.") |
| `error-text` | `errorText` | `string` | Error shown under the field (for example from the server); marks it invalid |
| `free-text` | `freeText` | `boolean` | Accept typed text that isn't an option |
| `helper-text` | `helperText` | `string` | Hint shown under the field |
| `icon` | `icon` | `string` | Icon name from the built-in set (`NX.icons.names()`) or raw SVG |
| `label` | `label` | `string` | Label shown with the field |
| `name` | `name` | `string` | Field name: the key in form values, and the name it posts under |
| `placeholder` | `placeholder` | `string` | Text shown while empty |
| `required` | `required` | `boolean` | A value is required before the form can submit |
| `size` | `size` | `sm` `md` `lg` | Control height |
| `value` | `value` | `string \| number` | Selected option value |

**Events:** `change`

## nx-command

`<nx-command>` · JSX: `<Command>` · [source](../src/components/ui/command.tsx)

Command menu: a search box over a list of actions (shadcn's Command / ⌘K). Type to filter, arrow keys to move, Enter to run.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `empty-text` | `emptyText` | `string` | Shown when nothing matches (default "No results found.") |
| `placeholder` | `placeholder` | `string` | Search box placeholder |

**Events:** `select`

## nx-container

`<nx-container>` · JSX: `<Box>`, `<HStack>`, `<VStack>`, `<Grid>` · [source](../src/layout/container.tsx)

Flex/grid layout box. Children are regular light-DOM elements.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `align` | `align` | `start` `center` `end` `stretch` `baseline` | Cross-axis alignment of the children |
| `columns` | `columns` | `number` | grid layout: fixed column count |
| `gap` | `gap` | `string \| number` | Space between children (px number or CSS length) |
| `layout` | `layout` | `vbox` `hbox` `grid` `fit` | `hbox` (row), `vbox` (column), `grid`, or `fit` (one child fills it) |
| `min-column-width` | `minColumnWidth` | `string \| number` | grid layout: responsive columns of at least this width |
| `pack` | `pack` | `start` `center` `end` `between` `around` `evenly` | Main-axis distribution of the children |
| `padding` | `padding` | `string \| number` | Inner padding (px number or CSS length) |
| `scrollable` | `scrollable` | `boolean` | Scroll when the content overflows |
| `wrap` | `wrap` | `boolean` | Let children wrap onto new lines |

## nx-data-table

`<nx-data-table>` · [source](../src/data/grid.tsx)

`<nx-data-table>` — kept for compatibility; identical to `<nx-grid>`.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `bordered` | `bordered` | `boolean` | Borders between cells |
| `checkbox-selection` | `checkboxSelection` | `boolean` | A checkbox column for selecting rows |
| `dense` | `dense` | `boolean` | Compact rows |
| `empty-text` | `emptyText` | `string` | Shown when there are no rows |
| `hoverable` | `hoverable` | `boolean` | Highlight the row under the pointer |
| `page-size` | `pageSize` | `number` | Rows per page; omit for no paging |
| `search` | `search` | `boolean` | Show a search box that filters across all visible columns |
| `selectable` | `selectable` | `boolean \| 'single' \| 'multiple'` | Row selection: `true` or `'single'` for one row, `'multiple'` for several |
| `store` | `store` |  | …or a Store instance / registered store name |
| `striped` | `striped` | `boolean` | Alternate row shading |
| `title` | `title` | `string` | Toolbar heading |

## nx-datepicker

`<nx-datepicker>` · JSX: `<DatePicker>` · [source](../src/components/ui/form/datepicker.tsx)

Date picker: a button that opens a calendar. Full keyboard support in the calendar grid (arrows, Home/End, Page Up/Down for months, with Shift for years), localized names, `min`/`max`, and a `YYYY-MM-DD` form value.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `disabled` | `disabled` | `boolean` | Not interactive (fields are also left out when a form posts) |
| `error-text` | `errorText` | `string` | Error shown under the field (for example from the server); marks it invalid |
| `first-day` | `firstDay` | `number` | First day of the week, 0 = Sunday … 6 = Saturday (default: from the locale) |
| `helper-text` | `helperText` | `string` | Hint shown under the field |
| `label` | `label` | `string` | Label shown with the field |
| `locale` | `locale` | `string` | BCP 47 locale for names and formatting (default: `<html lang>`, then the browser's) |
| `max` | `max` | `string` | Latest selectable date, `YYYY-MM-DD` |
| `min` | `min` | `string` | Earliest selectable date, `YYYY-MM-DD` |
| `name` | `name` | `string` | Field name: the key in form values, and the name it posts under |
| `placeholder` | `placeholder` | `string` | Text shown while empty |
| `required` | `required` | `boolean` | A value is required before the form can submit |
| `size` | `size` | `sm` `md` `lg` | Control height |
| `value` | `value` | `string` | `YYYY-MM-DD` |

**Events:** `change`

## nx-dialog

`<nx-dialog>` · JSX: `<Dialog>` · [source](../src/components/ui/modal.tsx)

`<nx-dialog>`: the HTML name matching `<Dialog>` in JSX.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `closable` | `closable` | `boolean` | Show a close (×) button |
| `close-on-backdrop` | `closeOnBackdrop` | `boolean` | Close when the backdrop is clicked |
| `close-on-escape` | `closeOnEscape` | `boolean` | Close when Escape is pressed |
| `description` | `description` | `string` | Text under the heading |
| `destroy-on-close` | `destroyOnClose` | `boolean` | Remove the element from the DOM after it closes |
| `flush` | `flush` | `boolean` | No padding around the body (for full-bleed content such as a command palette) |
| `html` | `html` | `string` | Body HTML |
| `label` | `label` | `string` | Accessible name when there is no visible title |
| `size` | `size` | `sm` `md` `lg` `xl` `full` | Dialog width |
| `title` | `title` | `string` | Dialog heading |

## nx-divider

`<nx-divider>` · JSX: `<Divider>` · [source](../src/layout/container.tsx)

Horizontal rule, optionally with a label.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `label` | `label` |  | Text in the middle of the rule |

## nx-drawer

`<nx-drawer>` · JSX: `<Drawer>` · [source](../src/components/ui/drawer.tsx)

Slide-in panel (a "sheet"), built on the native `<dialog>` element: focus trap, Escape, top layer and inert background come from the browser.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `backdrop` | `backdrop` | `boolean` | Dim and block the page behind (default true). `false` = non-modal side panel |
| `close-on-backdrop` | `closeOnBackdrop` | `boolean` | Close when the backdrop is clicked |
| `close-on-escape` | `closeOnEscape` | `boolean` | Close when Escape is pressed |
| `description` | `description` | `string` | Text under the heading |
| `open` | `open` | `boolean` | Initially open |
| `persistent` | `persistent` | `boolean` | Can't be dismissed by the user (no ×, Escape or backdrop) |
| `position` | `position` | `left` `right` `top` `bottom` | Edge the drawer slides in from |
| `size` | `size` | `string \| number` | Width (left/right) or height (top/bottom): CSS length or px number. Default 24rem |
| `title` | `title` | `string` | Drawer heading |

**Events:** `open`, `close`

## nx-form

`<nx-form>` · JSX: `<Form>` · [source](../src/components/ui/form.tsx)

Form container: collects values from named fields, validates, and fires `submit`. Works with nx fields and plain `<input>`/`<select>`/`<textarea>` elements.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `action` | `action` | `string` | Post to the server like a native form (after validation, unless `submit` is prevented) |
| `columns` | `columns` | `number` | Lay fields out in N columns |
| `enctype` | `enctype` | `application/x-www-form-urlencoded` `multipart/form-data` `text/plain` | Encoding used with `action` (`multipart/form-data` for file uploads) |
| `gap` | `gap` | `string \| number` | Space between fields (px number or CSS length) |
| `method` | `method` | `get` `post` `dialog` | HTTP method used with `action` |
| `target` | `target` | `string` | Where the response of `action` opens |

**Events:** `submit`

## nx-grid

`<nx-grid>` · JSX: `<DataGrid>` · [source](../src/data/grid.tsx)

Data grid: sorting, search, selection, paging, store binding.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `bordered` | `bordered` | `boolean` | Borders between cells |
| `checkbox-selection` | `checkboxSelection` | `boolean` | A checkbox column for selecting rows |
| `dense` | `dense` | `boolean` | Compact rows |
| `empty-text` | `emptyText` | `string` | Shown when there are no rows |
| `hoverable` | `hoverable` | `boolean` | Highlight the row under the pointer |
| `page-size` | `pageSize` | `number` | Rows per page; omit for no paging |
| `search` | `search` | `boolean` | Show a search box that filters across all visible columns |
| `selectable` | `selectable` | `boolean \| 'single' \| 'multiple'` | Row selection: `true` or `'single'` for one row, `'multiple'` for several |
| `store` | `store` |  | …or a Store instance / registered store name |
| `striped` | `striped` | `boolean` | Alternate row shading |
| `title` | `title` | `string` | Toolbar heading |

**Events:** `row-click`, `row-dblclick`, `selection-change`, `sort-change`

## nx-input

`<nx-input>` · JSX: `<Input>` · [source](../src/components/ui/form/textfield.tsx)

`<nx-input>`: the HTML name matching `<Input>` in JSX.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `autocomplete` | `autocomplete` | `string` | Browser autofill hint (`email`, `name`, `new-password`…) |
| `clearable` | `clearable` | `boolean` | Show an × button when there is a value |
| `disabled` | `disabled` | `boolean` | Not interactive (fields are also left out when a form posts) |
| `error-text` | `errorText` | `string` | Error shown under the field (for example from the server); marks it invalid |
| `helper-text` | `helperText` | `string` | Hint shown under the field |
| `icon` | `icon` | `string` | Leading icon (name or SVG) |
| `label` | `label` | `string` | Label shown with the field |
| `max` | `max` | `string \| number` | Largest allowed value |
| `max-length` | `maxLength` | `number` | Maximum number of characters |
| `maxlength` | `maxlength` | `number` | Maximum number of characters |
| `min` | `min` | `string \| number` | Smallest allowed value |
| `min-length` | `minLength` | `number` | Minimum number of characters |
| `minlength` | `minlength` | `number` | Minimum number of characters |
| `multiline` | `multiline` | `boolean` | Render a `<textarea>` |
| `name` | `name` | `string` | Field name: the key in form values, and the name it posts under |
| `pattern` | `pattern` | `string` | Regular expression the whole value must match |
| `placeholder` | `placeholder` | `string` | Text shown while empty |
| `readonly` | `readonly` | `boolean` | Can be focused and copied, but not edited |
| `required` | `required` | `boolean` | A value is required before the form can submit |
| `rows` | `rows` | `number` | Visible lines (multi-line fields) |
| `size` | `size` | `sm` `md` `lg` | Control height |
| `step` | `step` | `string \| number` | Increment between allowed values |
| `type` | `type` | `number` `text` `email` `password` `tel` `url` `search` `date` `time` `datetime-local` | Input type: `text`, `email`, `password`, `number`, `date`, `search`… |
| `value` | `value` | `string \| number` | Current value |

## nx-loader

`<nx-loader>` · [source](../src/components/ui/loader.tsx)

Loading indicator, optionally covering its container or the whole page.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `active` | `active` | `boolean` | `false` hides the loader |
| `color` | `color` | `string` | Any CSS color; defaults to the primary color |
| `fullscreen` | `fullscreen` | `boolean` | Cover the whole viewport |
| `overlay` | `overlay` | `boolean` | Cover the nearest positioned ancestor with a translucent layer |
| `size` | `size` | `sm` `md` `lg` | Indicator size |
| `text` | `text` | `string` | Message under the indicator |
| `type` | `type` | `spinner` `dots` `bars` `pulse` | Animation style |

## nx-menu

`<nx-menu>` · JSX: `<Menu>` · [source](../src/components/ui/menu.tsx)

A trigger button with a dropdown menu.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `disabled` | `disabled` | `boolean` | Trigger is not interactive |
| `icon` | `icon` | `string` | Trigger button icon |
| `placement` | `placement` | `bottom-start` `bottom-end` | Where the menu opens |
| `size` | `size` | `sm` `md` `lg` `icon` | Trigger button size |
| `text` | `text` | `string` | Trigger button text |
| `variant` | `variant` | `secondary` `outline` `primary` `ghost` `danger` `link` | Trigger button style |

## nx-menubar

`<nx-menubar>` · JSX: `<MenuBar>` · [source](../src/components/ui/menubar.tsx)

Application menu bar (File / Edit / View …). Once a menu is open, hovering or arrowing to a neighbour switches menus, like a desktop app.

## nx-modal

`<nx-modal>` · [source](../src/components/ui/modal.tsx)

Modal dialog built on the native `<dialog>` element (focus trap, Escape, top layer and inert background for free).

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `closable` | `closable` | `boolean` | Show a close (×) button |
| `close-on-backdrop` | `closeOnBackdrop` | `boolean` | Close when the backdrop is clicked |
| `close-on-escape` | `closeOnEscape` | `boolean` | Close when Escape is pressed |
| `description` | `description` | `string` | Text under the heading |
| `destroy-on-close` | `destroyOnClose` | `boolean` | Remove the element from the DOM after it closes |
| `flush` | `flush` | `boolean` | No padding around the body (for full-bleed content such as a command palette) |
| `html` | `html` | `string` | Body HTML |
| `label` | `label` | `string` | Accessible name when there is no visible title |
| `size` | `size` | `sm` `md` `lg` `xl` `full` | Dialog width |
| `title` | `title` | `string` | Dialog heading |

**Events:** `open`, `close`

## nx-panel

`<nx-panel>` · JSX: `<Panel>` · [source](../src/layout/panel.tsx)

General-purpose container with an optional header. Inside a viewport, set `region` to dock it (`north`, `west`, `center`, ...).

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `body-padding` | `bodyPadding` | `string \| number \| boolean` | Padding inside the body. `true` (default) = 1rem, `false` = none, or any CSS length / number (px). |
| `border` | `border` | `boolean` | Draw the outer border. Defaults to true, or the region edge only inside a border layout. |
| `closable` | `closable` | `boolean` | Show a close button in the header |
| `collapsed` | `collapsed` | `boolean` | Starts collapsed |
| `collapsible` | `collapsible` | `boolean` | Can be collapsed from its header |
| `height` | `height` | `string \| number` | Height (px number or CSS length) |
| `icon` | `icon` | `string` | Header icon |
| `max-height` | `maxHeight` | `string \| number` | Maximum height (px number or CSS length) |
| `max-width` | `maxWidth` | `string \| number` | Maximum width (px number or CSS length) |
| `min-height` | `minHeight` | `string \| number` | Minimum height (px number or CSS length) |
| `min-width` | `minWidth` | `string \| number` | Minimum width (px number or CSS length) |
| `region` | `region` | `center` `north` `south` `east` `west` | Viewport region to dock into |
| `resizable` | `resizable` | `boolean` | Drag the inner edge to resize (docked panels) |
| `title` | `title` | `string` | Header text |
| `width` | `width` | `string \| number` | Width (px number or CSS length) |

## nx-popover

`<nx-popover>` · JSX: `<Popover>` · [source](../src/components/ui/popover.tsx)

Popover: a panel of rich content anchored to a trigger. Click the trigger to toggle; Escape, clicking outside or opening another popover closes it.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `label` | `label` | `string` | Accessible name of the panel (defaults to the trigger's text) |
| `placement` | `placement` | `left` `right` `top` `bottom` `left-start` `right-start` `top-start` `bottom-start` `left-end` `right-end` `top-end` `bottom-end` | Preferred side; flips when there is no room |
| `width` | `width` | `string \| number` | Panel width, e.g. `320` or `'20rem'` (default 18rem) |

**Events:** `open`, `close`

## nx-progress

`<nx-progress>` · JSX: `<Progress>` · [source](../src/components/ui/progress.tsx)

Progress bar.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `animated` | `animated` | `boolean` | Animate the stripes |
| `indeterminate` | `indeterminate` | `boolean` | Unknown duration |
| `label` | `label` | `string` | Text above the bar (also the accessible name) |
| `max` | `max` | `number` | Value at 100% (default 100) |
| `show-label` | `showLabel` | `boolean` | Deprecated: use `label` — kept for compatibility |
| `show-value` | `showValue` | `boolean` | Show the percentage above the bar |
| `size` | `size` | `sm` `md` `lg` | Bar thickness |
| `striped` | `striped` | `boolean` | Striped bar |
| `value` | `value` | `number` | Current value |
| `variant` | `variant` | `default` `info` `success` `warning` `error` | Color by meaning |

## nx-radio-group

`<nx-radio-group>` · JSX: `<RadioGroup>` · [source](../src/components/ui/form/radio.tsx)

Radio group: pick one of a few options. Native radios inside, so arrow keys, form posting and validation (`required`) behave like HTML.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `disabled` | `disabled` | `boolean` | Not interactive (fields are also left out when a form posts) |
| `error-text` | `errorText` | `string` | Error shown under the field (for example from the server); marks it invalid |
| `helper-text` | `helperText` | `string` | Hint shown under the field |
| `label` | `label` | `string` | Label shown with the field |
| `name` | `name` | `string` | Field name: the key in form values, and the name it posts under |
| `orientation` | `orientation` | `vertical` `horizontal` | Lay the options out in a column or a row |
| `required` | `required` | `boolean` | A value is required before the form can submit |
| `value` | `value` | `string \| number` | Value of the selected option |
| `variant` | `variant` | `default` `cards` | `cards` draws each option as a bordered, selectable card |

## nx-select

`<nx-select>` · JSX: `<Select>` · [source](../src/components/ui/form/select.tsx)

Select, styled around the native `<select>` (accessible, mobile friendly, never clipped by overflow containers).

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `disabled` | `disabled` | `boolean` | Not interactive (fields are also left out when a form posts) |
| `error-text` | `errorText` | `string` | Error shown under the field (for example from the server); marks it invalid |
| `helper-text` | `helperText` | `string` | Hint shown under the field |
| `icon` | `icon` | `string` | Icon name from the built-in set (`NX.icons.names()`) or raw SVG |
| `label` | `label` | `string` | Label shown with the field |
| `multiple` | `multiple` | `boolean` | Allow several selections (the value becomes an array) |
| `name` | `name` | `string` | Field name: the key in form values, and the name it posts under |
| `placeholder` | `placeholder` | `string` | Text shown while empty |
| `required` | `required` | `boolean` | A value is required before the form can submit |
| `size` | `size` | `sm` `md` `lg` | Control height |
| `value` | `value` |  | Current value |

## nx-separator

`<nx-separator>` · JSX: `<Separator>` · [source](../src/layout/container.tsx)

Vertical separator for toolbars / hboxes. Shorthand in items arrays: `'-'`.

## nx-skeleton

`<nx-skeleton>` · JSX: `<Skeleton>` · [source](../src/components/ui/skeleton.tsx)

Loading placeholder.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `animation` | `animation` | `pulse` `wave` `none` | Loading animation |
| `count` | `count` | `number` | Repeat the placeholder (e.g. lines of text) |
| `height` | `height` | `string \| number` | Height (px number or CSS length) |
| `variant` | `variant` | `circle` `text` `circular` `rectangular` | Shape of the placeholder |
| `width` | `width` | `string \| number` | CSS length or px number |

## nx-slider

`<nx-slider>` · JSX: `<Slider>` · [source](../src/components/ui/form/slider.tsx)

Slider: pick a number in a range. A native range input underneath, so arrow keys, Page Up/Down, Home/End, touch and form posting all work.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `disabled` | `disabled` | `boolean` | Not interactive (fields are also left out when a form posts) |
| `error-text` | `errorText` | `string` | Error shown under the field (for example from the server); marks it invalid |
| `helper-text` | `helperText` | `string` | Hint shown under the field |
| `label` | `label` | `string` | Label shown with the field |
| `max` | `max` | `number` | Largest allowed value |
| `min` | `min` | `number` | Smallest allowed value |
| `name` | `name` | `string` | Field name: the key in form values, and the name it posts under |
| `required` | `required` | `boolean` | A value is required before the form can submit |
| `show-value` | `showValue` | `boolean` | Show the current value next to the label |
| `step` | `step` | `number` | Increment between allowed values |
| `unit` | `unit` | `string` | Unit appended to the shown value (HTML-friendly alternative to `format`) |
| `value` | `value` | `number` | Current value (default: the middle of the range) |

**Events:** `input`, `change`

## nx-spacer

`<nx-spacer>` · JSX: `<Spacer>` · [source](../src/layout/container.tsx)

Flexible space. In a toolbar or hbox, pushes following items to the end. Shorthand in items arrays: `'->'`.

## nx-spinner

`<nx-spinner>` · JSX: `<Spinner>` · [source](../src/components/ui/spinner.tsx)

Loading spinner.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `color` | `color` | `string` | Any CSS color; defaults to the primary color |
| `label` | `label` | `string` | Accessible name (default "Loading") |
| `size` | `size` | `sm` `md` `lg` `xl` | Spinner size |
| `speed` | `speed` | `number` | Seconds per rotation (default 0.8) |
| `text` | `text` | `string` | Visible caption under the spinner |
| `thickness` | `thickness` | `number` | Stroke width (viewBox units, default 4) |

## nx-switch

`<nx-switch>` · JSX: `<Switch>` · [source](../src/components/ui/form/checkbox.tsx)

`<nx-switch>`: a toggle switch, like `<Switch>` in JSX.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `checked` | `checked` | `boolean` | Checked |
| `description` | `description` | `string` | Secondary text under the title or label |
| `disabled` | `disabled` | `boolean` | Not interactive (fields are also left out when a form posts) |
| `error-text` | `errorText` | `string` | Error shown under the field (for example from the server); marks it invalid |
| `helper-text` | `helperText` | `string` | Hint shown under the field |
| `indeterminate` | `indeterminate` | `boolean` | Shows a dash for "partly checked"; cleared when the user toggles it |
| `label` | `label` | `string` | Label shown with the field |
| `name` | `name` | `string` | Field name: the key in form values, and the name it posts under |
| `required` | `required` | `boolean` | A value is required before the form can submit |
| `switch` | `switch` | `boolean` | Render as a toggle switch (also: `xtype: 'switch'`) |
| `value` | `value` | `string` | Value submitted when checked (default `'on'`); `form.getValues()` reports a boolean unless set |

## nx-tab

`<nx-tab>` · JSX: `<Tab>` · [source](../src/components/ui/tabpanel.tsx)

A tab inside `<nx-tabpanel>`: `<nx-tab title="Account" icon="user" closable>…</nx-tab>`.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `closable` | `closable` | `boolean` | Show a close button (emits `tab-close`) |
| `content` | `content` | `string` | Static HTML content for the tab |
| `disabled` | `disabled` | `boolean` | Cannot be selected |
| `icon` | `icon` | `string` | Icon name from the built-in set (`NX.icons.names()`) or raw SVG |
| `id` | `id` | `string` | Element id (also `NX.get(id)`) |
| `title` | `title` | `string` | Tab label |

## nx-tabpanel

`<nx-tabpanel>` · [source](../src/components/ui/tabpanel.tsx)

Tabs. Each item is a tab: `title`/`icon`/`closable`/`disabled` configure the tab button, everything else (`xtype`, `items`, `html`) is the tab's content.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `active-tab` | `activeTab` | `number` | Index of the selected tab |
| `position` | `position` | `left` `right` `top` `bottom` | Side the tab strip sits on |
| `variant` | `variant` | `default` `pills` `underlined` | Tab strip style |

## nx-tabs

`<nx-tabs>` · JSX: `<Tabs>` · [source](../src/components/ui/tabpanel.tsx)

`<nx-tabs>`: the HTML name matching `<Tabs>` in JSX.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `active-tab` | `activeTab` | `number` | Index of the selected tab |
| `position` | `position` | `left` `right` `top` `bottom` | Side the tab strip sits on |
| `variant` | `variant` | `default` `pills` `underlined` | Tab strip style |

## nx-textarea

`<nx-textarea>` · JSX: `<Textarea>` · [source](../src/components/ui/form/textfield.tsx)

`<nx-textarea>`: a multi-line text field, like `<Textarea>` in JSX.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `autocomplete` | `autocomplete` | `string` | Browser autofill hint (`email`, `name`, `new-password`…) |
| `clearable` | `clearable` | `boolean` | Show an × button when there is a value |
| `disabled` | `disabled` | `boolean` | Not interactive (fields are also left out when a form posts) |
| `error-text` | `errorText` | `string` | Error shown under the field (for example from the server); marks it invalid |
| `helper-text` | `helperText` | `string` | Hint shown under the field |
| `icon` | `icon` | `string` | Leading icon (name or SVG) |
| `label` | `label` | `string` | Label shown with the field |
| `max` | `max` | `string \| number` | Largest allowed value |
| `max-length` | `maxLength` | `number` | Maximum number of characters |
| `maxlength` | `maxlength` | `number` | Maximum number of characters |
| `min` | `min` | `string \| number` | Smallest allowed value |
| `min-length` | `minLength` | `number` | Minimum number of characters |
| `minlength` | `minlength` | `number` | Minimum number of characters |
| `multiline` | `multiline` | `boolean` | Render a `<textarea>` |
| `name` | `name` | `string` | Field name: the key in form values, and the name it posts under |
| `pattern` | `pattern` | `string` | Regular expression the whole value must match |
| `placeholder` | `placeholder` | `string` | Text shown while empty |
| `readonly` | `readonly` | `boolean` | Can be focused and copied, but not edited |
| `required` | `required` | `boolean` | A value is required before the form can submit |
| `rows` | `rows` | `number` | Visible lines (multi-line fields) |
| `size` | `size` | `sm` `md` `lg` | Control height |
| `step` | `step` | `string \| number` | Increment between allowed values |
| `type` | `type` | `number` `text` `email` `password` `tel` `url` `search` `date` `time` `datetime-local` | Input type: `text`, `email`, `password`, `number`, `date`, `search`… |
| `value` | `value` | `string \| number` | Current value |

## nx-textfield

`<nx-textfield>` · [source](../src/components/ui/form/textfield.tsx)

Text input (also: `xtype: 'textarea'`, `'numberfield'`, `'datefield'`, `'password'`, `'email'`).

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `autocomplete` | `autocomplete` | `string` | Browser autofill hint (`email`, `name`, `new-password`…) |
| `clearable` | `clearable` | `boolean` | Show an × button when there is a value |
| `disabled` | `disabled` | `boolean` | Not interactive (fields are also left out when a form posts) |
| `error-text` | `errorText` | `string` | Error shown under the field (for example from the server); marks it invalid |
| `helper-text` | `helperText` | `string` | Hint shown under the field |
| `icon` | `icon` | `string` | Leading icon (name or SVG) |
| `label` | `label` | `string` | Label shown with the field |
| `max` | `max` | `string \| number` | Largest allowed value |
| `max-length` | `maxLength` | `number` | Maximum number of characters |
| `maxlength` | `maxlength` | `number` | Maximum number of characters |
| `min` | `min` | `string \| number` | Smallest allowed value |
| `min-length` | `minLength` | `number` | Minimum number of characters |
| `minlength` | `minlength` | `number` | Minimum number of characters |
| `multiline` | `multiline` | `boolean` | Render a `<textarea>` |
| `name` | `name` | `string` | Field name: the key in form values, and the name it posts under |
| `pattern` | `pattern` | `string` | Regular expression the whole value must match |
| `placeholder` | `placeholder` | `string` | Text shown while empty |
| `readonly` | `readonly` | `boolean` | Can be focused and copied, but not edited |
| `required` | `required` | `boolean` | A value is required before the form can submit |
| `rows` | `rows` | `number` | Visible lines (multi-line fields) |
| `size` | `size` | `sm` `md` `lg` | Control height |
| `step` | `step` | `string \| number` | Increment between allowed values |
| `type` | `type` | `number` `text` `email` `password` `tel` `url` `search` `date` `time` `datetime-local` | Input type: `text`, `email`, `password`, `number`, `date`, `search`… |
| `value` | `value` | `string \| number` | Current value |

## nx-toast

`<nx-toast>` · [source](../src/components/ui/toast.tsx)

Toast notifications: short messages that stack in a corner and dismiss themselves. Created on demand by the helpers, so you rarely write the tag:

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `position` | `position` |  | Where toasts stack: `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center` or `bottom-right` (default) |

## nx-toolbar

`<nx-toolbar>` · JSX: `<Toolbar>` · [source](../src/components/ui/toolbar.tsx)

Horizontal bar of controls. Items are regular components; buttons default to the `ghost` variant. Use `'->'` to push the rest to the right and `'-'` for a separator.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `title` | `title` | `string` | Optional title rendered at the start |
| `variant` | `variant` | `default` `compact` `plain` | Density and background |

## nx-tooltip

`<nx-tooltip>` · JSX: `<Tooltip>` · [source](../src/components/ui/tooltip.tsx)

Tooltip: a short hint shown on hover and keyboard focus. Wrap the trigger: `<nx-tooltip content="Save changes"><nx-button icon="save" aria-label="Save"></nx-button></nx-tooltip>` (buttons also take `tooltip="…"` directly).

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `content` | `content` | `string` | Tooltip text (or put rich content in a `slot="tooltip"` child) |
| `delay` | `delay` | `number` | Hover delay in ms (default 400). Moving between tooltips skips it. |
| `disabled` | `disabled` | `boolean` | Don't show the tooltip |
| `placement` | `placement` | `left` `right` `top` `bottom` `left-start` `right-start` `top-start` `bottom-start` `left-end` `right-end` `top-end` `bottom-end` | Preferred side; flips when there is no room |

## nx-tree

`<nx-tree>` · JSX: `<Tree>` · [source](../src/components/ui/tree.tsx)

Tree view with keyboard navigation (arrow keys, Home/End, type-ahead), optional checkboxes and multi-select. Nodes can carry a `route` to navigate on select.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `checkboxes` | `checkboxes` | `boolean` | A checkbox on every node (emits `check`) |
| `expand-on-click` | `expandOnClick` | `boolean` | Clicking a parent node expands or collapses it |
| `icons` | `icons` | `boolean` | Show node icons |
| `multi-select` | `multiSelect` | `boolean` | Select several nodes with Ctrl/⌘ and Shift |

**Events:** `select`, `toggle`, `check`

## nx-viewport

`<nx-viewport>` · JSX: `<Viewport>` · [source](../src/layout/viewport.tsx)

Full-page app shell. Children go into regions with `region="north|south|east|west|center"`; side regions collapse into a drawer on small screens.

| Attribute | JSX prop | Values | Description |
| --- | --- | --- | --- |
| `breakpoint` | `breakpoint` | `number` | Width in px below which side regions turn into drawers (default 768) |
| `layout` | `layout` | `fit` `border` `viewport` `card` | `border` (default, also accepts `viewport`) \| `card` \| `fit` |
