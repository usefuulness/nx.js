import { BaseComponent } from '@/components/abstracts/base';

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
    this.alias('container', 'nx-panel');
    this.alias('box', 'nx-panel');
    this.alias('grid', 'nx-grid');
    this.alias('form', 'nx-form');
    this.alias('button', 'nx-button');
    this.alias('btn', 'nx-button');
    this.alias('text', 'nx-text');
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
    this.alias('separator', 'nx-divider');
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
    this.alias('panel', 'nx-panel');
    this.alias('splitter', 'nx-splitter');
    this.alias('split', 'nx-splitter');
  }

  /**
   * Register a component
   */
  static register(xtype: string, component: typeof BaseComponent, config?: any): void {
    const tagName = this.aliases.get(xtype) || xtype;
    
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
   * Create a component instance
   */
  static create(xtype: string, config?: any): HTMLElement | null {
    // Check for factory first
    if (this.factories.has(xtype)) {
      const factory = this.factories.get(xtype)!;
      return factory(config) as HTMLElement;
    }

    // Get component definition
    const definition = this.components.get(xtype);
    if (!definition) {
      // Try to find by tag name
      const tagName = this.aliases.get(xtype) || xtype;
      const element = document.createElement(tagName);
      
      // Apply config as attributes
      if (config) {
        Object.entries(config).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            element.setAttribute(key, JSON.stringify(value));
          } else {
            element.setAttribute(key, String(value));
          }
        });
      }
      
      return element;
    }

    // Create component instance
    const { tagName, component } = definition;
    let instance: HTMLElement;

    try {
      instance = new (component as any)(config) as HTMLElement;
    } catch {
      // If constructor fails, create via document
      instance = document.createElement(tagName);
    }

    // Apply config
    if (config) {
      Object.entries(config).forEach(([key, value]) => {
        if (key === 'listeners') {
          // Add event listeners
          Object.entries(value as Record<string, Function>).forEach(([event, handler]) => {
            instance.addEventListener(event, handler as EventListener);
          });
        } else if (key === 'style' && typeof value === 'object') {
          // Apply styles
          Object.assign(instance.style, value);
        } else if (typeof value === 'object' && value !== null) {
          // Set as JSON attribute
          instance.setAttribute(key, JSON.stringify(value));
        } else {
          // Set as attribute
          instance.setAttribute(key, String(value));
        }
      });
    }

    return instance;
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
    this.registerFactory(xtype, async (config) => {
      const Component = await loader();
      this.register(xtype, Component);
      return this.create(xtype, config);
    });
  }

  /**
   * Extend an existing component
   */
  static extend(xtype: string, ParentComponent: typeof BaseComponent, extension: any): typeof BaseComponent {
    class ExtendedComponent extends ParentComponent {
      static get observedAttributes() {
        return [
          ...(ParentComponent.observedAttributes || []),
          ...(extension.observedAttributes || [])
        ];
      }

      protected initializeState(): void {
        super.initializeState();
        extension.initializeState?.call(this);
      }

      protected render(): string {
        if (extension.render) {
          return extension.render.call(this);
        }
        return super.render();
      }

      protected styles(): string {
        const parentStyles = super.styles();
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
