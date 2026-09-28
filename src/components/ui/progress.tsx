/**
 * @file @/components/ui/progress.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { variants } from '@/core/variants';

export interface ProgressConfig {
  /** Current value */
  value?: number;
  /** Value at 100% (default 100) */
  max?: number;
  /** Text above the bar (also the accessible name) */
  label?: string;
  /** Show the percentage above the bar */
  showValue?: boolean;
  /** @deprecated use `label` — kept for compatibility */
  showLabel?: boolean;
  /** Color by meaning */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  /** Bar thickness */
  size?: 'sm' | 'md' | 'lg';
  /** Striped bar */
  striped?: boolean;
  /** Animate the stripes */
  animated?: boolean;
  /** Unknown duration */
  indeterminate?: boolean;
}

const bar = variants({
  base: 'progress',
  variants: {
    variant: { default: '', success: 'success', warning: 'warning', error: 'error', info: 'info' },
    size: { sm: 'sm', md: 'md', lg: 'lg' }
  },
  defaultVariants: { variant: 'default', size: 'md' }
});

/**
 * Progress bar.
 *
 * ```tsx
 * <Progress value={66} />
 * <Progress value={3} max={5} label="Uploading" showValue variant="success" />
 * <Progress indeterminate />
 * ```
 */
export class NXProgress extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['value', 'max', 'label', 'show-label', 'show-value', 'variant', 'size', 'striped', 'animated', 'indeterminate'];
  }

  constructor(config?: ProgressConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    if (config) this.configure(config);
  }

  protected initializeState(): void {}

  protected render(): Node {
    const value = this.getValue();
    const max = this.getMax();
    const label = this.getProp<string>('label', '');
    const showValue = this.getProp('show-value', false);
    const indeterminate = this.getProp('indeterminate', false);
    const percentage = this.getPercentage();

    return (
      <div part="progress" class={bar({ variant: this.getProp('variant'), size: this.getProp('size') })}>
        {(label || (showValue && !indeterminate)) && (
          <div class="meta" part="label">
            <span>{label}</span>
            {showValue && !indeterminate && <span class="value">{Math.round(percentage)}%</span>}
          </div>
        )}
        <div class="track" part="track" role="progressbar" aria-label={label || 'Progress'}
             aria-valuemin="0" aria-valuemax={max} aria-valuenow={indeterminate ? undefined : value}>
          <div part="bar" class={['bar', { striped: this.getProp('striped', false), animated: this.getProp('animated', false), indeterminate }]}
               style={indeterminate ? undefined : { width: `${percentage}%` }} />
        </div>
      </div>
    );
  }

  protected styles(): string {
    return `
      :host { display: block; }

      .progress {
        --progress-height: 0.5rem;
        --progress-color: var(--color-primary);
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }

      .sm { --progress-height: 0.375rem; }
      .lg { --progress-height: 0.75rem; }

      .success { --progress-color: var(--color-success); }
      .warning { --progress-color: var(--color-warning); }
      .error { --progress-color: var(--color-error); }
      .info { --progress-color: var(--color-info); }

      .meta {
        display: flex;
        justify-content: space-between;
        font-size: 0.8125rem;
      }

      .value { color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }

      .track {
        position: relative;
        height: var(--progress-height);
        overflow: hidden;
        border-radius: 9999px;
        background: var(--color-muted);
      }

      .bar {
        height: 100%;
        border-radius: inherit;
        background: var(--progress-color);
        transition: width 0.4s var(--transition-easing);
      }

      .striped {
        background-image: linear-gradient(45deg,
          color-mix(in srgb, var(--color-background) 25%, transparent) 25%, transparent 25%, transparent 50%,
          color-mix(in srgb, var(--color-background) 25%, transparent) 50%, color-mix(in srgb, var(--color-background) 25%, transparent) 75%,
          transparent 75%, transparent);
        background-size: 1rem 1rem;
      }

      .animated { animation: stripes 1s linear infinite; }
      @keyframes stripes { from { background-position: 1rem 0; } to { background-position: 0 0; } }

      .indeterminate {
        width: 40%;
        animation: indeterminate 1.4s var(--transition-easing) infinite;
      }

      @keyframes indeterminate {
        from { transform: translateX(-100%); }
        to { transform: translateX(250%); }
      }
    `;
  }

  setValue(value: number): void {
    this.setAttribute('value', String(value));
  }

  getValue(): number {
    return Number(this.getProp('value', 0)) || 0;
  }

  setMax(max: number): void {
    this.setAttribute('max', String(max));
  }

  getMax(): number {
    return Number(this.getProp('max', 100)) || 100;
  }

  getPercentage(): number {
    return Math.max(0, Math.min(100, (this.getValue() / this.getMax()) * 100));
  }

  increment(amount = 1): void {
    this.setValue(this.getValue() + amount);
  }

  complete(): void {
    this.setValue(this.getMax());
  }

  reset(): void {
    this.setValue(0);
  }
}

define('nx-progress', NXProgress);
