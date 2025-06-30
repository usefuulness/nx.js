/**
 * @file @/app.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

import { BaseComponent } from '@/components/abstracts/base';
import { ComponentRegistry } from '@/core/registry';
import { Router, type RouterConfig as CoreRouterConfig, type RouteConfig as CoreRouteConfig } from '@/core/router';
import { ThemeManager } from '@/core/theme';
import { Store, type StoreConfig as CoreStoreConfig } from '@/data/store';

// Re-export compatible interfaces
export interface RouteConfig extends CoreRouteConfig {
  component?: string | typeof BaseComponent;
}

export interface RouterConfig extends CoreRouterConfig {
  routes?: RouteConfig[];
}

export interface StoreConfig extends CoreStoreConfig<any> {}

export interface ApplicationConfig {
  el?: string | HTMLElement;
  title?: string;
  theme?: string;
  layout?: LayoutConfig;
  router?: RouterConfig;
  stores?: Record<string, StoreConfig>;
  components?: ComponentConfig[];
  plugins?: Plugin[];
  ready?: () => void;
}

export interface LayoutConfig {
  type: 'border' | 'flex' | 'grid' | 'dock' | 'viewport';
  config?: any;
  items?: ComponentConfig[];
}

export interface ComponentConfig {
  xtype: string;
  [key: string]: any;
}

export interface ProxyConfig {
  type: 'rest' | 'ajax' | 'memory';
  url?: string;
  api?: {
    create?: string;
    read?: string;
    update?: string;
    destroy?: string;
  };
}

export interface Plugin {
  name: string;
  install: (app: NXApplication) => void;
}

interface Route {
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
}

/**
 * Main application class that bootstraps and manages the entire application
 */
export class NXApplication extends EventTarget {
  private static instance: NXApplication;
  private config: ApplicationConfig = {};
  private container: HTMLElement | null = null;
  private router: Router | null = null;
  private stores: Map<string, Store<any>> = new Map();
  private viewport: BaseComponent | null = null;
  private ready = false;

  private constructor() {
    super();
  }

  /**
   * Create a new application instance
   */
  static create(config: ApplicationConfig): NXApplication {
    if (NXApplication.instance) {
      console.warn('Application already exists. Returning existing instance.');
      return NXApplication.instance;
    }

    NXApplication.instance = new NXApplication();
    NXApplication.instance.configure(config);
    return NXApplication.instance;
  }

  /**
   * Get the current application instance
   */
  static get current(): NXApplication | null {
    return NXApplication.instance;
  }

  /**
   * Configure the application
   */
  private configure(config: ApplicationConfig): void {
    this.config = config;

    // Set up theme
    if (config.theme) {
      ThemeManager.setTheme(config.theme);
    }

    // Set document title
    if (config.title) {
      document.title = config.title;
    }

    // Initialize plugins
    if (config.plugins) {
      config.plugins.forEach(plugin => plugin.install(this));
    }

    // Set up stores
    if (config.stores) {
      this.initializeStores(config.stores);
    }

    // Set up router
    if (config.router) {
      // Convert to core router config
      const coreConfig: CoreRouterConfig = {
        mode: config.router.mode,
        base: config.router.base,
        routes: config.router.routes?.map(route => ({
          ...route,
          component: typeof route.component === 'string' ? route.component : undefined
        }))
      };
      this.router = new Router(coreConfig);
      this.router.on('navigate', (route: Route) => {
        this.handleRouteChange(route);
      });
    }

    // Register components
    if (config.components) {
      config.components.forEach(comp => {
        if (comp.xtype && !ComponentRegistry.has(comp.xtype)) {
          console.warn(`Component ${comp.xtype} not registered`);
        }
      });
    }
  }

  /**
   * Launch the application
   */
  launch(): void {
    if (this.ready) {
      console.warn('Application already launched');
      return;
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.launch());
      return;
    }

    // Get or create container
    this.container = this.resolveContainer(this.config.el);
    if (!this.container) {
      throw new Error('Application container not found');
    }

    // Create viewport
    this.createViewport();

    // Auto-load stores
    this.stores.forEach((store, name) => {
      const config = this.config.stores?.[name];
      if (config?.autoLoad) {
        store.load();
      }
    });

    // Start router
    if (this.router) {
      this.router.start();
    }

    // Mark as ready
    this.ready = true;
    this.dispatchEvent(new CustomEvent('ready'));

    // Call ready callback
    if (this.config.ready) {
      this.config.ready();
    }
  }

  /**
   * Resolve container element
   */
  private resolveContainer(el?: string | HTMLElement): HTMLElement | null {
    if (!el) {
      return document.body;
    }

    if (typeof el === 'string') {
      return document.querySelector(el);
    }

    return el;
  }

  /**
   * Create the main viewport
   */
  private createViewport(): void {
    if (!this.container) return;

    const layoutConfig = this.config.layout || {
      type: 'viewport',
      items: []
    };

    // Create viewport element
    const viewport = document.createElement('nx-viewport');
    viewport.setAttribute('layout', layoutConfig.type);

    // Create layout
    if (layoutConfig.items) {
      layoutConfig.items.forEach(item => {
        const component = this.createComponent(item);
        if (component) {
          viewport.appendChild(component);
        }
      });
    }

    // Clear container and append viewport
    this.container.innerHTML = '';
    this.container.appendChild(viewport);
    this.viewport = viewport as any;
  }

  /**
   * Create a component from config
   */
  createComponent(config: ComponentConfig): HTMLElement | null {
    const { xtype, ...props } = config;
    
    if (!xtype) {
      console.error('Component config missing xtype');
      return null;
    }

    const component = ComponentRegistry.create(xtype, props);
    if (!component) {
      console.error(`Failed to create component: ${xtype}`);
      return null;
    }

    // Set attributes
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'items' && Array.isArray(value)) {
        // Handle nested items
        value.forEach(itemConfig => {
          const child = this.createComponent(itemConfig);
          if (child) {
            component.appendChild(child);
          }
        });
      } else if (key === 'slot') {
        component.setAttribute('slot', value);
      } else if (typeof value === 'object') {
        component.setAttribute(key, JSON.stringify(value));
      } else {
        component.setAttribute(key, String(value));
      }
    });

    return component;
  }

  /**
   * Initialize stores
   */
  private initializeStores(storesConfig: Record<string, StoreConfig>): void {
    Object.entries(storesConfig).forEach(([name, config]) => {
      const store = new Store({
        data: config.data || [],
        proxy: config.proxy,
        sorters: config.sorters,
        filters: config.filters
      });

      this.stores.set(name, store);
    });
  }

  /**
   * Handle route changes
   */
  private handleRouteChange(route: Route): void {
    this.dispatchEvent(new CustomEvent('route', { detail: route }));

    // Update viewport based on route
    const routeConfig = this.router?.getRouteConfig?.(route.path);
    if (routeConfig?.layout) {
      this.updateLayout(routeConfig.layout);
    }
  }

  /**
   * Update the application layout
   */
  private updateLayout(layoutConfig: LayoutConfig): void {
    if (!this.viewport || !this.container) return;

    // Create new layout
    const viewport = document.createElement('nx-viewport');
    viewport.setAttribute('layout', layoutConfig.type);

    if (layoutConfig.items) {
      layoutConfig.items.forEach(item => {
        const component = this.createComponent(item);
        if (component) {
          viewport.appendChild(component);
        }
      });
    }

    // Replace viewport
    this.container.innerHTML = '';
    this.container.appendChild(viewport);
    this.viewport = viewport as any;
  }

  // Public API

  /**
   * Get a store by name
   */
  getStore(name: string): Store<any> | undefined {
    return this.stores.get(name);
  }

  /**
   * Navigate to a route
   */
  navigate(path: string, options?: any): void {
    if (this.router) {
      this.router.navigate(path, options);
    }
  }

  /**
   * Show a notification
   */
  notify(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const toast = document.querySelector('nx-toast') || document.createElement('nx-toast');
    if (!document.body.contains(toast)) {
      document.body.appendChild(toast);
    }
    (toast as any).show(message, type);
  }

  /**
   * Show a modal dialog
   */
  modal(config: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const modal = this.createComponent({
        xtype: 'modal',
        ...config,
        listeners: {
          close: () => reject('cancelled'),
          confirm: (data: any) => resolve(data)
        }
      });

      if (modal) {
        document.body.appendChild(modal);
      }
    });
  }

  /**
   * Get the current theme
   */
  getTheme(): string {
    return ThemeManager.current;
  }

  /**
   * Set the theme
   */
  setTheme(theme: string): void {
    ThemeManager.setTheme(theme);
    this.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  }
}

// Global convenience methods
export const NX = {
  /**
   * Create a new application
   */
  application: (config: ApplicationConfig) => NXApplication.create(config),

  /**
   * Create a component
   */
  create: (xtype: string, config?: any) => ComponentRegistry.create(xtype, config),

  /**
   * Register a component
   */
  register: (xtype: string, component: typeof BaseComponent) => {
    ComponentRegistry.register(xtype, component);
  },

  /**
   * Define a new component class
   */
  define: (xtype: string, config: any) => {
    const Component = class extends BaseComponent {
      static get observedAttributes() {
        return config.observedAttributes || [];
      }

      constructor() {
        super();
        if (config.constructor) {
          config.constructor.call(this);
        }
      }

      protected initializeState(): void {
        if (config.initializeState) {
          config.initializeState.call(this);
        }
      }

      protected render() {
        return config.render?.call(this) || '';
      }

      protected styles() {
        return config.styles?.call(this) || '';
      }

      protected initialize() {
        super.initialize();
        config.initialize?.call(this);
      }

      protected afterRender() {
        config.afterRender?.call(this);
      }
    };

    ComponentRegistry.register(xtype, Component);
    return Component;
  },

  /**
   * Get the current application
   */
  get app() {
    return NXApplication.current;
  },

  /**
   * Utility functions
   */
  utils: {
    /**
     * Deep merge objects
     */
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

    /**
     * Generate unique ID
     */
    id: (prefix = 'nx') => `${prefix}-${Math.random().toString(36).substr(2, 9)}`,

    /**
     * Debounce function
     */
    debounce: (fn: Function, delay: number) => {
      let timeout: any;
      return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
      };
    },

    /**
     * Format date
     */
    formatDate: (date: Date | string, format = 'YYYY-MM-DD') => {
      const d = typeof date === 'string' ? new Date(date) : date;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      
      return format
        .replace('YYYY', String(year))
        .replace('MM', month)
        .replace('DD', day);
    }
  }
};

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// Make NX globally available
(window as any).NX = NX;
