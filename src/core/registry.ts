import { BaseComponent, eventName, toKebab } from '@/components/abstracts/base';

/**
 * A declarative component config. `xtype` picks the component
 * (`'button'`, `'nx-button'`, or any plain tag like `'div'`), `items` are children.
 * Every other key is applied with `BaseComponent.configure()`.
 */
export interface ComponentConfig {
  xtype?: string;
  items?: ItemConfig[];
  [key: string]: any;
}

/**
 * Anything that can appear in an `items` array:
 * - a config object
 * - an existing DOM node
 * - `'->'` (flexible spacer), `'-'` / `'|'` (separator)
 * - any other string, rendered as HTML
 * - `null` / `false` (skipped — handy for conditionals)
 */
export type ItemConfig = ComponentConfig | Node | string | null | undefined | false;

/**
 * Containers can implement this to take over how their `items` are built
 * (e.g. the tab panel turns each item into a tab). Components that instead
 * define `setItems(items)` receive the raw items as data.
 */
export interface ItemsAware {
  applyItems(items: ItemConfig[], build: (item: ItemConfig) => HTMLElement | null): void;
}

export interface ComponentDefinition {
  tagName: string;
  component: typeof BaseComponent;
  config?: any;
}

export interface ComponentFactory {
  (config?: any): BaseComponent;
}

/**
 * Central registry for all Nexaro components
 */
export class ComponentRegistry {
  private static components = new Map<string, ComponentDefinition>();
  private static aliases = new Map<string, string>();
  private static factories = new Map<string, ComponentFactory>();
  private static initialized = false;

  /**
   * Initialize the registry with core components
   */
  static initialize(): void {
    if (this.initialized) return;
    
    this.initialized = true;
    
    // Register core component aliases
    this.alias('container', 'nx-container');
    this.alias('box', 'nx-container');
    this.alias('hbox', 'nx-container');
    this.alias('vbox', 'nx-container');
    this.alias('html', 'div');
    this.alias('text', 'span');
    this.alias('grid', 'nx-grid');
    this.alias('form', 'nx-form');
    this.alias('button', 'nx-button');
    this.alias('btn', 'nx-button');
    this.alias('input', 'nx-textfield');
    this.alias('select', 'nx-select');
    this.alias('checkbox', 'nx-checkbox');
    this.alias('radio', 'nx-radio');
    this.alias('toggle', 'nx-toggle');
    this.alias('modal', 'nx-modal');
    this.alias('dialog', 'nx-modal');
    this.alias('toast', 'nx-toast');
    this.alias('notification', 'nx-toast');
    this.alias('tabs', 'nx-tabpanel');
    this.alias('tabpanel', 'nx-tabpanel');
    this.alias('toolbar', 'nx-toolbar');
    this.alias('tree', 'nx-tree');
    this.alias('treepanel', 'nx-tree');
    this.alias('accordion', 'nx-accordion');
    this.alias('drawer', 'nx-drawer');
    this.alias('menu', 'nx-menu');
    this.alias('menubar', 'nx-menubar');
    this.alias('breadcrumb', 'nx-breadcrumb');
    this.alias('progress', 'nx-progress');
    this.alias('progressbar', 'nx-progress');
    this.alias('skeleton', 'nx-skeleton');
    this.alias('loader', 'nx-loader');
    this.alias('divider', 'nx-divider');
    this.alias('separator', 'nx-separator');
    this.alias('spacer', 'nx-spacer');
    this.alias('viewport', 'nx-viewport');
    this.alias('layout', 'nx-layout');
    this.alias('field', 'nx-field');
    this.alias('fieldset', 'nx-fieldset');
    this.alias('label', 'nx-label');
    this.alias('datefield', 'nx-datefield');
    this.alias('datepicker', 'nx-datefield');
    this.alias('numberfield', 'nx-numberfield');
    this.alias('number', 'nx-numberfield');
    this.alias('slider', 'nx-slider');
    this.alias('range', 'nx-slider');
    this.alias('list', 'nx-list');
    this.alias('listview', 'nx-list');
    this.alias('dataview', 'nx-dataview');
    this.alias('card', 'nx-card');
    this.alias('table', 'nx-data-table');
    this.alias('datatable', 'nx-data-table');
    this.alias('data-table', 'nx-data-table');
    this.alias('spinner', 'nx-spinner');
    this.alias('panel', 'nx-panel');
    this.alias('splitter', 'nx-splitter');
    this.alias('split', 'nx-splitter');
  }

  /**
   * Register a component under an xtype. The tag name is taken from an existing
   * alias, the xtype itself if it contains a dash, or `nx-<xtype>`.
   */
  static register(xtype: string, component: typeof BaseComponent, config?: any): void {
    const tagName = this.aliases.get(xtype) || (xtype.includes('-') ? xtype : `nx-${xtype}`);
    
    this.components.set(xtype, {
      tagName,
      component,
      config
    });

    // Register with custom elements if not already registered
    if (!customElements.get(tagName)) {
      // Only register concrete components, not abstract ones
      if (!component.name.includes('Abstract') && !component.name.includes('Base')) {
        try {
          customElements.define(tagName, component as any);
        } catch (e) {
          console.warn(`Failed to register component ${tagName}:`, e);
        }
      }
    }
  }

  /**
   * Create an alias for a component
   */
  static alias(alias: string, tagName: string): void {
    this.aliases.set(alias, tagName);
  }

  /**
   * Register a factory function for a component
   */
  static registerFactory(xtype: string, factory: ComponentFactory): void {
    this.factories.set(xtype, factory);
  }

  /**
   * Resolve an xtype (`'button'`, `'btn'`, `'nx-button'`, `'div'`) to a tag name.
   */
  static resolveTag(xtype: string): string {
    this.initialize();
    const definition = this.components.get(xtype);
    if (definition) return definition.tagName;
    const alias = this.aliases.get(xtype);
    if (alias) return alias;
    if (xtype.includes('-')) return xtype;
    if (customElements.get(`nx-${xtype}`)) return `nx-${xtype}`;
    return xtype;
  }

  /**
   * Create a component instance.
   *
   * @example
   * ```typescript
   * ComponentRegistry.create('button', { text: 'Save', handler: save });
   * ```
   */
  static create(xtype: string, config: Record<string, any> = {}): HTMLElement | null {
    return this.build({ ...config, xtype });
  }

  /**
   * Build a component tree from a declarative config.
   *
   * @example
   * ```typescript
   * ComponentRegistry.build({
   *   xtype: 'toolbar',
   *   items: [{ xtype: 'button', text: 'New' }, '->', { xtype: 'button', icon: 'settings' }]
   * });
   * ```
   */
  static build(item: ItemConfig): HTMLElement | null {
    if (item === null || item === undefined || item === false) return null;
    if (item instanceof Node) return item as HTMLElement;

    if (typeof item === 'string') {
      if (item === '->') return document.createElement('nx-spacer');
      if (item === '-' || item === '|') return document.createElement('nx-separator');
      const div = document.createElement('div');
      div.innerHTML = item;
      return div;
    }

    const { xtype: rawXtype, items, ...config } = item;
    const xtype = rawXtype ?? ('html' in config || 'text' in config ? 'html' : 'container');

    const factory = this.factories.get(xtype);
    if (factory) return factory({ ...config, items }) as HTMLElement;

    const tagName = this.resolveTag(xtype);
    let element: HTMLElement;
    try {
      element = document.createElement(tagName);
    } catch {
      console.error(`[nx] Cannot create "${xtype}" — "${tagName}" is not a valid tag name.`);
      return null;
    }

    if (tagName.includes('-') && !customElements.get(tagName)) {
      console.warn(`[nx] Unknown component "${xtype}" (<${tagName}>). Did you forget to import it?`);
    }

    // Layout shorthands for containers: { xtype: 'hbox' }
    if ((xtype === 'hbox' || xtype === 'vbox') && config.layout === undefined) {
      config.layout = xtype;
    }

    if (element instanceof BaseComponent) {
      element.configure(config);
    } else {
      applyToElement(element, config);
    }

    if (items && items.length) {
      this.appendItems(element, items);
    }

    return element;
  }

  /**
   * Build `items` into a container, respecting `ItemsAware` containers.
   */
  static appendItems(container: HTMLElement, items: ItemConfig[]): void {
    const build = (item: ItemConfig) => this.build(item);
    if (typeof (container as any).applyItems === 'function') {
      (container as unknown as ItemsAware).applyItems(items, build);
      return;
    }
    // Data-driven components (menu, breadcrumb, accordion…) take items as data
    if (typeof (container as any).setItems === 'function') {
      (container as any).setItems(items);
      return;
    }
    items.forEach(item => {
      const child = build(item);
      if (child) container.appendChild(child);
    });
  }

  /**
   * Check if a component is registered
   */
  static has(xtype: string): boolean {
    return this.components.has(xtype) || this.factories.has(xtype);
  }

  /**
   * Get component definition
   */
  static get(xtype: string): ComponentDefinition | undefined {
    return this.components.get(xtype);
  }

  /**
   * Get all registered components
   */
  static getAll(): Map<string, ComponentDefinition> {
    return new Map(this.components);
  }

  /**
   * Create a lazy component that loads on demand
   */
  static lazy(xtype: string, loader: () => Promise<typeof BaseComponent>): void {
    this.registerFactory(xtype, (config) => {
      // Create a placeholder element that will be replaced when component loads
      const placeholder = document.createElement('div');
      
      loader().then(Component => {
        this.register(xtype, Component);
        const actualComponent = this.create(xtype, config);
        if (actualComponent && placeholder.parentNode) {
          placeholder.parentNode.replaceChild(actualComponent, placeholder);
        }
      });
      
      return placeholder as any;
    });
  }

  /**
   * Extend an existing component
   */
  static extend(xtype: string, ParentComponent: typeof BaseComponent, extension: any): typeof BaseComponent {
    class ExtendedComponent extends ParentComponent {
      static get observedAttributes() {
        const parentAttrs = (ParentComponent as any).observedAttributes || [];
        const extAttrs = extension.observedAttributes || [];
        return [...parentAttrs, ...extAttrs];
      }

      protected initializeState(): void {
        if ((ParentComponent.prototype as any).initializeState) {
          (ParentComponent.prototype as any).initializeState.call(this);
        }
        extension.initializeState?.call(this);
      }

      protected render(): string {
        if (extension.render) {
          return extension.render.call(this);
        }
        if ((ParentComponent.prototype as any).render) {
          return (ParentComponent.prototype as any).render.call(this);
        }
        return '';
      }

      protected styles(): string {
        let parentStyles = '';
        if ((ParentComponent.prototype as any).styles) {
          parentStyles = (ParentComponent.prototype as any).styles.call(this);
        }
        const extStyles = extension.styles?.call(this) || '';
        return `${parentStyles}\n${extStyles}`;
      }
    }

    // Copy over any additional methods
    Object.entries(extension).forEach(([key, value]) => {
      if (typeof value === 'function' && 
          !['initializeState', 'render', 'styles', 'observedAttributes'].includes(key)) {
        (ExtendedComponent.prototype as any)[key] = value;
      }
    });

    this.register(xtype, ExtendedComponent);
    return ExtendedComponent;
  }
}


/**
 * Define a custom element (once — safe under HMR) and register its xtype.
 * `define('nx-button', NXButton)` makes `{ xtype: 'button' }` work.
 */
export function define(tagName: string, component: CustomElementConstructor): void {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, component);
  }
  const xtype = tagName.replace(/^nx-/, '');
  ComponentRegistry.alias(xtype, tagName);
}

/**
 * Apply a config object to a plain (non-Nexaro) element.
 */
function applyToElement(element: HTMLElement, config: Record<string, any>): void {
  Object.entries(config).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    switch (key) {
      case 'html':
      case 'content':
        element.innerHTML = String(value);
        return;
      case 'text':
        element.textContent = String(value);
        return;
      case 'cls':
      case 'className':
        element.classList.add(...String(value).split(/\s+/).filter(Boolean));
        return;
      case 'style':
        if (typeof value === 'string') element.style.cssText += `;${value}`;
        else Object.assign(element.style, value);
        return;
      case 'flex':
        element.style.flex = String(value);
        return;
      case 'region':
        element.setAttribute('region', value);
        element.slot = value;
        return;
      case 'listeners':
        Object.entries(value as Record<string, EventListener>).forEach(([event, fn]) => {
          element.addEventListener(event, fn);
        });
        return;
      case 'handler':
        element.addEventListener('click', value);
        return;
    }
    if (typeof value === 'function' && /^on[A-Z]/.test(key)) {
      element.addEventListener(eventName(key), value);
    } else if (typeof value === 'object') {
      (element as any)[key] = value;
    } else {
      element.setAttribute(toKebab(key), value === true ? '' : String(value));
    }
  });
}
