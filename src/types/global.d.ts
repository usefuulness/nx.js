/// <reference types="vite/client" />

// Extend global object for test environment
declare global {
  interface Window {
    NX: any;
    fs: {
      readFile: (filepath: string, options?: { encoding?: string }) => Promise<Uint8Array | string>;
    };
  }
  
  var requestAnimationFrame: (callback: FrameRequestCallback) => number;
  var cancelAnimationFrame: (handle: number) => void;
}

// Make this file a module
export {};
