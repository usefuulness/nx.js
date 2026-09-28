/**
 * @file @/components/ui/spinner.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { variants } from '@/core/variants';

export interface SpinnerConfig {
  /** Spinner size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Any CSS color; defaults to the primary color */
  color?: string;
  /** Stroke width (viewBox units, default 4) */
  thickness?: number;
  /** Seconds per rotation (default 0.8) */
  speed?: number;
  /** Accessible name (default "Loading") */
  label?: string;
  /** Visible caption under the spinner */
  text?: string;
}

const spinner = variants({
  base: 'spinner',
  variants: { size: { sm: 'sm', md: 'md', lg: 'lg', xl: 'xl' } },
  defaultVariants: { size: 'md' }
});

/**
 * Loading spinner.
 *
 * ```tsx
 * <Spinner />
 * <Spinner size="lg" text="Loading orders…" />
 * ```
 */
export class NXSpinner extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['size', 'color', 'thickness', 'speed', 'label', 'text'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  protected render(): Node {
    const color = this.getProp<string>('color');
    const thickness = this.getProp('thickness', 4);
    const text = this.getProp<string>('text');

    return (
      <div part="container" class={spinner({ size: this.getProp('size') })} role="status"
           aria-label={this.getProp('label', 'Loading')} style={color ? { '--spinner-color': color } : undefined}>
        <svg class="ring" viewBox="0 0 50 50" style={{ animationDuration: `${this.getProp('speed', 0.8)}s` }}>
          <circle class="track" cx="25" cy="25" r="20" fill="none" stroke-width={thickness} />
          <circle class="arc" cx="25" cy="25" r="20" fill="none" stroke-width={thickness} />
        </svg>
        {text && <span class="text" part="text">{text}</span>}
      </div>
    );
  }

  protected styles(): string {
    return `
      :host {
        display: inline-flex;
        vertical-align: middle;
      }

      .spinner {
        --spinner-size: 1.5rem;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        color: var(--spinner-color, var(--color-primary));
      }

      .sm { --spinner-size: 1rem; font-size: 0.75rem; }
      .md { --spinner-size: 1.5rem; font-size: 0.8125rem; }
      .lg { --spinner-size: 2.5rem; font-size: 0.875rem; }
      .xl { --spinner-size: 3.5rem; font-size: 1rem; }

      .ring {
        width: var(--spinner-size);
        height: var(--spinner-size);
        animation: spin linear infinite;
      }

      .track { stroke: var(--color-muted); }

      .arc {
        stroke: currentColor;
        stroke-linecap: round;
        stroke-dasharray: 90 126;
        animation: dash 1.4s ease-in-out infinite;
      }

      .text { color: var(--color-text-secondary); }

      @keyframes spin { to { transform: rotate(360deg); } }

      @keyframes dash {
        0% { stroke-dasharray: 1 126; stroke-dashoffset: 0; }
        50% { stroke-dasharray: 90 126; stroke-dashoffset: -35; }
        100% { stroke-dasharray: 90 126; stroke-dashoffset: -124; }
      }
    `;
  }
}

define('nx-spinner', NXSpinner);
