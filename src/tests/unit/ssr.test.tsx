// @vitest-environment node
/**
 * Server rendering: runs in plain Node with the nx.js/ssr server DOM.
 */
import { renderToString, renderHTML, stylesheet } from '@/ssr';
import { describe, it, expect } from 'vitest';
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
    expect(out).toMatch(/^<!DOCTYPE html>\n<html lang="de" data-theme="dark"><head><style id="nx-styles">/);
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
