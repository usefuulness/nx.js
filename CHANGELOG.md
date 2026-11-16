# Changelog

All notable changes to Nexaro (nx.js). The format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [semver](https://semver.org/) once the package is published (it is still `private` at 0.1.0).

## Unreleased

### Added
- **Grid:** row virtualization (`virtual`, `rowHeight`, `height`); resizable, reorderable and left-pinned columns with state saved under `stateKey`; cell editing (`editable`, `editor`, `options`, `validate`, `cell-change`) with the ARIA grid keyboard model.
- **Router:** route `loader` functions with `staleTime`, `errorView`, `prefetch()`, `invalidate()`, `reload()`; `resolve()` and `routeDataScript()` for loading on the server without fetching twice in the browser; scroll restoration and `route.history`; history-mode link handling with hover prefetch; `viewTransitions`; `Router.stop()`.
- **Data:** `buffered` stores page rows in as a virtual grid scrolls (LRU page cache, shared and stale-proof requests, server sort and search, skeleton rows).
- **Forms:** `<nx-form enhance>` posts with `fetch`, shows server validation errors on the named fields, and follows redirects; `success`/`error` events, `isSubmitting()`, `abort()`.
- **Per-component imports:** `nx.js/components/<name>` (34 entries, with types) loads one component and the runtime it needs: `badge` is 13.6 kB gzipped, `form` 17.4 kB, `grid` 28.0 kB, against about 70 kB for everything.
- `pnpm size`: a bundle-size budget checked in CI, including each entry's real cost.

### Changed
- CI runs the browser tests (`pnpm test:e2e`, including the axe audit), the library build and the size budget before deploying.
- Route params are URL-decoded.

### Fixed
- A record with `id: 0` had its id replaced by a generated one.
- `RestProxy` threw for relative URLs such as `/api/users`.
- A field's `error-text` never marked the control `aria-invalid`; it does now, and the flag clears with the text.
- A slow navigation could commit after a newer one; the newest navigation now always wins.
- History mode dropped the query string and hash; `/a?x=1#top` was parsed as `x="1#top"` with no hash.
- New pages opened at the previous page's scroll offset.
