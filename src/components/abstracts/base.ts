/**
 * @file @/components/base.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */


// Symbols for private state and props storage
declare const DEBUG: boolean;
export const ComponentState = Symbol('ComponentState');
export const ComponentProps = Symbol('ComponentProps');

/**
 * BaseComponent
 * A foundational Web Component class with built-in state/props management,
 * lifecycle hooks, and templating support using a shadow DOM.
 * @abstract
 */
export abstract class BaseComponent extends HTMLElement {
  /** Shadow root for encapsulated markup and styles */
  protected shadow: ShadowRoot;
  /** Internal state storage */
  private [ComponentState]: Map<string, any> = new Map();
  /** Internal props storage */
  private [ComponentProps]: Map<string, any> = new Map();
  /** Active subscription cleanup functions */
  private subscriptions: Set<() => void> = new Set();
  /** Registered event listeners for cleanup */
  private eventListeners: Map<EventTarget, Array<{ type: string; handler: EventListenerOrEventListenerObject }>> = new Map();

  /**
   * Automatically called when element is constructed.
   * Attaches an open shadow root and initializes fields.
   */
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  /**
   * Attributes to observe for changes. Override in subclasses.
   */
  static get observedAttributes(): string[] {
    return [];
  }

  /**
   * Called when the element is connected into the DOM.
   * Initializes state, parses attributes, runs user init, renders view, and attaches events.
   */
  connectedCallback(): void {
    if (DEBUG) console.info(`${this.constructor.name} connected`);
    this.initializeState();
    this.parseAttributes();
    this.initialize();
    this.updateView();
    this.attachEventListeners();
  }

  /**
   * Hook for subclasses to set up initial state before rendering.
   * @protected
   */
  protected initializeState(): void {
    // Override in subclass
  }

  /**
   * Called when the element is disconnected from the DOM.
   * Cleans up subscriptions and event listeners.
   */
  disconnectedCallback(): void {
    this.cleanup();

    for (const unsubscribe of this.subscriptions) {
      unsubscribe?.();
    }
    this.subscriptions.clear();

    for (const [target, listeners] of this.eventListeners) {
      listeners.forEach(({ type, handler }) => target.removeEventListener(type, handler));
    }
    this.eventListeners.clear();
  }

  /**
   * Called when one of the observed attributes changes.
   * @param name Name of the attribute
   * @param oldValue Previous value
   * @param newValue New value
   */
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || newValue == null) return;
    let parsed: any = newValue;
    try {
      if (/^[\[{].*[\]}]$/.test(newValue)) {
        parsed = JSON.parse(newValue);
      }
    } catch {
      // leave as string
    }
    this.setProp(name, parsed);
    if (this.isConnected) {
      this.updateView();
    }
  }

  // -------- State & Props Management --------

  /**
   * Updates internal state and triggers re-render + dispatches a statechange event.
   * @param key State key
   * @param value New value
   */
  protected setState(key: string, value: any): void {
    this[ComponentState].set(key, value);
    if (this.isConnected) this.updateView();
    this.dispatchEvent(new CustomEvent('statechange', {
      detail: { key, value },
      bubbles: true,
      composed: true
    }));
  }

  /**
   * Retrieves state value or default.
   * @param key State key
   * @param defaultValue Optional default if not set
   */
  protected getState<T = any>(key: string, defaultValue?: T): T | undefined {
    return this[ComponentState].has(key)
      ? (this[ComponentState].get(key) as T)
      : defaultValue;
  }

  /**
   * Sets a prop (attribute-synced) value.
   * @param key Prop key
   * @param value Value to set
   */
  protected setProp(key: string, value: any): void {
    this[ComponentProps].set(key, value);
  }

  /**
   * Gets a prop value or default.
   * @param key Prop key
   * @param defaultValue Optional default
   */
  protected getProp<T = any>(key: string, defaultValue?: T): T | undefined {
    return this[ComponentProps].has(key)
      ? (this[ComponentProps].get(key) as T)
      : defaultValue;
  }

  // -------- Subclass Hooks (Override) --------

  /** Perform custom initialization logic. */
  protected initialize(): void {}
  /** Perform custom cleanup logic. */
  protected cleanup(): void {}
  /** Return HTML string for rendering. */
  protected abstract render(): string;
  /** Return CSS string for component-specific styles. */
  protected styles(): string { return ''; }
  /** Attach events in the rendered DOM. */
  protected attachEventListeners(): void {}
  /** Called after the view has been rendered into the shadow DOM. */
  protected afterRender(): void {}

  // -------- Rendering --------

  public update(): void {
    this.updateView();
  }

  /**
   * Re-renders the component template with styles.
   * @protected
   */
  protected updateView(): void {
    this.shadow.innerHTML = `
      <style>
        :host { display: block; box-sizing: border-box; }
        *, *::before, *::after { box-sizing: border-box; }
        ${this.globalStyles()}
        ${this.styles()}
      </style>
      ${this.render()}
    `;
    requestAnimationFrame(() => {
      if (DEBUG) console.info(`${this.constructor.name} afterRender`);
      this.afterRender();
    });
  }

  /** Parses all current attributes into props. */
  private parseAttributes(): void {
    for (const { name, value } of Array.from(this.attributes)) {
      let parsed: any = value;
      try {
        if (/^[\[{].*[\]}]$/.test(value)) parsed = JSON.parse(value);
      } catch {
        console.warn(`Failed to parse attribute ${name}`);
      }
      this.setProp(name, parsed);
    }
  }

  // -------- DOM Helpers --------

  /**
   * Query a single element within shadow DOM.
   * @param selector CSS selector
   */
  protected $(selector: string): Element | null {
    return this.shadow.querySelector(selector);
  }

  /**
   * Query multiple elements within shadow DOM.
   * @param selector CSS selector
   */
  protected $$(selector: string): NodeListOf<Element> {
    return this.shadow.querySelectorAll(selector);
  }

  /**
   * Attach an event listener to an element found by selector.
   * @param selector CSS selector
   * @param event Event type
   * @param handler Event handler
   * @returns True if attached, false otherwise
   */
  protected on(
    selector: string,
    event: string,
    handler: EventListenerOrEventListenerObject
  ): boolean {
    const el = this.$(selector);
    if (!el) {
      if (DEBUG) console.warn(`Selector not found: ${selector}`);
      return false;
    }
    el.addEventListener(event, handler);
    if (!this.eventListeners.has(el)) {
      this.eventListeners.set(el, []);
    }
    this.eventListeners.get(el)?.push({ type: event, handler });
    return true;
  }

  /**
   * Global utility styles (Tailwind-like).
   */
  protected globalStyles(): string {
    return `
        /* Import Tailwind-like utilities */
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .flex-row { flex-direction: row; }
        .items-center { align-items: center; }
        .justify-between { justify-content: space-between; }
        .justify-center { justify-content: center; }
        .gap-2 { gap: 0.5rem; }
        .gap-4 { gap: 1rem; }
        .p-2 { padding: 0.5rem; }
        .p-4 { padding: 1rem; }
        .px-4 { padding-left: 1rem; padding-right: 1rem; }
        .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        .m-2 { margin: 0.5rem; }
        .m-4 { margin: 1rem; }
        .rounded { border-radius: var(--radius-md); }
        .rounded-lg { border-radius: var(--radius-lg); }
        .shadow { box-shadow: var(--shadow-md); }
        .shadow-lg { box-shadow: var(--shadow-lg); }
        .bg-primary { background-color: var(--color-primary); }
        .bg-surface { background-color: var(--color-surface); }
        .text-white { color: white; }
        .text-sm { font-size: 0.875rem; }
        .font-medium { font-weight: 500; }
        .font-bold { font-weight: 700; }
        .border { border: 1px solid var(--color-border); }
        .w-full { width: 100%; }
        .h-full { height: 100%; }
        .grid { display: grid; }
        .hidden { display: none; }
        .block { display: block; }
        .relative { position: relative; }
        .absolute { position: absolute; }
        .fixed { position: fixed; }
        .top-0 { top: 0; }
        .right-0 { right: 0; }
        .bottom-0 { bottom: 0; }
        .left-0 { left: 0; }
        .z-10 { z-index: 10; }
        .z-50 { z-index: 50; }
        .overflow-hidden { overflow: hidden; }
        .overflow-auto { overflow: auto; }
        .transition { transition: all 0.2s; }
        .cursor-pointer { cursor: pointer; }
        .hover\\:bg-opacity-80:hover { opacity: 0.8; }
    `;
  }
}
