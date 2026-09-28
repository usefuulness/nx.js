# Contributing

## House style

Nexaro follows the shadcn approach: every component is a small, readable file you own and can copy. New UI code is written in **JSX that reads like HTML**.

- **JSX creates real DOM.** There is no virtual DOM. `<div onClick={fn}>` is a `div` with a listener, and `<Button>` is an `<nx-button>`.
- **Components are custom elements** (`<nx-*>`, shadow DOM) with a typed **PascalCase wrapper** for JSX (`Button`, `Card`, …).
- **One prop model.** JSX props, HTML attributes and `{ xtype }` configs all go through `configure()`, so a component only has to handle a prop once.
- **Design tokens only.** Use `var(--color-*)`, `--radius-*` and `--shadow-*` in component CSS, never hard-coded colors, so every theme works for free. For *text* in a status colour, use the `-text` variants (`--color-success-text`, `--color-warning-text`, `--color-error-text`, `--color-info-text`). The base colours don't reach 4.5:1 contrast on their own tints.
- **Variants, not conditionals.** Describe the look with `variants()` (a tiny cva) and join classes with `cn()`.
- **Accessible by default.** Use real `<button>`s, roles, `aria-*`, visible focus (`--color-ring`) and keyboard support. Never nest interactive elements (a button inside a `role="tab"`, for example). Make them siblings.

## Adding a component

`src/components/ui/badge.tsx` is the reference implementation. Copy it.

1. **Create `src/components/ui/<name>.tsx`:**

   ```tsx
   import { BaseComponent } from '@/components/abstracts/base';
   import { define } from '@/core/registry';
   import { variants } from '@/core/variants';

   export interface ChipConfig {
     variant?: 'default' | 'outline';
     selected?: boolean;
   }

   const chip = variants({
     base: 'chip',
     variants: { variant: { default: 'default', outline: 'outline' } },
     defaultVariants: { variant: 'default' }
   });

   export class NXChip extends BaseComponent {
     // Attributes that trigger a re-render when they change
     static get observedAttributes() { return ['variant', 'selected']; }

     constructor() {
       super();
       this.attachShadow({ mode: 'open' });
     }

     protected initializeState() {}

     protected render() {
       const selected = this.getProp('selected', false);
       return (
         <button part="chip" class={chip({ variant: this.getProp('variant') })} aria-pressed={String(selected)}
                 onClick={() => this.emit('toggle', { selected: !selected })}>
           <slot />
         </button>
       );
     }

     protected styles() {
       return `
         .chip { height: 2rem; padding: 0 .75rem; border-radius: 9999px; border: 1px solid transparent; }
         .default { background: var(--color-secondary); color: var(--color-secondary-foreground); }
         .outline { border-color: var(--color-border); }
         [aria-pressed="true"] { background: var(--color-primary); color: var(--color-primary-foreground); }
       `;
     }
   }

   define('nx-chip', NXChip);   // also registers xtype 'chip'
   ```

2. **Register it:** import the file in `src/components/index.ts` and export the class and config type from `src/index.ts`.
3. **Add the JSX wrapper** in `src/jsx/components.tsx`:

   ```tsx
   export const Chip = (props: Props<ChipConfig>) => <nx-chip {...props} />;
   // and inside `interface NexaroElements`:
   'nx-chip': Props<ChipConfig>;
   ```

4. **Test it** in `src/tests/unit/<name>.test.tsx` (Vitest + jsdom). Cover rendering, props, events and keyboard handling.
   `pnpm test:e2e` also runs an axe accessibility audit (WCAG 2.1 AA) of every demo page in every theme, including open dialogs and menus, so showing the component in the demo gets it audited too.
5. **Show it** on the demo's Components page (`src/main.tsx`), and add a row to the README's component table.
6. **Server-render it:** add it to `examples/ssg/pages.tsx` (`Components`). The e2e suite then checks that it renders without JavaScript, hydrates without moving a pixel, and still works.
7. **Document it for HTML authors:** the class's JSDoc (first paragraph, plus ``Events: `a`, `b` ``) and the `<Name>Config` interface's prop docs become editor autocompletion (`scripts/custom-elements.ts`). Elements without `observedAttributes` list theirs as `@attr name - description`.

## Component rules of thumb

- **Props:** read them with `this.getProp('kebab-name', default)`. It checks attributes first, then values set via `configure()`. List attributes that should re-render in `observedAttributes`.
- **Rich props** (arrays, objects, functions) reach you through a `setXxx()` method if you define one (`setData`, `setColumns`), or through `getProp()` otherwise.
- **State:** `this.setState(key, value)` batches one re-render per frame. Focus and the text caret are preserved across re-renders.
- **Events:** `this.emit('kebab-name', detail)` fires a bubbling, composed `CustomEvent`. Consumers listen with `onKebabName` in JSX or configs.
- **Listeners:** put them inline in JSX (`onClick={…}`). They disappear with the old nodes on re-render. Listeners on `document`/`window` go in `afterRender()` via `this.on(...)`, which cleans them up automatically.
- **Children:** light-DOM children render through `<slot>`. Use named slots for regions (`slot="footer"`) and expose a wrapper such as `CardFooter` for them.
- **Items:** implement `applyItems(items, build)` if `items` configs should become something special (the tab panel turns them into tabs).
- **Escaping:** JSX text children are always safe. `html={…}` and string templates are not, so wrap user data in `escapeHTML()`.
- **Styling hooks:** add `part="…"` to meaningful inner elements so apps can use `::part()`.
- **Icons:** use `Icons.get(name)`. Add new icons to `src/core/icons.ts` (24px, 2px stroke).
- **Overlays:** anything that floats (menus, popovers) must render in the top layer (see `nx-menu-popup`), or `overflow: hidden` ancestors will clip it.

## Server rendering rules

Components also run on the server (`src/ssr`, happy-dom) and upgrade over their own server-rendered HTML. `src/tests/unit/ssr.test.tsx` and `src/tests/e2e/ssr.spec.ts` cover this. To keep it working:

- **No DOM access at module load.** Touch `document`/`window` in lifecycle methods only. `src/jsx/jsx-runtime.ts` and `src/core/dom-utils.ts` must stay DOM-free, because the JSX runtime import is hoisted above everything else in a `.tsx` file.
- **State that matters lives in the DOM.** Examples are `<nx-tab active>`, `<nx-accordion-item expanded>`, a field's `value` attribute and `<option>` children. Derive from children, and follow later changes with a `MutationObserver`, since parsers can upgrade an element before its children arrive.
- **Rich config must be JSON.** Values set through `configure()` are serialized for hydration automatically. Keep functions optional, and offer an event for the same behaviour (`row-click` next to `onRowClick`).
- **Forms stay native.** Fields keep their `ElementInternals` value and validity in sync, so a plain `<form>` posts and validates them without JS handlers.
- **Forms work before JS.** A field's shadow controls are written into the light DOM as native stand-ins when server-rendered (`nativeStandIns()` on `NXField`; override it when the control isn't a native input, as the combobox and date picker do). `hydrateState()` reads and removes them on upgrade. `src/tests/e2e/ssr.spec.ts` posts forms with JavaScript disabled.

## App code

Write app code like `src/main.tsx`: pages are plain function components, and data comes from stores (`NX.store`), refs (`ref={{ current: null }}`) and the promise-based helpers (`NX.confirm`, `NX.dialog`, `NX.toast`).

## Commands

```bash
pnpm dev          # demo with HMR
pnpm check        # typecheck + unit tests (run before every commit)
pnpm test:e2e     # Playwright: demo, a11y, SSR/hydration, native forms
pnpm build        # library → dist/
```
