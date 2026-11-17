# Internationalization

Every string a component shows on its own (labels such as "Close", "Search…", "Page 1 of 3", error messages, dialog buttons) comes from a message catalogue, and numbers, currencies and dates are formatted for the page's language. English is built in; other languages are small opt-in modules.

## Pick a language

Components read their language from the DOM, the way HTML does: the nearest `lang` attribute above them, then the browser's language.

```html
<html lang="es">  <!-- the whole page -->
<div lang="de"><nx-grid …></nx-grid></div>  <!-- one part of it -->
```

```ts
import 'nx.js/locales/es';              // adds the Spanish strings (about 1 kB)
NX.i18n.setLanguage('es');              // sets <html lang> and dir, and every component redraws
```

Changing `lang` or `dir` on a live page redraws the components it affects. Because the language lives in the DOM, one page can mix languages, and nothing is shared between server requests.

Shipped: `es`, `fr`, `de`, `ar` (`nx.js/locales/<code>`). **These translations were written without native review, so have a native speaker check them before you rely on them**; corrections are welcome. A region falls back to its language (`es-MX` → `es`), and anything not translated falls back to English.

## Add or change strings

```ts
NX.i18n.extend('pt-br', {
  close: 'Fechar',
  'grid.search': 'Pesquisar…',
  'grid.rows': { one: '{count} linha', other: '{count} linhas' }   // plural forms
});
NX.i18n.extend('es', { 'grid.empty': 'Nada que mostrar' });        // override one string
```

- Keys are listed in [`src/core/messages.en.ts`](../src/core/messages.en.ts), which is the catalogue every other language falls back to.
- `{name}` is replaced by a parameter. **Numbers are formatted for the language** (`1,000` · `1.000` · `١٬٠٠٠`); pass a string to use it as given.
- A message can be an object with one string per plural category (`zero`, `one`, `two`, `few`, `many`, `other`) chosen from `{count}` by the language's own rules.
- `NX.i18n.t('close', undefined, 'es')` looks a string up yourself; `NX.i18n.direction('ar')` gives `rtl`.
- The `alert()`, `confirm()` and `prompt()` helpers use the page's language, since they have no element to read it from.

## Numbers and dates

The data grid formats `number`, `currency`, `percent` and `date` columns, and the date picker its calendar, in the language around them. A column's `currency` stays whatever you set; only the formatting changes. The date picker's own `locale` attribute still wins when you set it.

## Server rendering

Pass the language per render. It is applied to that render only, so concurrent requests in different languages don't interfere:

```tsx
import { renderDocument } from 'nx.js/ssr';
import 'nx.js/locales/es';

const html = await renderDocument(<Page />, { lang: 'es' });   // <html lang="es"> and the Spanish strings
```

`renderToString(…, { lang })` and `renderHTML(…, { lang })` take the same option; `renderHTML` of a full document uses its own `<html lang>`. For right-to-left languages `renderDocument` also writes `dir="rtl"`. Hydration keeps the server's text, and the browser's `lang` takes over from there.

## Right to left

Set `dir="rtl"` (with the language) and the whole interface mirrors: `NX.i18n.setLanguage('ar')` does both. `renderDocument` writes `dir="rtl"` for right-to-left languages.

- **Layout:** component styles use logical properties (`margin-inline-start`, `inset-inline-end`, `text-align: start`…), so padding, borders, icons and positions follow the reading direction. In an app shell the `west` region sits at the start (the right in RTL) and `east` at the end; their borders, resize handles and off-canvas drawers follow.
- **Tables:** columns run right to left; pinned columns stick to the start edge; numeric columns align to the end.
- **Keys:** Left and Right follow the reading direction. In RTL, Left moves to the *next* tab, menubar item, toolbar button or calendar day, opens a submenu or tree node, and opens a tree-grid node; Right goes back, closes, or climbs to the parent. Up, Down, Home, End and the others are unchanged.
- **Floating UI:** menus, popovers and listboxes line up with the `start` or `end` edge of what they open from, so a `bottom-start` menu hangs from the right edge of its button in RTL.
- **Icons:** chevrons that point along the reading direction (next page, submenu, tree expander, breadcrumb separator) flip.
- **Fixed sides:** a few options name a physical side on purpose and do not mirror: a drawer's `position="left"`, a toast's `top-left`, tab `position`. Use `start` and `end` (`position="start"`, `top-end`) to follow the direction.
- Text direction inside your own content (an English quote in an Arabic page, say) is up to the browser's bidi rules; mark it with `dir` or `<bdi>` where the order looks wrong.

## In your own components

```ts
import { DIRECTION_CSS, MIRROR_CSS, inlineStep, isRtl } from 'nx.js';

protected styles() {
  return `
    ${DIRECTION_CSS}   /* --nx-dir: 1, or -1 in RTL, for  translateX(calc(1rem * var(--nx-dir)))  */
    ${MIRROR_CSS}      /* <span class="mirror"> flips in RTL */
    .row { padding-inline: 1rem 0.5rem; margin-inline-start: auto; text-align: start; }
  `;
}

// Arrow keys along the reading direction: +1 is next, -1 is previous
const step = inlineStep(event.key, this);   // 0 for any other key
```

Write `inline-start`/`inline-end`, never `left`/`right`, unless the option really means a physical side. Use `this.t('key')` for strings and `this.locale()` when you format numbers or dates. Test it with `lang="ar" dir="rtl"`: the repository's Playwright suite does this for every demo page.

