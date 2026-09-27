/**
 * @file @/components/ui/skeleton.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { variants } from '@/core/variants';

export interface SkeletonConfig {
  variant?: 'text' | 'circular' | 'circle' | 'rectangular';
  /** CSS length or px number */
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
  /** Repeat the placeholder (e.g. lines of text) */
  count?: number;
}

const skeleton = variants({
  base: 'skeleton',
  variants: {
    variant: { text: 'text', circular: 'circle', circle: 'circle', rectangular: 'rect' },
    animation: { pulse: 'pulse', wave: 'wave', none: '' }
  },
  defaultVariants: { variant: 'text', animation: 'pulse' }
});

const cssSize = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : typeof v === 'number' ? `${v}px` : String(v));

/**
 * Loading placeholder.
 *
 * ```tsx
 * <Skeleton count={3} />                              // three lines of text
 * <Skeleton variant="circle" width={40} height={40} />
 * <Skeleton variant="rectangular" height={120} animation="wave" />
 * ```
 */
export class NXSkeleton extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['variant', 'width', 'height', 'animation', 'count'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  protected render(): Node {
    const count = Math.max(1, Number(this.getProp('count', 1)) || 1);
    const cls = skeleton({ variant: this.getProp('variant'), animation: this.getProp('animation') });
    // Only size explicitly; otherwise the variant's CSS decides
    const style = { width: cssSize(this.getProp('width')), height: cssSize(this.getProp('height')) };

    return (
      <div class="stack" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          // The last line of a paragraph is shorter, like real text
          <div part="skeleton" class={cls} style={{ ...style, width: style.width ?? (count > 1 && i === count - 1 ? '60%' : undefined) }} />
        ))}
      </div>
    );
  }

  protected styles(): string {
    return `
      :host { display: block; }

      .stack {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .skeleton {
        position: relative;
        overflow: hidden;
        background: var(--color-muted);
      }

      .text { height: 0.875rem; border-radius: var(--radius-sm); }
      .circle { width: 2.5rem; height: 2.5rem; border-radius: 9999px; }
      .rect { height: 5rem; border-radius: var(--radius-md); }

      .pulse { animation: skeleton-pulse 1.8s ease-in-out infinite; }

      .wave::after {
        content: '';
        position: absolute;
        inset: 0;
        transform: translateX(-100%);
        background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-surface) 60%, transparent), transparent);
        animation: skeleton-wave 1.5s linear infinite;
      }

      @keyframes skeleton-pulse {
        50% { opacity: 0.5; }
      }

      @keyframes skeleton-wave {
        to { transform: translateX(100%); }
      }
    `;
  }
}

define('nx-skeleton', NXSkeleton);
