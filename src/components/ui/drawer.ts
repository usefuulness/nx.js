import { BaseComponent, ComponentState } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';

export interface DrawerConfig {
  position?: 'left' | 'right' | 'top' | 'bottom';
  size?: string;
  backdrop?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  persistent?: boolean;
}

/**
 * Drawer/sidebar component
 */
export class NXDrawer extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['open', 'position', 'size', 'backdrop', 'close-on-backdrop', 'close-on-escape', 'persistent'];
  }

  protected initializeState(): void {
    this[ComponentState].set('open', false);
    this[ComponentState].set('transitioning', false);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.getState('open')) {
      // Set open attribute if state is true
      this.setAttribute('open', '');
    }
  }

  protected render(): string {
    const open = this.getState('open');
    const transitioning = this.getState('transitioning');
    const position = this.getProp('position', 'left');
    const backdrop = this.getProp('backdrop', true);
    const size = this.getProp('size', '300px');
    const persistent = this.getProp('persistent', false);

    const drawerClasses = [
      'nx-drawer',
      `position-${position}`,
      open ? 'open' : '',
      transitioning ? 'transitioning' : ''
    ].filter(Boolean).join(' ');

    return `
      ${backdrop && open && !persistent ? `
        <div class="nx-drawer-backdrop" part="backdrop"></div>
      ` : ''}
      <div class="${drawerClasses}" part="drawer" style="--drawer-size: ${size}">
        ${!persistent ? `
          <button class="nx-drawer-close" part="close" aria-label="Close drawer" type="button">
            ${Icons.get('close')}
          </button>
        ` : ''}
        <div class="nx-drawer-content" part="content">
          <slot></slot>
        </div>
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        --drawer-size: 320px;
        --drawer-duration: 250ms;
      }

      :host([hidden]) {
        display: none !important;
      }

      .nx-drawer-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--backdrop-bg);
        z-index: 998;
        opacity: 0;
        transition: opacity var(--drawer-duration) var(--transition-easing);
      }

      :host([open]) .nx-drawer-backdrop {
        opacity: 1;
      }

      .nx-drawer {
        position: fixed;
        background: var(--drawer-bg);
        color: var(--color-text);
        border: 0 solid var(--color-border);
        z-index: 999;
        visibility: hidden;
        transition: transform var(--drawer-duration) var(--transition-easing),
                    visibility 0s linear var(--drawer-duration);
        overflow: auto;
      }

      .position-left { border-right-width: 1px; }
      .position-right { border-left-width: 1px; }
      .position-top { border-bottom-width: 1px; }
      .position-bottom { border-top-width: 1px; }

      /* Position styles */
      .position-left {
        top: 0;
        left: 0;
        bottom: 0;
        width: var(--drawer-size);
        transform: translateX(-100%);
      }

      .position-right {
        top: 0;
        right: 0;
        bottom: 0;
        width: var(--drawer-size);
        transform: translateX(100%);
      }

      .position-top {
        top: 0;
        left: 0;
        right: 0;
        height: var(--drawer-size);
        transform: translateY(-100%);
      }

      .position-bottom {
        bottom: 0;
        left: 0;
        right: 0;
        height: var(--drawer-size);
        transform: translateY(100%);
      }

      /* Open state */
      .nx-drawer.open {
        transform: translate(0, 0);
        visibility: visible;
        box-shadow: var(--drawer-shadow);
        transition: transform var(--drawer-duration) var(--transition-easing), visibility 0s;
      }

      /* Close button */
      .nx-drawer-close {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: var(--radius-sm);
        color: var(--color-text-secondary);
        font-size: 1rem;
        transition: background-color var(--transition-duration);
      }

      .nx-drawer-close:hover {
        background-color: var(--color-accent);
        color: var(--color-text);
      }

      /* Content */
      .nx-drawer-content {
        padding: 1.5rem;
        height: 100%;
        overflow: auto;
      }

      /* Responsive */
      @media (max-width: 600px) {
        :host {
          --drawer-size: 80vw;
        }

        .position-top,
        .position-bottom {
          --drawer-size: 80vh;
        }
      }

      /* Prevent body scroll when open */
      :host([open]) {
        pointer-events: auto;
      }

      /* Animation classes */
      .transitioning {
        transition: transform var(--transition-duration) var(--transition-easing);
      }
    `;
  }

  protected afterRender(): void {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Backdrop click
    const backdrop = this.$('.nx-drawer-backdrop');
    if (backdrop && this.getProp('close-on-backdrop', true)) {
      this.on(backdrop, 'click', () => this.close());
    }

    // Close button
    const closeBtn = this.$('.nx-drawer-close');
    if (closeBtn) {
      this.on(closeBtn, 'click', () => this.close());
    }

    // Escape key
    if (this.getProp('close-on-escape', true)) {
      this.on(document, 'keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Escape' && this.getState('open')) {
          this.close();
        }
      });
    }
  }

  open(): void {
    if (this.getState('open')) return;

    this.setState('transitioning', true);
    
    // Trigger reflow
    void this.offsetHeight;
    
    this.setState('open', true);
    this.setAttribute('open', '');
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    this.setTimeout(() => {
      this.setState('transitioning', false);
      this.emit('open');
    }, 225);
  }

  close(): void {
    if (!this.getState('open') || this.getProp('persistent', false)) return;

    this.setState('transitioning', true);
    this.setState('open', false);
    this.removeAttribute('open');
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    this.setTimeout(() => {
      this.setState('transitioning', false);
      this.emit('close');
    }, 225);
  }

  toggle(): void {
    if (this.getState('open')) {
      this.close();
    } else {
      this.open();
    }
  }

  protected onAttributeChange(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'open') {
      const shouldBeOpen = newValue !== null;
      if (shouldBeOpen !== this.getState('open')) {
        if (shouldBeOpen) {
          this.open();
        } else {
          this.close();
        }
      }
    }
  }
}

// Register the component
define('nx-drawer', NXDrawer);
