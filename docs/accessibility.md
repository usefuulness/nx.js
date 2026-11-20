# Accessibility

Every component is built to work with a keyboard and a screen reader, in every theme. This is checked automatically: `pnpm test:e2e` runs an [axe-core](https://github.com/dequelabs/axe-core) audit (WCAG 2.1 A and AA) of every demo page in all three themes, with dialogs, menus, popovers, the date picker and the command palette open. The audit must stay at zero violations for a change to ship.

## What you get without doing anything

- **Native elements where they exist.** Buttons are `<button>`s, selects are `<select>`s, and the radio group, checkbox, switch and slider use native inputs. Dialogs and drawers use `<dialog>`, which provides the focus trap, Escape and the inert background.
- **Labels are wired up.** A field's `label` labels its control, its `helper-text` and errors are linked with `aria-describedby`, and an invalid field gets `aria-invalid`.
- **Visible focus** on every interactive part (`--color-ring`), shown for keyboard use only (`:focus-visible`).
- **Contrast.** Status text uses the `--color-*-text` tokens, which are derived to reach 4.5:1.
- **Reduced motion.** Transitions and animations shrink to near zero under `prefers-reduced-motion`.
- **Announcements.** Toasts are announced politely. `<nx-alert>` uses `role="alert"` for warnings and errors and `role="status"` otherwise.
- **Top-layer overlays.** Menus, popovers, tooltips and listboxes render in the browser's top layer, so they are never clipped and stay usable inside open dialogs.

## What you still own

- **Name icon-only buttons.** Give them `aria-label`, or a `tooltip` (which then also names them): `<Button icon="trash" tooltip="Delete" />`.
- **Label every field.** Use `label`, or `aria-label` when a visible label really doesn't fit the design.
- **Write alt text.** `<nx-avatar alt="Ada Lovelace">` names the person; decorative images need `alt=""`.
- **Keep your own colours within the tokens.** Custom CSS that hard-codes colours won't adapt to dark mode or to high-contrast needs.

## Keyboard

| Component | Keys |
| --- | --- |
| Pagination | every control is a native button (**Tab**, **Enter**, **Space**); the current page has `aria-current="page"` and keeps focus when the buttons are redrawn |
| Splitter | each divider is a focusable `separator` with `aria-valuenow`/`min`/`max`/`controls`: **←** **→** (vertical: **↑** **↓**) move it 2%, **Shift** 10%; **Home** **End** collapse or grow the pane before it; **Enter** collapses or restores it |
| Tag input | **Enter** or a separator adds the typed text, **Backspace** in the empty box removes the last tag, chips have × buttons; additions, removals and refusals are announced (`role="status"`) |
| File upload | the drop zone is a real file input: **Tab** to it, **Enter** or **Space** opens the picker; each file has a **Remove** button, and refused files are announced (`role="status"`) |
| Chart | the plot is hidden from assistive technology and replaced by a real data table (caption, row and column headers) inside a `role="img"` figure with the chart's `label`; colour is never the only cue (legend, marker shapes); marks have text tooltips |
| One-time code | one text box per character, each named "Character 2 of 6", in a labelled group; the first asks for `one-time-code` autofill; **Backspace** in an empty box steps back, **←** **→** (reading direction) **Home** **End** move, a paste or autofill fills every box; it posts as one value (a single text box before JavaScript) |
| Rating | native radio buttons: **Tab** to the group, **←** **→** **↑** **↓** move and choose; each star is named "3 of 5"; the chosen value is also available as text (`role="status"`); `readonly` is a single image named with the value |
| Calendar | an ARIA grid: **←** **→** a day (follows the reading direction), **↑** **↓** a week, **Home** **End** the start and end of the week, **Page Up/Down** a month (**Shift** a year), **Enter** **Space** select; each day is named in full with its event count, so the dots are never the only cue; the selected day's events are listed below (`aria-live="polite"`) |
| Timeline | an ordered list; each time is a `<time>` element; a status is written out for screen readers ("failed"), never only colour |
| Stepper | an ordered list; each step says complete, current or needs attention in text, and the current one has `aria-current="step"`; with `clickable`, completed steps are buttons (**Tab**, **Enter**, **Space**) |
| Dialog, Drawer | **Tab** stays inside; **Escape** closes (unless `close-on-escape="false"`) |
| Menu, dropdown button | **↑ ↓** move · **Home End** first/last · **→** opens a submenu, **←** closes it · **Enter Space** choose · **Escape Tab** close · letters jump (type-ahead) |
| MenuBar | **← →** move between menus · **↓ Enter Space** open |
| Tabs | **← → ↑ ↓** select the previous/next tab · **Home End** first/last · **Delete** closes a closable tab |
| Accordion | **Enter Space** toggle · **↑ ↓** previous/next header · **Home End** first/last |
| List | a listbox, one tab stop · **↑ ↓** move (in a card layout also **← →**) · **Home End** first/last · **Enter Space** select · with `multi-select`: **Space** toggles, **Shift+↑ ↓** extends, **Ctrl/⌘+A** selects all · letters jump (type-ahead) · with `reorderable`: **Alt+↑ Alt+↓** move the item, and the new position is announced in a live region |
| Tree | **↑ ↓** move · **→** expand · **←** collapse, or go to the parent · **Home End** first/last · **Enter Space** select · letters jump (type-ahead) |
| Toolbar | **← →** move between items |
| Combobox | type to filter · **↓ ↑** open and move · **Home End** first/last · **Enter** pick · **Escape** close the list (a second Escape reaches an enclosing dialog) · **Tab** keeps a matching entry |
| Date picker | **Enter Space** on the trigger opens · **← →** day · **↑ ↓** week · **Home End** start/end of the week · **Page Up/Down** month · **Shift + Page Up/Down** year · **Enter Space** pick · **Escape** close |
| Command palette | type to filter · **↑ ↓** move · **Home End** first/last · **Enter** run · **Escape** close |
| Popover | **Enter Space** on the trigger toggles · focus moves into the panel · **Escape** or a click outside closes and returns focus |
| Tooltip | appears on keyboard focus as well as hover · **Escape** hides |
| Data grid | sortable headers are buttons (**Enter Space** sort) · selection checkboxes and paging buttons are native · resize handles are focusable separators (**←** **→**, **Shift** for bigger steps, **Enter** resets) · **Alt+←** **Alt+→** on a header moves the column · with editable columns it is an ARIA grid: **←** **→** **↑** **↓** **Home** **End** **Ctrl+Home** **Ctrl+End** **PageUp** **PageDown** move between cells, **Enter** **F2** edit, **Escape** cancels, **Tab** saves and moves on, **Space** toggles a boolean · group headers are buttons (**Enter** **Space**) with `aria-expanded`, and arrow keys skip them · a tree grid is an ARIA `treegrid`: **→** opens a node, **←** closes it or climbs to the parent |
| Select | the native `<select>` stays the control: with the browser's own list (Chromium 135+, touch screens) it is entirely native; with our themed list (other desktop browsers, or `popup="custom"`) **Enter** **Space** or **Alt+↓** open it, then **↑ ↓** **Home** **End** move, letters jump, **Enter** **Space** choose, **Escape** closes (and a second one reaches an enclosing dialog), **Tab** moves on; the list is a labelled `listbox` of `option`s with `aria-selected` and `aria-activedescendant` |
| Radio group, Slider, Checkbox, Switch | the browser's native keys (arrows, Space, Home/End, Page Up/Down) |

In a right-to-left layout (`dir="rtl"`) **←** and **→** follow the reading direction: **←** is "next" in tabs, menubars, toolbars and calendars, and opens submenus and tree nodes, while **→** goes back, closes or climbs to the parent. See [Internationalization](internationalization.md#right-to-left).

## Testing a new component

Show it on the demo's Components page (`src/main.tsx`) and it is audited automatically in every theme. If it opens something (a menu, a panel), add the open state to `src/tests/e2e/a11y.spec.ts`, as is done for the date picker and the command palette.
