import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface LoaderConfig {
  type?: 'spinner' | 'dots' | 'bars' | 'pulse';
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  overlay?: boolean;
  fullscreen?: boolean;
  text?: string;
}

export class NXLoader extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['type', 'size', 'color', 'overlay', 'fullscreen', 'text', 'active'];
  }

  protected initializeState(): void {
    this[ComponentState].set('active', true);
  }
  
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected render(): string {
    const type = this.getProp('type', 'spinner');
    const size = this.getProp('size', 'md');
    const overlay = this.getProp('overlay', false);
    const fullscreen = this.getProp('fullscreen', false);
    const text = this.getProp('text');
    const active = this.getProp('active', true);
    
    if (!active) return '';

    const content = `
      <div class="nx-loader nx-loader-${type} nx-loader-${size}" part="loader">
        ${this.renderLoader(type)}
        ${text ? `<div class="nx-loader-text" part="text">${text}</div>` : ''}
      </div>
    `;

    if (overlay || fullscreen) {
      return `
        <div class="nx-loader-overlay ${fullscreen ? 'fullscreen' : ''}" part="overlay">
          ${content}
        </div>
      `;
    }

    return content;
  }

  private renderLoader(type: string): string {
    switch (type) {
      case 'dots':
        return `
          <div class="nx-loader-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        `;
        
      case 'bars':
        return `
          <div class="nx-loader-bars">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        `;
        
      case 'pulse':
        return `
          <div class="nx-loader-pulse">
            <span></span>
            <span></span>
          </div>
        `;
        
      case 'spinner':
      default:
        return '<nx-spinner></nx-spinner>';
    }
  }

  protected styles(): string {
    return `
      :host {
        --loader-color: var(--color-primary);
        --loader-size: 2rem;
        display: inline-block;
      }

      .nx-loader {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }

      /* Sizes */
      .nx-loader-sm {
        --loader-size: 1rem;
        font-size: 0.75rem;
      }

      .nx-loader-lg {
        --loader-size: 3rem;
        font-size: 1rem;
      }

      /* Overlay */
      .nx-loader-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999;
      }

      [data-theme="dark"] .nx-loader-overlay {
        background: rgba(0, 0, 0, 0.9);
      }

      .nx-loader-overlay.fullscreen {
        position: fixed;
        z-index: 9999;
      }

      /* Dots */
      .nx-loader-dots {
        display: flex;
        gap: 0.5rem;
      }

      .nx-loader-dots span {
        width: calc(var(--loader-size) / 3);
        height: calc(var(--loader-size) / 3);
        background: var(--loader-color);
        border-radius: 50%;
        animation: loader-dots 1.4s ease-in-out infinite both;
      }

      .nx-loader-dots span:nth-child(1) {
        animation-delay: -0.32s;
      }

      .nx-loader-dots span:nth-child(2) {
        animation-delay: -0.16s;
      }

      @keyframes loader-dots {
        0%, 80%, 100% {
          transform: scale(0);
          opacity: 0.5;
        }
        40% {
          transform: scale(1);
          opacity: 1;
        }
      }

      /* Bars */
      .nx-loader-bars {
        display: flex;
        gap: 0.25rem;
        height: var(--loader-size);
      }

      .nx-loader-bars span {
        width: calc(var(--loader-size) / 8);
        background: var(--loader-color);
        animation: loader-bars 1.2s ease-in-out infinite;
      }

      .nx-loader-bars span:nth-child(1) {
        animation-delay: -0.4s;
      }

      .nx-loader-bars span:nth-child(2) {
        animation-delay: -0.3s;
      }

      .nx-loader-bars span:nth-child(3) {
        animation-delay: -0.2s;
      }

      .nx-loader-bars span:nth-child(4) {
        animation-delay: -0.1s;
      }

      @keyframes loader-bars {
        0%, 40%, 100% {
          transform: scaleY(0.4);
        }
        20% {
          transform: scaleY(1);
        }
      }

      /* Pulse */
      .nx-loader-pulse {
        position: relative;
        width: var(--loader-size);
        height: var(--loader-size);
      }

      .nx-loader-pulse span {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--loader-color);
        border-radius: 50%;
        opacity: 0.6;
        animation: loader-pulse 2s ease-out infinite;
      }

      .nx-loader-pulse span:nth-child(2) {
        animation-delay: -1s;
      }

      @keyframes loader-pulse {
        0% {
          transform: scale(0);
          opacity: 1;
        }
        100% {
          transform: scale(1);
          opacity: 0;
        }
      }

      /* Text */
      .nx-loader-text {
        color: var(--color-text-secondary);
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .nx-loader-dots span,
        .nx-loader-bars span,
        .nx-loader-pulse span {
          animation: none;
        }
      }
    `;
  }

  // Public API
  show(): void {
    this.setAttribute('active', 'true');
  }

  hide(): void {
    this.removeAttribute('active');
  }

  toggle(): void {
    if (this.hasAttribute('active')) {
      this.hide();
    } else {
      this.show();
    }
  }

  static showFullscreen(config?: LoaderConfig): NXLoader {
    const loader = new NXLoader();
    Object.assign(loader, {
      ...config,
      fullscreen: true,
      overlay: true
    });
    
    document.body.appendChild(loader);
    return loader;
  }
}

customElements.define('nx-loader', NXLoader);
