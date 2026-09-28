# Nexaro documentation

Start with **Getting started**, then read the guide for what you are building. The component reference lists every tag, attribute and event.

| Guide | Read it when you want to… |
| --- | --- |
| [Getting started](getting-started.md) | set up a project, write a first page, or use Nexaro from a `<script>` tag |
| [JSX, configs and HTML](jsx-and-html.md) | understand the three ways to write the same UI, and how props map to attributes |
| [Building apps](building-apps.md) | build an app shell with routing, data grids, stores, dialogs, toasts and menus |
| [Forms](forms.md) | collect and validate input, post to a server, or build forms that work before JavaScript |
| [Server rendering](server-rendering.md) | render pages on the server (SSR, SSG) or use Nexaro from Twig, Blade, Jinja, ERB… |
| [Theming](theming.md) | match your brand, switch light and dark, or restyle a component |
| [Accessibility](accessibility.md) | know what each component does for keyboard and screen-reader users |
| [Custom components](custom-components.md) | write your own component in the house style |
| [Component reference](components.md) | look up a tag's attributes, allowed values and events (generated from the source) |

Working on Nexaro itself? See [CONTRIBUTING.md](../CONTRIBUTING.md). Coding agents: see [AGENTS.md](../AGENTS.md).

## Examples

| Example | Shows |
| --- | --- |
| [`src/main.tsx`](../src/main.tsx) (`pnpm dev`) | a complete admin app: shell, routing, grid, forms, dialogs, ⌘K |
| [`examples/showcase`](../examples/showcase) (`pnpm example:showcase`) | every component on one page, server-rendered and hydrated |
| [`examples/ssg`](../examples/ssg) (`pnpm example:ssg`) | a static site: JSX pages rendered at build time, hydrated in the browser |
| [`examples/server`](../examples/server) (`pnpm example:server`) | a server app whose templates aren't JSX, with Twig, Blade and Jinja versions |
