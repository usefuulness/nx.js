export interface SkeletonConfig {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
  count?: number;
}

/**
 * Skeleton loader component
 */
export class NXSkeleton extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['variant', 'width', 'height', 'animation', 'count'];
  }

  constructor(config?: SkeletonConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    
    if (config) {
      this.configure(config);
    }
  }

  configure(config: SkeletonConfig): void {
    Object.entries(config).forEach(([key, value]) => {
      const attrName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      this.setAttribute(attrName, String(value));
    });
  }

  protected render(): string {
    const variant = this.getProp('variant', 'text');
    const width = this.getProp('width');
    const height = this.getProp('height');
    const animation = this.getProp('animation', 'pulse');
    const count = parseInt(this.getProp('count', '1'));

    const style = this.buildStyle(variant, width, height);

    return `
      <div class="nx-skeleton-container" part="container">
        ${Array(count).fill(0).map((_, index) => `
          <div class="nx-skeleton nx-skeleton-${variant} nx-skeleton-${animation}"
               part="skeleton"
               style="${style}"
               aria-hidden="true">
            ${animation === 'wave' ? '<div class="nx-skeleton-wave"></div>' : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  private buildStyle(variant: string, width?: string | number, height?: string | number): string {
    const styles: string[] = [];
    
    if (width) {
      const widthValue = typeof width === 'number' ? `${width}px` : width;
      styles.push(`width: ${widthValue}`);
    }
    
    if (height) {
      const heightValue = typeof height === 'number' ? `${height}px` : height;
      styles.push(`height: ${heightValue}`);
    }
    
    // Default dimensions for variants
    if (!width && variant === 'circular') {
      styles.push('width: 40px');
    }
    
    if (!height) {
      switch (variant) {
        case 'text':
          styles.push('height: 1em');
          break;
        case 'circular':
          styles.push('height: 40px');
          break;
        case 'rectangular':
        case 'rounded':
          styles.push('height: 120px');
          break;
      }
    }
    
    return styles.join('; ');
  }

  protected styles(): string {
    return `
      :host {
        --skeleton-bg: rgba(0, 0, 0, 0.11);
        --skeleton-highlight: rgba(255, 255, 255, 0.05);
        display: block;
      }

      [data-theme="dark"] {
        --skeleton-bg: rgba(255, 255, 255, 0.13);
        --skeleton-highlight: rgba(255, 255, 255, 0.05);
      }

      .nx-skeleton-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .nx-skeleton {
        background: var(--skeleton-bg);
        position: relative;
        overflow: hidden;
      }

      /* Variants */
      .nx-skeleton-text {
        border-radius: var(--radius-sm);
        width: 100%;
      }

      .nx-skeleton-circular {
        border-radius: 50%;
      }

      .nx-skeleton-rectangular {
        width: 100%;
      }

      .nx-skeleton-rounded {
        border-radius: var(--radius-md);
        width: 100%;
      }

      /* Animations */
      .nx-skeleton-pulse {
        animation: skeleton-pulse 1.5s ease-in-out infinite;
      }

      @keyframes skeleton-pulse {
        0% {
          opacity: 1;
        }
        50% {
          opacity: 0.4;
        }
        100% {
          opacity: 1;
        }
      }

      .nx-skeleton-wave {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
          90deg,
          transparent,
          var(--skeleton-highlight),
          transparent
        );
        transform: translateX(-100%);
        animation: skeleton-wave 1.5s ease-in-out infinite;
      }

      @keyframes skeleton-wave {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }

      .nx-skeleton-none {
        animation: none;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .nx-skeleton-pulse,
        .nx-skeleton-wave {
          animation: none;
        }
      }
    `;
  }
}

customElements.define('nx-skeleton', NXSkeleton);
