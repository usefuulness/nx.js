import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface PanelConfig {
  title?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  closable?: boolean;
  resizable?: boolean;
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
  width?: string;
  height?: string;
  region?: 'north' | 'south' | 'east' | 'west' | 'center';
}

export class NXPanel extends BaseComponent {
  static get observedAttributes(): string[] {
    return [
      'title', 'collapsible', 'collapsed', 'closable', 'resizable',
      'min-width', 'max-width', 'min-height', 'max-height',
      'width', 'height', 'region'
    ];
  }

  protected initializeState(): void {
    this[ComponentState].set('collapsed', false);
    this[ComponentState].set('resizing', false);
    this[ComponentState].set('width', null);
    this[ComponentState].set('height', null);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected render(): string {
    const title = this.getProp('title');
    const collapsible = this.getProp('collapsible', false);
    const collapsed = this.getState('collapsed', false);
    const closable = this.getProp('closable', false);
    const resizable = this.getProp('resizable', false);
    const region = this.getProp('region');
    const width = this.getState('width') || this.getProp('width');
    const height = this.getState('height') || this.getProp('height');

    const panelClasses = [
      'nx-panel',
      collapsed ? 'collapsed' : '',
      region ? `region-${region}` : ''
    ].filter(Boolean).join(' ');

    const style = [
      width ? `width: ${width}` : '',
      height ? `height: ${height}` : ''
    ].filter(Boolean).join('; ');

    return `
      <div class="${panelClasses}" part="container" ${style ? `style="${style}"` : ''}>
        ${title || collapsible || closable ? `
          <div class="nx-panel-header" part="header">
            ${collapsible ? `
              <button class="nx-panel-toggle" part="toggle" aria-label="Toggle panel">
                <svg viewBox="0 0 24 24">
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </button>
            ` : ''}
            <h3 class="nx-panel-title" part="title">${title || ''}</h3>
            <div class="nx-panel-tools" part="tools">
              <slot name="tools"></slot>
              ${closable ? `
                <button class="nx-panel-close" part="close" aria-label="Close panel">
                  <svg viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </div>
        ` : ''}
        
        <div class="nx-panel-body" part="body">
          <slot></slot>
        </div>
        
        ${resizable ? `
          <div class="nx-panel-resize-handle" part="resize"></div>
        ` : ''}
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        display: block;
        position: relative;
      }

      .nx-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--bg-color);
        border: 1px solid var(--border-color);
        border-radius: 0.25rem;
        overflow: hidden;
      }

      /* Header */
      .nx-panel-header {
        display: flex;
        align-items: center;
        padding: 0.75rem 1rem;
        background: var(--surface-color);
        border-bottom: 1px solid var(--border-color);
        gap: 0.5rem;
      }

      .nx-panel-toggle {
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--text-color);
        transition: transform 0.2s;
      }

      .nx-panel-toggle svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }

      .collapsed .nx-panel-toggle {
        transform: rotate(-90deg);
      }

      .nx-panel-title {
        flex: 1;
        margin: 0;
        font-size: 1rem;
        font-weight: 500;
      }

      .nx-panel-tools {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .nx-panel-close {
        width: 1.5rem;
        height: 1.5rem;
        padding: 0.25rem;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--text-color-secondary);
        border-radius: 0.25rem;
        transition: all 0.2s;
      }

      .nx-panel-close:hover {
        background: var(--hover-bg);
        color: var(--text-color);
      }

      .nx-panel-close svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }

      /* Body */
      .nx-panel-body {
        flex: 1;
        padding: 1rem;
        overflow: auto;
      }

      .collapsed .nx-panel-body {
        display: none;
      }

      /* Resize handle */
      .nx-panel-resize-handle {
        position: absolute;
        background: transparent;
        z-index: 10;
      }

      .region-east .nx-panel-resize-handle,
      .region-west .nx-panel-resize-handle {
        top: 0;
        bottom: 0;
        width: 4px;
        cursor: ew-resize;
      }

      .region-east .nx-panel-resize-handle {
        left: 0;
      }

      .region-west .nx-panel-resize-handle {
        right: 0;
      }

      .region-north .nx-panel-resize-handle,
      .region-south .nx-panel-resize-handle {
        left: 0;
        right: 0;
        height: 4px;
        cursor: ns-resize;
      }

      .region-north .nx-panel-resize-handle {
        bottom: 0;
      }

      .region-south .nx-panel-resize-handle {
        top: 0;
      }

      .nx-panel-resize-handle:hover,
      .nx-panel-resize-handle.resizing {
        background: var(--color-primary);
        opacity: 0.5;
      }

      /* Region-specific styles */
      .region-north,
      .region-south {
        width: 100%;
      }

      .region-east,
      .region-west {
        height: 100%;
      }
    `;
  }

  protected afterRender(): void {
    // Toggle button
    const toggleBtn = this.$('.nx-panel-toggle');
    if (toggleBtn) {
      this.on(toggleBtn, 'click', () => this.toggle());
    }

    // Close button
    const closeBtn = this.$('.nx-panel-close');
    if (closeBtn) {
      this.on(closeBtn, 'click', () => this.close());
    }

    // Resize handle
    const resizeHandle = this.$('.nx-panel-resize-handle');
    if (resizeHandle) {
      this.setupResize(resizeHandle as HTMLElement);
    }
  }

  private setupResize(handle: HTMLElement): void {
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    const handleMouseDown = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      mouseEvent.preventDefault();
      startX = mouseEvent.clientX;
      startY = mouseEvent.clientY;
      
      const rect = this.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;
      
      handle.classList.add('resizing');
      this.setState('resizing', true);
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const region = this.getProp('region');
      const minWidth = parseInt(this.getProp('min-width', '100'));
      const maxWidth = parseInt(this.getProp('max-width', '9999'));
      const minHeight = parseInt(this.getProp('min-height', '100'));
      const maxHeight = parseInt(this.getProp('max-height', '9999'));
      
      if (region === 'east' || region === 'west') {
        const deltaX = region === 'west' ? mouseEvent.clientX - startX : startX - mouseEvent.clientX;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
        this.setState('width', `${newWidth}px`);
      } else {
        const deltaY = region === 'south' ? mouseEvent.clientY - startY : startY - mouseEvent.clientY;
        const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
        this.setState('height', `${newHeight}px`);
      }
    };

    const handleMouseUp = () => {
      handle.classList.remove('resizing');
      this.setState('resizing', false);
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      this.emit('resize', {
        width: this.getState('width'),
        height: this.getState('height')
      });
    };

    this.on(handle, 'mousedown', handleMouseDown);
  }

  toggle(): void {
    const collapsed = !this.getState('collapsed', false);
    this.setState('collapsed', collapsed);
    this.emit('toggle', { collapsed });
  }

  close(): void {
    this.emit('close');
    this.remove();
  }

  collapse(): void {
    this.setState('collapsed', true);
    this.emit('collapse');
  }

  expand(): void {
    this.setState('collapsed', false);
    this.emit('expand');
  }

  setTitle(title: string): void {
    this.setAttribute('title', title);
  }

  getRegion(): string | null {
    return this.getProp('region', null);
  }
}

customElements.define('nx-panel', NXPanel);
