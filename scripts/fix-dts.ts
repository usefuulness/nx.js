/**
 * Make the generated declaration files valid for Node-style ESM (`moduleResolution: node16/nodenext`),
 * which needs explicit extensions on relative imports. vite-plugin-dts writes `from './button'`; this
 * rewrites it to `from './button.js'` (or `./button/index.js`). Bundler-style resolution accepts both.
 * Run after the library build: `pnpm build` does.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
let files = 0;
let rewritten = 0;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.d.ts') ? [full] : [];
  });
}

for (const file of walk(root)) {
  const source = readFileSync(file, 'utf8');
  const fixed = source.replace(/(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]*)\2/g, (whole, lead, quote, spec) => {
    if (/\.(js|json|css)$/.test(spec)) return whole;
    const target = path.resolve(path.dirname(file), spec);
    if (existsSync(`${target}.d.ts`)) return `${lead}${quote}${spec}.js${quote}`;
    if (existsSync(path.join(target, 'index.d.ts'))) return `${lead}${quote}${spec.replace(/\/$/, '')}/index.js${quote}`;
    return whole; // not one of ours (a type-only path that doesn't exist): leave it for tsc to report
  });
  files++;
  if (fixed !== source) {
    rewritten++;
    writeFileSync(file, fixed);
  }
}
console.log(`declarations: ${rewritten} of ${files} files given explicit .js extensions`);
