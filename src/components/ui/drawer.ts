import { BaseComponent, ComponentState } from '@/components/abstracts/base';

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
          <button 
            class="nx-drawer-close" 
            part="close"
            aria-label="Close drawer"
            type="button"
          >
            <svg viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
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
        --drawer-size: 300px;
        --drawer-bg: var(--surface-color, #fff);
        --drawer-shadow: 0 8px 10px -5px rgba(0,0,0,0.2),
                        0 16px 24px 2px rgba(0,0,0,0.14),
                        0 6px 30px 5px rgba(0,0,0,0.12);
        --backdrop-bg: rgba(0, 0, 0, 0.5);
        --transition-duration: 225ms;
        --transition-easing: cubic-bezier(0, 0, 0.2, 1);
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
        transition: opacity var(--transition-duration) var(--transition-easing);
      }

      :host([open]) .nx-drawer-backdrop {
        opacity: 1;
      }

      .nx-drawer {
        position: fixed;
        background: var(--drawer-bg);
        box-shadow: var(--drawer-shadow);
        z-index: 999;
        transition: transform var(--transition-duration) var(--transition-easing);
        overflow: auto;
      }

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
      }

      /* Close button */
      .nx-drawer-close {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        width: 3rem;
        height: 3rem;
        padding: 0.75rem;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 50%;
        transition: background-color 150ms;
        color: var(--text-color);
      }

      .nx-drawer-close:hover {
        background-color: rgba(0, 0, 0, 0.04);
      }

      .nx-drawer-close:active {
        background-color: rgba(0, 0, 0, 0.08);
      }

      .nx-drawer-close svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }

      /* Content */
      .nx-drawer-content {
        padding: 1rem;
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
customElements.define('nx-drawer', NXDrawer);
