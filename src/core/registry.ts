// src/core/registry.ts
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
    // Ensure tag name format
    const tagName = this.normalizeTagName(xtype);
    
    // Check if already defined
    if (customElements.get(tagName)) {
      console.warn(`Component ${tagName} is already defined`);
      return;
    }

    // Store definition
    this.components.set(xtype, {
      tagName,
      component,
      config
    });

    // Define custom element
    try {
      customElements.define(tagName, component);
    } catch (error) {
      console.error(`Failed to define component ${tagName}:`, error);
    }
  }

  /**
   * Create an alias for a component
   */
  static alias(alias: string, xtype: string): void {
    this.aliases.set(alias, xtype);
  }

  /**
   * Register a factory function for complex components
   */
  static registerFactory(xtype: string, factory: ComponentFactory): void {
    this.factories.set(xtype, factory);
  }

  /**
   * Create a component instance
   */
  static create(xtype: string, config?: any): BaseComponent | null {
    // Initialize if needed
    if (!this.initialized) {
      this.initialize();
    }

    // Resolve alias
    const resolvedXtype = this.aliases.get(xtype) || xtype;

    // Check for factory
    const factory = this.factories.get(resolvedXtype);
    if (factory) {
      return factory(config);
    }

    // Get component definition
    const definition = this.components.get(resolvedXtype);
    if (!definition) {
      // Try to create by tag name
      const tagName = this.normalizeTagName(resolvedXtype);
      const ElementClass = customElements.get(tagName);
      
      if (ElementClass && ElementClass.prototype instanceof BaseComponent) {
        const element = new ElementClass() as BaseComponent;
        this.applyConfig(element, config);
        return element;
      }

      console.error(`Component not found: ${xtype}`);
      return null;
    }

    // Create instance
    const element = document.createElement(definition.tagName) as BaseComponent;
    
    // Apply default config
    if (definition.config) {
      this.applyConfig(element, definition.config);
    }

    // Apply user config
    if (config) {
      this.applyConfig(element, config);
    }

    return element;
  }

  /**
   * Apply configuration to an element
   */
  static applyConfig(element: BaseComponent | HTMLElement, config: any): void {
    if (!config || typeof config !== 'object') return;

    Object.entries(config).forEach(([key, value]) => {
      // Special handling for certain properties
      switch (key) {
        case 'xtype':
        case 'tag':
          // Skip these
          break;

        case 'listeners':
          // Add event listeners
          if (typeof value === 'object') {
            Object.entries(value).forEach(([event, handler]) => {
              if (typeof handler === 'function') {
                element.addEventListener(event, handler as EventListener);
              }
            });
          }
          break;

        case 'items':
          // Handle child items
          if (Array.isArray(value)) {
            value.forEach(itemConfig => {
              const child = this.create(itemConfig.xtype || 'panel', itemConfig);
              if (child) {
                element.appendChild(child);
              }
            });
          }
          break;

        case 'html':
        case 'content':
          // Set inner content
          if ('setContent' in element && typeof element.setContent === 'function') {
            element.setContent(value);
          } else {
            element.innerHTML = String(value);
          }
          break;

        case 'text':
          // Set text content
          element.textContent = String(value);
          break;

        case 'cls':
        case 'className':
          // Add CSS classes
          element.className = String(value);
          break;

        case 'style':
          // Apply styles
          if (typeof value === 'object') {
            Object.assign((element as HTMLElement).style, value);
          } else if (typeof value === 'string') {
            element.setAttribute('style', value);
          }
          break;

        case 'data':
          // Set data attributes
          if (typeof value === 'object') {
            Object.entries(value).forEach(([dataKey, dataValue]) => {
              element.setAttribute(`data-${dataKey}`, String(dataValue));
            });
          }
          break;

        case 'handler':
          // Convenience for click handler
          if (typeof value === 'function') {
            element.addEventListener('click', value as EventListener);
          }
          break;

        default:
          // Set as attribute
          if (value === true) {
            element.setAttribute(key, '');
          } else if (value === false || value === null || value === undefined) {
            element.removeAttribute(key);
          } else if (typeof value === 'object') {
            element.setAttribute(key, JSON.stringify(value));
          } else {
            element.setAttribute(key, String(value));
          }
      }
    });
  }

  /**
   * Check if a component is registered
   */
  static has(xtype: string): boolean {
    const resolvedXtype = this.aliases.get(xtype) || xtype;
    return this.components.has(resolvedXtype) || 
           this.factories.has(resolvedXtype) ||
           customElements.get(this.normalizeTagName(resolvedXtype)) !== undefined;
  }

  /**
   * Get all registered components
   */
  static getAll(): string[] {
    const all = new Set<string>();
    
    // Add registered components
    this.components.forEach((_, xtype) => all.add(xtype));
    
    // Add factories
    this.factories.forEach((_, xtype) => all.add(xtype));
    
    // Add aliases
    this.aliases.forEach((_, alias) => all.add(alias));
    
    return Array.from(all).sort();
  }

  /**
   * Get component definition
   */
  static getDefinition(xtype: string): ComponentDefinition | undefined {
    const resolvedXtype = this.aliases.get(xtype) || xtype;
    return this.components.get(resolvedXtype);
  }

  /**
   * Batch create components
   */
  static createMany(configs: Array<any>): BaseComponent[] {
    return configs
      .map(config => this.create(config.xtype || 'panel', config))
      .filter(Boolean) as BaseComponent[];
  }

  /**
   * Create and append to parent
   */
  static createAndAppend(parent: HTMLElement, xtype: string, config?: any): BaseComponent | null {
    const component = this.create(xtype, config);
    if (component) {
      parent.appendChild(component);
    }
    return component;
  }

  /**
   * Normalize tag name
   */
  private static normalizeTagName(xtype: string): string {
    // Ensure tag name starts with nx- and is lowercase
    const name = xtype.toLowerCase();
    return name.startsWith('nx-') ? name : `nx-${name}`;
  }

  /**
   * Query components in DOM
   */
  static query(selector: string, root: HTMLElement | Document = document): BaseComponent | null {
    return root.querySelector(selector) as BaseComponent | null;
  }

  /**
   * Query all components in DOM
   */
  static queryAll(selector: string, root: HTMLElement | Document = document): NodeListOf<BaseComponent> {
    return root.querySelectorAll(selector) as NodeListOf<BaseComponent>;
  }

  /**
   * Find component by ID
   */
  static find(id: string): BaseComponent | null {
    return document.getElementById(id) as BaseComponent | null;
  }

  /**
   * Define a component class inline
   */
  static define(xtype: string, definition: any): typeof BaseComponent {
    const Component = class extends BaseComponent {
      static get observedAttributes() {
        return definition.observedAttributes || [];
      }

      constructor() {
        super();
        if (definition.constructor) {
          definition.constructor.call(this);
        }
      }

      connectedCallback() {
        if (definition.connectedCallback) {
          definition.connectedCallback.call(this);
        }
        super.connectedCallback();
      }

      disconnectedCallback() {
        if (definition.disconnectedCallback) {
          definition.disconnectedCallback.call(this);
        }
        super.disconnectedCallback();
      }

      attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (definition.attributeChangedCallback) {
          definition.attributeChangedCallback.call(this, name, oldValue, newValue);
        }
        super.attributeChangedCallback(name, oldValue, newValue);
      }

      initialize() {
        if (definition.initialize) {
          definition.initialize.call(this);
        }
      }

      render() {
        if (definition.render) {
          return definition.render.call(this);
        }
        return '';
      }

      styles() {
        if (definition.styles) {
          return definition.styles.call(this);
        }
        return '';
      }

      afterRender() {
        if (definition.afterRender) {
          definition.afterRender.call(this);
        }
      }

      cleanup() {
        if (definition.cleanup) {
          definition.cleanup.call(this);
        }
      }
    };

    // Copy static properties
    if (definition.statics) {
      Object.assign(Component, definition.statics);
    }

    // Copy prototype methods
    if (definition.methods) {
      Object.entries(definition.methods).forEach(([name, method]) => {
        if (typeof method === 'function') {
          Component.prototype[name] = method;
        }
      });
    }

    // Register the component
    this.register(xtype, Component, definition.defaults);

    return Component;
  }

  /**
   * Create a component tree from nested configuration
   */
  static createTree(config: any, parent?: HTMLElement): BaseComponent | null {
    const component = this.create(config.xtype || 'panel', config);
    if (!component) return null;

    if (config.items && Array.isArray(config.items)) {
      config.items.forEach((itemConfig: any) => {
        const child = this.createTree(itemConfig);
        if (child) {
          component.appendChild(child);
        }
      });
    }

    if (parent) {
      parent.appendChild(component);
    }

    return component;
  }
}

// Initialize on import
ComponentRegistry.initialize();
