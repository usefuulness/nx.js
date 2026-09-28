/**
 * @file @/jsx/hydrate.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * Make server-rendered JSX interactive with the same JSX: `hydrate(() => <Page />)`.
 *
 * The tree is built again (detached) and walked side by side with the server
 * DOM. The server elements are kept — nothing is re-created or re-painted —
 * and receive what HTML can't carry: event listeners, refs, and component
 * props that are functions (handlers, formatters, `items` with handlers).
 * Where the two trees differ, that subtree is replaced and a warning explains why.
 */
import { GENERATED, NX_COMPONENT, bindings, hooks } from '@/core/dom-utils';

type View = Node | (() => Node);

export interface HydrateOptions {
  /** Called for each subtree that didn't match and was re-created */
  onMismatch?: (server: Element, client: Element) => void;
}

/** Element children that JSX produced (skipping what the server or components generated). */
function elements(parent: ParentNode): Element[] {
  return Array.from(parent.children).filter(el => !el.matches(GENERATED));
}

function adopt(client: Element, server: Element, options: HydrateOptions): void {
  if (client.localName !== server.localName) {
    if (options.onMismatch) options.onMismatch(server, client);
    else console.warn(`[nx] hydrate: expected <${client.localName}>, found <${server.localName}> — re-rendering it.`, server);
    server.replaceWith(client);
    return;
  }

  const bound = bindings.get(client);
  bound?.listeners.forEach(([type, listener]) => server.addEventListener(type, listener));
  if (bound?.ref) {
    const ref = bound.ref as ((el: Element) => void) | { current: Element | null };
    if (typeof ref === 'function') ref(server);
    else ref.current = server;
  }

  if ((client as any)[NX_COMPONENT] && (server as any)[NX_COMPONENT]) {
    const { items, ...live } = (client as any).liveConfig() as Record<string, unknown>;
    if (Object.keys(live).length) (server as any).configure(live);
    if (Array.isArray(items)) hooks.appendItems?.(server as HTMLElement, items);
  }

  const clientChildren = elements(client);
  const serverChildren = elements(server);
  clientChildren.forEach((child, i) => {
    const match = serverChildren[i];
    if (match) adopt(child, match, options);
    else server.appendChild(child);
  });
}

/**
 * Attach a JSX view to the server-rendered HTML in `container` (default
 * `document.body`). Call it after importing `nx.js`, with the same JSX the
 * server rendered.
 *
 * ```tsx
 * import { hydrate } from 'nx.js';
 * import { Page } from './page';
 * hydrate(() => <Page />);
 * ```
 */
export function hydrate(view: View, container: Element = document.body, options: HydrateOptions = {}): void {
  const node = typeof view === 'function' ? view() : view;
  const client = node instanceof DocumentFragment ? elements(node) : node instanceof Element ? [node] : [];
  const server = elements(container);
  if (client.length !== server.length) {
    console.warn(`[nx] hydrate: the view has ${client.length} top-level element(s), the container ${server.length}.`);
  }
  client.forEach((el, i) => {
    if (server[i]) adopt(el, server[i], options);
    else container.appendChild(el);
  });
}
