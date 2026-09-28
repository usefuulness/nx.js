# Server rendering

Nexaro renders to HTML on the server with [Declarative Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement/shadowRootMode). Pages arrive complete: styled, themed, and with working forms before any JavaScript runs. When `nx.js` loads, the elements upgrade in place, with nothing re-created and no flash.

Server rendering runs the real components on [happy-dom](https://github.com/capricorn86/happy-dom), an optional peer dependency: `pnpm add -D happy-dom`.

## How a page is delivered

1. **Render on the server.** JSX goes through `renderToString()` or `renderDocument()`. HTML from any other template engine goes through `renderHTML()`, the `nx-ssr` proxy or the `nx-ssr` CLI.
2. **Paint before JavaScript.** Components arrive as `<template shadowrootmode>` markup and render immediately. Fields carry native stand-ins, so forms can be filled in and posted ([Forms](forms.md#before-javascript-loads)).
3. **Upgrade and hydrate.** Loading `nx.js` upgrades the elements. Rich config comes back from a `<script type="application/json" data-nx-config>` child, and `hydrate()` attaches event handlers from the same JSX.

## JSX pages: SSG and Node SSR

```tsx
// build.tsx or server.tsx
import { renderDocument, renderToString } from 'nx.js/ssr';   // first: it installs the server DOM
import { Page } from './page';                                 // then anything that uses components

const html = await renderDocument(<Page />, {
  title: 'Home',
  scripts: ['/client.js'],              // your bundle, which calls hydrate()
  bodyAttributes: { 'data-page': 'home' }
});
const fragment = await renderToString(<Card title="Hi">…</Card>);   // or just a fragment
```

```tsx
// client.tsx
import { hydrate } from 'nx.js';
import { Page } from './page';

hydrate(() => <Page />);                // or hydrate(() => <Page />, document.getElementById('app')!)
```

`nx.js/ssr` must be imported before any module that uses components, because components extend `HTMLElement` when their module loads. If import order is awkward in your setup, run Node with `--import nx.js/ssr/register` instead. Getting it wrong raises an error that says so.

### What survives into the HTML

| Kind of prop | On the server | In the browser |
| --- | --- | --- |
| Strings, numbers, booleans | attributes | read directly |
| Arrays and plain objects (`data`, `columns`, `items`, `options`) | JSON in a `data-nx-config` script | applied on upgrade |
| Functions (`onClick`, `onSubmit`, `formatter`, `handler` in items), refs | left out, with a warning naming them | attached by `hydrate()` |

`hydrate()` walks the client JSX next to the server DOM. The server elements are kept and only receive listeners, refs and function props, so anything typed so far survives. If the JSX doesn't match the HTML, only the subtree that differs is re-rendered, with a warning naming it. `renderToString(…, { onDropped })` replaces the warning about left-out functions, for example to silence it when `hydrate()` handles them.

See [`examples/ssg`](../examples/ssg) (`pnpm example:ssg`) and [`examples/showcase`](../examples/showcase) (`pnpm example:showcase`).

## Template engines: Twig, Blade, Jinja, ERB, Go, Handlebars…

Templates write the tags. Attributes take strings; rich values are JSON in an attribute or in a config script:

```twig
<nx-grid title="Users" search columns="{{ columns|json_encode }}">
  <script type="application/json" data-nx-config>{"data": {{ users|json_encode|raw }}}</script>
</nx-grid>

<form method="post" action="/users">
  <nx-input name="email" type="email" label="Email" value="{{ old.email }}" error-text="{{ errors.email }}" required></nx-input>
  <nx-select name="role" label="Role" value="Editor"><option>Admin</option><option>Editor</option></nx-select>
  <nx-button type="submit">Invite</nx-button>
</form>
```

Escape JSON the way your engine does for a script body: Twig's `json_encode` escapes `/`, Blade's `@json` uses `JSON_HEX_TAG`, and Jinja's `tojson` escapes `<`, `>` and `&`. Complete Twig, Blade and Jinja versions of one page are in [`examples/server/templates`](../examples/server/templates).

This works with **no Node at all**: link `nx.css` and your client bundle, and the elements render once `nx.js` loads. To also get the fully rendered first paint, pre-render the HTML:

| Setup | How |
| --- | --- |
| A backend in any language | `nx-ssr --proxy http://127.0.0.1:8000 --port 3000`: a reverse proxy in front of your app. It renders every `text/html` response, in the visitor's theme (from the `nx-theme` cookie), and passes everything else (assets, JSON, form posts, redirects) through unchanged. |
| A Node backend | `res.send(await renderHTML(html, { theme: themeFromCookie(req) }))`; see [`examples/server`](../examples/server) (`pnpm example:server`). |
| Static output from any generator | `nx-ssr public/**/*.html` renders the files in place; `nx-ssr < in.html > out.html` pipes. |

`renderHTML()` accepts a fragment or a whole document. For whole documents it also injects the stylesheet and a small theme bootstrap into `<head>`, unless you pass `injectStyles: false` and link `nx.css` yourself.

### The `nx-ssr` CLI

```text
nx-ssr --proxy <upstream> [--port 3000] [--host 127.0.0.1]   render a running app's HTML
nx-ssr <file.html>... [--out-dir <dir>]                       render files in place (or into a directory)
nx-ssr < in.html > out.html                                   stdin to stdout
nx-ssr --css > nx.css                                         print the stylesheet

--theme <name>    render in this theme (<html data-theme>)
--no-styles       don't inject <style id="nx-styles"> into whole documents
```

If rendering fails, the proxy serves the original HTML: the page still works, it just upgrades in the browser.

## Themes without a flash

`NX.theme.set()` also writes an `nx-theme` cookie, so a server can render `<html data-theme="…">`: the proxy and `themeFromCookie()` do this for you. Static pages get `themeScript()`, a tiny inline script that `renderDocument` and `renderHTML` add automatically; it applies a saved theme before first paint. `nx.css` (or `stylesheet()`) contains every theme plus the operating system's light/dark fallback, and hides elements that are waiting to upgrade, except server-rendered ones.

## API

| Export (`nx.js/ssr`) | Does |
| --- | --- |
| `renderToString(node \| config \| array \| fn, { onDropped })` | Render JSX or configs to an HTML fragment |
| `renderDocument(node, { title, lang, theme, head, scripts, bodyAttributes, inlineStyles })` | A complete page: body, stylesheet, theme bootstrap, scripts |
| `renderHTML(html, { theme, injectStyles, onDropped })` | Pre-render the `<nx-*>` tags in a fragment or document from any template engine |
| `stylesheet({ hideUndefined })` | The full stylesheet (the same as `nx.css`) |
| `themeScript()` | The inline theme bootstrap script |
| `createProxy({ upstream, theme })`, `proxyHandler(…)` | The reverse proxy, as a server or as a handler for any Node framework |
| `themeFromCookie(request)` | The visitor's theme from the `nx-theme` cookie |
| `settle()` | Wait for pending renders (for custom pipelines) |

In the browser, `hydrate(view, container?, { onMismatch })` comes from `nx.js`.

## Limits

- **Content Security Policy:** whole-document rendering injects an inline `<style>` and `<script>`. With a strict CSP, pass `injectStyles: false`, serve `nx.css` as a file, and allow the theme script by hash or leave it out.
- **Functions don't travel.** Anything that is a function is attached in the browser by `hydrate()`; template-engine pages without JSX attach behaviour with `addEventListener`.
- **Browser support:** Declarative Shadow DOM is supported by all current engines. Browsers without it still render the components once `nx.js` loads.
