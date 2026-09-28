/**
 * Builds the showcase: `pnpm example:showcase` → examples/showcase/dist
 *
 *   index.html    the page, server-rendered (content only: the host adds <html>/<head>/<body>)
 *   showcase.js   the client bundle that hydrates it
 *
 * `nx.js/ssr` must be imported before any module that uses components.
 */
import { renderToString, stylesheet } from 'nx.js/ssr';
import { Showcase } from './page';
import { bundleClient } from '../bundle';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'dist');
await mkdir(outDir, { recursive: true });

// Handlers can't be written into HTML; hydrate() in client.tsx attaches them
const body = await renderToString(<Showcase />, { onDropped: () => {} });
const css = await readFile(path.join(here, 'showcase.css'), 'utf8');

const html = `<title>Nexaro Showcase</title>
<meta name="description" content="Every Nexaro component, live: server-rendered, hydrated, themeable.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Martian+Mono:wght@400&family=Schibsted+Grotesk:wght@400;500;600;700;800&display=swap">
<style id="nx-styles">${stylesheet()}</style>
<style>${css}</style>
<div id="app">${body}</div>
<script type="module" src="showcase.js"></script>
`;

await writeFile(path.join(outDir, 'index.html'), html);
console.log(`  index.html  ${(html.length / 1024).toFixed(0)} kB`);

await bundleClient(path.join(here, 'client.tsx'), outDir, 'showcase.js');
console.log('  showcase.js');
