/// <reference types="vite/client" />
import type { NX } from '@/app';

declare global {
  interface Window {
    /** Set by the library so script-tag users (UMD build) and the console can use it */
    NX: typeof NX;
  }
}

export {};
