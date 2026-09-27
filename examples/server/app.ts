/**
 * A server app whose templates are NOT JSX — `pnpm example:server`, then open
 * http://localhost:3000.
 *
 * `page()` stands in for any template engine (Twig, Blade, Jinja, ERB, Go
 * templates…): it just writes `<nx-*>` tags with attributes and JSON, exactly
 * like templates/users.twig, users.blade.php and users.html.j2 do. The HTML is
 * then pre-rendered with `renderHTML()`, so the page is complete before any
 * JavaScript loads.
 *
 * Not on Node? Keep your backend and put `nx-ssr --proxy http://127.0.0.1:8000`
 * in front of it — same result, no code changes.
 */
import { renderHTML, themeFromCookie } from 'nx.js/ssr';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleClient } from '../bundle';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);

// ────────── "Database" ──────────

const users = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'Admin' },
  { id: 2, name: 'Grace Hopper', email: 'grace@example.com', role: 'Editor' },
  { id: 3, name: 'Alan Turing', email: 'alan@example.com', role: 'Viewer' }
];

// ────────── A minimal template engine: auto-escaping, like Twig/Blade/Jinja ──────────

type Raw = { raw: string };
const raw = (value: string): Raw => ({ raw: value });
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  return raw(strings.reduce((out, string, i) => {
    const value = values[i - 1];
    const text = Array.isArray(value) ? value.map(v => (v as Raw).raw ?? escape(v)).join('') : (value as Raw)?.raw ?? escape(value);
    return out + text + string;
  }));
}

/** JSON for a <script> body: `</script>` can't break out (like Twig's json_encode, Jinja's tojson). */
const json = (value: unknown) => raw(JSON.stringify(value).replace(/</g, '\\u003c'));

// ────────── Templates ──────────

const layout = (title: string, body: Raw) => html`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script type="module" src="/client.js"></script>
</head>
<body>
  <main style="max-width: 56rem; margin: 0 auto; padding: 2rem 1rem; display: grid; gap: 1.5rem">
    <nx-toolbar>
      <strong>Acme admin</strong>
      <nx-badge variant="secondary">server-rendered</nx-badge>
      <nx-spacer></nx-spacer>
      <nx-button id="theme" variant="ghost" icon="moon" aria-label="Toggle theme"></nx-button>
    </nx-toolbar>
    ${body}
  </main>
</body>
</html>`;

const usersPage = (flash?: string) => layout('Users', html`
  ${flash ? html`<nx-card title="Saved"><p>${flash}</p></nx-card>` : ''}

  <nx-grid id="users" title="Users" search striped
           columns='${JSON.stringify([
             { field: 'name', header: 'Name' },
             { field: 'email', header: 'Email' },
             { field: 'role', header: 'Role', width: 120 }
           ])}'>
    <script type="application/json" data-nx-config>{"data": ${json(users)}}</script>
  </nx-grid>

  <nx-card title="Invite someone" subtitle="A plain HTML form: it posts to /users without any JavaScript handler.">
    <form method="post" action="/users">
      <nx-form columns="2">
        <nx-textfield name="name" label="Name" required></nx-textfield>
        <nx-textfield name="email" type="email" label="Email" required></nx-textfield>
        <nx-select name="role" label="Role" value="Viewer">
          <option>Admin</option><option>Editor</option><option>Viewer</option>
        </nx-select>
      </nx-form>
      <p style="display: flex; justify-content: end; margin: 1rem 0 0">
        <nx-button type="submit" icon="send">Invite</nx-button>
      </p>
    </form>
  </nx-card>
`);

// ────────── Server ──────────

async function body(req: IncomingMessage): Promise<URLSearchParams> {
  let text = '';
  for await (const chunk of req) text += chunk;
  return new URLSearchParams(text);
}

async function send(req: IncomingMessage, res: ServerResponse, page: Raw): Promise<void> {
  // The one line that matters: pre-render whatever the template produced
  const out = await renderHTML(page.raw, { theme: themeFromCookie(req) });
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(out);
}

await bundleClient(path.join(here, 'client.ts'), path.join(here, 'dist'));

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/client.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    res.end(await readFile(path.join(here, 'dist/client.js')));
  } else if (url.pathname === '/users' && req.method === 'POST') {
    const form = await body(req);
    users.push({ id: users.length + 1, name: form.get('name') ?? '', email: form.get('email') ?? '', role: form.get('role') ?? 'Viewer' });
    // Post/redirect/get, as usual
    res.writeHead(303, { location: `/?invited=${encodeURIComponent(form.get('name') ?? '')}` });
    res.end();
  } else if (url.pathname === '/') {
    const invited = url.searchParams.get('invited');
    await send(req, res, usersPage(invited ? `${invited} was invited.` : undefined));
  } else {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
