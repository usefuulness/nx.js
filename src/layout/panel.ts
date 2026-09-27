/**
 * @file @/layout/panel.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent, ComponentState, escapeHTML } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';

export interface PanelConfig {
  title?: string;
  icon?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  closable?: boolean;
  resizable?: boolean;
  minWidth?: string | number;
  maxWidth?: string | number;
  minHeight?: string | number;
  maxHeight?: string | number;
  width?: string | number;
  height?: string | number;
  /** Padding inside the body. `true` (default) = 1rem, `false` = none, or any CSS length / number (px). */
  bodyPadding?: boolean | string | number;
  /** Draw the outer border. Defaults to true, or the region edge only inside a border layout. */
  border?: boolean;
  region?: 'north' | 'south' | 'east' | 'west' | 'center';
}

const size = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value)) ? `${value}px` : String(value);
};

/**
 * General-purpose container with an optional header. Inside a viewport,
 * set `region` to dock it (`north`, `west`, `center`, ...).
 *
 * @example
 * ```typescript
 * { xtype: 'panel', title: 'Navigation', region: 'west', width: 260, collapsible: true, items: [...] }
 * ```
 */
export class NXPanel extends BaseComponent {
  static get observedAttributes(): string[] {
    return [
      'title', 'icon', 'collapsible', 'collapsed', 'closable', 'resizable',
      'min-width', 'max-width', 'min-height', 'max-height',
      'width', 'height', 'region', 'body-padding', 'border'
    ];
  }

  protected initializeState(): void {
    this[ComponentState].set('collapsed', null);
    this[ComponentState].set('resizing', false);
    this[ComponentState].set('width', null);
    this[ComponentState].set('height', null);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  private isCollapsed(): boolean {
    const state = this.getState<boolean | null>('collapsed', null);
    return state ?? !!this.getProp('collapsed', false);
  }

  protected render(): string {
    const title = this.getProp('title');
    const icon = this.getProp<string>('icon');
    const collapsible = this.getProp('collapsible', false);
    const collapsed = this.isCollapsed();
    const closable = this.getProp('closable', false);
    const resizable = this.getProp('resizable', false);
    const region = this.getProp<string>('region');
    const border = this.getProp('border', true);
    const horizontal = region === 'west' || region === 'east';

    this.applyHostSize(collapsed && horizontal);

    const panelClasses = [
      'nx-panel',
      collapsed ? 'collapsed' : '',
      region ? `region region-${region}` : 'standalone',
      border ? 'bordered' : ''
    ].filter(Boolean).join(' ');

    const toggleIcon = horizontal
      ? (region === 'west') !== collapsed ? 'chevron-left' : 'chevron-right'
      : collapsed ? 'chevron-right' : 'chevron-down';

    const hasHeader = title || icon || collapsible || closable;

    return `
      <div class="${panelClasses}" part="container">
        ${hasHeader ? `
          <div class="nx-panel-header" part="header">
            ${icon ? `<span class="nx-panel-icon" part="icon">${Icons.get(icon)}</span>` : ''}
            <h3 class="nx-panel-title" part="title">${escapeHTML(title ?? '')}</h3>
            <div class="nx-panel-tools" part="tools">
              <slot name="tools"></slot>
              ${collapsible ? `
                <button class="nx-panel-tool nx-panel-toggle" part="toggle"
                        aria-label="${collapsed ? 'Expand' : 'Collapse'} panel"
                        aria-expanded="${!collapsed}">
                  ${Icons.get(toggleIcon)}
                </button>
              ` : ''}
              ${closable ? `
                <button class="nx-panel-tool nx-panel-close" part="close" aria-label="Close panel">
                  ${Icons.get('close')}
                </button>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <div class="nx-panel-body" part="body">
          <slot></slot>
        </div>

        <slot name="footer"></slot>

        ${resizable ? `<div class="nx-panel-resize-handle" part="resize"></div>` : ''}
      </div>
    `;
  }

  private applyHostSize(railCollapsed: boolean): void {
    const width = railCollapsed ? '3rem' : size(this.getState('width') || this.getProp('width'));
    const height = size(this.getState('height') || this.getProp('height'));
    this.style.width = width ?? '';
    this.style.height = height ?? '';
    this.style.minWidth = railCollapsed ? '' : size(this.getProp('min-width')) ?? '';
    this.style.maxWidth = railCollapsed ? '' : size(this.getProp('max-width')) ?? '';
  }

  protected styles(): string {
    const padding = this.getProp<boolean | string | number>('body-padding', true);
    const bodyPadding = padding === true ? '1rem' : padding === false ? '0' : size(padding);

    return `
      :host {
        display: flex;
        flex-direction: column;
        position: relative;
        min-width: 0;
        min-height: 0;
        transition: width var(--transition-duration) var(--transition-easing);
      }

      .nx-panel {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        background: var(--color-surface);
        color: var(--color-text);
        overflow: hidden;
      }

      .standalone.bordered {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
      }

      .region-north.bordered { border-bottom: 1px solid var(--color-border); }
      .region-south.bordered { border-top: 1px solid var(--color-border); }
      .region-west.bordered { border-right: 1px solid var(--color-border); }
      .region-east.bordered { border-left: 1px solid var(--color-border); }
      .region-center { background: var(--color-background); }

      /* Header */
      .nx-panel-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 3rem;
        padding: 0 0.5rem 0 1rem;
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .nx-panel-icon {
        display: inline-flex;
        font-size: 1rem;
        color: var(--color-text-secondary);
      }

      .nx-panel-title {
        flex: 1;
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
        letter-spacing: -0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .nx-panel-tools {
        display: flex;
        align-items: center;
        gap: 0.125rem;
      }

      .nx-panel-tool {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        font-size: 1rem;
        cursor: pointer;
        transition: background var(--transition-duration), color var(--transition-duration);
      }

      .nx-panel-tool:hover {
        background: var(--color-accent);
        color: var(--color-text);
      }

      /* Body */
      .nx-panel-body {
        flex: 1;
        min-height: 0;
        padding: ${bodyPadding};
        overflow: auto;
      }

      .collapsed .nx-panel-body,
      .collapsed ::slotted([slot="footer"]) {
        display: none;
      }

      .collapsed.region-west .nx-panel-header,
      .collapsed.region-east .nx-panel-header {
        padding: 0.5rem 0;
        justify-content: center;
        border-bottom: none;
      }

      .collapsed.region-west .nx-panel-title,
      .collapsed.region-east .nx-panel-title,
      .collapsed.region-west .nx-panel-icon,
      .collapsed.region-east .nx-panel-icon {
        display: none;
      }

      /* Resize handle */
      .nx-panel-resize-handle {
        position: absolute;
        z-index: 10;
        background: transparent;
        transition: background var(--transition-duration);
      }

      .region-east .nx-panel-resize-handle,
      .region-west .nx-panel-resize-handle {
        top: 0;
        bottom: 0;
        width: 4px;
        cursor: ew-resize;
      }

      .region-east .nx-panel-resize-handle { left: -2px; }
      .region-west .nx-panel-resize-handle { right: -2px; }

      .region-north .nx-panel-resize-handle,
      .region-south .nx-panel-resize-handle {
        left: 0;
        right: 0;
        height: 4px;
        cursor: ns-resize;
      }

      .region-north .nx-panel-resize-handle { bottom: -2px; }
      .region-south .nx-panel-resize-handle { top: -2px; }

      .nx-panel-resize-handle:hover,
      .nx-panel-resize-handle.resizing {
        background: var(--color-ring);
      }
    `;
  }

  protected afterRender(): void {
    const toggleBtn = this.$('.nx-panel-toggle');
    if (toggleBtn) {
      this.on(toggleBtn, 'click', () => this.toggle());
    }

    const closeBtn = this.$('.nx-panel-close');
    if (closeBtn) {
      this.on(closeBtn, 'click', () => this.close());
    }

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

    const handleMouseMove = (e: MouseEvent) => {
      const region = this.getProp('region');
      const minWidth = parseInt(this.getProp('min-width', '100'));
      const maxWidth = parseInt(this.getProp('max-width', '9999'));
      const minHeight = parseInt(this.getProp('min-height', '100'));
      const maxHeight = parseInt(this.getProp('max-height', '9999'));

      if (region === 'east' || region === 'west') {
        const deltaX = region === 'west' ? e.clientX - startX : startX - e.clientX;
        this.style.width = `${Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX))}px`;
      } else {
        const deltaY = region === 'north' ? e.clientY - startY : startY - e.clientY;
        this.style.height = `${Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY))}px`;
      }
    };

    const handleMouseUp = () => {
      handle.classList.remove('resizing');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';

      // Persist the size so re-renders keep it
      this[ComponentState].set('width', this.style.width || null);
      this[ComponentState].set('height', this.style.height || null);
      this.emit('resize', { width: this.style.width, height: this.style.height });
    };

    this.on(handle, 'mousedown', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      mouseEvent.preventDefault();
      startX = mouseEvent.clientX;
      startY = mouseEvent.clientY;
      const rect = this.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;
      handle.classList.add('resizing');
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
  }

  toggle(): void {
    const collapsed = !this.isCollapsed();
    this.setState('collapsed', collapsed);
    this.emit('toggle', { collapsed });
    this.emit(collapsed ? 'collapse' : 'expand');
  }

  close(): void {
    if (this.emit('close')) {
      this.remove();
    }
  }

  collapse(): void {
    if (!this.isCollapsed()) this.toggle();
  }

  expand(): void {
    if (this.isCollapsed()) this.toggle();
  }

  setTitle(title: string): void {
    this.setAttribute('title', title);
  }

  getRegion(): string | null {
    return this.getProp('region', null);
  }
}

define('nx-panel', NXPanel);
