/**
 * @file @/core/events/event-bus.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

/**
 * A function that handles event payloads of type T.
 * @template T
 * @callback EventHandler
 * @param {T} data - The data passed to the handler.
 */
export type EventHandler<T> = (data: T) => void;

/**
 * A simple publish-subscribe event bus.
 * @template E Type of event names.
 * @template P Type of event payloads.
 */
export class EventBus<E extends string | symbol = string, P = any> {
  private events: Map<E, Set<EventHandler<P>>>;

  /**
   * Creates a new EventBus instance.
   */
  constructor() {
    this.events = new Map();
  }

  /**
   * Subscribes a handler to an event.
   * @param {E} event - The name of the event to listen for.
   * @param {EventHandler<P>} handler - The callback to invoke when the event is emitted.
   * @returns {() => void} A function to unsubscribe this handler.
   */
  on(event: E, handler: EventHandler<P>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
    return () => {
      this.events.get(event)!.delete(handler);
    };
  }

  /**
   * Emits an event, invoking all subscribed handlers with the provided data.
   * @param {E} event - The name of the event to emit.
   * @param {P} data - The data to pass to each handler.
   */
  emit(event: E, data: P): void {
    this.events.get(event)?.forEach((handler) => handler(data));
  }
}
