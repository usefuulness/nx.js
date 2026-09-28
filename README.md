# Nexaro

**[Website, live showcase and docs](https://usefuulness.github.io/nx.js/)** · [Demo app](https://usefuulness.github.io/nx.js/demo/) · [Component reference](https://usefuulness.github.io/nx.js/docs/components.html)

Accessible, themeable UI components you write like HTML: shadcn-style, as standard web components. Use them as JSX in a web app, as plain tags in Twig, Blade or Jinja templates, or render them on a server. They look and behave the same in each.

```tsx
<Card title="Invite a teammate">                          {/* JSX: creates real DOM, no React */}
  <Input name="email" type="email" label="Email" required />
  <CardFooter><Button type="submit">Send invite</Button></CardFooter>
</Card>
```

```html
<nx-card title="Invite a teammate">                        <!-- the same thing in HTML or any template -->
  <nx-input name="email" type="email" label="Email" required></nx-input>
  <nx-button slot="footer" type="submit">Send invite</nx-button>
</nx-card>
```

## Why Nexaro

- **Write it like HTML.** JSX creates real elements: `<Button>` is an `<nx-button>`, `<div onClick>` is a `div` with a listener. No virtual DOM and no framework to learn.
- **Any stack.** The same tags work in JSX, plain HTML, and every server template language. Editors autocomplete every tag, attribute and allowed value.
- **Server rendering built in.** Pages render on the server with Declarative Shadow DOM, so they paint fully styled before JavaScript loads. `hydrate()` then attaches the handlers from the same JSX without re-creating anything. For non-Node backends, the `nx-ssr` proxy pre-renders any app's HTML.
- **Forms that work before JavaScript.** Fields are form-associated: they post, validate and reset like native inputs, and server-rendered forms can be filled in and submitted before the script arrives.
- **Accessible, and checked.** Keyboard support and ARIA throughout; an axe WCAG 2.1 AA audit of every page, in every theme, with overlays open, runs on every change and must report zero violations.
- **Themeable.** Light, dark and midnight themes built in; your brand is a few design tokens.
- **Small.** About 50 kB gzipped with every component, and no runtime dependencies.

## Quick start

> Nexaro is not on npm yet. Build it from this repository (`pnpm install && pnpm build`) and use `dist/`.

Point your compiler's JSX at Nexaro:

```jsonc
// tsconfig.json
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "nx.js" } }
```

```tsx
import { NX, Button, Card, CardFooter, Input } from 'nx.js';

NX.render(
  <Card title="Create project" subtitle="Deploy your new project in one click.">
    <Input name="name" label="Name" placeholder="my-app" required />
    <CardFooter>
      <Button variant="outline">Cancel</Button>
      <Button onClick={() => NX.toast.success('Deployed!')}>Deploy</Button>
    </CardFooter>
  </Card>,
  '#root'
);
```

No CSS import is needed. Without a build step, load `dist/nx.umd.js` and write the tags or use config objects. [Getting started](docs/getting-started.md) covers every setup.

## Documentation

| Guide | |
| --- | --- |
| [Getting started](docs/getting-started.md) | setup with a bundler, a `<script>` tag, or a server template |
| [JSX, configs and HTML](docs/jsx-and-html.md) | the three ways to write UI, and how props map to attributes |
| [Building apps](docs/building-apps.md) | app shell, routing, data grid, stores, dialogs, toasts, menus, ⌘K |
| [Forms](docs/forms.md) | fields, validation, posting to a server, forms before JavaScript |
| [Server rendering](docs/server-rendering.md) | SSR, SSG, `hydrate()`, Twig/Blade/Jinja, the `nx-ssr` proxy and CLI |
| [Theming](docs/theming.md) | themes, brand colours, design tokens, `::part()` |
| [Accessibility](docs/accessibility.md) | what every component does for keyboard and screen-reader users |
| [Custom components](docs/custom-components.md) | writing your own in the house style |
| [Component reference](docs/components.md) | every tag, attribute, value and event (generated from the source) |

## Components

| Group | JSX components (tags: `<nx-*>`) |
| --- | --- |
| Actions | `Button`, `Menu`, `MenuBar`, `Command` (⌘K palette) |
| Forms | `Form`, `Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `Switch`, `RadioGroup`, `Slider`, `DatePicker` |
| Data | `DataGrid` with stores, sorting, search, selection and paging |
| Navigation | `Tabs`, `Tree`, `Breadcrumb`, `Accordion` |
| Overlays | `Dialog`, `Drawer`, `Popover`, `Tooltip`, plus `NX.toast()`, `NX.confirm()`, `NX.prompt()`, `NX.dialog()` |
| Display | `Card`, `Badge`, `Avatar`, `Alert`, `Progress`, `Spinner`, `Skeleton` |
| Layout | `Viewport` (app shell), `Panel`, `Toolbar`, `Box`, `HStack`, `VStack`, `Grid`, `Spacer`, `Separator`, `Divider` |

See them all live in the [showcase](examples/showcase) (`pnpm example:showcase`) or the demo app (`pnpm dev`).

## Examples

| | |
| --- | --- |
| [`src/main.tsx`](src/main.tsx) | a complete admin app: shell, routing, grid, forms, dialogs, ⌘K (`pnpm dev`) |
| [`examples/showcase`](examples/showcase) | every component on one page, server-rendered and hydrated (`pnpm example:showcase`) |
| [`examples/ssg`](examples/ssg) | a static site from JSX pages (`pnpm example:ssg`) |
| [`examples/server`](examples/server) | a template-engine app, with Twig, Blade and Jinja versions (`pnpm example:server`) |

## Development

```bash
pnpm dev              # demo app with hot reload
pnpm check            # typecheck + unit tests (run before every commit)
pnpm test:e2e         # Playwright: demo, a11y audit, server rendering, forms without JavaScript
pnpm build            # library → dist/ (ESM, CJS, UMD, types, nx.css, editor data)
pnpm docs:reference   # regenerate docs/components.md from the component sources
pnpm site             # the GitHub Pages site → site-dist/ (deployed from LIVE by .github/workflows/pages.yml)
```

Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Coding agents: [AGENTS.md](AGENTS.md).
