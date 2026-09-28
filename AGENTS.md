# AGENTS.md

Instructions for coding agents working on Nexaro (nx.js). People should start with [README.md](README.md), [docs/](docs/README.md) and [CONTRIBUTING.md](CONTRIBUTING.md); this file adds what an agent needs to change the code safely.

## What this is

Accessible, themeable UI components as standard custom elements (`<nx-*>`, shadow DOM). They are written in JSX that creates **real DOM**: the runtime is in `src/jsx/`, and there is no React and no virtual DOM. The same components are used three ways, as JSX, as plain HTML tags (including from Twig, Blade and Jinja templates), and as `{ xtype }` config objects. They also render on the server (`nx.js/ssr`) and upgrade in the browser.

The default branch is `LIVE`.

## Commands

| Command | Run it |
| --- | --- |
| `pnpm install` | once |
| `pnpm check` | **before every commit**: `tsc --noEmit` plus the Vitest unit tests |
| `pnpm test:e2e` | after **any UI change**: Playwright in Chromium, with the demo, server-rendered pages, native forms, and an axe WCAG 2.1 AA audit that must stay at **zero violations**. If Chromium lives somewhere non-standard, set `PLAYWRIGHT_CHROMIUM_PATH` |
| `pnpm docs:reference` | after changing a component's attributes or JSDoc; regenerates `docs/components.md` (a unit test fails when it is stale) |
| `pnpm build` | library into `dist/`: ESM, CJS, UMD, `.d.ts`, `nx.css`, editor data |
| `pnpm dev` | the demo app (`src/main.tsx`) at http://localhost:5173 |
| `pnpm example:ssg`, `example:server`, `example:showcase` | the examples in `examples/` |
| `pnpm site` | the GitHub Pages site into `site-dist/` (showcase, docs as HTML, demo). CI deploys it on every push to `LIVE` |

## Map

| Path | What |
| --- | --- |
| `src/index.ts` | public entry: every export, and the element definitions |
| `src/app.ts` | the `NX` facade (`NX.app`, `NX.toast`, `NX.command`, `NX.theme`…), application shell, router outlet |
| `src/jsx/` | JSX runtime (`jsx-runtime.ts`), the PascalCase wrappers (`components.tsx`), `hydrate.ts` |
| `src/components/abstracts/base.ts` | `BaseComponent`: config path, props, state, render loop, hydration hooks |
| `src/components/ui/` | components; `badge.tsx` is the template for new ones |
| `src/components/ui/form/` | fields; `field.tsx` (`NXField`) is the base of every form control |
| `src/core/` | registry and `define()`, theme, icons, router, `position.ts` (floating UI), `dom-utils.ts` |
| `src/layout/`, `src/data/` | container, panel, viewport; store, grid |
| `src/ssr/` | server rendering: DOM setup, serializer, `renderToString`/`renderHTML`, proxy, `nx-ssr` CLI |
| `src/main.tsx` | the demo app, and the template for app code |
| `src/tests/unit`, `src/tests/e2e` | Vitest (jsdom; `// @vitest-environment node` for SSR) and Playwright |
| `scripts/custom-elements.ts` | generates the Custom Elements Manifest, VS Code data and `docs/components.md` |
| `examples/` | `ssg`, `server` (template engines), `showcase` |
| `docs/` | user guides; `components.md` is generated, so don't edit it by hand |

## Rules that aren't obvious

Each of these has broken something before. The tests named catch most of them.

1. **One config path.** JSX props, HTML attributes and `{ xtype }` configs all go through `BaseComponent.configure()`. Never add behaviour that only JSX or only configs can reach.
2. **Some modules must stay DOM-free at load.** `src/jsx/jsx-runtime.ts` and `src/core/dom-utils.ts` are imported first in every `.tsx` file (the automatic JSX import is hoisted), including on the server before the DOM exists. Don't import `base.ts` or touch `document`, `window` or `HTMLElement` at module level in them. Components touch the DOM only in lifecycle methods.
3. **Design tokens only.** Component CSS uses `var(--color-*)`, `--radius-*` and `--shadow-*`, never literal colours. Status-coloured **text** uses `--color-*-text` for contrast.
4. **State that matters lives in the DOM** (`<nx-tab active>`, `<nx-accordion-item expanded>`, `value` attributes, `<option>` children), so server HTML carries it. Parsers can upgrade an element before its children exist, so derive from children and follow later changes with a `MutationObserver` (see `select.tsx`, `radio.tsx`).
5. **Never rebuild server-rendered light DOM on connect.** `hydrate()` keeps every server element and only attaches listeners, refs and function props (`liveConfig()`). Check what is already there before creating children (see `nx-divider`, `nx-tooltip`), and mark children a component creates itself with `data-nx-generated`. `ssr.spec.ts` fails if any server element is replaced or moves by a pixel.
6. **Form controls extend `NXField`.** It keeps `ElementInternals` value and validity in sync, and it writes native stand-ins into server HTML so forms post without JavaScript (`nativeStandIns()`; `hydrateState()` removes them). Override `nativeStandIns()` when the control isn't a native input, as `combobox.tsx` and `datepicker.tsx` do.
7. **Floating UI goes in the top layer.** Use `showTopLayer()` and `place()` from `src/core/position.ts`. Scroll lists with `keepInView()`, never `scrollIntoView()`, which scrolls the whole page.
8. **Escape user data.** JSX text is safe; `innerHTML`, `html={…}` and template strings are not. Build nodes with `textContent`, or use `escapeHTML()`.
9. **Server DOM quirks.** The server runs on happy-dom. It needs `:scope` support (v17 or later), and an `<option>`'s `selected` set before insertion isn't kept, so sync selection after render (`syncSelection()` in `select.tsx`).
10. **Keyboard and ARIA claims must be true.** If docs or JSDoc say a key works, it must be implemented and tested. `docs/accessibility.md` lists every component's keys.
11. **Docs come from the code.** A class's JSDoc (first paragraph, plus ``Events: `a`, `b` ``) and its `<Name>Config` prop docs feed `docs/components.md` and editor autocompletion. Keep them accurate, then run `pnpm docs:reference`.

## Adding or changing a component

Follow [CONTRIBUTING.md](CONTRIBUTING.md#adding-a-component). In short: copy `badge.tsx`; register it in `src/components/index.ts` and `src/index.ts`; add the JSX wrapper and tag types in `src/jsx/components.tsx`; write unit tests; show it in `src/main.tsx` (the a11y audit covers it there) and in `examples/ssg/pages.tsx` (the hydration audit covers it there); document it; run `pnpm docs:reference`, `pnpm check` and `pnpm test:e2e`.

## Verifying UI work

- Tests first: `pnpm check`, then `pnpm test:e2e`.
- To look at a change, run `pnpm dev` and drive Chromium with Playwright. Slotted light-DOM content is not a DOM descendant of the shadow element it appears in (a dialog, a popover panel), so in Playwright locate it from the page or from the host element, not from the panel's role.
- `pnpm test:e2e` starts both web servers it needs (the demo on 5173, `examples/server` on 5174).

## Style

Match the surrounding code: comment density, naming, and the house style in [CONTRIBUTING.md](CONTRIBUTING.md#house-style). App code looks like `src/main.tsx`. Keep changes minimal and focused; don't reformat unrelated code.
