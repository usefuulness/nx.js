/**
 * @file @/components/ui/chart.tsx
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';

export interface ChartSeries {
  /** Name shown in the legend and the data table */
  name: string;
  /** One number per label */
  data: number[];
}

export interface ChartConfig {
  /** `bar` (default), `line`, `area` or `donut` */
  type?: 'bar' | 'line' | 'area' | 'donut';
  /** The category names, for example months */
  labels?: string[];
  /** One or more series, each with one number per label. A donut shows the first. */
  series?: ChartSeries[];
  /** Shortcut for one series: `[{ label, value }]` (sets the labels too) */
  data?: { label: string; value: number }[];
  /** Accessible name and caption of the chart */
  label?: string;
  /** Hide the legend (shown by default with more than one series, and for a donut) */
  hideLegend?: boolean;
}

const W = 600;
const H = 300;
const PAD = { top: 16, right: 16, bottom: 32, left: 48 };
const NS = 'http://www.w3.org/2000/svg';
const COLORS = ['--color-primary', '--color-info', '--color-success', '--color-warning', '--color-error'];
const MAX_POINTS = 500;

function el(tag: string, attrs: Record<string, string | number> = {}, text?: string): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node as SVGElement;
}

/** A round upper bound and step for the value axis */
export function niceScale(min: number, max: number, count = 5): { min: number; max: number; step: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, step: 0.2 };
  min = Math.min(min, 0);
  max = Math.max(max, 0);
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step };
}

/**
 * A chart drawn as SVG: bars, lines, areas or a donut. Colours come from the theme, so it follows
 * light and dark mode, and every chart also carries its data as a real (visually hidden) table for
 * screen readers. Hovering or focusing a mark shows its value.
 *
 * ```html
 * <nx-chart type="bar" label="Sales" data='[{"label":"Jan","value":12},{"label":"Feb","value":19}]'></nx-chart>
 * ```
 *
 * With several series, give `labels` and `series`. A series is told apart by its legend and by its
 * marker shape as well as its colour.
 */
export class NXChart extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['type', 'labels', 'series', 'data', 'label', 'hide-legend'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  private json<T>(name: string): T | undefined {
    const raw = this.getProp<unknown>(name);
    if (raw == null || raw === '') return undefined;
    if (typeof raw !== 'string') return raw as T;
    try { return JSON.parse(raw) as T; } catch { return undefined; }
  }

  /** The data as labels and series, whichever way it was given. Bad input gives an empty chart, never an error. */
  private model(): { labels: string[]; series: ChartSeries[] } {
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : 0);
    const short = this.json<{ label: string; value: number }[]>('data');
    if (Array.isArray(short)) {
      const rows = short.slice(0, MAX_POINTS).filter(r => r && typeof r === 'object');
      return { labels: rows.map(r => String(r.label ?? '')), series: [{ name: this.getProp<string>('label', '') || this.t('chart.value'), data: rows.map(r => num(r.value)) }] };
    }
    const labelsIn = this.json<unknown[]>('labels');
    const seriesIn = this.json<ChartSeries[]>('series');
    if (!Array.isArray(seriesIn)) return { labels: [], series: [] };
    const series = seriesIn.filter(s => s && Array.isArray(s.data)).slice(0, 12);
    const n = Math.min(MAX_POINTS, Math.max(Array.isArray(labelsIn) ? labelsIn.length : 0, ...series.map(s => s.data.length), 0));
    const labels = Array.from({ length: n }, (_, i) => String((Array.isArray(labelsIn) ? labelsIn[i] : undefined) ?? i + 1));
    return { labels, series: series.map(s => ({ name: String(s.name ?? ''), data: Array.from({ length: n }, (_, i) => num(s.data[i])) })) };
  }

  private fmt(v: number): string {
    try { return new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 2, notation: Math.abs(v) >= 10000 ? 'compact' : 'standard' }).format(v); } catch { return String(v); }
  }

  protected render(): Node {
    const { labels, series } = this.model();
    const type = this.getProp<string>('type', 'bar');
    const label = this.getProp<string>('label', '');
    const donut = type === 'donut';
    const empty = labels.length === 0 || series.length === 0;
    const showLegend = !this.getProp('hide-legend', false) && !empty && (donut || series.length > 1);

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', 'aria-hidden': 'true', focusable: 'false' });
    if (!empty) (donut ? this.drawDonut(svg, labels, series[0]) : this.drawAxes(svg, type, labels, series));

    return (
      <figure part="chart" class="chart">
        {label && <figcaption class="caption" part="caption">{label}</figcaption>}
        {empty ? <p class="empty" part="empty">{this.t('chart.empty')}</p> : (
          <div class="figure" role="img" aria-label={label || this.t('chart.label')}>{svg}</div>
        )}
        {showLegend && (
          <ul class="legend" part="legend">
            {(donut ? labels.map((l, i) => ({ name: l, i })) : series.map((s, i) => ({ name: s.name, i }))).map(({ name, i }) => (
              <li><span class="swatch" style={{ background: `var(${COLORS[i % COLORS.length]})` }} aria-hidden="true" />{name}</li>
            ))}
          </ul>
        )}
        {!empty && (
          <table class="sr-only">
            <caption>{label || this.t('chart.label')}</caption>
            <thead><tr><th scope="col" />{(donut ? [series[0]] : series).map(s => <th scope="col">{s.name}</th>)}</tr></thead>
            <tbody>{labels.map((l, i) => <tr><th scope="row">{l}</th>{(donut ? [series[0]] : series).map(s => <td>{this.fmt(s.data[i])}</td>)}</tr>)}</tbody>
          </table>
        )}
      </figure>
    );
  }

  private drawAxes(svg: SVGElement, type: string, labels: string[], series: ChartSeries[]): void {
    const all = series.flatMap(s => s.data);
    const scale = niceScale(Math.min(...all), Math.max(...all));
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const y = (v: number) => PAD.top + ih - ((v - scale.min) / (scale.max - scale.min)) * ih;
    const n = labels.length;
    const band = iw / n;
    const x = (i: number) => PAD.left + band * i + band / 2;

    for (let v = scale.min; v <= scale.max + scale.step / 2; v += scale.step) {
      svg.append(el('line', { x1: PAD.left, x2: W - PAD.right, y1: y(v), y2: y(v), class: v === 0 ? 'zero' : 'grid' }));
      svg.append(el('text', { x: PAD.left - 8, y: y(v), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, this.fmt(Math.round(v * 1e6) / 1e6)));
    }
    // Thin out the category labels so they never overlap
    const every = Math.ceil(n / Math.max(1, Math.floor(iw / 56)));
    labels.forEach((l, i) => {
      if (i % every === 0) svg.append(el('text', { x: x(i), y: H - PAD.bottom + 18, class: 'tick', 'text-anchor': 'middle' }, l));
    });

    const bar = type === 'bar';
    const group = Math.min(band * 0.8, 56 * series.length);
    series.forEach((s, si) => {
      const color = `var(${COLORS[si % COLORS.length]})`;
      const pts = s.data.map((v, i) => [x(i), y(v)] as const);
      if (bar) {
        const w = group / series.length;
        s.data.forEach((v, i) => {
          const x0 = x(i) - group / 2 + w * si;
          const top = Math.min(y(v), y(0));
          svg.append(this.mark(el('rect', { x: x0 + 1, y: top, width: Math.max(1, w - 2), height: Math.max(1, Math.abs(y(v) - y(0))), rx: 2, fill: color, class: 'mark' }), `${labels[i]}, ${s.name}: ${this.fmt(v)}`));
        });
        return;
      }
      const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join('');
      if (type === 'area') svg.append(el('path', { d: `${d}L${pts[n - 1][0].toFixed(1)} ${y(0)}L${pts[0][0].toFixed(1)} ${y(0)}Z`, fill: color, opacity: 0.18 }));
      svg.append(el('path', { d, fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      // Marker shapes differ per series, so colour is not the only cue
      pts.forEach(([px, py], i) => {
        if (n > 60) return;
        const m = si % 3 === 0 ? el('circle', { cx: px, cy: py, r: 4 })
          : si % 3 === 1 ? el('rect', { x: px - 4, y: py - 4, width: 8, height: 8 })
          : el('path', { d: `M${px} ${py - 5}L${px + 5} ${py + 4}L${px - 5} ${py + 4}Z` });
        m.setAttribute('fill', color);
        m.setAttribute('class', 'mark point');
        svg.append(this.mark(m, `${labels[i]}, ${s.name}: ${this.fmt(s.data[i])}`));
      });
    });
  }

  private mark(node: SVGElement, text: string): SVGElement {
    node.append(el('title', {}, text));
    return node;
  }

  private drawDonut(svg: SVGElement, labels: string[], s: ChartSeries): void {
    const values = s.data.map(v => Math.max(0, v));
    const total = values.reduce((a, b) => a + b, 0);
    const cx = W / 2, cy = H / 2, R = 120, r = 74;
    if (total <= 0) return;
    let a0 = -Math.PI / 2;
    values.forEach((v, i) => {
      if (v <= 0) return;
      const sweep = Math.min(v / total, 0.9999) * Math.PI * 2;
      const a1 = a0 + sweep;
      const p = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
      const large = sweep > Math.PI ? 1 : 0;
      const d = `M${p(R, a0)}A${R} ${R} 0 ${large} 1 ${p(R, a1)}L${p(r, a1)}A${r} ${r} 0 ${large} 0 ${p(r, a0)}Z`;
      svg.append(this.mark(el('path', { d, fill: `var(${COLORS[i % COLORS.length]})`, class: 'mark slice', stroke: 'var(--color-background)', 'stroke-width': 2 }), `${labels[i]}: ${this.fmt(s.data[i])} (${Math.round((v / total) * 100)}%)`));
      a0 = a1;
    });
    svg.append(el('text', { x: cx, y: cy, class: 'total', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, this.fmt(total)));
  }

  protected styles(): string {
    return `
      :host { display: block; }
      .chart { margin: 0; }
      .caption { margin-bottom: 0.5rem; font-weight: 600; font-size: 0.9375rem; color: var(--color-text); }
      .figure { width: 100%; }
      .plot { display: block; width: 100%; height: auto; overflow: visible; }
      .grid { stroke: var(--color-border); stroke-width: 1; stroke-dasharray: 3 4; }
      .zero { stroke: var(--color-text-secondary); stroke-width: 1; }
      .tick { fill: var(--color-text-secondary); font-size: 14px; font-variant-numeric: tabular-nums; }
      .total { fill: var(--color-text); font-size: 28px; font-weight: 600; }
      .mark { transition: opacity var(--transition-duration); }
      .mark:hover { opacity: 0.75; }
      .legend { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin: 0.5rem 0 0; padding: 0; list-style: none; font-size: 0.8125rem; color: var(--color-text-secondary); }
      .legend li { display: inline-flex; align-items: center; gap: 0.375rem; }
      .swatch { width: 0.75rem; height: 0.75rem; border-radius: 2px; }
      .empty { margin: 0; padding: 2rem 0; text-align: center; color: var(--color-text-secondary); }
      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    `;
  }
}

define('nx-chart', NXChart);
