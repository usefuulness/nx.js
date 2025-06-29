/**
 * @file core/zustand/event-bus.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

/**
 * A listener function that is called with a value of type V when a store key updates.
 *
 * @template V - The type of the value associated with the store key.
 * @param {V} value - The new value for the store key.
 */
export type Listener<V> = (value: V) => void;

/**
 * A simple reactive key-value store that allows getting, setting, updating,
 * and subscribing to changes on specific keys.
 *
 * @template State - An object type representing the shape of the store's state.
 */
export class Store<State extends Record<string, any>> {
  /**
   * Internal state container.
   * @private
   */
  private state: State;

  /**
   * Map of listeners for each key in the state.
   * @private
   */
  private listeners: Map<keyof State, Set<Listener<any>>>;

  /**
   * Creates a new Store instance.
   *
   * @param {State} [initialState={}] - The initial state object for the store.
   */
  constructor(initialState: State = {} as State) {
    this.state = { ...initialState };
    this.listeners = new Map();
  }

  /**
   * Retrieves the current value associated with the given key.
   *
   * @template K
   * @param {K} key - The key to retrieve. Must be a key of the state.
   * @returns {State[K]} The current value for the specified key.
   */
  public get<K extends keyof State>(key: K): State[K] {
    return this.state[key];
  }

  /**
   * Sets a new value for the given key and notifies subscribers if the value changed.
   *
   * @template K
   * @param {K} key - The key to update. Must be a key of the state.
   * @param {State[K]} value - The new value to set.
   */
  public set<K extends keyof State>(key: K, value: State[K]): void {
    if (this.state[key] !== value) {
      this.state[key] = value;
      this.notify(key, value);
    }
  }

  /**
   * Updates the value for the given key using an updater function.
   *
   * @template K
   * @param {K} key - The key to update. Must be a key of the state.
   * @param {(prev: State[K]) => State[K]} updater - A function that receives the previous value and returns the new value.
   */
  public update<K extends keyof State>(
    key: K,
    updater: (prev: State[K]) => State[K]
  ): void {
    this.set(key, updater(this.state[key]));
  }

  /**
   * Subscribes a listener to changes on the given key.
   * The listener is immediately called with the current value.
   *
   * @template K
   * @param {K} key - The key to subscribe to. Must be a key of the state.
   * @param {Listener<State[K]>} listener - A callback to invoke when the key's value changes.
   * @returns {() => void} A function to unsubscribe the listener.
   */
  public subscribe<K extends keyof State>(
    key: K,
    listener: Listener<State[K]>
  ): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    (this.listeners.get(key) as Set<Listener<State[K]>>).add(listener);

    // Call immediately with current value
    listener(this.state[key]);

    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(listener);
    };
  }

  /**
   * Notifies all listeners subscribed to the given key with the new value.
   *
   * @template K
   * @private
   * @param {K} key - The key whose listeners should be notified.
   * @param {State[K]} value - The new value for the key.
   */
  private notify<K extends keyof State>(key: K, value: State[K]): void {
    this.listeners.get(key)?.forEach((listener) =>
      (listener as Listener<State[K]>)(value)
    );
  }

  /**
   * Returns a shallow copy of the entire state object.
   *
   * @returns {State} A copy of the store's current state.
   */
  public getState(): State {
    return { ...this.state };
  }
}

/**
 * Factory function to create a new Store instance with inferred generic type.
 *
 * @template State
 * @param {State} [initialState={}] - The initial state object for the store.
 * @returns {Store<State>} A new Store instance.
 */
export function createStore<State extends Record<string, any>>(
  initialState: State = {} as State
): Store<State> {
  return new Store(initialState);
}
