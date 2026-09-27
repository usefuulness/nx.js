/**
 * @file @/ssr/dom.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * Installs a server-side DOM (happy-dom) as globals, so the real components
 * run in Node. This module must evaluate before anything that defines
 * elements — `nx.js/ssr` imports it first; import `nx.js/ssr` before your
 * page modules.
 */
import { Window } from 'happy-dom';

type FrameCallback = (time: number) => void;

const frameQueue = new Map<number, FrameCallback>();
let frameSeq = 0;

export const serverWindow = new Window({
  url: 'http://localhost/',
  settings: {
    disableJavaScriptEvaluation: true,
    disableJavaScriptFileLoading: true,
    disableCSSFileLoading: true,
    disableIframePageLoading: true,
    navigator: { userAgent: 'nx-ssr' }
  }
});

const win = serverWindow as unknown as Record<string, any>;

/** Browser globals the library (and JSX code) touches. */
const names = new Set<string>([
  'window', 'document', 'customElements', 'getComputedStyle', 'matchMedia', 'localStorage', 'sessionStorage',
  'navigator', 'location', 'history', 'CSS', 'DOMParser', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver',
  'Node', 'Element', 'Document', 'DocumentFragment', 'ShadowRoot', 'Text', 'Comment', 'Event', 'CustomEvent',
  'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'FocusEvent', 'InputEvent', 'SubmitEvent', 'EventTarget',
  'HTMLElement', 'SVGElement', 'HTMLTemplateElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement',
  'HTMLOptionElement', 'HTMLButtonElement', 'HTMLFormElement', 'HTMLDialogElement', 'HTMLAnchorElement',
  'HTMLSlotElement', 'ElementInternals', 'NodeFilter', 'Blob', 'URL'
]);
// Every HTML*/SVG* element constructor, for `instanceof` checks in user code
Object.getOwnPropertyNames(win).forEach(name => {
  if (/^(HTML|SVG)[A-Za-z]*Element$/.test(name)) names.add(name);
});

for (const name of names) {
  const value = name === 'window' ? win : win[name];
  if (value === undefined) continue;
  try {
    (globalThis as any)[name] = value;
  } catch {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
}

// Renders are scheduled with requestAnimationFrame; the renderer flushes them itself
(globalThis as any).requestAnimationFrame = (callback: FrameCallback): number => {
  const id = ++frameSeq;
  frameQueue.set(id, callback);
  return id;
};
(globalThis as any).cancelAnimationFrame = (id: number): void => {
  frameQueue.delete(id);
};
win.requestAnimationFrame = (globalThis as any).requestAnimationFrame;
win.cancelAnimationFrame = (globalThis as any).cancelAnimationFrame;

/**
 * Run scheduled frames and microtasks until the components have settled.
 */
export async function settle(maxRounds = 20): Promise<void> {
  for (let round = 0; round < maxRounds; round++) {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (!frameQueue.size) return;
    const callbacks = Array.from(frameQueue.values());
    frameQueue.clear();
    callbacks.forEach(callback => callback(Date.now()));
  }
}
