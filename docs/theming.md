# Theming

Components only read CSS custom properties (design tokens). A theme is a set of token values, so switching themes, matching a brand or tweaking one value all work the same way: change the tokens.

## Built-in themes

Three themes ship built in: `light`, `dark` and `midnight`.

```ts
NX.theme.set('midnight');
NX.theme.toggle();                 // light ↔ dark
NX.theme.get();                    // 'midnight'
NX.theme.list();                   // ['light', 'dark', 'midnight', …]
NX.theme.onChange(name => …);
```

Which theme a visitor sees, in order:

1. the theme they picked before (saved in `localStorage` and in an `nx-theme` cookie);
2. a theme the server rendered (`<html data-theme="…">`);
3. the app's `theme` option (`NX.app({ theme: 'dark' })`);
4. the operating system's light or dark setting.

The cookie lets a server render the right theme with no flash; see [Server rendering](server-rendering.md#themes-without-a-flash).

## Your brand

Extend a built-in theme and override what differs:

```ts
NX.theme.extend('brand', 'light', {
  colors: { primary: '#2446d8', primaryDark: '#1a36b0', ring: '#2446d8' },
  radius: { md: '0.75rem' },
  fontFamily: "'Inter', system-ui, sans-serif"
});
NX.theme.set('brand');
```

Or override tokens with plain CSS; this applies to every theme:

```css
:root {
  --color-primary: #2446d8;
  --color-primary-foreground: #ffffff;
  --radius-md: 0.75rem;
  --font-family: 'Inter', system-ui, sans-serif;
}
```

Themes apply their tokens as inline styles on `<html>`. To make a CSS override win over every theme, including after `NX.theme.set()`, mark it `!important`. The [showcase](../examples/showcase/page.tsx) (`applyBrand()`) does exactly this for its brand playground.

## Tokens

| Token | Used for |
| --- | --- |
| `--color-primary`, `--color-primary-dark`, `--color-primary-foreground` | primary actions: background, hover, text on top |
| `--color-secondary`, `--color-secondary-foreground` | secondary actions |
| `--color-background`, `--color-surface`, `--color-muted`, `--color-accent` | page, cards and popovers, subtle fills, hover fills |
| `--color-text`, `--color-text-secondary` | body text, muted text |
| `--color-border`, `--color-ring` | borders, focus rings |
| `--color-error`, `--color-success`, `--color-warning`, `--color-info` | status fills and icons |
| `--color-error-text`, `--color-success-text`, `--color-warning-text`, `--color-info-text` | status-coloured **text** (derived for 4.5:1 contrast) |
| `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-full` | corner radii |
| `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl` | elevation |
| `--spacing-xs` … `--spacing-xl` | spacing scale |
| `--font-family`, `--font-mono` | typefaces |
| `--transition-duration`, `--transition-easing` | motion (reduced to near zero with `prefers-reduced-motion`) |
| `--backdrop-bg` | dialog and drawer backdrop |

Use the `-text` variants whenever text is in a status colour: the plain status colours don't reach 4.5:1 contrast on their own tinted backgrounds.

## Styling one component

Every component exposes named parts for `::part()`:

```css
nx-button::part(button) { letter-spacing: 0.01em; }
nx-card::part(header) { border-bottom: 1px solid var(--color-border); }
nx-input::part(input) { font-variant-numeric: tabular-nums; }
```

Variants cover most needs without CSS: `variant`, `size`, `elevation` and so on; see the [component reference](components.md). Host elements take `class` and `style` like any element.

## Registering a theme from scratch

`NX.theme.register()` takes a complete theme: a `name` and every colour in `colors`, plus optional `radius`, `shadow`, `spacing`, `fontFamily` and `customProperties`. Themes registered before the stylesheet is generated (`nx.css`, `stylesheet()`) are included in it, so server-rendered pages can use them too.
