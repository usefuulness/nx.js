# Changelog

All notable changes to nx.js. The format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [semver](https://semver.org/) once the package is published (first published as 0.2.0).

## 0.9.0 - 2026-11-19

### Added
- **OpenAPI client:** `NX.openapi(document | url, config)` reads an OpenAPI 3 or Swagger 2 document (JSON): every operation becomes a function (`api.operations.listPets(params, body)`), and every collection with its item path becomes a resource, with a model (types, defaults, `nullable`, required fields, length, range, pattern, enum and format validators from the schema; `readOnly` fields never sent back) and the list parameters worked out (`limit`/`offset`, `page`/`per_page`, `sort` with a direction, `q`). `$ref`, `allOf` and `oneOf` are followed.
- **HAL client:** `NX.hal(entry, config)` finds its stores by following links: `resources()`, `store(rel)`, `register()`, `follow()`; stores fill in templated links (`page`, `size`, `sort`, `q`), read `_embedded` records and totals, take ids from `self` links, and save through each record's own links. `expandTemplate()` fills RFC 6570 URI templates.
- `registerProxyType()` lets a store name a custom kind of proxy; `ApiResource.mapParams` overrides the parameter mapping per resource.

## 0.8.0 - 2026-11-19

### Added
- **API client:** `NX.api({ baseUrl, auth, resources })`: requests with a base URL, headers, a bearer token, a time limit, one new token on 401 (`auth.refresh`), repeats for reads and dropped connections, and `onRequest`/`onResponse`/`onError`; `client(name)` for plain CRUD calls; `model(name)` and `store(name)` for resources, so a store loads, sorts, filters, pages and saves through the client; `register()` names every store so `<nx-grid store="users">` just works; `params` renames the query parameters for any server.
- **View model and components:** `bind-store` hands a view model's store to a grid; `bind-selection`, `bind-selected` and `bind-event-<name>` publish a grid's selection or any event's detail into the data, so other bindings follow.
- **Store grouping:** `groupField` / `group(field, direction)`: groups stay together (the group field sorts first), `getGroups()` uses it, `groupchange` event.

### Fixed
- A grid bound to a store whose server sorts or filters (`remoteSort`, `remoteFilter`) now asks the store when you sort a column or search, and shows the rows in the order the server sent them, instead of sorting and filtering them again itself (it only did this for buffered stores).
- The SSG accessibility audit waits for fonts and transitions before measuring.

## 0.7.0 - 2026-11-19

### Added
- **Tree store:** `NX.treeStore()`: nodes with parents and children, expand/collapse/reveal, filtering that keeps the way down to each match without opening anything for good, sorting per level, append/move/remove (a node cannot move into itself), children loaded when a `leaf: false` node is first opened, and `toItems()` for `<nx-tree>`.
- **Associations:** models take `associations` (`hasMany`, `belongsTo`): `user.orders()` is a store (from nested data, or loaded with the owner's id), new records get the foreign key; `order.getUser()`, `loadAssoc()`, `setAssoc()`.
- **Sessions:** `NX.session()`: the same record is the same object, tracked creates, edits and deletions, `save()` in order with per-record errors, `reject()`, `commit()`.
- **Events:** the data layer's `on()` and `once()` return a function that stops listening; a handler that throws no longer stops the others, and a handler that removes itself no longer skips its neighbour.

## 0.6.0 - 2026-11-19

### Added (logic layer)
- **Models:** `NX.model()` / `defineModel()`: typed fields with defaults, conversion, mapping and `persist`; validators (`presence`, `length`, `range`, `format`, `email`, `url`, `inclusion`, `exclusion`, functions) with translated messages; change tracking (`set`, `dirty`, `modified`, `commit`, `reject`, `copy`); `load()`, `save()`, `erase()` through a proxy. A store takes `model` to convert and validate what it holds.
- **View models:** `NX.viewModel()`: reactive data with formulas (dependencies found automatically), batched bindings, parent/child models, on-demand stores; `bindElement()` and `bindAll()` bind `bind-value` (two-way), `bind-text`, `bind-hidden`, `bind-disabled`, `bind-class-x`, `bind-attr-x` attributes.
- **Controllers:** `NX.controller()`: delegated, selector-based event handling that sees through shadow roots, `reference` lookup, an owned or shared view model.
- **`NX.ajax()`:** JSON requests that fail on bad statuses (`AjaxError`), time out and abort.
- **`NX.state`:** remembered JSON state in browser storage that never throws and falls back to memory. The grid and splitter use it.
- **`NX.format`, `NX.task`, `NX.utils.throttle`:** number, currency, percent, file size, date, relative time, duration, plural and text formatting that follows the page's language; repeating tasks that never overlap; a real `debounce` and `throttle` with `cancel` and `flush`.
- **Store:** `first`, `last`, `indexOf`, `insert`, `removeAt`, `sum`, `average`, `min`, `max`, `getGroups`, `getFilters`, `getSorters`, `validate`; `filterchange` and `sortchange` events.

### Fixed (data layer)
- `Store.filter()` did nothing for local stores; it now filters (all operators, `*` for any field). Filtered-out records stay in the store, so they still count as changes and are synced.
- A sorter without a direction sorted descending; it is now ascending, with empty values last.
- Editing a field whose original value was falsy (`0`, `''`) twice lost the original, so `rejectChanges()` restored the wrong value.
- Proxies: a bad HTTP status was treated as data (now an `AjaxError`); `rest` now sends one request per record with the id in the URL and `DELETE` no longer sends a body; the memory and localStorage proxies now really update and destroy.

### Added
- **Select, everywhere:** browsers that cannot theme the native dropdown (Firefox, Safari) now open a themed list on desktop: same look as the Chromium one, a labelled `listbox` with arrow keys, Home/End, type-ahead, Escape, and the top layer so nothing clips it. The native `<select>` remains the control (value, validity, forms, server HTML). Touch screens keep the native picker. New `popup` attribute (`auto`, `custom`, `native`).

### Added (tooling)
- **`create-nx.js`:** `npm create nx.js` scaffolds a project: an `app` template (Vite + TypeScript + JSX, ready to run) or an `html` template (one file, a `<script>` tag). It lives in `packages/create-nx` and is published separately.

## 0.5.0 - 2026-11-18

### Added
- **One-time code:** `<nx-otp-input>`: a box per character (2 to 12) that advances as you type, steps back on Backspace, and takes a pasted or autofilled code; `numeric` or `text`, `complete` event, posts as one value and as one text box before JavaScript.
- **Segmented control:** `<nx-radio-group variant="segmented">` joins the options into one compact switch row (still native radios: keys, posting and `required` as before).

## 0.4.0 - 2026-11-17

### Added
- **Calendar:** `<nx-calendar>`: an always-visible month with `events` (dots on the grid, the selected day's list below), `min`/`max`, `first-day`, an ARIA grid keyboard model, `select` and `month-change` events, `showMonth()`. The date helpers the date picker used now live in `src/core/dates.ts`.

## 0.3.0 - 2026-11-17

### Added
- **Timeline:** `<nx-timeline>` / `<nx-timeline-item>`: an ordered list of events with a formatted `<time>`, a status written out for screen readers, optional icons and `reverse`.
- **Rating:** `<nx-rating>` star rating form control (native radios underneath: keys, posting and `required` as in HTML), `max` up to 10, `readonly` display with half stars.
- **Chart:** `<nx-chart>`: bar, line, area and donut charts in SVG, themed (light and dark), with the data as a hidden table for screen readers, a legend, per-series marker shapes, locale-formatted numbers; bad data shows an empty state, and a chart is capped at 500 points.
- **Stepper:** `<nx-stepper>` / `<nx-step>` shows progress through a sequence (horizontal or vertical), with an error state and optional click-to-go-back; `current` lives in the markup so server HTML carries it.
- **Chat:** `<nx-chat>` for AI interfaces: streaming replies (`respond()`), Stop, safe Markdown (`renderMarkdown()`: HTML shown as text, images never loaded, only http/https/mailto links), a message box (Enter sends, IME-safe), copy and regenerate, scroll-following that yields to the reader, announcements for screen readers; `readText()` and `readSSE()` for streamed responses.

### Changed
- `Select` (single): in browsers with customizable selects (Chromium 135+) the dropdown is styled with the theme, lines up with the field, and left-aligns its options with a checkmark, instead of showing the operating system's list. Other browsers keep the native popup.

## 0.2.0 - 2026-11-17

First release. Everything below is new since the first commit.

### Added
- **Grid:** row virtualization (`virtual`, `rowHeight`, `height`); resizable, reorderable and left-pinned columns with state saved under `stateKey`; cell editing (`editable`, `editor`, `options`, `validate`, `cell-change`) with the ARIA grid keyboard model.
- **Router:** route `loader` functions with `staleTime`, `errorView`, `prefetch()`, `invalidate()`, `reload()`; `resolve()` and `routeDataScript()` for loading on the server without fetching twice in the browser; scroll restoration and `route.history`; history-mode link handling with hover prefetch; `viewTransitions`; `Router.stop()`.
- **Internationalization:** built-in strings come from a catalogue (`NX.i18n`) read from the nearest `lang`, with opt-in `nx.js/locales/{es,fr,de,ar}` (unreviewed by native speakers), plurals, locale-formatted numbers, live redraw on `lang`/`dir` changes, grid and date formatting in the page language, and `lang` for server rendering.
- **Splitter:** `<nx-splitter>`: resizable panes (horizontal, vertical, nested) with accessible dividers, keyboard resize/collapse, minimum sizes, remembered sizes, and padding-safe sizing.
- **Tag input:** `<nx-tag-input>`: chips added by Enter or a separator, paste to split, Backspace to remove, `max`/`min`/duplicate/per-tag validation, announced changes, suggestions, tags post as separate entries (comma separated before JavaScript).
- **File upload:** `<nx-file-upload>`: drop zone and file list over a real file input, `accept`/`max-size`/`max-files` rules with announced rejections, removal, native stand-in, multipart through `nx-form enhance`.
- **Pagination:** `<nx-pagination>` with a stable-width page window, previous/next, `compact`, a range label, a page-size selector, and `page-change`/`page-size-change`.
- **Right to left:** components use logical CSS properties and mirror under `dir="rtl"` (side regions, pinned columns, chevrons, the switch thumb); Left/Right keys follow the reading direction in tabs, menus, menubars, toolbars, the tree, the tree grid and the calendar; `place()` aligns `start`/`end` by direction; drawer `position` and toast placement accept `start`/`end`; `DIRECTION_CSS`, `MIRROR_CSS`, `inlineStep`, `isRtl` helpers. Audited by axe on every demo page in Arabic.
- **Grid tree rows:** `tree` shows rows with `children` as an ARIA treegrid (expander, Right/Left keys, sort within levels, search keeps ancestors), with `expandNode()`/`collapseNode()` and `node-toggle`.
- **Grid grouping:** `groupBy`, `groupCollapsed`, column `summary` totals under each group and in a footer, `toggleGroup()`/`expandAll()`/`collapseAll()`/`setGroupBy()`, `group-toggle`.
- **Grid export:** `exportXLSX()`/`toXLSX()` write a dependency-free `.xlsx` (typed cells, frozen bold header, filter, widths); `toCSV()`, `toTSV()`; Ctrl/Cmd+C copies selected rows or the focused cell as TSV and HTML.
- **Data:** `buffered` stores page rows in as a virtual grid scrolls (LRU page cache, shared and stale-proof requests, server sort and search, skeleton rows).
- **Forms:** `<nx-form enhance>` posts with `fetch`, shows server validation errors on the named fields, and follows redirects; `success`/`error` events, `isSubmitting()`, `abort()`.
- **Per-component imports:** `nx.js/components/<name>` (34 entries, with types) loads one component and the runtime it needs: `badge` is 13.6 kB gzipped, `form` 17.4 kB, `grid` 28.0 kB, against about 70 kB for everything.
- `llms.txt` and `llms-full.txt` (and the docs as plain Markdown) are published with the site, built from `docs/*.md` so they cannot drift.
- `pnpm bench` measures grid render and scroll times from 1,000 to 1,000,000 rows and writes `docs/performance.md`.
- `pnpm size`: a bundle-size budget checked in CI, including each entry's real cost.

### Changed
- CI runs the browser tests (`pnpm test:e2e`, including the axe audit), the library build and the size budget before deploying.
- Route params are URL-decoded.

### Security
- Grid CSV export and copied text no longer let a cell starting with `=`, `+`, `-` or `@` run as a spreadsheet formula (CSV injection).

### Fixed
- A record with `id: 0` had its id replaced by a generated one.
- `RestProxy` threw for relative URLs such as `/api/users`.
- A field's `error-text` never marked the control `aria-invalid`; it does now, and the flag clears with the text.
- A slow navigation could commit after a newer one; the newest navigation now always wins.
- History mode dropped the query string and hash; `/a?x=1#top` was parsed as `x="1#top"` with no hash.
- New pages opened at the previous page's scroll offset.
