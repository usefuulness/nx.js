// nx-data-component.ts

import { BaseComponent, ComponentState } from '@/components/abstracts/base';

/**
 * Abstract base class for components that manage a generic data object.
 *
 * @template D Shape of the component’s data object.
 */
export abstract class NXDataComponent<D extends Record<string, any> = Record<string, any>> extends BaseComponent {
  /**
   * Create a data-backed component.
   * @param initialData - Initial data for this component.
   */
  constructor(initialData: D) {
    super();
    // Bypass update on construction
    this[ComponentState].set('data', initialData);
  }

  /**
   * Get the current data object.
   * @returns The data object of type D.
   */
  protected getData(): D {
    return this.getState('data') ?? ({} as D);
  }

  /**
   * Merge partial data into the existing data and trigger a re-render.
   * @param newData - Partial data to merge.
   */
  protected setData(newData: Partial<D>): void {
    const current = this.getData();
    const merged = { ...current, ...newData };
    this.setState('data', merged);
  }
}
