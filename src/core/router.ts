// src/core/router.ts
import { EventBus } from '@/core/zustand/event-bus';

export interface RouteConfig {
  path: string;
  component?: string | (() => Promise<any>);
  layout?: any;
  beforeEnter?: (route: Route) => boolean | Promise<boolean>;
  children?: RouteConfig[];
  meta?: Record<string, any>;
}

export interface Route {
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  hash: string;
  fullPath: string;
  matched: RouteConfig[];
  meta: Record<string, any>;
}

export interface RouterConfig {
  mode?: 'hash' | 'history';
  base?: string;
  routes?: RouteConfig[];
}

interface RouteMatch {
  route: RouteConfig;
  params: Record<string, string>;
  regex: RegExp;
  keys: string[];
}

/**
 * Client-side router for single-page applications
 */
export class Router extends EventBus<string, any> {
  private mode: 'hash' | 'history';
  private base: string;
  private routes: RouteMatch[] = [];
  private currentRoute: Route | null = null;
  private fallback: RouteConfig | null = null;
  private beforeHooks: Array<(to: Route, from: Route | null) => boolean | Promise<boolean>> = [];
  private afterHooks: Array<(to: Route, from: Route | null) => void> = [];

  constructor(config: RouterConfig = {}) {
    super();
    this.mode = config.mode || 'hash';
    this.base = this.normalizeBase(config.base || '/');
    
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

    // Process child routes
    if (route.children) {
      route.children.forEach(child => this.addRoute(child, route));
    }
  }

  /**
   * Start the router
   */
  start(): void {
    if (this.mode === 'hash') {
      window.addEventListener('hashchange', () => this.handleRouteChange());
    } else {
      window.addEventListener('popstate', () => this.handleRouteChange());
      
      // Intercept link clicks
      document.addEventListener('click', (e) => {
        const link = (e.target as HTMLElement).closest('a');
        if (link && link.href && link.target !== '_blank') {
          const url = new URL(link.href);
          if (url.origin === window.location.origin) {
            e.preventDefault();
            this.push(url.pathname + url.search + url.hash);
          }
        }
      });
    }

    // Handle initial route
    this.handleRouteChange();
  }

  /**
   * Navigate to a path
   */
  async push(path: string): Promise<boolean> {
    return this.navigate(path, 'push');
  }

  /**
   * Replace current path
   */
  async replace(path: string): Promise<boolean> {
    return this.navigate(path, 'replace');
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
   * Go to specific position in history
   */
  go(delta: number): void {
    window.history.go(delta);
  }

  /**
   * Internal navigation method
   */
  private async navigate(path: string, method: 'push' | 'replace'): Promise<boolean> {
    const route = this.resolve(path);
    
    if (!route) {
      console.warn(`No route found for path: ${path}`);
      return false;
    }

    // Run before hooks
    const canNavigate = await this.runBeforeHooks(route, this.currentRoute);
    if (!canNavigate) {
      return false;
    }

    // Update URL
    if (this.mode === 'hash') {
      if (method === 'push') {
        window.location.hash = path;
      } else {
        window.location.replace(`#${path}`);
      }
    } else {
      const url = this.base + path;
      if (method === 'push') {
        window.history.pushState(null, '', url);
      } else {
        window.history.replaceState(null, '', url);
      }
    }

    // Update current route
    const previousRoute = this.currentRoute;
    this.currentRoute = route;

    // Emit events
    this.emit('navigate', route);
    this.emit('route-change', { to: route, from: previousRoute });

    // Run after hooks
    this.runAfterHooks(route, previousRoute);

    return true;
  }

  /**
   * Handle route change from browser
   */
  private handleRouteChange(): void {
    const path = this.getCurrentPath();
    const route = this.resolve(path);

    if (!route) {
      console.warn(`No route found for path: ${path}`);
      if (this.fallback) {
        this.currentRoute = this.createRoute(this.fallback, path, {});
        this.emit('navigate', this.currentRoute);
      }
      return;
    }

    // Run before hooks
    this.runBeforeHooks(route, this.currentRoute).then(canNavigate => {
      if (!canNavigate) {
        // Revert URL change
        if (this.currentRoute) {
          if (this.mode === 'hash') {
            window.location.hash = this.currentRoute.path;
          } else {
            window.history.pushState(null, '', this.base + this.currentRoute.path);
          }
        }
        return;
      }

      const previousRoute = this.currentRoute;
      this.currentRoute = route;

      this.emit('navigate', route);
      this.emit('route-change', { to: route, from: previousRoute });

      this.runAfterHooks(route, previousRoute);
    });
  }

  /**
   * Get current path from browser
   */
  private getCurrentPath(): string {
    if (this.mode === 'hash') {
      return window.location.hash.slice(1) || '/';
    } else {
      const path = window.location.pathname;
      if (this.base !== '/' && path.startsWith(this.base)) {
        return path.slice(this.base.length) || '/';
      }
      return path;
    }
  }

  /**
   * Resolve a path to a route
   */
  resolve(path: string): Route | null {
    // Parse path
    const [pathname, search, hash] = this.parsePath(path);
    const query = this.parseQuery(search);

    // Find matching route
    for (const routeMatch of this.routes) {
      const match = pathname.match(routeMatch.regex);
      
      if (match) {
        const params: Record<string, string> = {};
        
        // Extract params
        routeMatch.keys.forEach((key, index) => {
          params[key] = match[index + 1];
        });

        return this.createRoute(routeMatch.route, path, params, query, hash);
      }
    }

    // Check fallback
    if (this.fallback) {
      return this.createRoute(this.fallback, path, {}, query, hash);
    }

    return null;
  }

  /**
   * Create a route object
   */
  private createRoute(
    config: RouteConfig,
    fullPath: string,
    params: Record<string, string>,
    query: Record<string, string> = {},
    hash: string = ''
  ): Route {
    const matched = [config];
    let parent = config;
    
    // Build matched array for nested routes
    while (parent.children) {
      const child = parent.children.find(c => 
        fullPath.startsWith(parent.path + c.path)
      );
      if (child) {
        matched.push(child);
        parent = child;
      } else {
        break;
      }
    }

    return {
      path: config.path,
      params,
      query,
      hash,
      fullPath,
      matched,
      meta: config.meta || {}
    };
  }

  /**
   * Parse path into components
   */
  private parsePath(path: string): [string, string, string] {
    const hashIndex = path.indexOf('#');
    const queryIndex = path.indexOf('?');

    let pathname = path;
    let search = '';
    let hash = '';

    if (hashIndex >= 0) {
      hash = path.slice(hashIndex + 1);
      pathname = path.slice(0, hashIndex);
    }

    if (queryIndex >= 0 && (hashIndex < 0 || queryIndex < hashIndex)) {
      search = pathname.slice(queryIndex + 1);
      pathname = pathname.slice(0, queryIndex);
    }

    return [pathname, search, hash];
  }

  /**
   * Parse query string
   */
  private parseQuery(search: string): Record<string, string> {
    if (!search) return {};

    const query: Record<string, string> = {};
    const pairs = search.split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        query[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
    }

    return query;
  }

  /**
   * Run before navigation hooks
   */
  private async runBeforeHooks(to: Route, from: Route | null): Promise<boolean> {
    // Route-specific hook
    if (to.matched.length > 0) {
      const lastMatched = to.matched[to.matched.length - 1];
      if (lastMatched.beforeEnter) {
        const canEnter = await lastMatched.beforeEnter(to);
        if (!canEnter) return false;
      }
    }

    // Global hooks
    for (const hook of this.beforeHooks) {
      const result = await hook(to, from);
      if (!result) return false;
    }

    return true;
  }

  /**
   * Run after navigation hooks
   */
  private runAfterHooks(to: Route, from: Route | null): void {
    for (const hook of this.afterHooks) {
      hook(to, from);
    }
  }

  /**
   * Add a global before hook
   */
  beforeEach(hook: (to: Route, from: Route | null) => boolean | Promise<boolean>): () => void {
    this.beforeHooks.push(hook);
    return () => {
      const index = this.beforeHooks.indexOf(hook);
      if (index >= 0) this.beforeHooks.splice(index, 1);
    };
  }

  /**
   * Add a global after hook
   */
  afterEach(hook: (to: Route, from: Route | null) => void): () => void {
    this.afterHooks.push(hook);
    return () => {
      const index = this.afterHooks.indexOf(hook);
      if (index >= 0) this.afterHooks.splice(index, 1);
    };
  }

  /**
   * Get current route
   */
  get current(): Route | null {
    return this.currentRoute;
  }

  /**
   * Create a URL for a route
   */
  createUrl(name: string, params?: Record<string, string>, query?: Record<string, string>): string {
    // Find route by name/path
    const routeMatch = this.routes.find(r => r.route.path === name);
    if (!routeMatch) return '#';

    let path = routeMatch.route.path;

    // Replace params
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        path = path.replace(`:${key}`, value);
      });
    }

    // Add query
    if (query && Object.keys(query).length > 0) {
      const queryString = Object.entries(query)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
      path += `?${queryString}`;
    }

    return this.mode === 'hash' ? `#${path}` : this.base + path;
  }

  /**
   * Check if a route is active
   */
  isActive(path: string, exact = false): boolean {
    if (!this.currentRoute) return false;
    
    if (exact) {
      return this.currentRoute.path === path;
    }

    return this.currentRoute.fullPath.startsWith(path);
  }

  /**
   * Get route configuration by path
   */
  getRouteConfig(path: string): RouteConfig | null {
    const route = this.resolve(path);
    return route ? route.matched[route.matched.length - 1] : null;
  }
}

// Route link component
export class NXRouterLink extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['to', 'exact', 'active-class'];
  }

  connectedCallback(): void {
    this.addEventListener('click', this.handleClick);
    this.updateActiveState();
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.handleClick);
  }

  attributeChangedCallback(): void {
    this.updateActiveState();
  }

  private handleClick = (e: Event): void => {
    e.preventDefault();
    const to = this.getAttribute('to');
    if (to && window.NX?.app) {
      window.NX.app.navigate(to);
    }
  };

  private updateActiveState(): void {
    const to = this.getAttribute('to');
    const exact = this.hasAttribute('exact');
    const activeClass = this.getAttribute('active-class') || 'active';

    if (to && window.NX?.app?.router) {
      const isActive = window.NX.app.router.isActive(to, exact);
      
      if (isActive) {
        this.classList.add(activeClass);
      } else {
        this.classList.remove(activeClass);
      }
    }
  }
}

// Register router link component
customElements.define('nx-link', NXRouterLink);

// Extend window interface
declare global {
  interface Window {
    NX?: any;
  }
}
