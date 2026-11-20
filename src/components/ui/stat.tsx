import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';

export interface StatConfig {
  /** What is measured */
  label?: string;
  /** The figure, as you want it shown (`$48,200`, `1.2M`, `99.9%`) */
  value?: string | number;
  /** Change against the last period, as a percentage (`12.5` is +12.5%) */
  delta?: number;
  /** What the change is measured against ("vs last month") */
  deltaLabel?: string;
  /** A rise is bad news (churn, errors, cost): it shows in the warning colour instead */
  invert?: boolean;
  /** Icon in the corner */
  icon?: string;
  /** Recent values for a small trend line (decorative: the figures are in `value` and `delta`) */
  trend?: number[];
  /** Show a placeholder while the figure loads */
  loading?: boolean;
}

/**
 * A key figure: label, value, change against the last period (written out for screen readers, never only
 * colour or an arrow), an optional icon and a small trend line.
 *
 * ```tsx
 * <Stat label="Revenue" value="$48,200" delta={12.5} deltaLabel="vs last month" trend={[3, 5, 4, 7, 9]} />
 * ```
 */
export class NXStat extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['label', 'value', 'delta', 'delta-label', 'invert', 'icon', 'trend', 'loading'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  private sparkline(values: number[]): Node | null {
    const v = values.filter(n => Number.isFinite(n));
    if (v.length < 2) return null;
    const min = Math.min(...v);
    const span = Math.max(...v) - min || 1;
    const points = v.map((n, i) => `${((i / (v.length - 1)) * 100).toFixed(1)},${(22 - ((n - min) / span) * 20).toFixed(1)}`).join(' ');
    return (
      <svg class="trend" part="trend" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <polyline points={points} fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
      </svg>
    ) as Node;
  }

  protected render(): Node {
    const delta = this.getProp<number | undefined>('delta');
    const hasDelta = delta !== undefined && delta !== null && !Number.isNaN(Number(delta));
    const d = Number(delta);
    const dir = !hasDelta || d === 0 ? 'flat' : d > 0 ? 'up' : 'down';
    const good = dir === 'flat' ? 'neutral' : (dir === 'up') !== this.getProp('invert', false) ? 'good' : 'bad';
    const icon = this.getProp<string>('icon');
    const trend = this.getProp<number[]>('trend');
    const label = this.getProp<string>('label', '');
    const deltaLabel = this.getProp<string>('delta-label', '');
    const sign = d > 0 ? '+' : d < 0 ? '−' : '';
    let pct = '';
    if (hasDelta) {
      try { pct = new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 1 }).format(Math.abs(d)); } catch { pct = String(Math.abs(d)); }
    }
    const loading = this.getProp('loading', false);

    return (
      <div class="stat" part="stat" aria-busy={loading ? 'true' : undefined}>
        <div class="head">
          <span class="label" part="label">{label}</span>
          {icon && <span class="icon" part="icon" aria-hidden="true" html={Icons.get(icon) || undefined}>{Icons.get(icon) ? undefined : icon}</span>}
        </div>
        {loading
          ? <div class="skeleton" aria-hidden="true" />
          : <div class="value" part="value">{String(this.getProp('value', ''))}</div>}
        {hasDelta && !loading && (
          <div class={['delta', good]} part="delta">
            <span class="arrow" aria-hidden="true" html={dir === 'flat' ? '' : Icons.get(dir === 'up' ? 'arrow-up' : 'arrow-down')} />
            <span>{sign}{pct}%</span>
            <span class="sr-only">{this.t(`stat.${dir}`)}</span>
            {deltaLabel && <span class="vs">{deltaLabel}</span>}
          </div>
        )}
        {!loading && Array.isArray(trend) && this.sparkline(trend)}
      </div>
    );
  }

  protected styles(): string {
    return `
      :host { display: block; }
      .stat { display: flex; flex-direction: column; gap: 0.375rem; min-width: 0; }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
      .label { font-size: 0.8125rem; color: var(--color-text-secondary); }
      .icon { display: inline-flex; font-size: 1.125rem; color: var(--color-text-secondary); }
      .value { font-size: 1.75rem; font-weight: 600; line-height: 1.15; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
      .skeleton { height: 1.75rem; width: 60%; border-radius: var(--radius-sm); background: var(--color-accent); animation: pulse 1.4s ease-in-out infinite; }
      .delta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem; font-size: 0.8125rem; font-weight: 500; }
      .delta.good { color: var(--color-success-text); }
      .delta.bad { color: var(--color-error-text); }
      .delta.neutral { color: var(--color-text-secondary); }
      .arrow { display: inline-flex; font-size: 0.875rem; }
      .vs { font-weight: 400; color: var(--color-text-secondary); }
      .trend { width: 100%; height: 1.5rem; color: var(--color-primary); margin-top: 0.25rem; }
      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      @keyframes pulse { 50% { opacity: 0.5; } }
      @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
    `;
  }
}

define('nx-stat', NXStat);
