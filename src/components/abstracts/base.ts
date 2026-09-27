/**
 * @file @/components/abstracts/base.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

/**
 * Symbol for accessing component's internal state management.
 * @internal
 */
export const ComponentState = Symbol('ComponentState');

/**
 * Symbol for accessing component's property definitions.
 * @internal
 */
export const ComponentProps = Symbol('ComponentProps');

import '@/core/require-dom';
import { ATTRIBUTE_NAMES, HOST_KEYS, NX_COMPONENT, applyStyle, escapeHTML, eventName, toKebab } from '@/core/dom-utils';

export { applyStyle, escapeHTML, eventName, toKebab };

/**
 * Styles shared by every component's shadow root.
 * @internal
 */
const BASE_STYLES = `
  :host([hidden]) { display: none !important; }
  *, *::before, *::after { box-sizing: border-box; }
  button { font: inherit; color: inherit; }
  button:focus-visible, [tabindex]:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
    outline: 2px solid var(--color-ring);
    outline-offset: 2px;
  }
`;

/**
 * Component lifecycle interface defining standard Web Component lifecycle methods.
 */
export interface ComponentLifecycle {
  connectedCallback?(): void;
  disconnectedCallback?(): void;
  attributeChangedCallback?(name: string, oldValue: string | null, newValue: string | null): void;
  adoptedCallback?(): void;
}

/**
 * Type for state manager - using Map for efficient key-value storage.
 */
export type StateManager = Map<string, any>;

/**
 * Base configuration interface that all component configs should extend.
 */
export interface ComponentConfig {
  id?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  [key: string]: any;
}

/**
 * Abstract base class for all Nexaro components.
 * Provides core functionality including state management, lifecycle hooks,
 * property handling, and DOM utilities.
 * 
 * @abstract
 * @extends {HTMLElement}
 * @implements {ComponentLifecycle}
 * 
 * @example
 * ```typescript
 * class MyComponent extends BaseComponent {
 *   static get observedAttributes() {
 *     return ['value', 'disabled'];
 *   }
 *   
 *   protected initializeState(): void {
 *     this.setState('internalValue', '');
 *   }
 *   
 *   protected render() {
 *     return (
 *       <div class="my-component" onClick={() => this.setState('internalValue', 'clicked')}>
 *         {this.getProp('value', 'default')}
 *       </div>
 *     );
 *   }
 *   
 *   protected styles(): string {
 *     return `
 *       .my-component {
 *         padding: 1rem;
 *         background: var(--color-surface);
 *       }
 *     `;
 *   }
 * }
 * ```
 */
export abstract class BaseComponent extends HTMLElement implements ComponentLifecycle {
  /** Brand checked by the JSX runtime (which can't import this class) */
  declare readonly [NX_COMPONENT]: true;

  /** Options passed to attachShadow() — server rendering writes them back out */
  shadowInit: ShadowRootInit | null = null;

  attachShadow(init: ShadowRootInit): ShadowRoot {
    this.shadowInit = init;
    return super.attachShadow(init);
  }

  /**
   * Internal state management instance.
   * @private
   */
  protected [ComponentState]: StateManager;
  
  /**
   * Property definitions cache for non-attribute properties.
   * @private
   */
  protected [ComponentProps]: Map<string, any>;
  
  /**
   * Reference to the component's shadow DOM root.
   * Will be null if shadow DOM is not used.
   * @protected
   */
  protected shadow: ShadowRoot | null = null;

  /**
   * List of cleanup functions to be called on disconnect.
   * Used for removing event listeners, clearing timers, etc.
   * @private
   */
  private cleanupFunctions: Array<() => void> = [];

  /**
   * Cleanup functions registered while wiring up a render (inside afterRender).
   * They run before every re-render so listeners never pile up.
   * @private
   */
  private renderCleanupFunctions: Array<() => void> = [];

  /**
   * True while afterRender() runs; listeners added then are render-scoped.
   * @private
   */
  private inRenderPhase = false;

  /**
   * Flag indicating if the component has been initialized.
   * @private
   */
  private initialized = false;

  /**
   * Animation frame ID for scheduled updates.
   * @private
   */
  private updateFrameId = 0;

  /**
   * Creates a new component instance.
   * Initializes state and property management.
   */
  constructor() {
    super();
    
    // Initialize state and props
    this[ComponentState] = new Map();
    this[ComponentProps] = new Map();
    
    // Initialize component state
    this.initializeState();
  }

  /**
   * Called when the component is connected to the DOM.
   * Performs initialization and triggers initial render.
   */
  connectedCallback(): void {
    if (!this.initialized) {
      this.initialized = true;
      this.hydrateFromMarkup();
      this.initialize();
    } else if (this.shadow) {
      // Moved in the DOM: disconnect removed the listeners afterRender() set up
      this.forceUpdate();
    }

    this.afterConnect();
  }

  /**
   * Called when the component is disconnected from the DOM.
   * Performs cleanup to prevent memory leaks.
   */
  disconnectedCallback(): void {
    this.beforeDisconnect();
    
    // Cancel any pending updates
    if (this.updateFrameId) {
      cancelAnimationFrame(this.updateFrameId);
      this.updateFrameId = 0;
    }
    
    // Run cleanup functions
    this.runRenderCleanups();
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];
    
    // Custom cleanup
    this.cleanup();
  }

  /**
   * Called when an observed attribute changes.
   * Triggers component update if initialized.
   * 
   * @param {string} name - Name of the changed attribute
   * @param {string | null} oldValue - Previous value
   * @param {string | null} newValue - New value
   */
  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (_oldValue !== newValue) {
      this.onAttributeChange(name, _oldValue, newValue);
      if (this.initialized) {
        this.scheduleUpdate();
      }
    }
  }

  /**
   * Called when the component is moved to a new document.
   * Useful for handling components in iframes or when using document.adoptNode().
   */
  adoptedCallback(): void {
    this.onAdopted();
  }

  /**
   * Initialize component state.
   * Must be implemented by subclasses to set up initial state.
   * 
   * @protected
   * @abstract
   * 
   * @example
   * ```typescript
   * protected initializeState(): void {
   *   this.setState('isOpen', false);
   *   this.setState('items', []);
   * }
   * ```
   */
  protected abstract initializeState(): void;

  /**
   * Render the component's shadow DOM. Return JSX (the house style, see
   * CONTRIBUTING.md) or, for legacy code, an HTML string.
   *
   * @protected
   * @abstract
   *
   * @example
   * ```tsx
   * protected render() {
   *   return (
   *     <div class="container">
   *       <slot />
   *     </div>
   *   );
   * }
   * ```
   */
  protected abstract render(): string | Node;

  /**
   * Define component-specific styles.
   * Override in subclasses to provide custom styles.
   * 
   * @returns {string} CSS styles string
   * @protected
   * 
   * @example
   * ```typescript
   * protected styles(): string {
   *   return `
   *     :host {
   *       display: block;
   *       padding: 1rem;
   *     }
   *     
   *     .container {
   *       background: var(--bg-color);
   *     }
   *   `;
   * }
   * ```
   */
  protected styles(): string {
    return '';
  }

  /**
   * Initialize the component.
   * Called once when the component is first connected.
   * Sets up shadow DOM if needed and performs initial render.
   * 
   * @protected
   */
  protected initialize(): void {
    // Set up shadow DOM if attachShadow was called in constructor
    if (this.shadowRoot) {
      this.shadow = this.shadowRoot;
    }

    // Perform initial update if shadow DOM exists
    if (this.shadow) {
      this.forceUpdate();
    }
  }

  /**
   * Update the component's DOM.
   * Renders template and styles to shadow DOM.
   * 
   * @protected
   */
  protected update(): void {
    if (!this.shadow) return;

    // Listeners wired to the previous render's DOM are dead weight now
    this.runRenderCleanups();
    const focus = this.captureFocus();

    const template = this.render();
    const styles = this.styles();
    const css = styles ? `${BASE_STYLES}${styles}` : '';

    if (typeof template === 'string') {
      this.shadow.innerHTML = `
      ${css ? `<style>${css}</style>` : ''}
      ${template}
    `;
    } else {
      // JSX: real nodes with their own listeners
      const nodes: Node[] = [];
      if (css) {
        const style = document.createElement('style');
        style.textContent = css;
        nodes.push(style);
      }
      if (template) nodes.push(template);
      this.shadow.replaceChildren(...nodes);
    }

    this.restoreFocus(focus);

    this.inRenderPhase = true;
    try {
      this.afterRender();
    } finally {
      this.inRenderPhase = false;
    }
  }

  /** Remember which shadow element had focus (as a child-index path) and its caret. */
  private captureFocus(): { path: number[]; start: number | null; end: number | null } | null {
    const active = this.shadow?.activeElement;
    if (!active) return null;
    const path: number[] = [];
    let node: Element | null = active;
    while (node && node.parentNode && node.parentNode !== this.shadow) {
      path.unshift(Array.prototype.indexOf.call(node.parentNode.children, node));
      node = node.parentElement;
    }
    if (!node) return null;
    path.unshift(Array.prototype.indexOf.call(this.shadow!.children, node));
    const input = active as HTMLInputElement;
    let start: number | null = null;
    let end: number | null = null;
    try {
      start = input.selectionStart ?? null;
      end = input.selectionEnd ?? null;
    } catch {
      // not a text control
    }
    return { path, start, end };
  }

  private restoreFocus(focus: ReturnType<BaseComponent['captureFocus']>): void {
    if (!focus || !this.shadow) return;
    let node: Element | undefined = this.shadow.children[focus.path[0]];
    for (const index of focus.path.slice(1)) node = node?.children[index];
    if (!(node instanceof HTMLElement || node instanceof SVGElement)) return;
    node.focus({ preventScroll: true });
    if (focus.start !== null && 'setSelectionRange' in node) {
      try {
        (node as HTMLInputElement).setSelectionRange(focus.start, focus.end);
      } catch {
        // input type without selection support
      }
    }
  }

  private runRenderCleanups(): void {
    this.renderCleanupFunctions.forEach(cleanup => cleanup());
    this.renderCleanupFunctions = [];
  }

  /**
   * Schedule an update for the next animation frame.
   * Multiple calls are batched into a single update.
   * 
   * @protected
   */
  protected scheduleUpdate(): void {
    if (this.updateFrameId) return;
    
    this.updateFrameId = requestAnimationFrame(() => {
      this.updateFrameId = 0;
      this.update();
    });
  }

  /**
   * Force immediate update without scheduling.
   * Use sparingly as it bypasses update batching.
   * 
   * @protected
   */
  protected forceUpdate(): void {
    if (this.updateFrameId) {
      cancelAnimationFrame(this.updateFrameId);
      this.updateFrameId = 0;
    }
    this.update();
  }

  /**
   * Get a property value with optional default.
   * First checks attributes, then internal props.
   * 
   * @template T - Type of the property value
   * @param {string} name - Property name
   * @param {T} [defaultValue] - Default value if not found
   * @returns {T} Property value
   * @protected
   */
  protected getProp<T = any>(name: string, defaultValue?: T): T {
    // Check attribute first
    const attr = this.getAttribute(name);
    if (attr !== null) {
      // Bare boolean attribute: <nx-button disabled>
      if (attr === '') {
        // Bare boolean attribute (<nx-button disabled>) — only for boolean props;
        // an empty placeholder/name/icon stays ''
        return (typeof defaultValue === 'boolean' ? true : '') as any;
      }

      // Try to parse JSON for objects/arrays
      if (attr.startsWith('{') || attr.startsWith('[')) {
        try {
          return JSON.parse(attr);
        } catch {
          return attr as any;
        }
      }
      
      // Convert boolean strings
      if (attr === 'true') return true as any;
      if (attr === 'false') return false as any;
      
      // Convert numbers
      const num = Number(attr);
      if (!isNaN(num) && attr.trim() !== '') return num as any;
      
      return attr as any;
    }
    
    // Check internal props (stored kebab-cased, see configure())
    const key = toKebab(name);
    if (this[ComponentProps].has(key)) {
      return this[ComponentProps].get(key);
    }

    return defaultValue as T;
  }

  /**
   * Set a property value.
   * Stores in internal props map.
   * 
   * @param {string} name - Property name
   * @param {any} value - Property value
   * @protected
   */
  protected setProp(name: string, value: any): void {
    this[ComponentProps].set(toKebab(name), value);
    this.scheduleUpdate();
  }

  /**
   * Check if a property exists.
   * 
   * @param {string} name - Property name
   * @returns {boolean} True if property exists
   * @protected
   */
  protected hasProp(name: string): boolean {
    return this.hasAttribute(name) || this[ComponentProps].has(toKebab(name));
  }

  /**
   * Get all properties as a plain object.
   * Combines attributes and internal props.
   * 
   * @returns {Record<string, any>} All properties
   * @protected
   */
  protected getProps(): Record<string, any> {
    const props: Record<string, any> = {};
    
    // Get attributes
    Array.from(this.attributes).forEach(attr => {
      props[attr.name] = this.getProp(attr.name);
    });
    
    // Get internal props
    this[ComponentProps].forEach((value, key) => {
      if (!(key in props)) {
        props[key] = value;
      }
    });
    
    return props;
  }

  // ────────── Config API ──────────

  /**
   * Apply a config object to this component. This is what `NX.create()` and
   * the application builder use, and you can call it at runtime too.
   *
   * Rules, per key:
   * - `id`, `cls`/`className`, `style`, `flex`, `hidden`: applied to the host element
   * - `region`: sets both the `region` attribute and the slot (for border layouts)
   * - `listeners: { click: fn }`, `onClick: fn`, `onTabChange: fn` → event listeners
   *   (`onTabChange` listens to `tab-change`)
   * - `handler: fn` → click listener
   * - if the component has a `setXxx()` method, `xxx` is passed to it (e.g. `data` → `setData`)
   * - primitives become attributes (`pageSize: 10` → `page-size="10"`)
   * - objects/arrays/functions are kept as props (read them with `getProp()`)
   *
   * `xtype` and `items` are handled by the builder, not here.
   *
   * @example
   * ```typescript
   * button.configure({ text: 'Save', variant: 'primary', handler: () => save() });
   * ```
   */
  public configure(config: Record<string, any>): this {
    Object.entries(config).forEach(([key, value]) => {
      this.applyConfig(key, value);
      this.recordConfig(key, value);
    });
    this.scheduleUpdate();
    return this;
  }

  // ────────── Server rendering / hydration ──────────

  /** Config that isn't reflected in attributes or light DOM (rich props, setter data). */
  private configRecord: Record<string, unknown> = {};

  private recordConfig(key: string, value: unknown): void {
    if (HOST_KEYS.has(key)) return;
    const attr = ATTRIBUTE_NAMES[key] ?? toKebab(key);
    const primitive = value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value);
    if (value === undefined || (primitive && value !== false && this.hasAttribute(attr) && key !== 'title')) {
      delete this.configRecord[key];
    } else {
      this.configRecord[key] = value;
    }
  }

  /**
   * The config needed to recreate this component from its HTML, as JSON — used by
   * server rendering, which writes it into a `<script type="application/json" data-nx-config>`
   * child. Functions can't be serialized; their paths are reported in `dropped`.
   * @internal
   */
  serializeConfig(): { json: string | null; dropped: string[] } {
    const dropped: string[] = [];
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.configRecord)) {
      if (typeof value === 'function') {
        dropped.push(key);
        continue;
      }
      data[key] = value;
    }
    if (!Object.keys(data).length) return { json: null, dropped };
    const json = JSON.stringify(data, function (k: string, v: unknown) {
      if (typeof v === 'function') {
        dropped.push(k);
        return undefined;
      }
      return v;
    });
    // Safe inside <script>: no "</script>" or "<!--" can appear
    return { json: json.replace(/</g, '\\u003c'), dropped };
  }

  /**
   * Apply config carried in the HTML: a `<script type="application/json" data-nx-config>`
   * child (written by server rendering, or by hand in any template engine) and JSON
   * attributes for props that have a setter (`<nx-grid columns='[…]' data='[…]'>`).
   */
  private hydrateFromMarkup(): void {
    const script = this.querySelector(':scope > script[type="application/json"][data-nx-config]');
    if (script) {
      try {
        this.configure(JSON.parse(script.textContent || '{}'));
      } catch (error) {
        console.error(`[nx] Invalid JSON in <${this.localName}> data-nx-config`, error);
      }
      script.remove();
    }

    Array.from(this.attributes).forEach(({ name, value }) => {
      const trimmed = value.trim();
      if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return;
      const camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const setter = (this as any)[`set${camel.charAt(0).toUpperCase()}${camel.slice(1)}`];
      if (typeof setter !== 'function') return;
      try {
        setter.call(this, JSON.parse(trimmed));
      } catch {
        // not JSON after all: leave it to getProp()
      }
    });
  }

  /**
   * Set a single config value at runtime. Alias for `configure({ [key]: value })`.
   */
  public set(key: string, value: any): this {
    return this.configure({ [key]: value });
  }

  /**
   * Read a config value (attribute or prop).
   */
  public get<T = any>(key: string, defaultValue?: T): T {
    return this.getProp<T>(toKebab(key), defaultValue);
  }

  /**
   * Apply one config key. Override to special-case keys; call super for the rest.
   * @protected
   */
  protected applyConfig(key: string, value: any): void {
    switch (key) {
      case 'xtype':
      case 'items':
        return;
      case 'id':
        this.id = String(value);
        return;
      case 'cls':
      case 'className':
        this.classList.add(...String(value).split(/\s+/).filter(Boolean));
        return;
      case 'style':
        applyStyle(this, value);
        return;
      case 'flex':
        this.style.flex = String(value);
        return;
      case 'hidden':
        this.hidden = !!value;
        return;
      case 'title':
        // Kept as a prop: a `title` attribute would show a native tooltip over the whole component
        this.removeAttribute('title');
        this[ComponentProps].set('title', value);
        return;
      case 'html':
        // Light-DOM content, rendered into the default slot
        this.innerHTML = String(value ?? '');
        return;
      case 'region':
        this.setAttribute('region', value);
        this.slot = value;
        return;
      case 'listeners':
        Object.entries(value as Record<string, EventListener>).forEach(([event, fn]) => {
          this.addEventListener(event, fn);
        });
        return;
      case 'handler':
        if (typeof value === 'function') this.addEventListener('click', value);
        return;
    }

    // onSelect / onTabChange / onKeyDown → 'select' / 'tab-change' / 'keydown'
    if (typeof value === 'function' && /^on[A-Z]/.test(key)) {
      this.addEventListener(eventName(key), value);
      return;
    }

    // `undefined` means "not set": clear it instead of passing it to a setter
    if (value === undefined) {
      const attr = ATTRIBUTE_NAMES[key] ?? toKebab(key);
      this.removeAttribute(attr);
      this[ComponentProps].delete(attr);
      return;
    }

    // setData(), setColumns(), setTabs() ...
    const setter = (this as any)[`set${key.charAt(0).toUpperCase()}${key.slice(1)}`];
    if (typeof setter === 'function') {
      setter.call(this, value);
      return;
    }

    const attr = ATTRIBUTE_NAMES[key] ?? toKebab(key);
    if (value === null || value === undefined) {
      this.removeAttribute(attr);
      this[ComponentProps].delete(attr);
    } else if (value === true) {
      this[ComponentProps].delete(attr);
      this.setAttribute(attr, '');
    } else if (value === false) {
      // Keep an explicit `false` so it wins over a truthy default
      this.removeAttribute(attr);
      this[ComponentProps].set(attr, false);
    } else if (typeof value === 'string' || typeof value === 'number') {
      this[ComponentProps].delete(attr);
      this.setAttribute(attr, String(value));
    } else {
      this.removeAttribute(attr);
      this[ComponentProps].set(attr, value);
    }
  }

  /**
   * Query shadow DOM for an element.
   * 
   * @param {string} selector - CSS selector
   * @returns {Element | null} Found element or null
   * @protected
   */
  protected $(selector: string): Element | null {
    return this.shadow?.querySelector(selector) || null;
  }

  /**
   * Query shadow DOM for all matching elements.
   * 
   * @param {string} selector - CSS selector
   * @returns {NodeListOf<Element>} List of found elements
   * @protected
   */
  protected $$(selector: string): NodeListOf<Element> {
    return this.shadow?.querySelectorAll(selector) || ([] as any);
  }

  /**
   * Add event listener with automatic cleanup.
   * 
   * @param {EventTarget} target - Event target
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {AddEventListenerOptions} [options] - Event options
   * @protected
   */
  protected on(target: EventTarget, event: string, handler: EventListenerOrEventListenerObject, options?: AddEventListenerOptions): void {
    target.addEventListener(event, handler, options);

    // Listeners added while wiring a render are dropped on the next render
    (this.inRenderPhase ? this.renderCleanupFunctions : this.cleanupFunctions).push(() => {
      target.removeEventListener(event, handler, options);
    });
  }

  /**
   * Add one-time event listener.
   * 
   * @param {EventTarget} target - Event target
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {AddEventListenerOptions} [options] - Event options
   * @protected
   */
  protected once(target: EventTarget, event: string, handler: EventListener, options?: AddEventListenerOptions): void {
    const onceHandler = (e: Event) => {
      handler(e);
      target.removeEventListener(event, onceHandler, options);
    };
    
    this.on(target, event, onceHandler, options);
  }

  /**
   * Emit a custom event.
   * 
   * @param {string} name - Event name
   * @param {any} [detail] - Event detail data
   * @param {boolean} [bubbles=true] - Whether event bubbles
   * @param {boolean} [composed=true] - Whether event crosses shadow DOM
   * @protected
   */
  protected emit(name: string, detail?: any, bubbles = true, composed = true): boolean {
    const event = new CustomEvent(name, {
      detail,
      bubbles,
      composed
    });
    
    return this.dispatchEvent(event);
  }

  /**
   * Set a timer with automatic cleanup.
   * 
   * @param {Function} callback - Timer callback
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timer ID
   * @protected
   */
  protected setTimeout(callback: Function, delay: number): number {
    const id = window.setTimeout(callback, delay);
    
    this.cleanupFunctions.push(() => {
      window.clearTimeout(id);
    });
    
    return id;
  }

  /**
   * Set an interval with automatic cleanup.
   * 
   * @param {Function} callback - Interval callback
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Interval ID
   * @protected
   */
  protected setInterval(callback: Function, delay: number): number {
    const id = window.setInterval(callback, delay);
    
    this.cleanupFunctions.push(() => {
      window.clearInterval(id);
    });
    
    return id;
  }

  /**
   * Request animation frame with automatic cleanup.
   * 
   * @param {FrameRequestCallback} callback - Animation callback
   * @returns {number} Frame ID
   * @protected
   */
  protected requestAnimationFrame(callback: FrameRequestCallback): number {
    const id = window.requestAnimationFrame(callback);
    
    this.cleanupFunctions.push(() => {
      window.cancelAnimationFrame(id);
    });
    
    return id;
  }

  /**
   * Called when state changes.
   * Override to react to specific state changes.
   * 
   * @param {string} key - State key that changed
   * @param {any} oldValue - Previous value
   * @param {any} newValue - New value
   * @protected
   */
  protected onStateChange(_key: string, _oldValue: any, _newValue: any): void {}

  /**
   * Called after component is connected to DOM.
   * Override to perform post-connection setup.
   * 
   * @protected
   */
  protected afterConnect(): void {}

  /**
   * Called before component is disconnected from DOM.
   * Override to perform pre-disconnection cleanup.
   * 
   * @protected
   */
  protected beforeDisconnect(): void {}

  /**
   * Called after render is complete.
   * Override to perform post-render DOM manipulation.
   * 
   * @protected
   */
  protected afterRender(): void {}

  /**
   * Called when an attribute changes.
   * Override to handle specific attribute changes.
   * 
   * @param {string} name - Attribute name
   * @param {string | null} oldValue - Previous value
   * @param {string | null} newValue - New value
   * @protected
   */
  protected onAttributeChange(_name: string, _oldValue: string | null, _newValue: string | null): void {}

  /**
   * Called when component is adopted into a new document.
   * Override to handle document adoption.
   * 
   * @protected
   */
  protected onAdopted(): void {}

  /**
   * Cleanup method for removing listeners, timers, etc.
   * Override to perform custom cleanup.
   * 
   * @protected
   */
  protected cleanup(): void {}

  /**
   * Get state value by key with optional default.
   * 
   * @template T - Type of the state value
   * @param {string} key - State key
   * @param {T} [defaultValue] - Default value if key doesn't exist
   * @returns {T} State value
   * @protected
   * 
   * @example
   * ```typescript
   * const isOpen = this.getState<boolean>('isOpen', false);
   * const items = this.getState<string[]>('items', []);
   * ```
   */
  protected getState<T = any>(key: string, defaultValue?: T): T {
    return this[ComponentState].has(key) 
      ? this[ComponentState].get(key) as T
      : (defaultValue as unknown as T);
  }

  /**
   * Set state value by key and trigger update if changed.
   * 
   * @param {string} key - State key
   * @param {any} value - Value to set
   * @protected
   * 
   * @example
   * ```typescript
   * this.setState('isOpen', true);
   * this.setState('items', ['item1', 'item2']);
   * ```
   */
  protected setState(key: string, value: any): void {
    const oldValue = this[ComponentState].get(key);
    this[ComponentState].set(key, value);
    
    if (oldValue !== value) {
      this.onStateChange(key, oldValue, value);
      this.scheduleUpdate();
    }
  }

  /**
   * Batch update multiple state values.
   * More efficient than multiple setState calls.
   * 
   * @param {Record<string, any>} updates - Object with state updates
   * @protected
   * 
   * @example
   * ```typescript
   * this.updateState({
   *   isOpen: true,
   *   selectedIndex: 2,
   *   items: ['a', 'b', 'c']
   * });
   * ```
   */
  protected updateState(updates: Record<string, any>): void {
    let hasChanges = false;
    
    Object.entries(updates).forEach(([key, value]) => {
      const oldValue = this[ComponentState].get(key);
      if (oldValue !== value) {
        this[ComponentState].set(key, value);
        this.onStateChange(key, oldValue, value);
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      this.scheduleUpdate();
    }
  }

  /**
   * Check if component has a specific state key.
   * 
   * @param {string} key - State key to check
   * @returns {boolean} True if state exists
   * @protected
   */
  protected hasState(key: string): boolean {
    return this[ComponentState].has(key);
  }

  /**
   * Clear all component state.
   * Triggers update if any state existed.
   * 
   * @protected
   */
  protected clearState(): void {
    const hadState = this[ComponentState].size > 0;
    this[ComponentState].clear();
    if (hadState) {
      this.scheduleUpdate();
    }
  }

  /**
   * Get all state as a plain object.
   * Useful for debugging or serialization.
   * 
   * @returns {Record<string, any>} State object
   * @protected
   */
  protected getStateObject(): Record<string, any> {
    const state: Record<string, any> = {};
    this[ComponentState].forEach((value, key) => {
      state[key] = value;
    });
    return state;
  }

  /**
   * Check if component is connected to DOM.
   * 
   * @returns {boolean} True if connected
   * @protected
   */
  public get isConnected(): boolean {
    return this.initialized && super.isConnected;
  }

  /**
   * Get computed styles for the component.
   * 
   * @returns {CSSStyleDeclaration} Computed styles
   * @protected
   */
  protected get computedStyle(): CSSStyleDeclaration {
    return window.getComputedStyle(this);
  }

  /**
   * Safely parse JSON with fallback.
   * 
   * @template T - Expected type
   * @param {string} json - JSON string
   * @param {T} fallback - Fallback value
   * @returns {T} Parsed value or fallback
   * @protected
   */
  protected parseJSON<T>(json: string, fallback: T): T {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }
}

(BaseComponent.prototype as any)[NX_COMPONENT] = true;
