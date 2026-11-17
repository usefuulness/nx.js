// src/core/router.ts
import { EventBus } from '@/core/events/event-bus';

export interface RouteConfig {
  path: string;
  /**
   * What to render in the app's `outlet` for this route: a component config,
   * an element, or a function of the route returning either (may be async).
   */
  view?: any;
  /** Document title while this route is active */
  title?: string;
  component?: string | (() => Promise<any>);
  layout?: any;
  beforeEnter?: (route: Route) => boolean | Promise<boolean>;
  /**
   * Fetch this route's data. It runs before the route is shown (the previous page stays up,
   * the outlet is `aria-busy`), the result arrives as `route.data`, and a newer navigation
   * aborts it through `signal`. It may also run on the server: see `Router.resolve()`.
   */
  loader?: (context: LoaderContext) => unknown | Promise<unknown>;
  /** Milliseconds a loader result is reused for the same URL (default 0: load on every visit) */
  staleTime?: number;
  /** What to render when `loader` throws: a view like `view`, called with the error */
  errorView?: any;
  children?: RouteConfig[];
  meta?: Record<string, any>;
}

export interface LoaderContext {
  route: Route;
  params: Record<string, string>;
  query: Record<string, string>;
  /** Aborted when a newer navigation replaces this one */
  signal: AbortSignal;
}

export interface Route {
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  hash: string;
  fullPath: string;
  matched: RouteConfig[];
  meta: Record<string, any>;
  /** True when the visit came from the browser's back/forward buttons rather than a link or `navigate()` */
  history?: boolean;
  /** What the route's `loader` returned */
  data?: any;
  /** What the route's `loader` threw, if it did */
  error?: unknown;
}

export interface RouterConfig {
  mode?: 'hash' | 'history';
  base?: string;
  routes?: RouteConfig[];
  /**
   * `history` mode only (default true): same-origin `<a href>` clicks navigate without a page load.
   * Left alone: modified clicks, `target`, `download`, `rel="external"` and other origins.
   */
  links?: boolean;
  /** Load a link's route data when the pointer or focus reaches it (default 'hover'); `false` to turn off */
  prefetch?: 'hover' | false;
}

interface RouteMatch {
  route: RouteConfig;
  params: Record<string, string>;
  regex: RegExp;
  keys: string[];
}

/** How long a prefetched or server-seeded result stays usable */
const PREFETCH_TTL = 30_000;
const SEED_TTL = 60_000;

/**
 * The `<script>` that hands a server-loaded route to the browser, so the first visit reuses the
 * data instead of fetching it again. Put it in the page `<head>` or `<body>`.
 */
export function routeDataScript(route: Pick<Route, 'fullPath' | 'data'>): string {
  const json = JSON.stringify({ path: route.fullPath, data: route.data ?? null })
    // Nothing in the data may end the script element or be read as markup
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `<script type="application/json" id="nx-route-data">${json}</script>`;
}

/**
 * Client-side router for single-page applications
 */
export class Router extends EventBus {
  private mode: 'hash' | 'history';
  private base: string;
  private routes: RouteMatch[] = [];
  private currentRoute: Route | null = null;
  private fallback: RouteConfig | null = null;
  private beforeHooks: Array<(to: Route, from: Route | null) => boolean | Promise<boolean>> = [];
  private afterHooks: Array<(to: Route, from: Route | null) => void> = [];
  private navId = 0;
  private programmatic = false;
  private fromHistory = false;
  private linkOptions: { links: boolean; prefetch: 'hover' | false };
  private prefetching = new Set<string>();
  private disposers: Array<() => void> = [];
  private controller: AbortController | null = null;
  private loading = false;
  private cache = new Map<string, { data: any; expires: number }>();

  constructor(config: RouterConfig = {}) {
    super();
    this.mode = config.mode || 'hash';
    this.base = this.normalizeBase(config.base || '/');
    this.linkOptions = { links: config.links ?? this.mode === 'history', prefetch: config.prefetch ?? 'hover' };
    
    if (config.routes) {
      this.addRoutes(config.routes);
    }
  }

  /**
   * Normalize base path
   */
  private normalizeBase(base: string): string {
    if (!base) return '/';
    // Ensure base starts with / and doesn't end with /
    return '/' + base.replace(/^\/+|\/+$/g, '');
  }

  /**
   * Add routes to the router
   */
  addRoutes(routes: RouteConfig[]): void {
    routes.forEach(route => this.addRoute(route));
  }

  /**
   * Add a single route
   */
  private addRoute(route: RouteConfig, parent?: RouteConfig): void {
    const path = parent ? `${parent.path}${route.path}` : route.path;
    
    // Handle catch-all route
    if (path === '*') {
      this.fallback = route;
      return;
    }

    // Convert path to regex
    const keys: string[] = [];
    const pattern = path
      .replace(/\//g, '\\/')
      .replace(/:(\w+)/g, (_, key) => {
        keys.push(key);
        return '([^/]+)';
      })
      .replace(/\*/g, '(.*)');

    const regex = new RegExp(`^${pattern}$`);

    this.routes.push({
      route: { ...route, path },
      params: {},
      regex,
      keys
    });

    // Add child routes
    if (route.children) {
      route.children.forEach(child => this.addRoute(child, route));
    }
  }

  /**
   * Start the router
   */
  start(): void {
    // The browser's own navigation (back/forward, a typed hash) is not a navigate() call
    const onBrowserNavigation = () => {
      this.fromHistory = !this.programmatic;
      this.programmatic = false;
      this.handleRoute();
    };
    this.listen(window, this.mode === 'hash' ? 'hashchange' : 'popstate', onBrowserNavigation);
    if (this.mode === 'history' && this.linkOptions.links) this.interceptLinks();

    if (typeof document !== 'undefined') this.readSeed();

    // Handle initial route
    this.handleRoute();
  }

  /**
   * Navigate to a path
   */
  navigate(path: string, options: { replace?: boolean; state?: any } = {}): void {
    const url = this.createUrl(path);

    if (this.mode === 'hash') {
      if (location.hash === url) return; // no hashchange would follow
      this.programmatic = true;
      if (options.replace) {
        location.replace(url);
      } else {
        location.hash = path;
      }
    } else {
      if (options.replace) {
        history.replaceState(options.state, '', url);
      } else {
        history.pushState(options.state, '', url);
      }
      this.fromHistory = false;
      this.handleRoute();
    }
  }

  private listen(target: EventTarget, type: string, handler: (e: Event) => void): void {
    target.addEventListener(type, handler);
    this.disposers.push(() => target.removeEventListener(type, handler));
  }

  /** Stop listening to the browser (history, links). A stopped router can be `start()`ed again. */
  stop(): void {
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
    this.controller?.abort();
    this.navId++;
  }

  /** The route path a same-origin link points at, or null when the router should leave it alone. */
  private linkTarget(anchor: HTMLAnchorElement): string | null {
    if (anchor.target && anchor.target !== '_self') return null;
    if (anchor.hasAttribute('download') || /\bexternal\b/.test(anchor.rel) || anchor.hasAttribute('data-nx-external')) return null;
    let url: URL;
    try {
      url = new URL(anchor.href, location.href);
    } catch {
      return null;
    }
    if (url.origin !== location.origin) return null;
    const { pathname } = url;
    if (this.base !== '/' && pathname !== this.base && !pathname.startsWith(this.base + '/')) return null;
    const path = this.base === '/' ? pathname : pathname.slice(this.base.length) || '/';
    return path + url.search + url.hash;
  }

  private interceptLinks(): void {
    const anchorOf = (e: Event) =>
      e.composedPath().find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement && el.hasAttribute('href'));

    this.listen(document, 'click', (e: Event) => {
      if (!(e instanceof MouseEvent)) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = anchorOf(e);
      const target = anchor && this.linkTarget(anchor);
      if (target === null || target === undefined) return;
      // A bare #fragment on this page is the browser's job
      if (anchor!.getAttribute('href')!.startsWith('#')) return;
      e.preventDefault();
      this.navigate(target);
    });

    if (this.linkOptions.prefetch === 'hover') {
      const warm = (e: Event) => {
        const anchor = anchorOf(e);
        const target = anchor && this.linkTarget(anchor);
        if (!target || this.prefetching.has(target)) return;
        this.prefetching.add(target);
        this.prefetch(target).catch(() => {}).finally(() => this.prefetching.delete(target));
      };
      this.listen(document, 'pointerover', warm);
      this.listen(document, 'focusin', warm);
    }
  }

  /**
   * Go back in history
   */
  back(): void {
    window.history.back();
  }

  /**
   * Go forward in history
   */
  forward(): void {
    window.history.forward();
  }

  /**
   * Create URL for a path
   */
  private createUrl(path: string): string {
    if (this.mode === 'hash') {
      return `#${path}`;
    }
    return this.base === '/' ? path : this.base + path;
  }

  /**
   * Get current path
   */
  private getCurrentPath(): string {
    if (this.mode === 'hash') {
      return location.hash.slice(1) || '/';
    }
    
    const path = location.pathname;
    const rest = location.search + location.hash;
    if (this.base === '/') return path + rest;

    return (path.startsWith(this.base) ? path.slice(this.base.length) || '/' : path) + rest;
  }

  /**
   * Parse query string
   */
  private parseQuery(query: string): Record<string, string> {
    const params: Record<string, string> = {};
    if (!query) return params;

    query.split('&').forEach(param => {
      const [key, value] = param.split('=');
      if (key) {
        params[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
    });

    return params;
  }

  /**
   * Match a path (`/users/42?tab=1`) against the routes. Pure: no location, no hooks, no loaders.
   */
  match(path: string): Route {
    // The fragment comes last (`/a?x=1#top`), so cut it first, then the query
    const hashAt = path.indexOf('#');
    const hash = hashAt >= 0 ? path.slice(hashAt + 1) : '';
    const beforeHash = hashAt >= 0 ? path.slice(0, hashAt) : path;
    const queryAt = beforeHash.indexOf('?');
    const pathWithoutHash = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
    const search = queryAt >= 0 ? beforeHash.slice(queryAt + 1) : '';

    const route: Route = {
      path: pathWithoutHash,
      params: {},
      query: this.parseQuery(search),
      hash: hash || '',
      fullPath: path,
      matched: [],
      meta: {}
    };

    let matched = false;
    for (const routeMatch of this.routes) {
      const match = routeMatch.regex.exec(pathWithoutHash);
      if (match) {
        matched = true;
        route.matched.push(routeMatch.route);
        routeMatch.keys.forEach((key, index) => {
          const raw = match[index + 1];
          try {
            route.params[key] = decodeURIComponent(raw);
          } catch {
            route.params[key] = raw; // malformed %-escape: keep it as written
          }
        });
        Object.assign(route.meta, routeMatch.route.meta);
        break;
      }
    }

    // Use fallback if no match
    if (!matched && this.fallback) route.matched.push(this.fallback);
    return route;
  }

  /**
   * Match a path and run its loader, with no browser involved: the server-side half of loaders.
   * Render the page from `route.data`, then embed it with `routeDataScript(route)` so the browser
   * doesn't fetch it again. A loader that throws sets `route.error` instead of rejecting.
   */
  async resolve(path: string, signal?: AbortSignal): Promise<Route> {
    const route = this.match(path);
    await this.runLoader(route, signal ?? new AbortController().signal);
    return route;
  }

  private async runLoader(route: Route, signal: AbortSignal, forPrefetch = false): Promise<void> {
    const config = route.matched[0];
    if (!config?.loader) return;

    const hit = this.cache.get(route.fullPath);
    if (hit && hit.expires > Date.now()) {
      route.data = hit.data;
      return;
    }
    try {
      route.data = await config.loader({ route, params: route.params, query: route.query, signal });
      const ttl = forPrefetch ? config.staleTime || PREFETCH_TTL : config.staleTime || 0;
      if (ttl > 0) this.cache.set(route.fullPath, { data: route.data, expires: Date.now() + ttl });
    } catch (error) {
      if (signal.aborted) throw error;
      route.error = error;
    }
  }

  /** Run a route's loader ahead of time (on link hover, say); the next visit reuses it briefly. */
  async prefetch(path: string): Promise<void> {
    const route = this.match(path);
    await this.runLoader(route, new AbortController().signal, true);
  }

  /** Drop cached loader results: one path, or all of them. */
  invalidate(path?: string): void {
    if (path) this.cache.delete(path);
    else this.cache.clear();
  }

  /** Run the current route's loader again, e.g. after a save, and show the fresh data. */
  async reload(): Promise<void> {
    if (!this.currentRoute) return;
    this.invalidate(this.currentRoute.fullPath);
    await this.handleRoute();
  }

  /** Whether a navigation is still waiting for its loader. */
  isLoading(): boolean {
    return this.loading;
  }

  /** Data the server rendered for `path`, so the first visit doesn't load it again. */
  seed(path: string, data: unknown): void {
    this.cache.set(path, { data, expires: Date.now() + SEED_TTL });
  }

  private readSeed(): void {
    try {
      const el = document.getElementById('nx-route-data');
      if (!el?.textContent) return;
      const { path, data } = JSON.parse(el.textContent);
      if (typeof path === 'string') this.seed(path, data);
    } catch {
      // No usable seed: the loader simply runs
    }
  }

  /**
   * Handle route change
   */
  private async handleRoute(): Promise<void> {
    const id = ++this.navId;
    this.controller?.abort();
    const controller = (this.controller = new AbortController());
    const stale = () => id !== this.navId;

    const route = this.match(this.getCurrentPath());
    route.history = this.fromHistory;
    this.fromHistory = false;

    // Run before hooks
    const from = this.currentRoute;
    this.emit('beforeNavigate', { to: route, from });

    for (const hook of this.beforeHooks) {
      const result = await hook(route, from);
      if (stale() || result === false) return;
    }

    // Run route-specific beforeEnter
    for (const matchedRoute of route.matched) {
      if (matchedRoute.beforeEnter) {
        const result = await matchedRoute.beforeEnter(route);
        if (stale() || result === false) return;
      }
    }

    // Load data before showing the route; a newer navigation abandons this one
    if (route.matched[0]?.loader) {
      this.loading = true;
      this.emit('loading', { to: route, from });
      try {
        await this.runLoader(route, controller.signal);
      } catch {
        // Aborted by a newer navigation
      }
      if (stale()) return;
      this.loading = false;
      this.emit('loaded', { to: route, from });
    }

    // Update current route
    this.currentRoute = route;
    this.emit('navigate', route);

    // Run after hooks
    for (const hook of this.afterHooks) {
      hook(route, from);
    }

    this.emit('afterNavigate', { to: route, from });
  }

  /**
   * Add global before hook
   */
  beforeEach(hook: (to: Route, from: Route | null) => boolean | Promise<boolean>): void {
    this.beforeHooks.push(hook);
  }

  /**
   * Add global after hook
   */
  afterEach(hook: (to: Route, from: Route | null) => void): void {
    this.afterHooks.push(hook);
  }

  /**
   * Get current route
   */
  getCurrentRoute(): Route | null {
    return this.currentRoute;
  }

  /**
   * Get route config by path
   */
  getRouteConfig(path: string): RouteConfig | undefined {
    for (const routeMatch of this.routes) {
      if (routeMatch.route.path === path) {
        return routeMatch.route;
      }
    }
    return undefined;
  }

  /**
   * Check if path matches current route
   */
  isActive(path: string, exact = true): boolean {
    if (!this.currentRoute) return false;
    
    if (exact) {
      return this.currentRoute.path === path;
    }
    
    return this.currentRoute.path.startsWith(path);
  }

  /**
   * Generate link for a path
   */
  link(path: string, params?: Record<string, string>): string {
    let finalPath = path;
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        finalPath = finalPath.replace(`:${key}`, value);
      });
    }
    
    return this.createUrl(finalPath);
  }
}
