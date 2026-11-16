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
