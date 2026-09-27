/**
 * @file @/core/dom-utils.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * Helpers shared by components, configs and the JSX runtime. This module must
 * not touch the DOM when it loads: the JSX runtime imports it, and the
 * compiler puts that import first in every .tsx file — before a server has
 * had a chance to install its DOM (see nx.js/ssr).
 */

/** Brand on Nexaro components (checked instead of `instanceof BaseComponent`). */
export const NX_COMPONENT = Symbol.for('nx.component');

/** Late-bound hooks, filled in by modules that do need the DOM. */
export const hooks: {
  appendItems?: (container: HTMLElement, items: any[]) => void;
} = {};

/**
 * `pageSize` → `page-size`. Already-kebab names pass through unchanged.
 */
export function toKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Native event names, read from the platform (`onkeydown` → `keydown`, `ontimeupdate`, …).
 * `selectionchange` is excluded: `onSelectionChange` means the grid's `selection-change`.
 */
let nativeEvents: Set<string> | null = null;

// Computed on first use: this module must load without a DOM (server rendering)
const NATIVE_EVENTS = (): Set<string> => nativeEvents ??= (() => {
  const names = new Set<string>();
  const collect = (obj: object | null) => {
    for (let o = obj; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
      Object.getOwnPropertyNames(o).forEach(k => k.startsWith('on') && names.add(k.slice(2)));
    }
  };
  if (typeof HTMLElement !== 'undefined') collect(HTMLElement.prototype);
  if (typeof Document !== 'undefined') collect(Document.prototype);
  if (typeof window !== 'undefined') collect(window);
  // Common events some engines don't expose as on* properties
  ['focusin', 'focusout', 'dblclick', 'beforeinput', 'compositionstart', 'compositionend', 'compositionupdate']
    .forEach(n => names.add(n));
  names.delete('selectionchange');
  return names;
})();

/**
 * Event name for an `onXxx` prop, shared by configs and JSX:
 * native events are lowercased (`onKeyDown` → `keydown`, `onTimeUpdate` → `timeupdate`),
 * everything else is kebab-cased (`onTabChange` → `tab-change`, `onRowClick` → `row-click`).
 */
export function eventName(prop: string): string {
  const name = prop.replace(/^on/, '');
  const lower = name.toLowerCase();
  return NATIVE_EVENTS().has(lower) ? lower : toKebab(name);
}

const UNITLESS = /^(flex|flexGrow|flexShrink|opacity|zIndex|order|fontWeight|lineHeight|zoom|gridRow|gridColumn|columnCount|scale)$/;

/**
 * Apply a style string or object to an element: camelCase properties
 * (numbers get `px` where it makes sense) and `--custom-properties`.
 * Shared by configs and the JSX runtime.
 */
export function applyStyle(el: HTMLElement | SVGElement, value: unknown, replace = false): void {
  if (typeof value === 'string') {
    if (replace) el.setAttribute('style', value);
    else el.style.cssText += `;${value}`;
  } else if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (key.startsWith('--')) el.style.setProperty(key, String(v));
      else (el.style as any)[key] = typeof v === 'number' && !UNITLESS.test(key) ? `${v}px` : String(v);
    });
  }
}

/** Config keys that live on the host or in light DOM (serialized as markup, not config). */
export const HOST_KEYS = new Set(['xtype', 'items', 'id', 'cls', 'className', 'style', 'flex', 'hidden', 'region', 'html', 'listeners', 'handler']);

/** camelCase DOM props whose attribute isn't the kebab-case of the name. */
export const ATTRIBUTE_NAMES: Record<string, string> = {
  tabIndex: 'tabindex',
  htmlFor: 'for',
  readOnly: 'readonly',
  maxLength: 'maxlength',
  minLength: 'minlength',
  autoComplete: 'autocomplete',
  autoFocus: 'autofocus',
  spellCheck: 'spellcheck',
  contentEditable: 'contenteditable',
  accessKey: 'accesskey',
  inputMode: 'inputmode',
  enterKeyHint: 'enterkeyhint'
};

/**
 * Escape a value for safe interpolation into a template string.
 */
export function escapeHTML(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

