/**
 * @file @/ssr/cli.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * `nx-ssr` — pre-render Nexaro tags in HTML from any template engine.
 *
 *   nx-ssr --proxy http://127.0.0.1:8000 --port 3000   render a running app (SSR)
 *   nx-ssr public/index.html public/docs/*.html        render files in place (SSG)
 *   nx-ssr < page.html > page.rendered.html            stdin → stdout
 *   nx-ssr --css > public/nx.css                       the stylesheet
 */
import '@/ssr/dom';
import { renderHTML, stylesheet } from '@/ssr/index';
import { createProxy } from '@/ssr/proxy';
import { readFile, writeFile } from 'node:fs/promises';

const HELP = `nx-ssr — pre-render Nexaro components in HTML from any template engine

Usage:
  nx-ssr --proxy <upstream> [--port 3000] [--host 127.0.0.1]
      Reverse proxy: renders every text/html response of <upstream>.
  nx-ssr <file.html>... [--out-dir <dir>]
      Render HTML files in place (or into --out-dir).
  nx-ssr < in.html > out.html
      Render stdin to stdout.
  nx-ssr --css
      Print the stylesheet (base styles + every theme).

Options:
  --theme <name>     Render in this theme (<html data-theme>)
  --no-styles        Don't inject <style id="nx-styles"> into full documents
`;

function parse(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) files.push(arg);
    else if (['--css', '--help', '--no-styles'].includes(arg)) flags[arg.slice(2)] = true;
    else flags[arg.slice(2)] = argv[++i] ?? '';
  }
  return { flags, files };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function main(): Promise<void> {
  const { flags, files } = parse(process.argv.slice(2));
  const theme = typeof flags.theme === 'string' ? flags.theme : undefined;
  const render = { theme, injectStyles: !flags['no-styles'] };

  if (flags.help) {
    process.stdout.write(HELP);
  } else if (flags.css) {
    process.stdout.write(stylesheet());
  } else if (typeof flags.proxy === 'string') {
    const port = Number(flags.port ?? 3000);
    const host = typeof flags.host === 'string' ? flags.host : '127.0.0.1';
    createProxy({ upstream: flags.proxy, injectStyles: render.injectStyles }).listen(port, host, () => {
      console.log(`nx-ssr: http://${host}:${port} → ${flags.proxy}`);
    });
  } else if (files.length) {
    const outDir = typeof flags['out-dir'] === 'string' ? flags['out-dir'] : null;
    const { join, basename } = await import('node:path');
    for (const file of files) {
      const out = outDir ? join(outDir, basename(file)) : file;
      await writeFile(out, await renderHTML(await readFile(file, 'utf8'), render));
      console.error(`nx-ssr: ${out}`);
    }
  } else if (!process.stdin.isTTY) {
    process.stdout.write(await renderHTML(await readStdin(), render));
  } else {
    process.stdout.write(HELP);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
