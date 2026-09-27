/**
 * Bundles an example's browser entry. Any bundler works; this is `vite build`
 * with `nx.js` pointed at the sources of this repository.
 */
import { build } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function bundleClient(entry: string, outDir: string, fileName = 'client.js'): Promise<void> {
  await build({
    configFile: false,
    logLevel: 'warn',
    resolve: { alias: { 'nx.js': path.join(root, 'src/index.ts'), '@': path.join(root, 'src') } },
    build: { outDir, emptyOutDir: false, rollupOptions: { input: entry, output: { entryFileNames: fileName } } }
  });
}
