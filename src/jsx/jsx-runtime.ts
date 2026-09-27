/**
 * @file @/jsx/jsx-runtime.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * A tiny JSX runtime that creates real DOM nodes — no virtual DOM, no React.
 * Configure TypeScript with `"jsx": "react-jsx"` and `"jsxImportSource": "nx.js"`
 * (inside this repo: `"@/jsx"`), then write components like HTML:
 *
 * ```tsx
 * const el = (
 *   <Card title="Welcome">
 *     <p class="muted">Hello!</p>
 *     <Button variant="outline" onClick={() => NX.toast('Hi')}>Say hi</Button>
 *   </Card>
 * );
 * document.body.append(el);
 * ```
 *
 * Rules:
 * - Lowercase tags are plain elements. `class` / `className` accept strings,
 *   arrays and `{ name: condition }` objects; `style` takes a string or an object
 *   (camelCase or `--custom-props`); `onClick` & co. add listeners; everything
 *   else is set as a property when the element has one, otherwise as an attribute.
 * - `<nx-*>` tags and PascalCase wrappers go through the component's `configure()`,
 *   so JSX props and `{ xtype }` configs behave exactly the same.
 * - Function components are plain functions `(props) => JSX`.
 * - `ref={el => …}` or `ref={{ current: null }}` gives you the element.
 */
import { BaseComponent, applyStyle, eventName } from '@/components/abstracts/base';
import { ComponentRegistry } from '@/core/registry';

export type Child = Node | string | number | bigint | boolean | null | undefined | Child[];
export type ClassValue = string | number | null | undefined | false | ClassValue[] | Record<string, unknown>;
export type Ref<T> = ((el: T) => void) | { current: T | null };
export type Component<P = any> = (props: P) => Node;

export const Fragment = Symbol.for('nx.fragment');

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g', 'defs', 'use',
  'symbol', 'text', 'tspan', 'clipPath', 'mask', 'pattern', 'linearGradient', 'radialGradient',
  'stop', 'marker', 'foreignObject', 'title', 'desc', 'image', 'filter', 'feGaussianBlur', 'feOffset',
  'feBlend', 'feColorMatrix', 'feMerge', 'feMergeNode', 'animate', 'animateTransform'
]);

/** Props that never become attributes/properties. */
const RESERVED = new Set(['children', 'ref', 'key', '__self', '__source']);

/** Always set these as attributes (a property would do the wrong thing). */
const ATTRIBUTE_ONLY = new Set(['list', 'form', 'type', 'width', 'height', 'href', 'download', 'role', 'slot', 'for', 'is', 'popover']);

/**
 * Join class names: `cn('a', cond && 'b', ['c'], { d: isActive })`.
 */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  const walk = (value: ClassValue): void => {
    if (!value && value !== 0) return;
    if (Array.isArray(value)) value.forEach(walk);
    else if (typeof value === 'object') Object.entries(value).forEach(([k, on]) => on && out.push(k));
    else out.push(String(value));
  };
  values.forEach(walk);
  return out.join(' ');
}

function appendChildren(parent: Node, children: Child): void {
  if (children === null || children === undefined || children === false || children === true) return;
  if (Array.isArray(children)) {
    children.forEach(child => appendChildren(parent, child));
  } else if (children instanceof Node) {
    parent.appendChild(children);
  } else {
    parent.appendChild(document.createTextNode(String(children)));
  }
}

function setRef<T>(ref: Ref<T> | undefined, el: T): void {
  if (!ref) return;
  if (typeof ref === 'function') ref(el);
  else ref.current = el;
}

/** Apply props to a plain (non-Nexaro) element. */
function applyDomProps(el: HTMLElement | SVGElement, props: Record<string, any>, svg: boolean): void {
  for (const [key, value] of Object.entries(props)) {
    if (RESERVED.has(key)) continue;

    if (key === 'class' || key === 'className') {
      const cls = cn(value);
      if (cls) el.setAttribute('class', cls);
      continue;
    }
    if (key === 'style') {
      applyStyle(el, value, true);
      continue;
    }
    if (key === 'html' || key === 'dangerouslySetInnerHTML') {
      el.innerHTML = key === 'html' ? String(value ?? '') : value?.__html ?? '';
      continue;
    }
    if (/^on[A-Z]/.test(key) && typeof value === 'function') {
      // onClick → click, onKeyDown → keydown, onTabChange → tab-change
      el.addEventListener(eventName(key), value);
      continue;
    }

    const name = key === 'htmlFor' ? 'for' : key;
    // undefined / null mean "not set" (like React). Assigning '' instead would e.g.
    // turn pattern={undefined} into an empty pattern that rejects every value.
    if (value === undefined || value === null) {
      el.removeAttribute(name);
      continue;
    }
    if (!svg && !ATTRIBUTE_ONLY.has(name) && !name.includes('-') && name in el) {
      try {
        (el as any)[name] = value;
        continue;
      } catch {
        // read-only property: fall through to the attribute
      }
    }
    if (value === false) el.removeAttribute(name);
    else el.setAttribute(name, value === true ? '' : String(value));
  }
}

/** Apply props to a Nexaro component (same semantics as `{ xtype }` configs). */
function applyComponentProps(el: BaseComponent, props: Record<string, any>): void {
  const config: Record<string, any> = {};
  for (const [key, value] of Object.entries(props)) {
    if (RESERVED.has(key) || key === 'items') continue;
    if (key === 'class' || key === 'className') config.cls = cn(value);
    else config[key] = value;
  }
  el.configure(config);
  if (Array.isArray(props.items)) ComponentRegistry.appendItems(el, props.items);
}

function create(type: any, props: Record<string, any>): Node {
  const { children, ref } = props;

  if (type === Fragment) {
    const fragment = document.createDocumentFragment();
    appendChildren(fragment, children);
    return fragment;
  }

  // Function component
  if (typeof type === 'function' && !(type.prototype instanceof HTMLElement)) {
    const node = type(props);
    return node ?? document.createComment('');
  }

  // Custom element class used as a tag: <NXButton />
  let el: Element;
  if (typeof type === 'function') {
    el = new type();
  } else {
    const tag = String(type);
    el = SVG_TAGS.has(tag) ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  }

  if (el instanceof BaseComponent) {
    applyComponentProps(el, props);
  } else {
    applyDomProps(el as HTMLElement, props, el.namespaceURI === SVG_NS);
  }

  appendChildren(el, children);
  setRef(ref, el);
  return el;
}

export function jsx(type: any, props: Record<string, any> | null, key?: unknown): any {
  void key;
  return create(type, props ?? {});
}

export const jsxs = jsx;
export const jsxDEV = jsx;

/**
 * Classic-runtime factory, for `/** @jsx h *\/` or `React.createElement`-style code.
 */
export function h(type: any, props: Record<string, any> | null, ...children: Child[]): any {
  return create(type, { ...(props ?? {}), children: children.length <= 1 ? children[0] : children });
}

// ────────── Types ──────────

/** React-cased DOM event props → event types. */
interface DOMEvents {
  onClick: MouseEvent; onDblClick: MouseEvent; onContextMenu: MouseEvent; onAuxClick: MouseEvent;
  onMouseDown: MouseEvent; onMouseUp: MouseEvent; onMouseMove: MouseEvent; onMouseEnter: MouseEvent;
  onMouseLeave: MouseEvent; onMouseOver: MouseEvent; onMouseOut: MouseEvent;
  onPointerDown: PointerEvent; onPointerUp: PointerEvent; onPointerMove: PointerEvent; onPointerEnter: PointerEvent;
  onPointerLeave: PointerEvent; onPointerOver: PointerEvent; onPointerOut: PointerEvent; onPointerCancel: PointerEvent;
  onTouchStart: TouchEvent; onTouchEnd: TouchEvent; onTouchMove: TouchEvent; onTouchCancel: TouchEvent;
  onKeyDown: KeyboardEvent; onKeyUp: KeyboardEvent; onKeyPress: KeyboardEvent;
  onFocus: FocusEvent; onBlur: FocusEvent; onFocusIn: FocusEvent; onFocusOut: FocusEvent;
  onInput: Event; onBeforeInput: InputEvent; onChange: Event; onSubmit: SubmitEvent; onReset: Event; onInvalid: Event;
  onSelect: Event; onScroll: Event; onWheel: WheelEvent;
  onDrag: DragEvent; onDragStart: DragEvent; onDragEnd: DragEvent; onDragEnter: DragEvent;
  onDragLeave: DragEvent; onDragOver: DragEvent; onDrop: DragEvent;
  onCopy: ClipboardEvent; onCut: ClipboardEvent; onPaste: ClipboardEvent;
  onAnimationStart: AnimationEvent; onAnimationEnd: AnimationEvent; onAnimationIteration: AnimationEvent;
  onTransitionEnd: TransitionEvent; onTransitionStart: TransitionEvent;
  onLoad: Event; onError: Event; onToggle: Event;
}

type EventHandlers = { [K in keyof DOMEvents]?: (event: DOMEvents[K]) => void };

/** Anything else: data-*, aria-*, custom attributes, component events (onTabChange, onRowClick…). */
export interface LooseProps {
  [handler: `on${string}`]: ((event: any) => void) | undefined;
  [attribute: string]: any;
}

/** Inline styles: camelCase properties (numbers get `px` where it makes sense) and `--custom-props`. */
export type StyleObject = {
  [K in keyof CSSStyleDeclaration as CSSStyleDeclaration[K] extends string ? K : never]?: string | number | null | false;
} & { [custom: `--${string}`]: string | number | null | undefined };

/** Props accepted by every element. Unknown props are allowed (data-*, aria-*, custom attributes). */
/** Known props of every element (no index signatures, so `Omit<>` works on it). */
export type KnownProps<T = HTMLElement> = EventHandlers & BasePropsCore<T>;

/** Props accepted by every element. Unknown props are allowed (data-*, aria-*, custom attributes). */
export type BaseProps<T = HTMLElement> = KnownProps<T> & LooseProps;

interface BasePropsCore<T> {
  children?: Child;
  ref?: Ref<T>;
  key?: string | number;
  class?: ClassValue;
  className?: ClassValue;
  style?: string | StyleObject;
  id?: string;
  slot?: string;
  title?: string;
  hidden?: boolean;
  tabIndex?: number;
  role?: string;
  /** Set innerHTML (you own the escaping) */
  html?: string;
}

/** Writable-ish primitive properties of an element (value, checked, placeholder, …) for autocomplete. */
type PrimitiveProps<T> = {
  [K in keyof T as K extends keyof KnownProps | `on${string}` | 'style' | 'className' ? never : T[K] extends string | number | boolean | null | undefined ? K : never]?: T[K];
};

export type ElementProps<T extends Element> = BaseProps<T> & PrimitiveProps<T>;

export namespace JSX {
  export type Element = any;
  export interface ElementChildrenAttribute {
    children: {};
  }
  export interface IntrinsicAttributes {
    key?: string | number;
  }
  export type IntrinsicElements = {
    [K in keyof HTMLElementTagNameMap]: ElementProps<HTMLElementTagNameMap[K]>;
  } & {
    [K in Exclude<keyof SVGElementTagNameMap, keyof HTMLElementTagNameMap>]: BaseProps<SVGElementTagNameMap[K]>;
  } & NexaroElements & {
    [tag: `${string}-${string}`]: BaseProps;
  };
}

/**
 * Typed `<nx-*>` tags. Extended via declaration merging in `@/jsx/components`.
 */
export interface NexaroElements {}
