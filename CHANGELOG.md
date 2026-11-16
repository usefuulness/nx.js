# Changelog

All notable changes to Nexaro (nx.js). The format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [semver](https://semver.org/) once the package is published (it is still `private` at 0.1.0).

## Unreleased

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
