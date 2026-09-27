/**
 * @file @/ssr/proxy.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * A reverse proxy that pre-renders the HTML of any backend. Put it in front of
 * a PHP, Python, Ruby, Go… app whose templates write `<nx-*>` tags: every
 * `text/html` response is piped through `renderHTML()`, everything else
 * (assets, JSON, redirects, form posts) passes through untouched.
 */
import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { renderHTML, type RenderHTMLOptions } from '@/ssr/index';

export interface ProxyOptions extends Omit<RenderHTMLOptions, 'theme'> {
  /** Origin of the app to render, e.g. `http://127.0.0.1:8000` */
  upstream: string;
  /** Pick the theme per request (default: the `nx-theme` cookie the client sets) */
  theme?: (request: IncomingMessage) => string | undefined;
}

// Hop-by-hop headers are per connection; length changes after rendering
const DROP_REQUEST = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'accept-encoding']);
const DROP_RESPONSE = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-length']);

export function themeFromCookie(request: IncomingMessage): string | undefined {
  const match = /(?:^|;\s*)nx-theme=([^;]+)/.exec(request.headers.cookie ?? '');
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** A request handler for `http.createServer()` (or any Node framework). */
export function proxyHandler(options: ProxyOptions): (req: IncomingMessage, res: ServerResponse) => void {
  const upstream = new URL(options.upstream);
  const send = upstream.protocol === 'https:' ? httpsRequest : httpRequest;
  const pickTheme = options.theme ?? themeFromCookie;

  return (req, res) => {
    const headers: Record<string, string | string[]> = {};
    Object.entries(req.headers).forEach(([name, value]) => {
      if (value !== undefined && !DROP_REQUEST.has(name)) headers[name] = value;
    });
    headers.host = upstream.host;
    headers['x-forwarded-host'] ??= req.headers.host ?? '';
    // Uncompressed, so HTML can be rendered
    headers['accept-encoding'] = 'identity';

    const outgoing = send(new URL(req.url ?? '/', upstream), { method: req.method, headers }, upstreamRes => {
      const status = upstreamRes.statusCode ?? 502;
      const responseHeaders = { ...upstreamRes.headers };
      const isHTML = /^text\/html/i.test(String(upstreamRes.headers['content-type'] ?? ''));
      const encoded = !!upstreamRes.headers['content-encoding'] && upstreamRes.headers['content-encoding'] !== 'identity';

      if (!isHTML || encoded || req.method === 'HEAD') {
        res.writeHead(status, responseHeaders);
        upstreamRes.pipe(res);
        return;
      }

      const chunks: Buffer[] = [];
      upstreamRes.on('data', chunk => chunks.push(chunk));
      upstreamRes.on('end', async () => {
        const source = Buffer.concat(chunks).toString('utf8');
        let body: string;
        try {
          body = await renderHTML(source, { ...options, theme: pickTheme(req) });
        } catch (error) {
          // Never break the page: serve it unrendered (the browser still upgrades it)
          console.error('[nx/ssr] render failed, serving the original HTML:', error);
          body = source;
        }
        Object.keys(responseHeaders).forEach(name => DROP_RESPONSE.has(name) && delete responseHeaders[name]);
        responseHeaders['content-length'] = String(Buffer.byteLength(body));
        res.writeHead(status, responseHeaders);
        res.end(body);
      });
    });

    outgoing.on('error', error => {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end(`[nx/ssr] upstream ${upstream.origin} unreachable: ${error.message}`);
    });
    req.pipe(outgoing);
  };
}

/** Start the proxy: `createProxy({ upstream: 'http://127.0.0.1:8000' }).listen(3000)`. */
export function createProxy(options: ProxyOptions): Server {
  return createServer(proxyHandler(options));
}
