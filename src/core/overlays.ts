/**
 * @file @/core/overlays.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * Tracks open modal surfaces (dialogs, sheets). While a modal <dialog> is open,
 * the browser makes everything outside it inert — so floating UI opened from
 * inside it (menus, popovers) must be mounted inside the topmost modal.
 */
const stack: Element[] = [];

export const Overlays = {
  /** A modal surface opened. */
  push(el: Element): void {
    this.remove(el);
    stack.push(el);
  },

  /** A modal surface closed. */
  remove(el: Element): void {
    const index = stack.indexOf(el);
    if (index >= 0) stack.splice(index, 1);
  },

  /** Where to mount floating UI: the topmost open modal, else `document.body`. */
  host(): Element {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].isConnected) return stack[i];
      stack.splice(i, 1);
    }
    return document.body;
  }
};
