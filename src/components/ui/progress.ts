// src/components/ui/progress.ts
import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface ProgressConfig {
  value?: number;
  max?: number;
  label?: string;
  showLabel?: boolean;
  showValue?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  striped?: boolean;
  animated?: boolean;
  indeterminate?: boolean;
}

/**
 * Progress bar component
 */
export class NXProgress extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['value', 'max', 'label', 'show-label', 'show-value', 'variant', 'size', 
            'striped', 'animated', 'indeterminate'];
  }

  protected initializeState(): void {
    this[ComponentState].set('value', 0);
    this[ComponentState].set('max', 100);
  }

  constructor(config?: ProgressConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    
    if (config) {
      this.configure(config);
    }
  }

  configure(config: ProgressConfig): void {
    Object.entries(config).forEach(([key, value]) => {
      const attrName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      this.setAttribute(attrName, String(value));
    });
  }

  protected render(): string {
    const value = this.getState('value', this.getProp('value', 0));
    const max = this.getState('max', this.getProp('max', 100));
    const label = this.getProp('label', '');
    const showLabel = this.getProp('show-label', false);
    const showValue = this.getProp('show-value', false);
    const variant = this.getProp('variant', 'default');
    const size = this.getProp('size', 'md');
    const striped = this.getProp('striped', false);
    const animated = this.getProp('animated', false);
    const indeterminate = this.getProp('indeterminate', false);
    
    const percentage = indeterminate ? 0 : Math.min(100, (value / max) * 100);
    const displayText = showValue ? `${Math.round(percentage)}%` : label;

    return `
      <div class="nx-progress nx-progress-${variant} nx-progress-${size}" 
           part="progress"
           role="progressbar"
           aria-valuenow="${value}"
           aria-valuemin="0"
           aria-valuemax="${max}"
           aria-label="${label || 'Progress'}">
        <div class="nx-progress-track" part="track">
          <div class="nx-progress-bar 
                      ${striped ? 'striped' : ''} 
                      ${animated ? 'animated' : ''}
                      ${indeterminate ? 'indeterminate' : ''}"
               part="bar"
               style="${!indeterminate ? `width: ${percentage}%` : ''}">
            ${(showLabel || showValue) && !indeterminate ? `
              <span class="nx-progress-label" part="label">
                ${displayText}
              </span>
            ` : ''}
          </div>
        </div>
        ${(showLabel || showValue) && indeterminate ? `
          <span class="nx-progress-label external" part="label">
            ${label || 'Loading...'}
          </span>
        ` : ''}
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        --progress-height: 1rem;
        --progress-bg: var(--color-background);
        --progress-color: var(--color-primary);
        --progress-radius: var(--radius-full);
        display: block;
      }

      .nx-progress {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      /* Sizes */
      .nx-progress-sm {
        --progress-height: 0.5rem;
        font-size: 0.75rem;
      }

      .nx-progress-lg {
        --progress-height: 1.5rem;
        font-size: 1rem;
      }

      /* Track */
      .nx-progress-track {
        flex: 1;
        height: var(--progress-height);
        background: var(--progress-bg);
        border-radius: var(--progress-radius);
        overflow: hidden;
        position: relative;
      }

      /* Bar */
      .nx-progress-bar {
        height: 100%;
        background: var(--progress-color);
        transition: width 0.3s ease;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* Variants */
      .nx-progress-success {
        --progress-color: var(--color-success);
      }

      .nx-progress-warning {
        --progress-color: var(--color-warning);
      }

      .nx-progress-error {
        --progress-color: var(--color-error);
      }

      .nx-progress-info {
        --progress-color: var(--color-info);
      }

      /* Striped */
      .nx-progress-bar.striped {
        background-image: linear-gradient(
          45deg,
          rgba(255, 255, 255, 0.15) 25%,
          transparent 25%,
          transparent 50%,
          rgba(255, 255, 255, 0.15) 50%,
          rgba(255, 255, 255, 0.15) 75%,
          transparent 75%,
          transparent
        );
        background-size: var(--progress-height) var(--progress-height);
      }

      /* Animated */
      .nx-progress-bar.animated {
        animation: progress-stripes 1s linear infinite;
      }

      @keyframes progress-stripes {
        from { background-position: var(--progress-height) 0; }
        to { background-position: 0 0; }
      }

      /* Indeterminate */
      .nx-progress-bar.indeterminate {
        width: 30% !important;
        animation: progress-indeterminate 1.5s ease-in-out infinite;
      }

      @keyframes progress-indeterminate {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(400%);
        }
      }

      /* Label */
      .nx-progress-label {
        color: white;
        font-size: 0.75em;
        font-weight: 500;
        padding: 0 0.5rem;
        white-space: nowrap;
      }

      .nx-progress-label.external {
        color: var(--color-text);
        flex-shrink: 0;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .nx-progress-bar {
          transition: none;
        }
        
        .nx-progress-bar.animated,
        .nx-progress-bar.indeterminate {
          animation: none;
        }
      }
    `;
  }

  // Public API
  setValue(value: number): void {
    this.setState('value', value);
    this.setAttribute('value', String(value));
  }

  getValue(): number {
    return this.getState('value', 0);
  }

  setMax(max: number): void {
    this.setState('max', max);
    this.setAttribute('max', String(max));
  }

  getPercentage(): number {
    const value = this.getState('value', 0);
    const max = this.getState('max', 100);
    return Math.min(100, (value / max) * 100);
  }

  increment(amount = 1): void {
    const current = this.getValue();
    this.setValue(current + amount);
  }

  complete(): void {
    const max = this.getState('max', 100);
    this.setValue(max);
  }

  reset(): void {
    this.setValue(0);
  }
}

customElements.define('nx-progress', NXProgress);
