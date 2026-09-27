/**
 * @file @/app.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

import { BaseComponent } from '@/components/abstracts/base';
import { ComponentRegistry, type ComponentConfig, type ItemConfig } from '@/core/registry';
import { Router, type Route, type RouteConfig, type RouterConfig } from '@/core/router';
import { ThemeManager } from '@/core/theme';
import { Icons } from '@/core/icons';
import { Store, type StoreConfig as CoreStoreConfig } from '@/data/store';
import { toast } from '@/components/ui/toast';
import { alert, confirm, dialog, prompt, type ModalConfig } from '@/components/ui/modal';
import { showMenu } from '@/components/ui/menu';

export type { ComponentConfig, ItemConfig } from '@/core/registry';

export interface StoreConfig extends CoreStoreConfig<any> {}

export interface ApplicationConfig {
  /** Mount point (selector or element). Defaults to `document.body`. */
  el?: string | HTMLElement;
  /** Document title */
  title?: string;
  /** `light` | `dark` | `midnight` | a registered theme. Omit to follow the user's saved choice / OS setting. */
  theme?: string;
  /**
   * Top-level items, placed in a full-screen border layout. Give items a
   * `region` (`north`, `west`, `center`, `east`, `south`); items without one go to the center.
   */
  items?: ItemConfig[];
  /** Long form of `items`: `{ type: 'border' | 'fit' | 'card', items }` */
  layout?: LayoutConfig;
  /** Named stores, bindable from components with `store: 'name'` */
  stores?: Record<string, StoreConfig | Store<any>>;
  /** Routes render their `view` into the `{ xtype: 'outlet' }` component */
  router?: RouterConfig | RouteConfig[];
  plugins?: Plugin[];
  ready?: (app: NXApplication) => void;
}

export interface LayoutConfig {
  type?: 'border' | 'viewport' | 'fit' | 'card';
  items?: ItemConfig[];
}

export interface Plugin {
  name: string;
  install: (app: NXApplication) => void;
}

/**
 * Bootstraps an application: theme, stores, router and the viewport.
 * Create it with `NX.app({...})`.
 */
export class NXApplication extends EventTarget {
  private static instance: NXApplication | null = null;
  private config: ApplicationConfig = {};
  private container: HTMLElement | null = null;
  private router: Router | null = null;
  private stores = new Map<string, Store<any>>();
  private viewport: HTMLElement | null = null;
  private ready = false;

  private constructor() {
    super();
  }

  /**
   * Create the application (there is one per page).
   */
  static create(config: ApplicationConfig): NXApplication {
    if (NXApplication.instance) {
      console.warn('[nx] Application already exists. Returning existing instance.');
      return NXApplication.instance;
    }

    NXApplication.instance = new NXApplication();
    NXApplication.instance.configure(config);
    return NXApplication.instance;
  }

  static get current(): NXApplication | null {
    return NXApplication.instance;
  }

  private configure(config: ApplicationConfig): void {
    this.config = config;

    // The app's theme is the default; a theme the user picked (and we saved) wins
    if (config.theme) ThemeManager.setDefault(config.theme);
    if (config.title) document.title = config.title;

    config.plugins?.forEach(plugin => plugin.install(this));

    Object.entries(config.stores ?? {}).forEach(([name, storeConfig]) => {
      const store = storeConfig instanceof Store ? storeConfig : new Store(storeConfig);
      Store.register(name, store);
      this.stores.set(name, store);
    });

    if (config.router) {
      const routerConfig = Array.isArray(config.router) ? { routes: config.router } : config.router;
      this.router = new Router(routerConfig);
      this.router.on('navigate', route => this.handleRouteChange(route));
    }
  }

  /**
   * Build the UI and start the router. Safe to call before DOMContentLoaded.
   */
  launch(): this {
    if (this.ready) {
      console.warn('[nx] Application already launched');
      return this;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.launch(), { once: true });
      return this;
    }

    this.container = resolveElement(this.config.el) ?? null;
    if (!this.container) {
      throw new Error(`[nx] Application container "${this.config.el}" not found`);
    }

    this.createViewport();

    this.stores.forEach((store, name) => {
      const config = this.config.stores?.[name];
      if (config && !(config instanceof Store) && config.autoLoad && !config.data) {
        store.load().catch(error => console.error(`[nx] Store "${name}" failed to load`, error));
      }
    });

    // Tree nodes with a `route` navigate when selected
    this.container.addEventListener('select', (e: Event) => {
      const route = (e as CustomEvent).detail?.node?.route;
      if (route && this.router) this.navigate(route);
    });

    this.router?.start();

    this.ready = true;
    this.dispatchEvent(new CustomEvent('ready'));
    this.config.ready?.(this);
    return this;
  }

  private createViewport(): void {
    const layout = this.config.layout ?? { type: 'border', items: this.config.items ?? [] };

    const viewport = document.createElement('nx-viewport');
    viewport.setAttribute('layout', layout.type === 'viewport' ? 'border' : layout.type ?? 'border');
    ComponentRegistry.appendItems(viewport, layout.items ?? []);

    this.container!.replaceChildren(viewport);
    this.viewport = viewport;
  }

  private async handleRouteChange(route: Route): Promise<void> {
    this.dispatchEvent(new CustomEvent('route', { detail: route }));

    const config = route.matched[route.matched.length - 1];
    if (!config) return;

    if (config.title) {
      document.title = this.config.title ? `${config.title} · ${this.config.title}` : config.title;
    }

    // Sync tree selection with the route
    this.container?.querySelectorAll('nx-tree').forEach(tree => {
      const find = (nodes: any[]): any => {
        for (const node of nodes ?? []) {
          if (node.route === route.path) return node;
          const found = find(node.children);
          if (found) return found;
        }
        return null;
      };
      const node = find((tree as any).getState?.('data') ?? []);
      if (node) (tree as any).select(node.id ?? node.text);
    });

    if (config.layout) {
      this.config.layout = config.layout;
      this.createViewport();
      return;
    }

    const outlet = this.container?.querySelector('nx-outlet, [data-outlet]');
    if (!outlet || config.view === undefined) return;

    try {
      const view = typeof config.view === 'function' ? await config.view(route) : config.view;
      // A newer navigation may have happened meanwhile
      if (this.router?.getCurrentRoute() !== route) return;
      const element = ComponentRegistry.build(view);
      outlet.replaceChildren(...(element ? [element] : []));
    } catch (error) {
      console.error(`[nx] Failed to render route "${route.path}"`, error);
    }
  }

  // ────────── Public API ──────────

  getStore<T extends Record<string, any> = any>(name: string): Store<T> | undefined {
    return this.stores.get(name) ?? Store.lookup<T>(name);
  }

  getRouter(): Router | null {
    return this.router;
  }

  getViewport(): HTMLElement | null {
    return this.viewport;
  }

  /** Show/hide a side region (off-canvas on narrow screens). */
  toggleRegion(region: 'west' | 'east' = 'west', force?: boolean): void {
    (this.viewport as any)?.toggleRegion?.(region, force);
  }

  navigate(path: string, options?: { replace?: boolean; state?: any }): void {
    this.router?.navigate(path, options);
  }

  /** @deprecated use `NX.toast()` */
  notify(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    toast(message, { type });
  }

  /** @deprecated use `NX.dialog()` */
  modal(config: ModalConfig): Promise<any> {
    return dialog(config);
  }

  getTheme(): string {
    return ThemeManager.current;
  }

  setTheme(theme: string): void {
    ThemeManager.setTheme(theme);
    this.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  }
}

/**
 * Router outlet: routes render their `view` here.
 */
class NXOutlet extends HTMLElement {
  connectedCallback(): void {
    this.style.display = this.style.display || 'block';
    this.style.minHeight = '0';
    this.style.overflow = this.style.overflow || 'auto';
  }
}
if (!customElements.get('nx-outlet')) customElements.define('nx-outlet', NXOutlet);
ComponentRegistry.alias('outlet', 'nx-outlet');

function resolveElement(el?: string | Element | null): HTMLElement | null {
  if (!el) return document.body;
  return (typeof el === 'string' ? document.querySelector(el) : el) as HTMLElement | null;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// ────────── NX facade ──────────

export const NX = {
  /** Library version */
  version: '0.1.0',

  /**
   * Create and launch an application.
   *
   * ```typescript
   * NX.app({
   *   title: 'Admin',
   *   items: [
   *     { xtype: 'toolbar', region: 'north', items: [...] },
   *     { xtype: 'panel', region: 'west', width: 240, items: [...] },
   *     { xtype: 'outlet' }
   *   ],
   *   router: [{ path: '/', view: { xtype: 'grid', store: 'users', columns: [...] } }]
   * });
   * ```
   */
  app(config: ApplicationConfig): NXApplication {
    return NXApplication.create(config).launch();
  },

  /** Create an application without launching it (call `.launch()` yourself). */
  application: (config: ApplicationConfig) => NXApplication.create(config),

  /**
   * Create a component tree from a config.
   *
   * ```typescript
   * NX.create({ xtype: 'button', text: 'Hi', handler: () => NX.toast('Hi!') });
   * NX.create('button', { text: 'Hi' });
   * ```
   */
  create<T extends HTMLElement = HTMLElement>(xtypeOrConfig: string | ComponentConfig, config: Record<string, any> = {}): T {
    const element = typeof xtypeOrConfig === 'string'
      ? ComponentRegistry.create(xtypeOrConfig, config)
      : ComponentRegistry.build(xtypeOrConfig);
    return element as T;
  },

  /**
   * Build a component tree and mount it into `target` (selector or element).
   * Accepts a single config or an array. Returns the created element(s).
   */
  render(items: ItemConfig | ItemConfig[], target: string | Element): HTMLElement[] {
    const parent = resolveElement(target);
    if (!parent) throw new Error(`[nx] render target "${target}" not found`);
    const built = (Array.isArray(items) ? items : [items])
      .map(item => ComponentRegistry.build(item))
      .filter((el): el is HTMLElement => !!el);
    parent.append(...built);
    return built;
  },

  /** Find a component by id (`NX.get('saveBtn')`). */
  get<T extends HTMLElement = any>(id: string): T | null {
    return document.getElementById(id) as T | null;
  },

  /** Register a component class under an xtype. */
  register(xtype: string, component: typeof BaseComponent): void {
    ComponentRegistry.register(xtype, component);
  },

  /**
   * Define a component from plain functions.
   *
   * ```typescript
   * NX.define('greeting', {
   *   render() { return `<p>Hello, ${this.getProp('name', 'world')}!</p>`; },
   *   styles() { return `p { color: var(--color-primary); }`; }
   * });
   * NX.create({ xtype: 'greeting', name: 'Ada' });
   * ```
   */
  define(xtype: string, config: {
    observedAttributes?: string[];
    initializeState?: (this: any) => void;
    render?: (this: any) => string;
    styles?: (this: any) => string;
    initialize?: (this: any) => void;
    afterRender?: (this: any) => void;
    [method: string]: any;
  }): typeof BaseComponent {
    const Component = class extends BaseComponent {
      static get observedAttributes() {
        return config.observedAttributes || [];
      }

      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      protected initializeState(): void {
        config.initializeState?.call(this);
      }

      protected render(): string {
        return config.render?.call(this) ?? '<slot></slot>';
      }

      protected styles(): string {
        return config.styles?.call(this) ?? ':host { display: block; }';
      }

      protected initialize(): void {
        super.initialize();
        config.initialize?.call(this);
      }

      protected afterRender(): void {
        config.afterRender?.call(this);
      }
    };

    const reserved = ['observedAttributes', 'initializeState', 'render', 'styles', 'initialize', 'afterRender'];
    Object.entries(config).forEach(([key, value]) => {
      if (typeof value === 'function' && !reserved.includes(key)) {
        (Component.prototype as any)[key] = value;
      }
    });

    ComponentRegistry.register(xtype, Component);
    return Component;
  },

  /** The running application, if any. */
  get current(): NXApplication | null {
    return NXApplication.current;
  },

  /** Create (and optionally register under a name) a data store. */
  store<T extends Record<string, any> = any>(nameOrConfig: string | CoreStoreConfig<T>, config?: CoreStoreConfig<T>): Store<T> {
    if (typeof nameOrConfig === 'string') {
      return config ? Store.register(nameOrConfig, new Store<T>(config)) : (Store.lookup<T>(nameOrConfig) as Store<T>);
    }
    return new Store<T>(nameOrConfig);
  },

  /** Open a menu at an element or mouse event (context menus). */
  menu: showMenu,

  // Feedback
  toast,
  alert,
  confirm,
  prompt,
  dialog,

  // Theming
  theme: {
    set: (name: string) => ThemeManager.setTheme(name),
    get: () => ThemeManager.current,
    toggle: () => ThemeManager.toggle(),
    list: () => ThemeManager.getThemes(),
    register: ThemeManager.registerTheme.bind(ThemeManager),
    extend: ThemeManager.createTheme.bind(ThemeManager),
    onChange: ThemeManager.subscribe.bind(ThemeManager)
  },

  icons: Icons,

  utils: {
    /** Deep merge objects into `target` */
    merge: function merge(target: any, ...sources: any[]): any {
      if (!sources.length) return target;
      const source = sources.shift();

      if (isObject(target) && isObject(source)) {
        for (const key in source) {
          if (isObject(source[key])) {
            if (!target[key]) Object.assign(target, { [key]: {} });
            merge(target[key], source[key]);
          } else {
            Object.assign(target, { [key]: source[key] });
          }
        }
      }

      return merge(target, ...sources);
    },

    id: (prefix = 'nx') => `${prefix}-${Math.random().toString(36).slice(2, 11)}`,

    debounce<A extends any[]>(fn: (...args: A) => void, delay: number): (...args: A) => void {
      let timeout: ReturnType<typeof setTimeout>;
      return (...args: A) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
      };
    },

    formatDate: (date: Date | string, format = 'YYYY-MM-DD') => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return format
        .replace('YYYY', String(d.getFullYear()))
        .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
        .replace('DD', String(d.getDate()).padStart(2, '0'));
    }
  }
};

// Handy in the console and for script-tag users
(window as any).NX = NX;
