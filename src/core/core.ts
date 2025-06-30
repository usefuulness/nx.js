/**
 * @file core/core.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

import type { BaseComponent } from '@/components/abstracts/base';

export class Core {
  /**
   * Library version
   */
  public static readonly version = '0.0.1';

  /**
   * Singleton instance of the Core.
   */
  private static instance: Core;

  /**
   * Collection of registered components.
   */
  private readonly components: Set<BaseComponent>;

  /**
   * Symbol key for storing component internal state.
   */
  private static readonly ComponentState = Symbol('ComponentState');

  /**
   * Symbol key for storing component props.
   */
  private static readonly ComponentProps = Symbol('ComponentProps');

  /**
   * Enable or disable debug logging.
   */
  private static readonly DEBUG = false;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    this.components = new Set<BaseComponent>();
  }

  /**
   * Retrieves the Core singleton instance, creating it if necessary.
   * @returns The Core instance
   */
  public static getInstance(): Core {
    if (!Core.instance) {
      Core.instance = new Core();
    }
    return Core.instance;
  }

  /**
   * Registers a component with the core manager.
   * @param component - The component to register
   */
  public registerComponent(component: BaseComponent): void {
    this.components.add(component);
    if (Core.DEBUG) {
      console.debug(`Component registered: ${component.tagName}`);
    }
  }

  /**
   * Unregisters a component from the core manager.
   * @param component - The component to unregister
   */
  public unregisterComponent(component: BaseComponent): void {
    if (this.components.delete(component) && Core.DEBUG) {
      console.debug(`Component unregistered: ${component.tagName}`);
    }
  }

  /**
   * Returns all registered components as an array.
   * @returns Array of registered BaseComponent instances
   */
  public getComponents(): BaseComponent[] {
    return Array.from(this.components);
  }

  /**
   * Clears all registered components from the core manager.
   */
  public clearComponents(): void {
    this.components.clear();
    if (Core.DEBUG) {
      console.debug('All components cleared');
    }
  }

  /**
   * Internal: Retrieves the symbol key used for component state.
   * @internal
   */
  public static getStateKey(): symbol {
    return Core.ComponentState;
  }

  /**
   * Internal: Retrieves the symbol key used for component props.
   * @internal
   */
  public static getPropsKey(): symbol {
    return Core.ComponentProps;
  }

  // ────────── Utility methods ──────────

  /**
   * Generate a unique ID.
   * @param prefix - Optional prefix for the ID
   * @returns A unique string ID
   */
  public static uid(prefix = 'nx'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Deep clone an object.
   * @param obj - The object to clone
   * @returns A deep-cloned copy of the object
   */
  public static clone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Check if a value is a non-array object.
   * @param val - The value to check
   */
  public static isObject(val: any): val is object {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  /**
   * Check if a value is a function.
   * @param val - The value to check
   */
  public static isFunction(val: any): val is Function {
    return typeof val === 'function';
  }

  /**
   * Create a debounced version of a function.
   * @param fn - The function to debounce
   * @param delay - Delay in milliseconds
   */
  public static debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Create a throttled version of a function.
   * @param fn - The function to throttle
   * @param limit - Minimum time between calls in milliseconds
   */
  public static throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  }
}
