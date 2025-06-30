/**
 * @file @/components/abstracts/base.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

import { Core } from '@/core/core';

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
 *   protected render(): string {
 *     return `
 *       <div class="my-component">
 *         ${this.getProp('value', 'default')}
 *       </div>
 *     `;
 *   }
 *   
 *   protected styles(): string {
 *     return `
 *       .my-component {
 *         padding: 1rem;
 *         background: var(--surface-color);
 *       }
 *     `;
 *   }
 * }
 * ```
 */
export abstract class BaseComponent extends HTMLElement implements ComponentLifecycle {
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
    this[ComponentState] = new Map();
    this[ComponentProps] = new Map();
    this.initializeState();
  }

  /**
   * Defines which attributes should be observed for changes.
   * Override in subclasses to specify observed attributes.
   * 
   * @returns {string[]} Array of attribute names to observe
   * @static
   * 
   * @example
   * ```typescript
   * static get observedAttributes() {
   *   return ['disabled', 'value', 'label'];
   * }
   * ```
   */
  static get observedAttributes(): string[] {
    return [];
  }

  /**
   * Called when the component is added to the DOM.
   * Registers with Core, initializes the component, and triggers lifecycle hooks.
   */
  connectedCallback(): void {
    Core.getInstance().registerComponent(this);
    
    if (!this.initialized) {
      this.initialize();
      this.initialized = true;
    }
    
    this.afterConnect();
    this.scheduleUpdate();
  }

  /**
   * Called when the component is removed from the DOM.
   * Performs cleanup, cancels pending updates, and unregisters from Core.
   */
  disconnectedCallback(): void {
    this.beforeDisconnect();
    
    // Cancel any pending updates
    if (this.updateFrameId) {
      cancelAnimationFrame(this.updateFrameId);
      this.updateFrameId = 0;
    }
    
    // Run all cleanup functions
    this.cleanupFunctions.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    });
    this.cleanupFunctions = [];
    
    // Custom cleanup
    this.cleanup();
    
    // Unregister from core
    Core.getInstance().unregisterComponent(this);
  }

  /**
   * Called when an observed attribute changes.
   * Triggers update if the value actually changed.
   * 
   * @param {string} name - Name of the changed attribute
   * @param {string | null} oldValue - Previous value
   * @param {string | null} newValue - New value
   */
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue !== newValue) {
      this.onAttributeChange(name, oldValue, newValue);
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
   * Render component template.
   * Must be implemented by subclasses to return HTML template.
   * 
   * @returns {string} HTML template string
   * @protected
   * @abstract
   * 
   * @example
   * ```typescript
   * protected render(): string {
   *   return `
   *     <div class="container">
   *       <slot></slot>
   *     </div>
   *   `;
   * }
   * ```
   */
  protected abstract render(): string;

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
      this.update();
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
    
    // Create template
    const template = document.createElement('template');
    template.innerHTML = `
      <style>
        ${this.globalStyles()}
        ${this.styles()}
      </style>
      ${this.render()}
    `;
    
    // Clear and append
    this.shadow.innerHTML = '';
    this.shadow.appendChild(template.content.cloneNode(true));
    
    // Trigger after render hook
    requestAnimationFrame(() => {
      this.afterRender();
    });
  }

  /**
   * Global styles applied to all components.
   * Provides base styling and CSS reset for shadow DOM.
   * 
   * @returns {string} Global CSS styles
   * @private
   */
  private globalStyles(): string {
    return `
      /* Base styles */
      :host {
        box-sizing: border-box;
        display: block;
      }
      
      :host([hidden]) {
        display: none !important;
      }
      
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.6;
      }
      
      /* Box sizing reset */
      *, *::before, *::after {
        box-sizing: inherit;
      }
      
      /* Focus styles */
      :focus {
        outline: 2px solid var(--focus-color, #0066cc);
        outline-offset: 2px;
      }
      
      /* Smooth transitions */
      * {
        transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        transition-duration: 150ms;
      }
    `;
  }

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
  protected onAttributeChange(name: string, oldValue: string | null, newValue: string | null): void {}

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
   *   items: newItems
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
   * Called when state changes.
   * Override to react to specific state changes.
   * 
   * @param {string} key - State key that changed
   * @param {any} oldValue - Previous value
   * @param {any} newValue - New value
   * @protected
   */
  protected onStateChange(key: string, oldValue: any, newValue: any): void {}

  /**
   * Get property value from attributes or internal props.
   * Attributes take precedence over internal props.
   * 
   * @template T - Type of the property value
   * @param {string} name - Property name
   * @param {T} [defaultValue] - Default value
   * @returns {T} Property value
   * @protected
   * 
   * @example
   * ```typescript
   * const label = this.getProp<string>('label', 'Default Label');
   * const max = this.getProp<number>('max', 100);
   * const disabled = this.getProp<boolean>('disabled', false);
   * ```
   */
  protected getProp<T = any>(name: string, defaultValue?: T): T {
    // Check attribute first
    const attrValue = this.getAttribute(name);
    if (attrValue !== null) {
      return this.parseAttributeValue(attrValue, defaultValue) as T;
    }
    
    // Check internal props
    if (this[ComponentProps].has(name)) {
      return this[ComponentProps].get(name);
    }
    
    return defaultValue as T;
  }

  /**
   * Set property value and update corresponding attribute.
   * 
   * @param {string} name - Property name
   * @param {any} value - Value to set
   * @protected
   * 
   * @example
   * ```typescript
   * this.setProp('label', 'New Label');
   * this.setProp('disabled', true);
   * this.setProp('items', ['a', 'b', 'c']);
   * ```
   */
  protected setProp(name: string, value: any): void {
    const oldValue = this.getProp(name);
    this[ComponentProps].set(name, value);
    
    // Update attribute
    if (typeof value === 'boolean') {
      this.toggleAttribute(name, value);
    } else if (value == null) {
      this.removeAttribute(name);
    } else if (typeof value === 'object') {
      this.setAttribute(name, JSON.stringify(value));
    } else {
      this.setAttribute(name, String(value));
    }
    
    if (oldValue !== value) {
      this.onPropChange(name, oldValue, value);
    }
  }

  /**
   * Called when a property changes.
   * Override to react to specific property changes.
   * 
   * @param {string} name - Property name
   * @param {any} oldValue - Previous value
   * @param {any} newValue - New value
   * @protected
   */
  protected onPropChange(name: string, oldValue: any, newValue: any): void {}

  /**
   * Parse attribute string value to appropriate type.
   * Handles booleans, numbers, null/undefined, and JSON.
   * 
   * @param {string} value - String value to parse
   * @param {any} [defaultValue] - Default value for type inference
   * @returns {any} Parsed value
   * @private
   */
  private parseAttributeValue(value: string, defaultValue?: any): any {
    // Handle boolean values
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // Handle null/undefined
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    
    // Handle empty string
    if (value === '') {
      // For boolean attributes, empty string means true
      if (typeof defaultValue === 'boolean') return true;
      return value;
    }
    
    // Try to parse as number
    if (typeof defaultValue === 'number' || /^-?\d+(\.\d+)?$/.test(value)) {
      const num = Number(value);
      if (!isNaN(num)) return num;
    }
    
    // Try to parse as JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        // Not valid JSON, return as string
      }
    }
    
    // Return as string
    return value;
  }

  /**
   * Query selector within shadow DOM.
   * Returns null if shadow DOM doesn't exist.
   * 
   * @template E - Element type
   * @param {string} selector - CSS selector
   * @returns {E | null} Found element or null
   * @protected
   * 
   * @example
   * ```typescript
   * const button = this.$<HTMLButtonElement>('.submit-btn');
   * const input = this.$<HTMLInputElement>('input[name="email"]');
   * ```
   */
  protected $<E extends Element = Element>(selector: string): E | null {
    return this.shadow?.querySelector<E>(selector) ?? null;
  }

  /**
   * Query selector all within shadow DOM.
   * Returns empty array if shadow DOM doesn't exist.
   * 
   * @template E - Element type
   * @param {string} selector - CSS selector
   * @returns {E[]} Array of found elements
   * @protected
   * 
   * @example
   * ```typescript
   * const buttons = this.$$<HTMLButtonElement>('button');
   * const items = this.$$('.list-item');
   * ```
   */
  protected $$<E extends Element = Element>(selector: string): E[] {
    return Array.from(this.shadow?.querySelectorAll<E>(selector) ?? []);
  }

  /**
   * Add event listener with automatic cleanup.
   * Listener will be automatically removed when component disconnects.
   * 
   * @param {EventTarget} target - Event target
   * @param {string} event - Event name
   * @param {EventListener} handler - Event handler
   * @param {AddEventListenerOptions} [options] - Event options
   * @protected
   * 
   * @example
   * ```typescript
   * this.addListener(window, 'resize', this.handleResize);
   * this.addListener(button, 'click', (e) => this.handleClick(e), { once: true });
   * ```
   */
  protected addListener(
    target: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(event, handler, options);
    this.cleanupFunctions.push(() => {
      target.removeEventListener(event, handler, options);
    });
  }

  /**
   * Add cleanup function to be called on disconnect.
   * Useful for cleaning up external resources.
   * 
   * @param {() => void} fn - Cleanup function
   * @protected
   * 
   * @example
   * ```typescript
   * const timer = setInterval(() => this.tick(), 1000);
   * this.addCleanup(() => clearInterval(timer));
   * ```
   */
  protected addCleanup(fn: () => void): void {
    this.cleanupFunctions.push(fn);
  }

  /**
   * Emit custom event with detail data.
   * Events are composed and bubble by default.
   * 
   * @param {string} eventName - Event name
   * @param {any} [detail] - Event detail data
   * @param {CustomEventInit} [options] - Additional event options
   * @returns {boolean} False if event was cancelled
   * @protected
   * 
   * @example
   * ```typescript
   * this.emit('change', { value: newValue });
   * this.emit('submit', formData, { cancelable: true });
   * ```
   */
  protected emit(eventName: string, detail?: any, options?: CustomEventInit): boolean {
    const event = new CustomEvent(eventName, {
      bubbles: true,
      composed: true,
      cancelable: false,
      ...options,
      detail
    });
    
    return this.dispatchEvent(event);
  }

  /**
   * Schedule update on next animation frame.
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
