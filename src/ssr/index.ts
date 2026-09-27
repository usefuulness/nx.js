/**
 * @file @/ssr/index.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * `nx.js/ssr` — render Nexaro components to HTML in Node (SSG, SSR).
 *
 * The real components run on a server DOM (happy-dom, an optional dependency)
 * and are written out with Declarative Shadow DOM, so pages are fully rendered
 * and themed before JavaScript loads; in the browser the elements upgrade in place.
 *
 * ```ts
 * import { renderToString, stylesheet } from 'nx.js/ssr';   // import this FIRST
 * import { Page } from './page';                             // then your JSX
 *
 * const body = await renderToString(<Page />);
 * ```
 *
 * For any other template engine (Twig, Blade, Jinja, ERB, Handlebars…), pipe its
 * HTML through `renderHTML()` — at build time or as middleware — to pre-render
 * every `<nx-*>` tag it contains.
 */
import { serverWindow, settle } from '@/ssr/dom';
import { openTag, serializeNode, type SerializeContext } from '@/ssr/serialize';
import { ComponentRegistry, ThemeManager, type ComponentConfig } from '@/index';

export { settle };

export interface RenderOptions {
  /** Called with config that couldn't be serialized for hydration (functions) */
  onDropped?: (paths: string[]) => void;
}

export interface RenderHTMLOptions extends RenderOptions {
  /** Add `<style id="nx-styles">` with the full stylesheet to <head> (full documents only). Default true */
  injectStyles?: boolean;
  /** Set `<html data-theme>` so the page renders in this theme */
  theme?: string;
}

type Renderable = Node | ComponentConfig | Array<Node | ComponentConfig> | (() => Node | ComponentConfig);

function report(ctx: SerializeContext, options: RenderOptions): void {
  if (!ctx.dropped.length) return;
  const unique = [...new Set(ctx.dropped)];
  if (options.onDropped) options.onDropped(unique);
  else {
    console.warn(
      `[nx/ssr] Not serializable for hydration (functions): ${unique.join(', ')}.\n` +
      '  The HTML is complete, but these must be attached again in the browser ' +
      '(hydrate the same JSX, or listen for events such as "select").'
    );
  }
}

/**
 * Render a JSX node, a component config (or a list, or a function returning
 * one) to HTML.
 */
export async function renderToString(input: Renderable, options: RenderOptions = {}): Promise<string> {
  const value = typeof input === 'function' ? input() : input;
  const nodes = (Array.isArray(value) ? value : [value])
    .map(item => (item instanceof Node ? item : ComponentRegistry.build(item)))
    .filter((node): node is HTMLElement => !!node);

  const container = document.createElement('div');
  document.body.appendChild(container);
  try {
    container.append(...nodes);
    await settle();
    const ctx: SerializeContext = { dropped: [] };
    const html = Array.from(container.childNodes).map(node => serializeNode(node, ctx)).join('');
    report(ctx, options);
    return html;
  } finally {
    container.remove();
  }
}

/**
 * Pre-render every Nexaro tag inside an HTML string — a fragment or a full
 * document — produced by any template engine.
 */
export async function renderHTML(html: string, options: RenderHTMLOptions = {}): Promise<string> {
  const isDocument = /<html[\s>]/i.test(html);
  const ctx: SerializeContext = { dropped: [] };

  if (!isDocument) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      container.innerHTML = html;
      await settle();
      const out = Array.from(container.childNodes).map(node => serializeNode(node, ctx)).join('');
      report(ctx, options);
      return out;
    } finally {
      container.remove();
    }
  }

  // Full document: keep head and <html>/<body> attributes, render the body
  const parsed = new serverWindow.DOMParser().parseFromString(html, 'text/html') as unknown as Document;
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html)?.[0] ?? '<!doctype html>';
  const htmlEl = parsed.documentElement;
  if (options.theme) htmlEl.setAttribute('data-theme', options.theme);

  const container = document.createElement('div');
  document.body.appendChild(container);
  try {
    // Moving the body into the live document upgrades its custom elements
    container.append(...Array.from(parsed.body.childNodes).map(node => document.adoptNode(node)));
    await settle();

    const head = parsed.head;
    if (options.injectStyles !== false && !head.querySelector('#nx-styles')) {
      const style = parsed.createElement('style');
      style.id = 'nx-styles';
      style.textContent = stylesheet();
      head.prepend(style);
    }

    const body = Array.from(container.childNodes).map(node => serializeNode(node, ctx)).join('');
    const out = `${doctype}\n${openTag(htmlEl)}${serializeNode(head, ctx)}${openTag(parsed.body)}${body}</body></html>`;
    report(ctx, options);
    return out;
  } finally {
    container.remove();
  }
}

/**
 * The complete stylesheet (base styles + every theme). Serve it as a file or
 * inline it in <head>: `<style>${stylesheet()}</style>`.
 */
export function stylesheet(options: { hideUndefined?: boolean } = {}): string {
  return ThemeManager.stylesheet(options);
}
