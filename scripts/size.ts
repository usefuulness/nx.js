/**
 * Bundle-size budget: `pnpm build && pnpm size`.
 *
 * Measures what ships in dist/ (gzip and brotli) against scripts/size-budget.json and exits 1 when
 * a file is over budget. A budget is a ceiling with a little headroom over today's size; lower it
 * when a change shrinks the bundle, and raise it only on purpose, in the same commit that grows it.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { brotliCompressSync, gzipSync } from 'node:zlib';

type Budget = { file: string; maxGzipKB: number; note?: string };
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
  const bytes = readFileSync(`dist/${name}`);
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
