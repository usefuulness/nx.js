export interface DrawerConfig {
  title?: string;
  position?: 'left' | 'right' | 'top' | 'bottom';
  size?: string | number;
  overlay?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  persistent?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * Drawer component for slide-out panels
 */
export class NXDrawer extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['open', 'title', 'position', 'size', 'overlay', 'close-on-overlay-click', 
            'close-on-escape', 'show-close-button', 'persistent'];
  }

  protected initializeState(): void {
    this[ComponentState].set('open', false);
    this[ComponentState].set('animating', false);
  }

  constructor(config?: DrawerConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    
    if (config) {
      this.configure(config);
    }
  }

  configure(config: DrawerConfig): void {
    Object.entries(config).forEach(([key, value]) => {
      if (['onOpen', 'onClose'].includes(key)) {
        this[ComponentState].set(key, value);
      } else {
        const attrName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        this.setAttribute(attrName, String(value));
      }
    });
  }

  protected render(): string {
    const open = this.getState('open', false);
    const animating = this.getState('animating', false);
    const title = this.getProp('title');
    const position = this.getProp('position', 'left');
    const overlay = this.getProp('overlay', true);
    const showCloseButton = this.getProp('show-close-button', true);

    return `
      <div class="nx-drawer-container ${open ? 'open' : ''} ${animating ? 'animating' : ''}"
           part="container">
        ${overlay ? `
          <div class="nx-drawer-overlay" part="overlay"></div>
        ` : ''}
        
        <div class="nx-drawer nx-drawer-${position}" 
             part="drawer"
             role="dialog"
             aria-modal="true"
             aria-label="${title || 'Drawer'}">
          ${title || showCloseButton ? `
            <div class="nx-drawer-header" part="header">
              ${title ? `<h2 class="nx-drawer-title" part="title">${title}</h2>` : '<div></div>'}
              ${showCloseButton ? `
                <button class="nx-drawer-close" 
                        part="close-button"
                        aria-label="Close drawer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              ` : ''}
            </div>
          ` : ''}
          
          <div class="nx-drawer-body" part="body">
            <slot></slot>
          </div>
          
          <div class="nx-drawer-footer" part="footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        --drawer-width: 320px;
        --drawer-height: 320px;
        --drawer-bg: var(--color-surface);
        --drawer-shadow: var(--shadow-lg);
        --overlay-bg: rgba(0, 0, 0, 0.5);
        --animation-duration: 0.3s;
      }

      .nx-drawer-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        pointer-events: none;
      }

      .nx-drawer-container.open {
        pointer-events: auto;
      }

      /* Overlay */
      .nx-drawer-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--overlay-bg);
        opacity: 0;
        transition: opacity var(--animation-duration) ease-out;
      }

      .nx-drawer-container.animating .nx-drawer-overlay {
        opacity: 1;
      }

      /* Drawer */
      .nx-drawer {
        position: absolute;
        background: var(--drawer-bg);
        box-shadow: var(--drawer-shadow);
        display: flex;
        flex-direction: column;
        transition: transform var(--animation-duration) ease-out;
      }

      /* Position variants */
      .nx-drawer-left {
        top: 0;
        left: 0;
        bottom: 0;
        width: var(--drawer-width);
        transform: translateX(-100%);
      }

      .nx-drawer-right {
        top: 0;
        right: 0;
        bottom: 0;
        width: var(--drawer-width);
        transform: translateX(100%);
      }

      .nx-drawer-top {
        top: 0;
        left: 0;
        right: 0;
        height: var(--drawer-height);
        transform: translateY(-100%);
      }

      .nx-drawer-bottom {
        bottom: 0;
        left: 0;
        right: 0;
        height: var(--drawer-height);
        transform: translateY(100%);
      }

      /* Open state */
      .nx-drawer-container.animating .nx-drawer {
        transform: translate(0, 0);
      }

      /* Header */
      .nx-drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .nx-drawer-title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--color-text);
      }

      .nx-drawer-close {
        width: 2rem;
        height: 2rem;
        padding: 0.375rem;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        border-radius: var(--radius-sm);
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .nx-drawer-close:hover {
        background: var(--color-background);
        color: var(--color-text);
      }

      .nx-drawer-close:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .nx-drawer-close svg {
        width: 100%;
        height: 100%;
      }

      /* Body */
      .nx-drawer-body {
        flex: 1;
        padding: 1.5rem;
        overflow-y: auto;
      }

      /* Footer */
      .nx-drawer-footer:not(:empty) {
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      /* Custom size */
      .nx-drawer[style*="--drawer-size"] {
        width: var(--drawer-size) !important;
        height: var(--drawer-size) !important;
      }

      /* Mobile responsive */
      @media (max-width: 640px) {
        .nx-drawer-left,
        .nx-drawer-right {
          width: calc(100vw - 3rem);
          max-width: var(--drawer-width);
        }

        .nx-drawer-top,
        .nx-drawer-bottom {
          height: calc(100vh - 3rem);
          max-height: var(--drawer-height);
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .nx-drawer-overlay,
        .nx-drawer {
          transition: none;
        }
      }
    `;
  }

  protected afterRender(): void {
    // Close button
    this.on('.nx-drawer-close', 'click', () => this.close());

    // Overlay click
    const overlay = this.$('.nx-drawer-overlay');
    if (overlay && this.getProp('close-on-overlay-click', true)) {
      overlay.addEventListener('click', () => this.close());
    }

    // Escape key
    if (this.getProp('close-on-escape', true)) {
      this.setupEscapeHandler();
    }

    // Focus management
    if (this.getState('open')) {
      this.trapFocus();
    }

    // Apply custom size
    const size = this.getProp('size');
    if (size) {
      const drawer = this.$('.nx-drawer') as HTMLElement;
      const sizeValue = typeof size === 'number' ? `${size}px` : size;
      drawer.style.setProperty('--drawer-size', sizeValue);
    }
  }

  private setupEscapeHandler(): void {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.getState('open')) {
        this.close();
      }
    };

    document.addEventListener('keydown', handler);
    this[ComponentState].set('escapeHandler', handler);
  }

  private trapFocus(): void {
    const drawer = this.$('.nx-drawer');
    if (!drawer) return;

    // Store previously focused element
    this[ComponentState].set('previousFocus', document.activeElement);

    // Focus first focusable element
    requestAnimationFrame(() => {
      const focusable = drawer.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusable.length > 0) {
        (focusable[0] as HTMLElement).focus();
      }
    });
  }

  private restoreFocus(): void {
    const previousFocus = this.getState('previousFocus') as HTMLElement;
    if (previousFocus && previousFocus.focus) {
      previousFocus.focus();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    
    // Remove escape handler
    const handler = this.getState('escapeHandler');
    if (handler) {
      document.removeEventListener('keydown', handler);
    }
  }

  // Public API
  open(): void {
    if (this.getState('open')) return;

    this.setState('open', true);
    this.setAttribute('open', '');
    
    // Start animation
    requestAnimationFrame(() => {
      this.setState('animating', true);
      
      const onOpen = this.getState('onOpen');
      if (onOpen) onOpen();
      
      this.dispatchEvent(new CustomEvent('open'));
    });
  }

  close(): void {
    if (!this.getState('open')) return;
    
    const persistent = this.getProp('persistent', false);
    if (persistent) {
      this.dispatchEvent(new CustomEvent('closeattempt'));
      return;
    }

    this.setState('animating', false);
    
    // Wait for animation
    setTimeout(() => {
      this.setState('open', false);
      this.removeAttribute('open');
      this.restoreFocus();
      
      const onClose = this.getState('onClose');
      if (onClose) onClose();
      
      this.dispatchEvent(new CustomEvent('close'));
    }, 300);
  }

  toggle(): void {
    if (this.getState('open')) {
      this.close();
    } else {
      this.open();
    }
  }

  isOpen(): boolean {
    return this.getState('open', false);
  }

  setTitle(title: string): void {
    this.setAttribute('title', title);
  }

  static show(config: DrawerConfig & { content?: string | HTMLElement }): NXDrawer {
    const drawer = new NXDrawer(config);
    
    if (config.content) {
      if (typeof config.content === 'string') {
        drawer.innerHTML = config.content;
      } else {
        drawer.appendChild(config.content);
      }
    }
    
    document.body.appendChild(drawer);
    drawer.open();
    
    drawer.addEventListener('close', () => {
      setTimeout(() => drawer.remove(), 300);
    });
    
    return drawer;
  }
}

customElements.define('nx-drawer', NXDrawer);
