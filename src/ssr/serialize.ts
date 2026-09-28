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
 *
 * Form controls also get native stand-ins in the light DOM (see NativeStandIn),
 * so forms can be filled in and posted before JavaScript loads.
 */
import { NATIVE_ATTR, type NativeStandIn } from '@/core/dom-utils';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['script', 'style']);

export interface SerializeContext {
  /** Config paths that were functions and could not be serialized (per tag) */
  dropped: string[];
  /** Shadow elements written as a `<slot>` for their stand-in (replace), or followed by one (overlay) */
  standIns?: Map<Element, { slot: string; mode: 'replace' | 'overlay' }>;
  /** `<nx-form action>` → id of the hidden native form its stand-ins post with */
  forms?: Map<Element, string>;
  formSeq?: number;
}

/** Shadow-only attributes a stand-in must not carry. */
const STAND_IN_DROP = ['id', 'class', 'part', 'style', 'tabindex', 'role', 'aria-describedby', 'aria-controls',
  'aria-activedescendant', 'aria-expanded', 'aria-autocomplete', 'aria-haspopup', 'aria-invalid'];

const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function attributes(el: Element, extra: Record<string, string | true | null> = {}): string {
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

  Object.entries(extra).forEach(([k, v]) => (v === null ? attrs.delete(k) : attrs.set(k, v)));
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

export function serializeNode(node: Node, ctx: SerializeContext, overrides: Record<string, string | true | null> = {}): string {
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

  // A shadow control with a native stand-in in the light DOM
  const standIn = ctx.standIns?.get(el);
  if (standIn) {
    const slot = `<slot name="${standIn.slot}"></slot>`;
    if (standIn.mode === 'replace') return slot;
    ctx.standIns!.delete(el);
    // Overlay: keep the original visible, but out of the tab order and the a11y tree until upgrade
    return serializeNode(el, ctx, { tabindex: '-1', 'aria-hidden': 'true' }) + slot;
  }

  const root = (el as HTMLElement).shadowRoot;
  const extra: Record<string, string | true | null> = { ...overrides };
  let prefix = '';

  // <nx-form action>: a hidden native form its stand-ins post with (via form="…")
  if (tag === 'nx-form' && el.hasAttribute('action')) {
    const id = `nx-form-${(ctx.formSeq = (ctx.formSeq ?? 0) + 1)}`;
    (ctx.forms ??= new Map()).set(el, id);
    const formAttrs = ['action', 'method', 'enctype', 'target']
      .filter(name => el.hasAttribute(name))
      .map(name => ` ${name}="${escapeAttr(el.getAttribute(name)!)}"`).join('');
    prefix += `<form id="${id}"${formAttrs} hidden ${NATIVE_ATTR}></form>`;
  }

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
    // Native stand-ins: slots in the shadow, the real controls in the light DOM
    const standIns: NativeStandIn[] = typeof (el as any).nativeStandIns === 'function' ? (el as any).nativeStandIns() : [];
    standIns.forEach((s, i) => (ctx.standIns ??= new Map()).set(s.original, { slot: `nx-native-${i}`, mode: s.mode ?? 'replace' }));
    const shadow = children(root as unknown as Node, ctx);
    const formOwner = el.closest('nx-form[action]');
    const formId = formOwner ? ctx.forms?.get(formOwner) : undefined;
    const natives = standIns.map((s, i) => {
      ctx.standIns?.delete(s.original);
      const target = s.fallback ?? s.original;
      const drop = Object.fromEntries(STAND_IN_DROP.filter(name => !(name in (s.attrs ?? {}))).map(name => [name, null]));
      return serializeNode(target, ctx, { ...drop, slot: `nx-native-${i}`, [NATIVE_ATTR]: true, ...(formId ? { form: formId } : {}), ...s.attrs });
    }).join('');
    prefix = `<template shadowrootmode="${root.mode}"${delegates}>${shadow}</template>` + natives + prefix;
  }

  const open = `<${tag}${attributes(el, extra)}>`;
  if (VOID.has(tag)) return open;
  const inner = tag === 'textarea' ? escapeText((el as HTMLTextAreaElement).value) : children(el, ctx);
  return `${open}${prefix}${inner}</${tag}>`;
}
