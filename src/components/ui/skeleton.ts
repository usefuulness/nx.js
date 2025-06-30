import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface SkeletonConfig {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string;
  height?: string;
  animation?: 'pulse' | 'wave' | 'none';
  count?: number;
}

export class NXSkeleton extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['variant', 'width', 'height', 'animation', 'count'];
  }

  protected initializeState(): void {
    // No state needed
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected render(): string {
    const variant = this.getProp('variant', 'text');
    const width = this.getProp('width', '100%');
    const height = this.getProp('height', 'auto');
    const animation = this.getProp('animation', 'pulse');
    const count = this.getProp('count', 1);

    const skeletons = Array.from({ length: count }, (_, index) => `
      <div class="nx-skeleton nx-skeleton-${variant} nx-skeleton-${animation}" 
           part="skeleton"
           style="width: ${width}; height: ${height};">
      </div>
    `).join('');

    return skeletons;
  }

  protected styles(): string {
    return `
      :host {
        display: block;
      }

      .nx-skeleton {
        background: var(--skeleton-base, #e0e0e0);
        position: relative;
        overflow: hidden;
        margin-bottom: 0.5rem;
      }

      .nx-skeleton:last-child {
        margin-bottom: 0;
      }

      .nx-skeleton-text {
        height: 1em;
        border-radius: 0.25rem;
      }

      .nx-skeleton-circular {
        border-radius: 50%;
        width: 3rem;
        height: 3rem;
      }

      .nx-skeleton-rectangular {
        border-radius: 0.25rem;
        height: 5rem;
      }

      .nx-skeleton-pulse {
        animation: skeleton-pulse 1.5s ease-in-out infinite;
      }

      .nx-skeleton-wave::after {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        transform: translateX(-100%);
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.5),
          transparent
        );
        animation: skeleton-wave 1.5s linear infinite;
      }

      @keyframes skeleton-pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      @keyframes skeleton-wave {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }
    `;
  }
}

customElements.define('nx-skeleton', NXSkeleton);
