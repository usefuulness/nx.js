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
| Dialog, Drawer | **Tab** stays inside; **Escape** closes (unless `close-on-escape="false"`) |
| Menu, dropdown button | **↑ ↓** move · **Home End** first/last · **→** opens a submenu, **←** closes it · **Enter Space** choose · **Escape Tab** close · letters jump (type-ahead) |
| MenuBar | **← →** move between menus · **↓ Enter Space** open |
| Tabs | **← → ↑ ↓** select the previous/next tab · **Home End** first/last · **Delete** closes a closable tab |
| Accordion | **Enter Space** toggle · **↑ ↓** previous/next header · **Home End** first/last |
| Tree | **↑ ↓** move · **→** expand · **←** collapse, or go to the parent · **Home End** first/last · **Enter Space** select · letters jump (type-ahead) |
| Toolbar | **← →** move between items |
| Combobox | type to filter · **↓ ↑** open and move · **Home End** first/last · **Enter** pick · **Escape** close the list (a second Escape reaches an enclosing dialog) · **Tab** keeps a matching entry |
| Date picker | **Enter Space** on the trigger opens · **← →** day · **↑ ↓** week · **Home End** start/end of the week · **Page Up/Down** month · **Shift + Page Up/Down** year · **Enter Space** pick · **Escape** close |
| Command palette | type to filter · **↑ ↓** move · **Home End** first/last · **Enter** run · **Escape** close |
| Popover | **Enter Space** on the trigger toggles · focus moves into the panel · **Escape** or a click outside closes and returns focus |
| Tooltip | appears on keyboard focus as well as hover · **Escape** hides |
| Data grid | sortable headers are buttons (**Enter Space** sort) · selection checkboxes and paging buttons are native |
| Radio group, Slider, Checkbox, Switch, Select | the browser's native keys (arrows, Space, Home/End, Page Up/Down) |

## Testing a new component

Show it on the demo's Components page (`src/main.tsx`) and it is audited automatically in every theme. If it opens something (a menu, a panel), add the open state to `src/tests/e2e/a11y.spec.ts`, as is done for the date picker and the command palette.
