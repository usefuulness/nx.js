/**
 * @file core/zustand/event-bus.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

import type { BaseComponent } from '@/components/abstracts/base';

export class Core {
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
}
