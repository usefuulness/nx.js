/**
 * Builds the GitHub Pages site: `pnpm site` → site-dist/
 *
 *   index.html      the showcase, server-rendered and hydrated (showcase.js)
 *   docs/*.html     docs/*.md as pages
 *   demo/           the demo app (src/main.tsx)
 *   nx.css          the stylesheet the docs pages use
 *
 * `.github/workflows/pages.yml` runs it on every push to LIVE and deploys the result.
 */
import { renderDocument, stylesheet, themeScript } from 'nx.js/ssr';
import { Showcase } from '../examples/showcase/page';
import { bundleClient } from '../examples/bundle';
import { Marked, type Tokens } from 'marked';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'site-dist');
const repo = 'https://github.com/usefuulness/nx.js';
const branch = 'LIVE';

const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Martian+Mono:wght@400&family=Schibsted+Grotesk:wght@400;500;600;700;800&display=swap">`;

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// ────────── Demo app ──────────

execFileSync('npx', ['vite', 'build', '--mode', 'demo', '--outDir', path.join(out, 'demo'), '--emptyOutDir', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
console.log('  demo/');

// ────────── Landing page: the showcase ──────────

const description = 'Accessible, themeable web components you write like HTML: JSX, plain HTML or any server template, rendered on the server and hydrated in the browser.';
const showcaseCss = await readFile(path.join(root, 'examples/showcase/showcase.css'), 'utf8');
const landing = await renderDocument(<div id="app"><Showcase site /></div>, {
  title: 'Nexaro — web components you write like HTML',
  head: [
    `<meta name="description" content="${escape(description)}">`,
    '<meta property="og:title" content="Nexaro">',
    `<meta property="og:description" content="${escape(description)}">`,
    '<meta property="og:type" content="website">',
    '<link rel="icon" href="favicon.svg" type="image/svg+xml">',
    fonts,
    `<style>${showcaseCss}</style>`
  ].join('\n'),
  scripts: ['showcase.js'],
  bodyAttributes: { 'data-site': '' },
  // Handlers can't be written into HTML; the showcase client hydrates them
  onDropped: () => {}
});
await writeFile(path.join(out, 'index.html'), landing);
await bundleClient(path.join(root, 'examples/showcase/client.tsx'), out, 'showcase.js');
console.log('  index.html, showcase.js');

// ────────── Stylesheet ──────────

await writeFile(path.join(out, 'nx.css'), stylesheet());

// ────────── Docs ──────────

/** GitHub's heading anchors, so links like `forms.md#before-javascript-loads` keep working. */
const slug = (text: string) => text.trim().toLowerCase().replace(/[`*_]/g, '').replace(/[^\w\- ]/g, '').replace(/ /g, '-');

/** Order of the sidebar: the guides as docs/README.md lists them. */
const guides: Array<[string, string]> = [
  ['README.md', 'Overview'],
  ['getting-started.md', 'Getting started'],
  ['jsx-and-html.md', 'JSX, configs and HTML'],
  ['building-apps.md', 'Building apps'],
  ['forms.md', 'Forms'],
  ['server-rendering.md', 'Server rendering'],
  ['theming.md', 'Theming'],
  ['accessibility.md', 'Accessibility'],
  ['custom-components.md', 'Custom components'],
  ['components.md', 'Component reference']
];
const pageName = (file: string) => (file === 'README.md' ? 'index.html' : file.replace(/\.md$/, '.html'));

/** Rewrite a link in docs/<file>: other docs → .html pages, repository files → GitHub. */
function rewrite(href: string): string {
  if (/^([a-z]+:|#)/i.test(href)) return href;
  const [target, anchor] = href.split('#');
  const hash = anchor ? `#${anchor}` : '';
  const resolved = path.posix.normalize(path.posix.join('docs', target));
  if (resolved.startsWith('docs/') && resolved.endsWith('.md')) return pageName(resolved.slice(5)) + hash;
  if (resolved === 'README.md') return `../${hash}`;
  const isDir = existsSync(path.join(root, resolved)) && statSync(path.join(root, resolved)).isDirectory();
  return `${repo}/${isDir ? 'tree' : 'blob'}/${branch}/${resolved}${hash}`;
}

const marked = new Marked({
  gfm: true,
  walkTokens(token) {
    if (token.type === 'link') (token as Tokens.Link).href = rewrite((token as Tokens.Link).href);
  },
  renderer: {
    heading({ tokens, depth, text }) {
      const html = this.parser.parseInline(tokens);
      return `<h${depth} id="${slug(text)}">${html}</h${depth}>\n`;
    },
    table(token) {
      // Default table markup, wrapped so wide tables scroll on their own
      const header = token.header.map(cell => `<th${cell.align ? ` style="text-align:${cell.align}"` : ''}>${this.parser.parseInline(cell.tokens)}</th>`).join('');
      const rows = token.rows.map(row => `<tr>${row.map(cell => `<td${cell.align ? ` style="text-align:${cell.align}"` : ''}>${this.parser.parseInline(cell.tokens)}</td>`).join('')}</tr>`).join('\n');
      return `<div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
    }
  }
});

const siteCss = await readFile(path.join(root, 'scripts/site.css'), 'utf8');
const toggleIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor"/></svg>';
// Same storage as NX.theme, so the landing page and the docs agree
const toggleScript = `document.getElementById('theme-toggle').addEventListener('click', function () {
  var root = document.documentElement;
  var current = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  var next = current === 'light' ? 'dark' : 'light';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('nx-theme', next); } catch (e) {}
  document.cookie = 'nx-theme=' + next + '; path=/; max-age=31536000; SameSite=Lax';
});`;

const docsDir = path.join(root, 'docs');
const docFiles = (await readdir(docsDir)).filter(f => f.endsWith('.md'));
await mkdir(path.join(out, 'docs'), { recursive: true });

for (const file of docFiles) {
  const source = await readFile(path.join(docsDir, file), 'utf8');
  const title = /^# (.+)$/m.exec(source)?.[1] ?? 'Documentation';
  const body = await marked.parse(source);
  const nav = guides.map(([f, label]) =>
    `<li><a href="${pageName(f)}"${f === file ? ' aria-current="page"' : ''}>${escape(label)}</a></li>`).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · Nexaro docs</title>
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<meta name="description" content="${escape(description)}">
<script>${themeScript()}</script>
<link rel="stylesheet" href="../nx.css">
${fonts}
<style>${siteCss}</style>
</head>
<body>
<header class="site-header">
  <div class="site-header-inner">
    <a class="site-brand" href="../"><code>&lt;nx/&gt;</code>Nexaro</a>
    <nav aria-label="Site">
      <a href="index.html" aria-current="page">Docs</a>
      <a href="../demo/">Demo</a>
      <a href="${repo}">GitHub</a>
      <button type="button" class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">${toggleIcon}</button>
    </nav>
  </div>
</header>
<div class="site-layout">
  <aside class="site-sidebar" aria-label="Documentation">
    <h2>Documentation</h2>
    <ol>${nav}</ol>
  </aside>
  <main class="doc">
${body}
    <footer class="doc-footer">
      <span>Nexaro is open source.</span>
      <a href="${repo}/edit/${branch}/docs/${file}">Edit this page on GitHub</a>
    </footer>
  </main>
</div>
<script>${toggleScript}</script>
</body>
</html>
`;
  await writeFile(path.join(out, 'docs', pageName(file)), html);
}
console.log(`  docs/ (${docFiles.length} pages)`);

// ────────── Misc ──────────

// Serve files as they are (no Jekyll processing on GitHub Pages)
await writeFile(path.join(out, '.nojekyll'), '');
await writeFile(path.join(out, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#18181b"/>
  <text x="16" y="21" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="13" font-weight="700" fill="#8aa2ff">nx</text>
</svg>
`);
console.log(`site → ${path.relative(root, out)}/`);
