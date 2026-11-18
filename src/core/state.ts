/**
 * @file @/core/state.ts
 * Remembered state: small JSON values kept in `localStorage` (or `sessionStorage`), with an in-memory
 * fallback for when storage is blocked, full or missing (private windows, servers). Never throws.
 * Must not touch the DOM when it loads.
 */

type Listener = (value: unknown, key: string) => void;

export interface StateOptions {
  /** `local` (default, survives the tab) or `session` (until the tab closes) */
  storage?: 'local' | 'session';
  /** Added in front of every key in storage (default `nx-state:`) */
  prefix?: string;
}

export class StateProvider {
  private memory = new Map<string, string>();
  private listeners = new Map<string, Set<Listener>>();
  private storageKind: 'local' | 'session';
  private prefix: string;

  constructor(options: StateOptions = {}) {
    this.storageKind = options.storage ?? 'local';
    this.prefix = options.prefix ?? 'nx-state:';
  }

  private backend(): Storage | null {
    try {
      const s = this.storageKind === 'session' ? globalThis.sessionStorage : globalThis.localStorage;
      return s ?? null;
    } catch {
      return null; // accessing storage can throw when it is blocked
    }
  }

  /** The saved value for `key`, or `fallback` when there is none (or it cannot be read) */
  get<T = unknown>(key: string, fallback?: T): T {
    let raw: string | null | undefined;
    try {
      raw = this.backend()?.getItem(this.prefix + key);
    } catch {
      raw = undefined;
    }
    raw ??= this.memory.get(key);
    if (raw === null || raw === undefined) return fallback as T;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback as T; // something else wrote here: ignore it rather than break the page
    }
  }

  /** Save a value (anything JSON can hold). Returns whether it reached real storage. */
  set(key: string, value: unknown): boolean {
    if (value === undefined) { this.remove(key); return true; }
    const text = JSON.stringify(value);
    this.memory.set(key, text);
    let stored = false;
    try {
      const s = this.backend();
      if (s) { s.setItem(this.prefix + key, text); stored = true; }
    } catch {
      // full or blocked: the in-memory copy still serves this page
    }
    this.notify(key, value);
    return stored;
  }

  remove(key: string): void {
    this.memory.delete(key);
    try { this.backend()?.removeItem(this.prefix + key); } catch { /* nothing to remove */ }
    this.notify(key, undefined);
  }

  /** Forget everything this provider saved */
  clear(): void {
    const keys = new Set(this.memory.keys());
    try {
      const s = this.backend();
      if (s) for (let i = s.length - 1; i >= 0; i--) { const k = s.key(i); if (k?.startsWith(this.prefix)) keys.add(k.slice(this.prefix.length)); }
    } catch { /* storage unreadable */ }
    keys.forEach(k => this.remove(k));
  }

  /** Call `listener` whenever `key` is set or removed (through this provider). Returns a function that stops it. */
  on(key: string, listener: Listener): () => void {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(listener);
    return () => this.listeners.get(key)?.delete(listener);
  }

  private notify(key: string, value: unknown): void {
    this.listeners.get(key)?.forEach(l => { try { l(value, key); } catch (e) { console.error(e); } });
  }
}

/** The page's own: `NX.state.set('sidebar', 'collapsed')` */
export const state = new StateProvider();
