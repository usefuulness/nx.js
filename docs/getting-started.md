# Getting started

Nexaro is a set of UI components that are standard custom elements (`<nx-button>`, `<nx-grid>`…). You can write them in JSX, as plain HTML, or as config objects, and they render the same way in each.

> Nexaro is not published to npm yet (`"private": true` in `package.json`). Until it is, build it from this repository (`pnpm build`) and use `dist/`, or depend on the repository directly.

## With a bundler and JSX

Point your compiler's JSX runtime at Nexaro. TypeScript, esbuild, Vite and Bun all read this:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "nx.js"
  }
}
```

Then write UI as JSX. It creates **real DOM elements**: there is no virtual DOM and no React.

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

No CSS import is needed: design tokens, base styles and the light and dark themes are injected when `nx.js` loads.

`NX.render()` appends to a target. Because JSX returns ordinary elements, `document.body.append(<Button>Hi</Button>)` works too.

## With a `<script>` tag

No build step. Use config objects, or plain HTML tags:

```html
<div id="root"></div>
<nx-button variant="outline" id="hello">Plain HTML works too</nx-button>

<script src="dist/nx.umd.js"></script>
<script>
  NX.render({ xtype: 'button', text: 'Hello', handler: () => NX.toast('Hi!') }, '#root');
  document.getElementById('hello').addEventListener('click', () => NX.toast('Clicked'));
</script>
```

## From a server template

Server apps (Laravel, Django, Rails, Symfony…) write the tags in their templates and load the client bundle. See [Server rendering](server-rendering.md) for rendering them before JavaScript loads.

```twig
<nx-card title="{{ project.name }}">
  <nx-input name="email" type="email" label="Email" value="{{ form.email }}" required></nx-input>
  <nx-button slot="footer" type="submit">Save</nx-button>
</nx-card>
```

## Package entry points

| Import | What it is |
| --- | --- |
| `nx.js` | Every component, the `NX` facade, the JSX components and `hydrate()` |
| `nx.js/jsx-runtime` | The JSX runtime (used by your compiler via `jsxImportSource`) |
| `nx.js/ssr` | Server rendering in Node: `renderToString`, `renderHTML`, `renderDocument`, the proxy |
| `nx.js/ssr/register` | Installs the server DOM; for `node --import nx.js/ssr/register` |
| `nx.js/nx.css` | The full stylesheet (every theme), for pages that link CSS instead of injecting it |
| `nx.js/umd` | `dist/nx.umd.js`, the `<script>` build (global `NX`) |
| `nx.js/custom-elements.json`, `nx.js/html-custom-data.json` | Editor autocompletion data (see [JSX, configs and HTML](jsx-and-html.md#editor-support)) |

## Next

- [JSX, configs and HTML](jsx-and-html.md): how props, attributes and configs map to each other.
- [Building apps](building-apps.md): an app shell with routing and data.
- [Component reference](components.md): every tag and attribute.
