// Test environment shims for jsdom gaps (skipped in node-environment tests, e.g. SSR).
if (typeof window !== 'undefined') {

  // Run rAF callbacks on a macrotask so `await nextFrame()` flushes renders
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as any;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);

  (globalThis as any).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  (globalThis as any).IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false
    })) as any;
  }

  // <dialog> is missing in jsdom (no HTMLDialogElement at all): shim the bits we use
  const dialogProto: any = typeof HTMLDialogElement !== 'undefined' ? HTMLDialogElement.prototype : HTMLElement.prototype;
  if (!dialogProto.showModal) {
    if (!('open' in dialogProto)) {
      Object.defineProperty(dialogProto, 'open', {
        configurable: true,
        get(this: HTMLElement) { return this.hasAttribute('open'); },
        set(this: HTMLElement, value: boolean) { this.toggleAttribute('open', !!value); }
      });
    }
    dialogProto.show = function (this: HTMLElement) { this.setAttribute('open', ''); };
    dialogProto.showModal = function (this: HTMLElement) { this.setAttribute('open', ''); };
    dialogProto.close = function (this: HTMLElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }

}
