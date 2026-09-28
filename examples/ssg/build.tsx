/**
 * Static site build: `pnpm example:ssg` → examples/ssg/dist
 *
 * `nx.js/ssr` must be imported before any module that uses components.
 */
import { renderDocument } from 'nx.js/ssr';
import { pages } from './pages';
import { bundleClient } from '../bundle';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'dist');
await mkdir(outDir, { recursive: true });

for (const [name, Page] of Object.entries(pages)) {
  const html = await renderDocument(<Page />, {
    title: `${name} · Nexaro SSG`,
    scripts: ['./client.js'],
    bodyAttributes: { 'data-page': name },
    // Handlers (onClick…) can't be written into HTML; client.tsx's hydrate() attaches them
    onDropped: () => {}
  });
  await writeFile(path.join(outDir, `${name}.html`), html);
  console.log(`  ${name}.html  ${(html.length / 1024).toFixed(1)} kB`);
}

// The browser bundle: `import 'nx.js'` upgrades the pre-rendered elements
await bundleClient(path.join(here, 'client.tsx'), outDir);
console.log('  client.js');
