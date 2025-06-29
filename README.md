# Nexaro Framework - Modern Web Component Framework

## Overview

Transform your codebase into a modern, shadcn-like component library with zero dependencies (except Tailwind CSS). This framework provides a complete solution for building web applications with a declarative, component-based approach similar to ExtJS but using modern web standards.

## Core Architecture

### 1. Application Structure

```typescript
// src/core/application.ts
export class NXApplication extends BaseComponent {
  private router: NXRouter;
  private layout: NXLayout;
  
  static create(config: AppConfig): NXApplication {
    const app = new NXApplication();
    app.configure(config);
    return app;
  }
  
  configure(config: AppConfig): void {
    // Set up routing, layout, theme, etc.
  }
  
  launch(): void {
    // Initialize app
  }
}
```

### 2. Layout System

```typescript
// src/layouts/index.ts
export class NXLayout extends BaseComponent {
  static layouts = {
    'border': NXBorderLayout,
    'flex': NXFlexLayout,
    'grid': NXGridLayout,
    'dock': NXDockLayout
  };
}

// Border Layout (ExtJS-like)
export class NXBorderLayout extends NXLayout {
  regions = ['north', 'south', 'east', 'west', 'center'];
  
  render(): string {
    return `
      <div class="nx-border-layout">
        <div class="nx-north"><slot name="north"></slot></div>
        <div class="nx-center-wrapper">
          <div class="nx-west"><slot name="west"></slot></div>
          <div class="nx-center"><slot name="center"></slot></div>
          <div class="nx-east"><slot name="east"></slot></div>
        </div>
        <div class="nx-south"><slot name="south"></slot></div>
      </div>
    `;
  }
}
```

### 3. Component Registry

```typescript
// src/core/registry.ts
export class ComponentRegistry {
  private static components = new Map<string, typeof BaseComponent>();
  
  static register(name: string, component: typeof BaseComponent): void {
    this.components.set(name, component);
    customElements.define(name, component);
  }
  
  static create(name: string, config?: any): BaseComponent {
    const Component = this.components.get(name);
    if (!Component) throw new Error(`Component ${name} not found`);
    return new Component(config);
  }
}
```

### 4. Data Management

```typescript
// src/data/store.ts
export class NXStore<T> extends EventTarget {
  private data: T[] = [];
  private filters: Filter[] = [];
  private sorters: Sorter[] = [];
  
  load(data: T[]): void {
    this.data = data;
    this.refresh();
  }
  
  filter(fn: FilterFn<T>): void {
    this.filters.push(fn);
    this.refresh();
  }
  
  sort(field: keyof T, direction: 'asc' | 'desc'): void {
    // Sorting logic
  }
  
  getFiltered(): T[] {
    // Apply filters and sorters
  }
}
```

## Component Library

### Core Components

1. **Layout Components**
   - `nx-viewport` - Main application container
   - `nx-panel` - Configurable panel with header/footer
   - `nx-tabpanel` - Tab container
   - `nx-accordion` - Collapsible panels
   - `nx-splitter` - Resizable split panels

2. **Form Components**
   - `nx-form` - Form container with validation
   - `nx-field` - Form field wrapper
   - `nx-textfield` - Text input
   - `nx-numberfield` - Number input
   - `nx-datefield` - Date picker
   - `nx-select` - Dropdown select
   - `nx-checkbox` - Checkbox
   - `nx-radio` - Radio button
   - `nx-toggle` - Toggle switch
   - `nx-slider` - Range slider

3. **Data Components**
   - `nx-grid` - Advanced data grid with virtual scrolling
   - `nx-tree` - Tree view component
   - `nx-list` - List view with templates
   - `nx-dataview` - Custom data templates

4. **Navigation**
   - `nx-menu` - Menu bar/dropdown
   - `nx-toolbar` - Toolbar with actions
   - `nx-breadcrumb` - Breadcrumb navigation
   - `nx-sidenav` - Side navigation

5. **Feedback Components**
   - `nx-modal` - Modal dialog
   - `nx-drawer` - Slide-out drawer
   - `nx-notification` - Notification system
   - `nx-progress` - Progress indicators
   - `nx-skeleton` - Loading skeletons

### Component Example - Advanced Modal

```typescript
// src/components/ui/modal.ts
export class NXModal extends BaseComponent {
  static get observedAttributes() {
    return ['open', 'title', 'size', 'closable', 'backdrop'];
  }
  
  protected render(): string {
    const open = this.getProp('open', false);
    const size = this.getProp('size', 'md');
    
    return `
      <div class="modal-backdrop ${open ? 'open' : ''}" part="backdrop">
        <div class="modal-container modal-${size}" part="container">
          <div class="modal-header" part="header">
            <h3 class="modal-title"><slot name="title">${this.getProp('title', '')}</slot></h3>
            ${this.getProp('closable', true) ? `
              <button class="modal-close" aria-label="Close">
                <svg>...</svg>
              </button>
            ` : ''}
          </div>
          <div class="modal-body" part="body">
            <slot></slot>
          </div>
          <div class="modal-footer" part="footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    `;
  }
}
```

## Modern Features

### 1. Reactive Forms

```typescript
export class NXForm extends BaseComponent {
  private formData = reactive({});
  private validators = new Map();
  
  validate(): ValidationResult {
    // Run validators
  }
  
  submit(): void {
    if (this.validate().valid) {
      this.dispatchEvent(new CustomEvent('submit', {
        detail: this.formData
      }));
    }
  }
}
```

### 2. Virtual Scrolling for Data Grid

```typescript
export class NXGrid extends NXDataComponent {
  private virtualScroller: VirtualScroller;
  
  protected renderRows(): string {
    const visibleRows = this.virtualScroller.getVisibleItems();
    return visibleRows.map(row => this.renderRow(row)).join('');
  }
}
```

### 3. Theme System

```typescript
// src/theme/index.ts
export class ThemeManager {
  static themes = {
    'light': lightTheme,
    'dark': darkTheme,
    'midnight': midnightTheme
  };
  
  static apply(theme: string): void {
    const root = document.documentElement;
    const themeVars = this.themes[theme];
    Object.entries(themeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }
}
```

### 4. Animation System

```typescript
export class AnimationManager {
  static transitions = {
    'fade': { in: 'fadeIn', out: 'fadeOut' },
    'slide': { in: 'slideIn', out: 'slideOut' },
    'scale': { in: 'scaleIn', out: 'scaleOut' }
  };
  
  static animate(element: Element, animation: string): Promise<void> {
    return new Promise(resolve => {
      element.addEventListener('animationend', resolve, { once: true });
      element.classList.add(animation);
    });
  }
}
```

## Application Example

```typescript
// app.ts
import { NXApplication } from '@nexaro/core';

const app = NXApplication.create({
  viewport: {
    layout: 'border',
    items: [
      {
        region: 'north',
        xtype: 'toolbar',
        items: [
          { xtype: 'button', text: 'File' },
          { xtype: 'button', text: 'Edit' },
          '->', // spacer
          { xtype: 'textfield', placeholder: 'Search...' }
        ]
      },
      {
        region: 'west',
        xtype: 'treepanel',
        title: 'Navigation',
        width: 250,
        collapsible: true,
        store: {
          root: {
            children: [
              { text: 'Dashboard', icon: 'dashboard' },
              { text: 'Users', icon: 'users' },
              { text: 'Settings', icon: 'settings' }
            ]
          }
        }
      },
      {
        region: 'center',
        xtype: 'tabpanel',
        items: [
          {
            title: 'Dashboard',
            xtype: 'dashboard',
            items: [
              { xtype: 'chart', type: 'line' },
              { xtype: 'grid', store: 'sales' }
            ]
          }
        ]
      }
    ]
  },
  
  stores: {
    sales: {
      model: 'Sale',
      proxy: {
        type: 'rest',
        url: '/api/sales'
      },
      autoLoad: true
    }
  }
});

app.launch();
```

## Component Creation Pattern

```typescript
// Simple component creation
const button = NX.create('button', {
  text: 'Click me',
  variant: 'primary',
  handler: () => console.log('Clicked!')
});

// Complex component with configuration
const grid = NX.create('grid', {
  title: 'Users',
  store: 'users',
  columns: [
    { text: 'Name', dataIndex: 'name', flex: 1 },
    { text: 'Email', dataIndex: 'email', width: 200 },
    { text: 'Actions', xtype: 'actioncolumn', items: [...] }
  ],
  features: {
    filtering: true,
    sorting: true,
    grouping: true
  }
});
```

## Build Configuration

### Vite Plugin for Component Registration

```typescript
// vite-plugin-nexaro.ts
export default function nexaroPlugin() {
  return {
    name: 'vite-plugin-nexaro',
    transform(code, id) {
      if (id.includes('/components/')) {
        // Auto-register components
        code += `\nComponentRegistry.register('${tagName}', ${className});`;
      }
      return code;
    }
  };
}
```

## Best Practices

1. **Component Naming**: Use `nx-` prefix for all components
2. **Props vs State**: Props for configuration, State for runtime changes
3. **Event Naming**: Use standard event names (submit, change, select)
4. **Styling**: Use CSS custom properties for theming
5. **Performance**: Implement virtual scrolling for large datasets
6. **Accessibility**: Include ARIA attributes and keyboard navigation

## Migration Path

1. Start with core components (Button, Form, Grid)
2. Build layout system
3. Add data management
4. Implement routing
5. Create theme system
6. Add advanced components
7. Build developer tools

This framework provides a modern, dependency-free solution for building sophisticated web applications with a familiar API for developers coming from ExtJS or similar frameworks.
