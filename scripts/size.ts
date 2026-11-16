/**
 * Bundle-size budget: `pnpm build && pnpm size`.
 *
 * Measures what ships in dist/ (gzip and brotli) against scripts/size-budget.json and exits 1 when
 * a file is over budget. A budget is a ceiling with a little headroom over today's size; lower it
 * when a change shrinks the bundle, and raise it only on purpose, in the same commit that grows it.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { build } from 'vite';

/** `closure`: bundle and minify the file with everything it imports, i.e. what a page importing it ships */
type Budget = { file: string; maxGzipKB: number; closure?: boolean; note?: string };
const budgets: Budget[] = JSON.parse(readFileSync(new URL('./size-budget.json', import.meta.url), 'utf8'));

if (!existsSync('dist')) {
  console.error('No dist/ folder: run `pnpm build` first.');
  process.exit(2);
}

// Vite gives the shared chunk a hashed name (app-C4NA8H-Q.js); `app-*.js` matches it
const resolve = (pattern: string): string | null => {
  if (!pattern.includes('*')) return existsSync(`dist/${pattern}`) ? pattern : null;
  const [prefix, suffix] = pattern.split('*');
  return readdirSync('dist').find(f => f.startsWith(prefix) && f.endsWith(suffix)) ?? null;
};

/**
 * What a page importing `name` downloads: the entry bundled with everything it imports and minified,
 * the way an application build would ship it. (Compressing the dist/ chunks one by one over-counts,
 * because small files lose the shared dictionary.)
 */
const bundle = async (name: string): Promise<Buffer> => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: 'esbuild',
      lib: { entry: resolvePath(`dist/${name}`), formats: ['es'], fileName: 'bundle' },
      rollupOptions: { external: [/^node:/, 'happy-dom'] }
    }
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => ('output' in r ? r.output : []));
  return Buffer.from(outputs.map(o => ('code' in o ? o.code : '')).join('\n'));
};

const kb = (n: number) => (n / 1024).toFixed(1).padStart(7);
let failed = false;
console.log('file'.padEnd(22), '    raw     gzip   brotli   budget');
for (const budget of budgets) {
  const name = resolve(budget.file);
  if (!name) {
    console.log(budget.file.padEnd(22), 'MISSING');
    failed = true;
    continue;
  }
  const bytes = budget.closure ? await bundle(name) : readFileSync(`dist/${name}`);
  const gzip = gzipSync(bytes, { level: 9 }).length;
  const brotli = brotliCompressSync(bytes).length;
  const over = gzip / 1024 > budget.maxGzipKB;
  failed ||= over;
  console.log(
    budget.file.padEnd(22), kb(bytes.length), kb(gzip), kb(brotli), `${String(budget.maxGzipKB).padStart(7)}`,
    over ? ' OVER BUDGET' : ''
  );
}
if (failed) {
  console.error('\nOver budget (or missing). Shrink the bundle, or raise scripts/size-budget.json on purpose.');
  process.exit(1);
}
