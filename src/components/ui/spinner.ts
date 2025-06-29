export interface SpinnerConfig {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  thickness?: number;
  speed?: number;
  label?: string;
}

/**
 * Loading spinner component
 */
export class NXSpinner extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['size', 'color', 'thickness', 'speed', 'label'];
  }

  protected render(): string {
    const size = this.getProp('size', 'md');
    const color = this.getProp('color');
    const thickness = this.getProp('thickness', 3);
    const speed = this.getProp('speed', 1);
    const label = this.getProp('label', 'Loading');

    const style = color ? `--spinner-color: ${color}` : '';

    return `
      <div class="nx-spinner-container nx-spinner-${size}" 
           part="container"
           role="status"
           aria-label="${label}"
           style="${style}">
        <svg class="nx-spinner" 
             viewBox="0 0 50 50"
             style="animation-duration: ${speed}s">
          <circle class="nx-spinner-track"
                  cx="25" cy="25" r="20"
                  fill="none"
                  stroke-width="${thickness}"/>
          <circle class="nx-spinner-fill"
                  cx="25" cy="25" r="20"
                  fill="none"
                  stroke-width="${thickness}"
                  stroke-dasharray="31.415 31.415"
                  stroke-dashoffset="0"/>
        </svg>
        ${label ? `<span class="nx-spinner-label" part="label">${label}</span>` : ''}
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        --spinner-size: 2rem;
        --spinner-color: var(--color-primary);
        --spinner-track-color: var(--color-border);
        display: inline-block;
      }

      .nx-spinner-container {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }

      /* Sizes */
      .nx-spinner-sm {
        --spinner-size: 1rem;
        font-size: 0.75rem;
      }

      .nx-spinner-md {
        --spinner-size: 2rem;
        font-size: 0.875rem;
      }

      .nx-spinner-lg {
        --spinner-size: 3rem;
        font-size: 1rem;
      }

      .nx-spinner-xl {
        --spinner-size: 4rem;
        font-size: 1.125rem;
      }

      .nx-spinner {
        width: var(--spinner-size);
        height: var(--spinner-size);
        animation: spinner-rotate 2s linear infinite;
      }

      @keyframes spinner-rotate {
        100% {
          transform: rotate(360deg);
        }
      }

      .nx-spinner-track {
        stroke: var(--spinner-track-color);
      }

      .nx-spinner-fill {
        stroke: var(--spinner-color);
        stroke-linecap: round;
        animation: spinner-dash 1.5s ease-in-out infinite;
        transform-origin: center;
      }

      @keyframes spinner-dash {
        0% {
          stroke-dasharray: 1 126;
          stroke-dashoffset: 0;
        }
        50% {
          stroke-dasharray: 90 126;
          stroke-dashoffset: -35;
        }
        100% {
          stroke-dasharray: 90 126;
          stroke-dashoffset: -124;
        }
      }

      .nx-spinner-label {
        color: var(--color-text-secondary);
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .nx-spinner,
        .nx-spinner-fill {
          animation: none;
        }
      }
    `;
  }
}

customElements.define('nx-spinner', NXSpinner);
