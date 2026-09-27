/**
 * @file @/ssr/serialize.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * DOM → HTML with Declarative Shadow DOM: every shadow root is written as
 * `<template shadowrootmode="open">`, so browsers render components before any
 * JavaScript runs. Nexaro components also get an `nx-ssr` attribute and, when
 * they hold rich config (data, columns, items…), a
 * `<script type="application/json" data-nx-config>` child that restores it
 * when the element upgrades in the browser.
 */

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['script', 'style']);

export interface SerializeContext {
  /** Config paths that were functions and could not be serialized (per tag) */
  dropped: string[];
}

const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function attributes(el: Element, extra: Record<string, string | true> = {}): string {
  const attrs = new Map<string, string | true>();
  Array.from(el.attributes).forEach(a => attrs.set(a.name, a.value));

  // Form controls: the *current* state lives in properties, not attributes
  const tag = el.localName;
  if (tag === 'input') {
    const input = el as HTMLInputElement;
    if (input.type === 'checkbox' || input.type === 'radio') {
      if (input.checked) attrs.set('checked', true);
      else attrs.delete('checked');
    } else if (input.value !== '' && input.type !== 'password') {
      attrs.set('value', input.value);
    }
  } else if (tag === 'option') {
    if ((el as HTMLOptionElement).selected) attrs.set('selected', true);
    else attrs.delete('selected');
  }

  Object.entries(extra).forEach(([k, v]) => attrs.set(k, v));
  return Array.from(attrs).map(([name, value]) => (value === true || value === '' ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`)).join('');
}

function children(node: Node, ctx: SerializeContext): string {
  const list = node instanceof HTMLTemplateElement ? node.content.childNodes : node.childNodes;
  return Array.from(list).map(child => serializeNode(child, ctx)).join('');
}

/** `<tag attr="…">` for an element (no children). */
export function openTag(el: Element): string {
  return `<${el.localName}${attributes(el)}>`;
}

export function serializeNode(node: Node, ctx: SerializeContext): string {
  switch (node.nodeType) {
    case Node.TEXT_NODE: {
      const parent = node.parentNode as Element | null;
      return parent && RAW_TEXT.has(parent.localName) ? node.textContent ?? '' : escapeText(node.textContent ?? '');
    }
    case Node.COMMENT_NODE:
      return `<!--${node.textContent ?? ''}-->`;
    case Node.DOCUMENT_FRAGMENT_NODE:
      return children(node, ctx);
    case Node.ELEMENT_NODE:
      break;
    default:
      return '';
  }

  const el = node as Element;
  const tag = el.localName;
  const root = (el as HTMLElement).shadowRoot;
  const extra: Record<string, string | true> = {};
  let prefix = '';

  // Server-rendered custom elements (with or without a shadow root) stay visible before they upgrade
  if (root || (tag.includes('-') && customElements.get(tag))) extra['nx-ssr'] = true;

  if (root) {
    const serializeConfig = (el as any).serializeConfig as undefined | (() => { json: string | null; dropped: string[] });
    if (typeof serializeConfig === 'function') {
      const { json, dropped } = serializeConfig.call(el);
      if (json) prefix += `<script type="application/json" data-nx-config>${json}</script>`;
      dropped.forEach(path => ctx.dropped.push(`<${tag}>.${path}`));
    }
    // Components remember their attachShadow() options (server DOMs may not expose them)
    const init = (el as { shadowInit?: ShadowRootInit | null }).shadowInit;
    const delegates = (init?.delegatesFocus ?? (root as ShadowRoot).delegatesFocus) ? ' shadowrootdelegatesfocus' : '';
    prefix = `<template shadowrootmode="${root.mode}"${delegates}>${children(root as unknown as Node, ctx)}</template>` + prefix;
  }

  const open = `<${tag}${attributes(el, extra)}>`;
  if (VOID.has(tag)) return open;
  const inner = tag === 'textarea' ? escapeText((el as HTMLTextAreaElement).value) : children(el, ctx);
  return `${open}${prefix}${inner}</${tag}>`;
}
