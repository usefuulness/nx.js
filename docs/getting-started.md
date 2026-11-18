# Getting started

nx.js is a set of UI components that are standard custom elements (`<nx-button>`, `<nx-grid>`…). You can write them in JSX, as plain HTML, or as config objects, and they render the same way in each.

> nx.js is not on npm yet. Until it is, `npm create nx.js` and `npm install nx.js` will not find it: build it from this repository (`pnpm install && pnpm build`) and use `dist/`, or depend on the repository directly.

## Start a new project

```bash
npm create nx.js my-app
cd my-app
npm run dev
```

It asks for a folder and a template, copies it, and installs. `app` is a Vite + TypeScript project that writes UI as JSX (the setup below, done for you); `html` is a single file with a `<script>` tag and no build step. Both also work with `pnpm create nx.js`, `yarn create nx.js` and `bun create nx.js`. Options: `--template app|html`, `--no-install`, `--force` (write into a folder that is not empty).

To add nx.js to a project you already have, follow the steps below.

## With a bundler and JSX

Point your compiler's JSX runtime at nx.js. TypeScript, esbuild, Vite and Bun all read this:

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
| `nx.js/components/<name>` | One component and what it needs, e.g. `nx.js/components/badge` (see below) |
| `nx.js/locales/<code>` | A translation of the built-in strings (`es`, `fr`, `de`, `ar`); see [Internationalization](internationalization.md) |
| `nx.js/jsx-runtime` | The JSX runtime (used by your compiler via `jsxImportSource`) |
| `nx.js/ssr` | Server rendering in Node: `renderToString`, `renderHTML`, `renderDocument`, the proxy |
| `nx.js/ssr/register` | Installs the server DOM; for `node --import nx.js/ssr/register` |
| `nx.js/nx.css` | The full stylesheet (every theme), for pages that link CSS instead of injecting it |
| `nx.js/umd` | `dist/nx.umd.js`, the `<script>` build (global `NX`) |
| `nx.js/custom-elements.json`, `nx.js/html-custom-data.json` | Editor autocompletion data (see [JSX, configs and HTML](jsx-and-html.md#editor-support)) |

### Import only what you use

`import 'nx.js'` registers every component. A page that needs a few can import them one by one; each entry registers its elements (a side effect, so it is imported for its effect or its exports) and shares one runtime with the others:

```ts
import 'nx.js/components/badge';        // <nx-badge>
import 'nx.js/components/form';         // <nx-form>
import 'nx.js/components/textfield';    // <nx-textfield>, <nx-input>, <nx-textarea>
import { NXGrid } from 'nx.js/components/grid';   // <nx-grid>, plus the class if you want it
```

Measured with everything minified and gzipped, including the runtime each one needs:

| Import | gzip |
| --- | --- |
| `components/badge` | 13.6 kB |
| `components/button` | 20.2 kB |
| `components/tabpanel` | 15.9 kB |
| `components/form` | 17.4 kB |
| `components/grid` (virtual, editable, buffered) | 28.0 kB |
| the `<script>` build, everything | 69.6 kB |

The name is the file name under `src/components/ui`, `src/components/ui/form`, `src/layout` or `src/data` (`select`, `checkbox`, `datepicker`, `panel`, `container`, `viewport`…). Some files register several related tags: `textfield` gives `<nx-input>` and `<nx-textarea>` too, `tabpanel` gives `<nx-tabs>` and `<nx-tab>`. On the server, import `nx.js/ssr` first, as always.

## Next

- [JSX, configs and HTML](jsx-and-html.md): how props, attributes and configs map to each other.
- [Building apps](building-apps.md): an app shell with routing and data.
- [Component reference](components.md): every tag and attribute.
