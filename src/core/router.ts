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
export class Router extends EventBus {
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

    // Add child routes
    if (route.children) {
      route.children.forEach(child => this.addRoute(child, route));
    }
  }

  /**
   * Start the router
   */
  start(): void {
    if (this.mode === 'hash') {
      window.addEventListener('hashchange', () => this.handleRoute());
    } else {
      window.addEventListener('popstate', () => this.handleRoute());
    }

    // Handle initial route
    this.handleRoute();
  }

  /**
   * Navigate to a path
   */
  navigate(path: string, options: { replace?: boolean; state?: any } = {}): void {
    const url = this.createUrl(path);

    if (this.mode === 'hash') {
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
      this.handleRoute();
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
    if (this.base === '/') return path;
    
    return path.startsWith(this.base) ? path.slice(this.base.length) : path;
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
   * Handle route change
   */
  private async handleRoute(): Promise<void> {
    const path = this.getCurrentPath();
    const [pathname, search] = path.split('?');
    const [pathWithoutHash, hash] = pathname.split('#');
    
    const route: Route = {
      path: pathWithoutHash,
      params: {},
      query: this.parseQuery(search),
      hash: hash || '',
      fullPath: path,
      matched: [],
      meta: {}
    };

    // Find matching route
    let matched = false;
    for (const routeMatch of this.routes) {
      const match = routeMatch.regex.exec(pathWithoutHash);
      if (match) {
        matched = true;
        route.matched.push(routeMatch.route);
        
        // Extract params
        routeMatch.keys.forEach((key, index) => {
          route.params[key] = match[index + 1];
        });

        // Merge meta
        Object.assign(route.meta, routeMatch.route.meta);
        break;
      }
    }

    // Use fallback if no match
    if (!matched && this.fallback) {
      route.matched.push(this.fallback);
    }

    // Run before hooks
    const from = this.currentRoute;
    this.emit('beforeNavigate', { to: route, from });

    for (const hook of this.beforeHooks) {
      const result = await hook(route, from);
      if (result === false) return;
    }

    // Run route-specific beforeEnter
    for (const matchedRoute of route.matched) {
      if (matchedRoute.beforeEnter) {
        const result = await matchedRoute.beforeEnter(route);
        if (result === false) return;
      }
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
