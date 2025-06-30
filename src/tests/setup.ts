// Mock window.customElements if needed
if (!window.customElements) {
  window.customElements = {
    define: () => {},
    get: () => undefined,
    whenDefined: () => Promise.resolve(),
    upgrade: () => {}
  } as any;
}

// Mock requestAnimationFrame
(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
  return setTimeout(() => cb(Date.now()), 0) as any;
};

(globalThis as any).cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

// Setup ResizeObserver mock
(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Setup IntersectionObserver mock
(globalThis as any).IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};
