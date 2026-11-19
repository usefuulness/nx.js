/**
 * @file @/core/viewmodel.ts
 * A view model: data that views bind to, formulas computed from it, and stores. Change the data and
 * everything bound to it updates, once, in the next microtask.
 */
import { Store, type StoreConfig } from '@/data/store';

export interface FormulaSpec {
  /** Computed from other data: `get('user.first')`. What it reads is what it depends on. */
  get: (get: (path: string) => any) => any;
  /** Called when something sets this path (a two-way binding on a computed value) */
  set?: (value: any, set: (path: string, value: any) => void) => void;
}

export interface ViewModelConfig {
  data?: Record<string, any>;
  formulas?: Record<string, FormulaSpec['get'] | FormulaSpec>;
  /** Stores made on demand: `vm.getStore('users')` */
  stores?: Record<string, StoreConfig<any> | Store<any>>;
  /** Data not found here is looked up in the parent, and setting it changes the parent's */
  parent?: ViewModel;
}

export interface Binding {
  /** Stop calling the callback */
  destroy(): void;
}

interface Sub {
  paths: string[];
  /** What each path was last time the callback ran (to call only on a real change) */
  last: any[];
  single: boolean;
  run: (value: any, old: any) => void;
  first: boolean;
  dirty: boolean;
  /** The expression to evaluate, as text pieces and paths */
  read: () => any;
  dead: boolean;
}

const MAX_PASSES = 100;

/** Same value, looking inside plain objects, arrays and dates */
export function sameData(a: any, b: any, depth = 0): boolean {
  if (a === b) return true;
  if (depth > 20 || typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return Number.isNaN(a) && Number.isNaN(b);
  if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  if (a instanceof Store || b instanceof Store) return false; // a store is compared by identity
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every(k => k in b && sameData(a[k], b[k], depth + 1));
}

const split = (path: string) => String(path).split('.').filter(Boolean);

/** Whether one path contains the other (`user` and `user.name` overlap; `user` and `users` do not) */
function overlaps(a: string, b: string): boolean {
  return a === b || a.startsWith(b + '.') || b.startsWith(a + '.');
}

/** A deep copy that keeps what cannot be copied (stores, functions, class instances other than Date) */
function clone(value: any, depth = 0): any {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(v => clone(v, depth + 1));
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v, depth + 1)]));
}

export class ViewModel {
  private data: Record<string, any>;
  private formulas = new Map<string, FormulaSpec>();
  private computed = new Map<string, { value: any; deps: Set<string>; dirty: boolean }>();
  private stores = new Map<string, Store<any>>();
  private storeConfigs: Record<string, StoreConfig<any> | Store<any>>;
  private subs = new Set<Sub>();
  private children = new Set<ViewModel>();
  private parent: ViewModel | null;
  private scheduled = false;
  private inFlush = false;
  /** Flushes in a row that were caused by callbacks, not by outside changes (a guard against loops) */
  private chain = 0;
  private changed = new Set<string>();
  private destroyed = false;

  constructor(config: ViewModelConfig = {}) {
    this.data = clone(config.data ?? {});
    this.storeConfigs = config.stores ?? {};
    this.parent = config.parent ?? null;
    this.parent?.children.add(this);
    for (const [name, f] of Object.entries(config.formulas ?? {})) {
      this.formulas.set(name, typeof f === 'function' ? { get: f } : f);
      this.computed.set(name, { value: undefined, deps: new Set(), dirty: true });
    }
  }

  // ────────── Reading and writing ──────────

  /** The value at a path (`user.name`), looking in formulas, then this model's data, then the parent's. `undefined` when there is none. */
  get(path: string): any {
    const [root, ...rest] = split(path);
    if (root === undefined) return undefined;
    let value: any;
    if (this.formulas.has(root)) value = this.evaluate(root);
    else if (Object.hasOwn(this.data, root)) value = this.data[root];
    else if (this.storeConfigs[root] !== undefined) value = this.getStore(root);
    else return this.parent ? this.parent.get(path) : undefined;
    for (const part of rest) {
      if (value === null || value === undefined) return undefined;
      value = value[part];
    }
    return value;
  }

  /**
   * Set a value at a path, or several at once with an object (`vm.set({ 'user.name': 'Ada', count: 2 })`).
   * Missing parents are created. Data that belongs to the parent model is set there.
   */
  set(path: string | Record<string, any>, value?: any): void {
    if (typeof path !== 'string') {
      Object.entries(path).forEach(([p, v]) => this.set(p, v));
      return;
    }
    const [root, ...rest] = split(path);
    if (root === undefined) return;
    const f = this.formulas.get(root);
    if (f) {
      if (!rest.length && f.set) f.set(value, (p, v) => this.set(p, v));
      return; // a computed value is read only unless it says how to be set
    }
    if (!Object.hasOwn(this.data, root) && this.parent && this.parent.has(root)) {
      this.parent.set(path, value);
      return;
    }
    if (!rest.length) {
      if (sameData(this.data[root], value)) return;
      this.data[root] = value;
    } else {
      let cur = this.data;
      let key = root;
      for (const part of rest) {
        if (cur[key] === null || typeof cur[key] !== 'object') cur[key] = {};
        cur = cur[key];
        key = part;
      }
      if (sameData(cur[key], value)) return;
      cur[key] = value;
    }
    this.touch(path);
  }

  /** Whether this model, or one above it, has data or a formula at the top of this path */
  has(path: string): boolean {
    const root = split(path)[0];
    return root !== undefined && (this.formulas.has(root) || Object.hasOwn(this.data, root) || this.storeConfigs[root] !== undefined || (this.parent?.has(root) ?? false));
  }

  /** A store from the `stores` config, created the first time it is asked for */
  getStore(name: string): Store<any> | undefined {
    let store = this.stores.get(name);
    if (!store && this.storeConfigs[name] !== undefined) {
      const given = this.storeConfigs[name];
      store = given instanceof Store ? given : new Store(given);
      this.stores.set(name, store);
    }
    return store ?? this.parent?.getStore(name);
  }

  // ────────── Formulas ──────────

  private evaluate(name: string): any {
    const entry = this.computed.get(name)!;
    if (!entry.dirty) return entry.value;
    const spec = this.formulas.get(name)!;
    const deps = new Set<string>();
    const reader = (p: string) => { deps.add(p); return this.get(p); };
    // A formula that reads itself (directly or through others) would never settle: it gets `undefined`
    entry.dirty = false;
    entry.deps = deps;
    try {
      entry.value = spec.get(reader);
    } catch (e) {
      entry.value = undefined;
      console.error(`ViewModel formula "${name}" threw:`, e);
    }
    entry.deps = deps;
    return entry.value;
  }

  // ────────── Binding ──────────

  /**
   * Call `callback` with the value of an expression now (once there is a value) and every time it
   * changes. The expression is a path (`user.name`), a template (`Hello {user.first} {user.last}`),
   * `{path}` for the raw value of a path, `!path` for its opposite, or a list of paths (the callback
   * then gets an array). Calls are batched: several changes in a row call it once.
   */
  bind<T = any>(expression: string | string[], callback: (value: T, old: T | undefined) => void, options: { immediate?: boolean } = {}): Binding {
    const sub = this.makeSub(expression, callback);
    this.subs.add(sub);
    if (options.immediate) this.runSub(sub);
    else this.schedule();
    return { destroy: () => { sub.dead = true; this.subs.delete(sub); } };
  }

  private makeSub(expression: string | string[], run: (value: any, old: any) => void): Sub {
    let paths: string[];
    let read: () => any;
    let single = true;
    if (Array.isArray(expression)) {
      paths = expression.map(e => e.replace(/^!/, ''));
      single = false;
      read = () => expression.map(e => (e.startsWith('!') ? !this.get(e.slice(1)) : this.get(e)));
    } else {
      const text = String(expression);
      const whole = /^\{([\w.$]+)\}$/.exec(text);
      const negated = /^!\{?([\w.$]+)\}?$/.exec(text);
      const pieces = [...text.matchAll(/\{([\w.$]+)\}/g)];
      if (whole) { paths = [whole[1]]; read = () => this.get(whole[1]); }
      else if (negated) { paths = [negated[1]]; read = () => !this.get(negated[1]); }
      else if (pieces.length) {
        paths = pieces.map(m => m[1]);
        // A template waits until everything in it has a value, so it never shows "undefined"
        read = () => {
          const values = paths.map(p => this.get(p));
          if (values.some(v => v === undefined)) return undefined;
          return text.replace(/\{([\w.$]+)\}/g, (_w, p) => { const v = this.get(p); return v === null ? '' : String(v); });
        };
      } else { paths = [text]; read = () => this.get(text); }
    }
    return { paths, last: [], single, run, first: true, dirty: true, read, dead: false };
  }

  private runSub(sub: Sub): void {
    if (sub.dead) return;
    sub.dirty = false;
    const value = sub.read();
    const empty = Array.isArray(value) && !sub.single ? value.every(v => v === undefined) : value === undefined;
    if (empty) return; // nothing to show yet
    const old = sub.last.length ? sub.last[0] : undefined;
    if (!sub.first && sameData(old, value)) return;
    sub.first = false;
    sub.last = [clone(value)];
    try {
      sub.run(value, old);
    } catch (e) {
      console.error('ViewModel binding threw:', e);
    }
  }

  // ────────── Change notification ──────────

  /** Something at `path` changed: formulas that read it are stale, and bindings on it will run */
  private touch(path: string): void {
    this.changed.add(path);
    this.schedule();
    this.children.forEach(c => c.touchFromParent(path));
  }

  private touchFromParent(path: string): void {
    // Only if this model does not shadow it with its own data
    const root = split(path)[0];
    if (this.formulas.has(root) || Object.hasOwn(this.data, root)) return;
    this.touch(path);
  }

  private schedule(): void {
    if (this.scheduled || this.destroyed) return;
    this.chain = this.inFlush ? this.chain + 1 : 0;
    if (this.chain > MAX_PASSES) {
      console.error('ViewModel: bindings keep changing the data they read (a loop?). Stopped.');
      this.changed.clear();
      this.chain = 0;
      return;
    }
    this.scheduled = true;
    queueMicrotask(() => this.flush());
  }

  /** Run the pending bindings now, instead of waiting for the next microtask (tests, and code that must read the DOM at once) */
  flush(): void {
    this.scheduled = false;
    if (this.destroyed) return;
    this.inFlush = true;
    try {
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const paths = [...this.changed];
        this.changed.clear();
        // Formulas that read a changed path go stale, and what they produce counts as a change too
        let again = false;
        for (const [name, entry] of this.computed) {
          if (!entry.dirty && paths.some(p => [...entry.deps].some(d => overlaps(p, d)))) {
            entry.dirty = true;
            const before = entry.value;
            const after = this.evaluate(name);
            if (!sameData(before, after)) {
              this.changed.add(name);
              again = true;
              this.children.forEach(c => c.touchFromParent(name)); // a child may bind to this formula
            }
          }
        }
        this.subs.forEach(sub => {
          if (sub.dirty || paths.some(p => sub.paths.some(sp => overlaps(p, sp)))) this.runSub(sub);
        });
        if (again) continue; // formulas changed: let what reads them see it, now
        // A callback set some data: settle it in the next microtask (guarded in schedule())
        if (this.changed.size) this.schedule();
        return;
      }
      console.error('ViewModel: formulas keep changing each other (a loop?). Stopped.');
      this.changed.clear();
    } finally {
      this.inFlush = false;
    }
  }

  /** Stop everything: bindings are dropped, and the model leaves its parent */
  destroy(): void {
    this.destroyed = true;
    this.subs.clear();
    this.parent?.children.delete(this);
    this.children.forEach(c => c.destroy());
    this.children.clear();
    this.stores.clear();
  }

  /** A model that sees this one's data and can add its own: for a part of a page */
  createChild(config: Omit<ViewModelConfig, 'parent'> = {}): ViewModel {
    return new ViewModel({ ...config, parent: this });
  }

  // ────────── Binding to elements ──────────

  /**
   * Bind properties of an element to expressions:
   *
   * ```ts
   * vm.bindElement(input, { value: 'user.name' });                 // two-way: typing sets user.name
   * vm.bindElement(label, { text: 'Hello {user.name}', hidden: '!user.loggedIn' });
   * ```
   * `value` and `checked` are two-way on form fields (they listen for `change` and `input`). Others are
   * one-way: `text` (as text, never markup), `hidden`, `disabled`, `readonly`, `required`, `title`,
   * `class:name` (toggles a class), `attr:name` (an attribute; `null` or `false` removes it) and any
   * property by name. `store` hands a store to a grid. The other way, from the element into the data: `selection`
   * (the selected rows), `selected` (the first one, or `null`) and `event:name` (the event's detail).
   */
  bindElement(el: Element, bindings: Record<string, string>): Binding {
    const subs: Binding[] = [];
    const cleanups: Array<() => void> = [];
    for (const [key, expr] of Object.entries(bindings)) {
      // Things the element tells us: its selection, or the detail of any event. They go from the element into the data.
      const published = publishedBy(key);
      if (published) {
        const path = expr.replace(/^\{|\}$/g, '');
        const handler = (e: Event) => this.set(path, published.read(e, el));
        el.addEventListener(published.event, handler);
        cleanups.push(() => el.removeEventListener(published.event, handler));
        continue;
      }
      const apply = (value: any) => applyToElement(el, key, value);
      subs.push(this.bind(expr, apply));
      const twoWay = (key === 'value' || key === 'checked') && /^\{?[\w.$]+\}?$/.test(expr) && !expr.startsWith('!');
      if (twoWay) {
        const path = expr.replace(/^\{|\}$/g, '');
        const handler = () => this.set(path, key === 'checked' ? !!(el as any).checked : (el as any).value);
        ['input', 'change'].forEach(type => el.addEventListener(type, handler));
        cleanups.push(() => ['input', 'change'].forEach(type => el.removeEventListener(type, handler)));
      }
    }
    return { destroy: () => { subs.forEach(s => s.destroy()); cleanups.forEach(c => c()); } };
  }

  /**
   * Bind every element under `root` that has `bind-…` attributes, so templates and server HTML can
   * carry their bindings: `<nx-input bind-value="user.name">`, `<span bind-text="Hi {user.name}">`,
   * `<nx-button bind-disabled="!user.name">`, `<div bind-class-open="menuOpen">`, `<a bind-attr-href="link">`.
   */
  bindAll(root: ParentNode): Binding {
    const subs: Binding[] = [];
    const all = [root instanceof Element ? root : null, ...Array.from(root.querySelectorAll('*'))].filter((e): e is Element => !!e);
    for (const el of all) {
      const bindings: Record<string, string> = {};
      for (const attr of Array.from(el.attributes)) {
        const m = /^bind-(.+)$/.exec(attr.name);
        if (!m) continue;
        // bind-class-open → class:open, bind-attr-href → attr:href
        const key = m[1].replace(/^class-/, 'class:').replace(/^attr-/, 'attr:').replace(/^event-/, 'event:');
        bindings[key] = attr.value;
      }
      if (Object.keys(bindings).length) subs.push(this.bindElement(el, bindings));
    }
    return { destroy: () => subs.forEach(s => s.destroy()) };
  }
}

/** Bindings that go the other way: the element's selection (`selection`, `selected`) or an event's detail (`event:name`) */
function publishedBy(key: string): { event: string; read: (e: Event, el: Element) => unknown } | null {
  if (key === 'selection') return { event: 'selection-change', read: (e, el) => (e as CustomEvent).detail?.selected ?? (el as any).getSelected?.() ?? [] };
  if (key === 'selected') return { event: 'selection-change', read: (e, el) => ((e as CustomEvent).detail?.selected ?? (el as any).getSelected?.() ?? [])[0] ?? null };
  if (key.startsWith('event:')) return { event: key.slice(6), read: e => (e as CustomEvent).detail };
  return null;
}

const BOOLEAN_PROPS = new Set(['hidden', 'disabled', 'readonly', 'required', 'checked', 'selected', 'open']);

function applyToElement(el: Element, key: string, value: any): void {
  // A store goes to a component through its `setStore()` (a grid, a pager…)
  if (key === 'store') { (el as any).setStore?.(value); return; }
  if (key === 'text') { el.textContent = value === null || value === undefined ? '' : String(value); return; }
  if (key.startsWith('class:')) { el.classList.toggle(key.slice(6), !!value); return; }
  if (key.startsWith('attr:')) {
    const name = key.slice(5);
    if (value === null || value === undefined || value === false) el.removeAttribute(name);
    else el.setAttribute(name, value === true ? '' : String(value));
    return;
  }
  if (BOOLEAN_PROPS.has(key) && key !== 'checked') {
    // As an attribute, so components that watch attributes (and server HTML) see it
    el.toggleAttribute(key, !!value);
    return;
  }
  // `value` and `checked`: never set the same value back (it would move the caret or fire pointless updates)
  if ((el as any)[key] === value) return;
  (el as any)[key] = value === undefined ? '' : value;
}

/** Make a view model: `NX.viewModel({ data: { name: 'Ada' }, formulas: { shout: get => get('name').toUpperCase() } })` */
export function createViewModel(config: ViewModelConfig = {}): ViewModel {
  return new ViewModel(config);
}
