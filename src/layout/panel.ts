// src/components/layout/panel.ts
import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface PanelConfig {
  title?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  closable?: boolean;
  resizable?: boolean;
  draggable?: boolean;
  tools?: ToolConfig[];
  headerActions?: ActionConfig[];
}

interface ToolConfig {
  type: 'minimize' | 'maximize' | 'close' | 'refresh' | 'settings' | 'custom';
  icon?: string;
  handler?: () => void;
  tooltip?: string;
}

interface ActionConfig {
  text?: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  handler?: () => void;
}

/**
 * A versatile panel component that serves as a container with header, body, and footer.
 * Supports collapsing, closing, resizing, and custom tools.
 */
export class NXPanel extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['title', 'collapsible', 'collapsed', 'closable', 'resizable', 'draggable', 'loading'];
  }

  protected initializeState(): void {
    this[ComponentState].set('collapsed', false);
    this[ComponentState].set('maximized', false);
    this[ComponentState].set('closed', false);
    this[ComponentState].set('isDragging', false);
    this[ComponentState].set('isResizing', false);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setupResizeObserver();
  }

  protected render(): string {
    const title = this.getProp('title', '');
    const collapsible = this.getProp('collapsible', false);
    const collapsed = this.getState('collapsed', false);
    const closable = this.getProp('closable', false);
    const closed = this.getState('closed', false);
    const maximized = this.getState('maximized', false);
    const loading = this.getProp('loading', false);

    if (closed) return '';

    return `
      <div class="nx-panel ${collapsed ? 'collapsed' : ''} ${maximized ? 'maximized' : ''}" part="panel">
        ${this.renderHeader(title, collapsible, closable)}
        <div class="nx-panel-body ${collapsed ? 'hidden' : ''}" part="body">
          ${loading ? this.renderLoader() : '<slot></slot>'}
        </div>
        <div class="nx-panel-footer ${collapsed ? 'hidden' : ''}" part="footer">
          <slot name="footer"></slot>
        </div>
        ${this.getProp('resizable') ? this.renderResizeHandles() : ''}
      </div>
    `;
  }

  private renderHeader(title: string, collapsible: boolean, closable: boolean): string {
    const hasHeaderSlot = this.querySelector('[slot="header"]');
    
    return `
      <div class="nx-panel-header" part="header" ${this.getProp('draggable') ? 'draggable="true"' : ''}>
        <div class="nx-panel-header-content">
          ${collapsible ? `
            <button class="nx-panel-toggle" aria-label="Toggle panel">
              <svg class="nx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ` : ''}
          <h3 class="nx-panel-title">
            ${hasHeaderSlot ? '<slot name="header"></slot>' : title}
          </h3>
        </div>
        <div class="nx-panel-tools">
          <slot name="tools"></slot>
          ${this.renderDefaultTools(closable)}
        </div>
      </div>
    `;
  }

  private renderDefaultTools(closable: boolean): string {
    const tools: string[] = [];
    
    if (this.getProp('maximizable')) {
      tools.push(`
        <button class="nx-panel-tool" data-action="maximize" aria-label="Maximize">
          <svg class="nx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        </button>
      `);
    }

    if (closable) {
      tools.push(`
        <button class="nx-panel-tool" data-action="close" aria-label="Close">
          <svg class="nx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      `);
    }

    return tools.join('');
  }

  private renderLoader(): string {
    return `
      <div class="nx-panel-loader">
        <div class="nx-spinner">
          <div class="nx-spinner-ring"></div>
          <div class="nx-spinner-ring"></div>
          <div class="nx-spinner-ring"></div>
        </div>
      </div>
    `;
  }

  private renderResizeHandles(): string {
    return `
      <div class="nx-resize-handle nx-resize-n" data-direction="n"></div>
      <div class="nx-resize-handle nx-resize-e" data-direction="e"></div>
      <div class="nx-resize-handle nx-resize-s" data-direction="s"></div>
      <div class="nx-resize-handle nx-resize-w" data-direction="w"></div>
      <div class="nx-resize-handle nx-resize-ne" data-direction="ne"></div>
      <div class="nx-resize-handle nx-resize-se" data-direction="se"></div>
      <div class="nx-resize-handle nx-resize-sw" data-direction="sw"></div>
      <div class="nx-resize-handle nx-resize-nw" data-direction="nw"></div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        --nx-panel-bg: var(--color-surface);
        --nx-panel-border: var(--color-border);
        --nx-panel-header-bg: var(--color-background);
        --nx-panel-shadow: var(--shadow-lg);
        --nx-panel-radius: var(--radius-lg);
      }

      .nx-panel {
        background: var(--nx-panel-bg);
        border: 1px solid var(--nx-panel-border);
        border-radius: var(--nx-panel-radius);
        box-shadow: var(--nx-panel-shadow);
        display: flex;
        flex-direction: column;
        position: relative;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .nx-panel.maximized {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 9999;
        border-radius: 0;
      }

      .nx-panel-header {
        background: var(--nx-panel-header-bg);
        border-bottom: 1px solid var(--nx-panel-border);
        padding: 1rem 1.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        user-select: none;
        border-radius: var(--nx-panel-radius) var(--nx-panel-radius) 0 0;
      }

      .nx-panel-header[draggable="true"] {
        cursor: move;
      }

      .nx-panel-header-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
      }

      .nx-panel-toggle {
        background: none;
        border: none;
        padding: 0.25rem;
        cursor: pointer;
        color: var(--color-text-secondary);
        transition: all 0.2s;
        border-radius: var(--radius-sm);
      }

      .nx-panel-toggle:hover {
        background: var(--color-surface);
        color: var(--color-text);
      }

      .nx-panel.collapsed .nx-panel-toggle svg {
        transform: rotate(0deg);
      }

      .nx-panel:not(.collapsed) .nx-panel-toggle svg {
        transform: rotate(90deg);
      }

      .nx-panel-title {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-text);
      }

      .nx-panel-tools {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .nx-panel-tool {
        background: none;
        border: none;
        padding: 0.5rem;
        cursor: pointer;
        color: var(--color-text-secondary);
        transition: all 0.2s;
        border-radius: var(--radius-sm);
      }

      .nx-panel-tool:hover {
        background: var(--color-surface);
        color: var(--color-text);
      }

      .nx-icon {
        width: 1.25rem;
        height: 1.25rem;
        transition: transform 0.2s;
      }

      .nx-panel-body {
        flex: 1;
        padding: 1.5rem;
        overflow: auto;
      }

      .nx-panel-footer:not(:empty) {
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--nx-panel-border);
        background: var(--nx-panel-header-bg);
        border-radius: 0 0 var(--nx-panel-radius) var(--nx-panel-radius);
      }

      .nx-panel-loader {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
      }

      .nx-spinner {
        position: relative;
        width: 3rem;
        height: 3rem;
      }

      .nx-spinner-ring {
        position: absolute;
        width: 100%;
        height: 100%;
        border: 3px solid transparent;
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
      }

      .nx-spinner-ring:nth-child(2) {
        animation-delay: -0.45s;
      }

      .nx-spinner-ring:nth-child(3) {
        animation-delay: -0.9s;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Resize handles */
      .nx-resize-handle {
        position: absolute;
        background: transparent;
      }

      .nx-resize-handle:hover {
        background: var(--color-primary);
        opacity: 0.3;
      }

      .nx-resize-n, .nx-resize-s {
        left: 0;
        right: 0;
        height: 4px;
        cursor: ns-resize;
      }

      .nx-resize-n { top: 0; }
      .nx-resize-s { bottom: 0; }

      .nx-resize-e, .nx-resize-w {
        top: 0;
        bottom: 0;
        width: 4px;
        cursor: ew-resize;
      }

      .nx-resize-e { right: 0; }
      .nx-resize-w { left: 0; }

      .nx-resize-ne, .nx-resize-se, .nx-resize-sw, .nx-resize-nw {
        width: 12px;
        height: 12px;
      }

      .nx-resize-ne { top: 0; right: 0; cursor: nesw-resize; }
      .nx-resize-se { bottom: 0; right: 0; cursor: nwse-resize; }
      .nx-resize-sw { bottom: 0; left: 0; cursor: nesw-resize; }
      .nx-resize-nw { top: 0; left: 0; cursor: nwse-resize; }

      .hidden {
        display: none !important;
      }
    `;
  }

  protected afterRender(): void {
    // Toggle collapse
    this.on('.nx-panel-toggle', 'click', () => {
      const collapsed = !this.getState('collapsed', false);
      this.setState('collapsed', collapsed);
      this.dispatchEvent(new CustomEvent('collapse', { detail: { collapsed } }));
    });

    // Tool actions
    this.$$('.nx-panel-tool').forEach(tool => {
      tool.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        
        switch (action) {
          case 'close':
            this.setState('closed', true);
            this.dispatchEvent(new CustomEvent('close'));
            break;
          case 'maximize':
            const maximized = !this.getState('maximized', false);
            this.setState('maximized', maximized);
            this.dispatchEvent(new CustomEvent('maximize', { detail: { maximized } }));
            break;
        }
      });
    });

    // Dragging
    if (this.getProp('draggable')) {
      this.setupDragging();
    }

    // Resizing
    if (this.getProp('resizable')) {
      this.setupResizing();
    }
  }

  private setupDragging(): void {
    const header = this.$('.nx-panel-header') as HTMLElement;
    let isDragging = false;
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;

    header.addEventListener('dragstart', (e) => {
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.setDragImage(new Image(), 0, 0);
      isDragging = true;
      initialX = e.clientX - (this.offsetLeft || 0);
      initialY = e.clientY - (this.offsetTop || 0);
      this.setState('isDragging', true);
    });

    document.addEventListener('dragover', (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        this.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
    });

    header.addEventListener('dragend', () => {
      isDragging = false;
      this.setState('isDragging', false);
      this.dispatchEvent(new CustomEvent('move', { 
        detail: { x: currentX, y: currentY } 
      }));
    });
  }

  private setupResizing(): void {
    const handles = this.$$('.nx-resize-handle');
    
    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const direction = (handle as HTMLElement).dataset.direction!;
        this.startResize(e as MouseEvent, direction);
      });
    });
  }

  private startResize(e: MouseEvent, direction: string): void {
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = this.offsetWidth;
    const startHeight = this.offsetHeight;

    const doResize = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;

      if (direction.includes('e')) newWidth = startWidth + dx;
      if (direction.includes('w')) newWidth = startWidth - dx;
      if (direction.includes('s')) newHeight = startHeight + dy;
      if (direction.includes('n')) newHeight = startHeight - dy;

      this.style.width = `${Math.max(200, newWidth)}px`;
      this.style.height = `${Math.max(100, newHeight)}px`;
    };

    const stopResize = () => {
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
      this.setState('isResizing', false);
      this.dispatchEvent(new CustomEvent('resize', {
        detail: { width: this.offsetWidth, height: this.offsetHeight }
      }));
    };

    this.setState('isResizing', true);
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
  }

  private setupResizeObserver(): void {
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          this.dispatchEvent(new CustomEvent('resize', {
            detail: {
              width: entry.contentRect.width,
              height: entry.contentRect.height
            }
          }));
        }
      });
      observer.observe(this);
    }
  }
}

customElements.define('nx-panel', NXPanel);
