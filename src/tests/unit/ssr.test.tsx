// @vitest-environment node
/**
 * Server rendering: runs in plain Node with the nx.js/ssr server DOM.
 */
import { renderToString, renderHTML, renderDocument, stylesheet, createProxy } from '@/ssr';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { execFileSync } from 'node:child_process';
import { describe, it, expect, afterAll } from 'vitest';
import { Button, Card, CardFooter, Tabs, Tab, Input, DataGrid, Tree } from '@/index';

describe('renderToString', () => {
  it('renders components with Declarative Shadow DOM', async () => {
    const html = await renderToString(<Button variant="outline" icon="save">Save</Button>);
    expect(html).toMatch(/^<nx-button variant="outline" icon="save" nx-ssr>/);
    expect(html).toContain('<template shadowrootmode="open" shadowrootdelegatesfocus>');
    expect(html).toContain('class="nx-button variant-outline size-md"');
    expect(html).toContain('<style>');
    expect(html).toMatch(/<\/template>Save<\/nx-button>$/);
  });

  it('keeps light DOM (slots) and nested components', async () => {
    const html = await renderToString(
      <Card title="Hello">
        <p>Body</p>
        <CardFooter><Button>OK</Button></CardFooter>
      </Card>
    );
    expect(html).toContain('<h3 class="title" part="title">Hello</h3>');
    expect(html).toContain('<p>Body</p>');
    expect(html).toContain('<div slot="footer"');
    expect(html).toContain('<div class="footer" part="footer"><slot name="footer"></slot></div>');
    expect((html.match(/shadowrootmode/g) ?? []).length).toBe(2); // card + button
  });

  it('writes rich props into a hydration script', async () => {
    const html = await renderToString(<Card title="From a prop">x</Card>);
    expect(html).toContain('<script type="application/json" data-nx-config>{"title":"From a prop"}</script>');
  });

  it('serializes data components and reports functions it cannot serialize', async () => {
    const dropped: string[][] = [];
    const html = await renderToString(
      <DataGrid
        data={[{ name: 'Ada' }, { name: '</script><b>x' }]}
        columns={[{ field: 'name', header: 'Name', formatter: (v: string) => v.toUpperCase() }]}
        onRowClick={() => {}}
      />,
      { onDropped: paths => dropped.push(paths) }
    );
    expect(html).toContain('<td class="align-left">ADA</td>');
    // Escaped in the table (the formatter upper-cases it) and safe inside the script tag
    expect(html).toContain('&lt;/SCRIPT&gt;&lt;B&gt;X');
    expect(html).not.toMatch(/<\/script><b>/);
    expect(html).toContain('\\u003c/script>');
    expect(dropped.flat()).toEqual(expect.arrayContaining(['<nx-grid>.formatter', '<nx-grid>.onRowClick']));
  });

  it('renders tabs from <Tab> children with the active tab reflected', async () => {
    const html = await renderToString(
      <Tabs>
        <Tab title="One">first</Tab>
        <Tab title="Two" active>second</Tab>
      </Tabs>
    );
    expect(html).toMatch(/<nx-tab [^>]*slot="tab-/);
    expect(html).toContain('label="Two"');
    expect(html).toMatch(/<nx-tab(?=[^>]* active[\s>])(?=[^>]*label="Two")[^>]*>/);
    expect(html).not.toMatch(/<nx-tab(?=[^>]* active[\s>])(?=[^>]*label="One")[^>]*>/);
    expect(html).not.toMatch(/<nx-tab[^>]* title=/);
    expect(html).toMatch(/aria-selected="true"[^>]*>[\s\S]*?Two/);
  });

  it('writes the current value of form controls', async () => {
    const html = await renderToString(<Input name="email" value="ada@example.com" label="Email" />);
    expect(html).toContain('value="ada@example.com"');
    expect(html).toContain('<label class="nx-field-label" part="label" for=');
  });

  it('renders xtype configs and trees too', async () => {
    const html = await renderToString([
      { xtype: 'badge', variant: 'success', html: 'Paid' },
      <Tree data={[{ text: 'Root', expanded: true, children: [{ text: 'Leaf' }] }]} />
    ]);
    expect(html).toContain('<nx-badge variant="success" nx-ssr>');
    expect(html).toContain('Leaf');
  });
});

describe('renderHTML (any template engine)', () => {
  it('pre-renders nx tags inside a fragment', async () => {
    const out = await renderHTML('<section><nx-button variant="ghost">Hi</nx-button><p>plain</p></section>');
    expect(out).toContain('<section><nx-button variant="ghost" nx-ssr><template shadowrootmode="open"');
    expect(out).toContain('<p>plain</p>');
  });

  it('honours JSON config written by a template engine', async () => {
    const out = await renderHTML(
      `<nx-grid columns='[{"field":"name","header":"Name"}]'><script type="application/json" data-nx-config>{"data":[{"name":"Grace"}]}</script></nx-grid>`
    );
    expect(out).toContain('Grace');
    expect(out).toContain('>Name<');
  });

  it('keeps a full document and injects the stylesheet and theme', async () => {
    const out = await renderHTML(
      '<!DOCTYPE html><html lang="de"><head><title>T</title></head><body class="x"><nx-badge>New</nx-badge></body></html>',
      { theme: 'dark' }
    );
    expect(out).toMatch(/^<!DOCTYPE html>\n<html lang="de" data-theme="dark"><head><script>\(function\(\)\{try\{var t=localStorage[^<]*<\/script><style id="nx-styles">/);
    expect(out).toContain('<title>T</title>');
    expect(out).toContain('<body class="x"><nx-badge nx-ssr>');
    expect(out).toMatch(/<\/body><\/html>$/);
  });
});

describe('stylesheet', () => {
  it('contains every theme, the OS fallback and the pre-upgrade rule', () => {
    const css = stylesheet();
    expect(css).toContain(':root[data-theme="light"]');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain(':root[data-theme="midnight"]');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain('--color-primary: #18181b;');
    expect(css).toMatch(/:not\(:defined\):not\(\[nx-ssr\]\) \{ visibility: hidden; \}/);
  });
});

describe('renderDocument', () => {
  it('builds a whole page with styles, theme bootstrap and scripts', async () => {
    const html = await renderDocument(<Button>Go</Button>, { title: 'A <b>', lang: 'de', scripts: ['/client.js'] });
    expect(html).toMatch(/^<!doctype html>\n<html lang="de">/);
    expect(html).toContain('<title>A &lt;b></title>');
    expect(html).toContain('<style id="nx-styles">');
    expect(html).toContain('localStorage.getItem(\'nx-theme\')');
    expect(html).toContain('<script type="module" src="/client.js"></script>');
    expect(html).toMatch(/<body><nx-button nx-ssr><template shadowrootmode="open"/);
  });
});

describe('createProxy (any backend)', () => {
  const servers: Server[] = [];
  const listen = (server: Server) => new Promise<string>(resolve => {
    servers.push(server);
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
  });
  afterAll(() => servers.forEach(server => server.close()));

  it('renders HTML responses and passes everything else through', async () => {
    const upstream = await listen(createServer((req, res) => {
      if (req.url === '/api') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
          res.writeHead(303, { location: `/thanks?${body}` });
          res.end();
        });
      } else {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'x-app': 'twig' });
        res.end('<!doctype html><html><head><title>App</title></head><body><nx-badge>Hi</nx-badge></body></html>');
      }
    }));
    const proxy = await listen(createProxy({ upstream }));

    const page = await fetch(`${proxy}/`, { headers: { cookie: 'a=1; nx-theme=midnight' } });
    const html = await page.text();
    expect(page.headers.get('x-app')).toBe('twig');
    expect(Number(page.headers.get('content-length'))).toBe(Buffer.byteLength(html));
    expect(html).toContain('<html data-theme="midnight">');
    expect(html).toContain('<nx-badge nx-ssr><template shadowrootmode="open">');

    expect(await (await fetch(`${proxy}/api`)).json()).toEqual({ ok: true });

    const post = await fetch(`${proxy}/contact`, { method: 'POST', body: 'email=a%40b.c', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(post.status).toBe(303);
    expect(post.headers.get('location')).toBe('/thanks?email=a%40b.c');
  });
});

describe('nx-ssr CLI', () => {
  it('renders stdin to stdout', () => {
    const out = execFileSync('npx', ['tsx', 'src/ssr/cli.ts'], { input: '<p><nx-badge>New</nx-badge></p>', encoding: 'utf8' });
    expect(out).toMatch(/^<p><nx-badge nx-ssr><template shadowrootmode="open">[\s\S]*New<\/nx-badge><\/p>$/);
  }, 30_000);
});
