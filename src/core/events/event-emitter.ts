/**
 * Simple event emitter for Store and other classes
 */
export class EventEmitter {
  private events = new Map<string, Set<Function>>();

  /** Listen for an event. Returns a function that stops listening. */
  on(event: string, handler: Function): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(event: string, data?: any): void {
    const handlers = this.events.get(event);
    if (handlers) {
      // A copy, so a handler that adds or removes listeners does not disturb this round; one that throws does not stop the rest
      [...handlers].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in a "${event}" handler:`, error);
        }
      });
    }
  }

  /** Listen for the next occurrence only. Returns a function that cancels it. */
  once(event: string, handler: Function): () => void {
    const onceHandler = (data: any) => {
      this.off(event, onceHandler);
      handler(data);
    };
    return this.on(event, onceHandler);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}
