/**
 * @file @/layout/container.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * Layout primitives: container (hbox / vbox / grid / fit), spacer, separator, divider.
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';

const px = (value: unknown): string =>
  typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value)) ? `${value}px` : String(value);

/**
 * Flex/grid layout box. Children are regular light-DOM elements.
 *
 * @example
 * ```typescript
 * { xtype: 'container', layout: 'hbox', gap: 12, align: 'center', items: [...] }
 * { xtype: 'container', layout: 'grid', columns: 3, gap: 16, items: [...] }
 * { xtype: 'container', layout: 'grid', minColumnWidth: 220, items: [...] } // responsive
 * ```
 *
 * ```html
 * <nx-container layout="hbox" gap="8" align="center">...</nx-container>
 * ```
 *
 * Layouts: `vbox`, `hbox`, `grid`, `fit`, plus the ones page designs keep needing:
 * `stack` (a column with a gap), `cluster` (a wrapping row), `sidebar` (a fixed-width side next to
 * content that drops underneath when it gets narrow), `switcher` (a row that becomes a column below a width),
 * `center` (a centered column with a maximum width), `masonry` (columns of different heights),
 * `table` (a grid whose children take `span="2"`), and `card` (one child at a time, like a wizard).
 *
 * Events: `activechange` (card layout).
 */
export class NXContainer extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['layout', 'gap', 'padding', 'align', 'pack', 'wrap', 'columns', 'min-column-width', 'scrollable', 'side', 'side-width', 'content-min', 'threshold', 'max-width', 'active'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  protected applyConfig(key: string, value: any): void {
    // An `align` attribute is a legacy presentational hint in browsers (text-align),
    // so keep it as a prop when configured from JS
    if (key === 'align') {
      this.setProp('align', value);
      return;
    }
    super.applyConfig(key, value);
  }

  /** Card layout: show a child, by position or by its `id` / `name`. */
  setActive(which: number | string): void {
    const kids = Array.from(this.children);
    const index = typeof which === 'number' ? which : /^\d+$/.test(which) ? Number(which) : kids.findIndex(k => k.id === which || k.getAttribute('name') === which);
    if (index < 0 || index >= kids.length) return;
    const changed = this.getAttribute('active') !== String(index);
    this.setAttribute('active', String(index));
    if (changed) this.emit('activechange', { index, id: kids[index].id || kids[index].getAttribute('name') || undefined, item: kids[index] });
  }

  /** Card layout: the position shown, from 0. */
  getActive(): number {
    const n = Number(this.getAttribute('active'));
    return Number.isInteger(n) && n >= 0 ? n : 0;
  }

  next(): void { this.setActive(Math.min(this.getActive() + 1, this.children.length - 1)); }
  previous(): void { this.setActive(Math.max(this.getActive() - 1, 0)); }

  protected afterConnect(): void {
    // A card shown by name: turn it into a position so the style can pick it
    const active = this.getAttribute('active');
    if (active !== null && !/^\d+$/.test(active)) this.setActive(active);
  }

  protected render(): Node {
    // Layout lives on an inner box: page-level resets (e.g. Tailwind's preflight)
    // override :host padding/margin, but can't reach inside the shadow root.
    return <div class="box" part="box"><slot /></div>;
  }

  protected styles(): string {
    const layout = this.getProp<string>('layout', 'vbox');
    const gap = this.getProp('gap');
    const padding = this.getProp('padding');
    const align = this.getProp<string>('align');
    const pack = this.getProp<string>('pack');
    const wrap = this.getProp('wrap', false);
    const columns = this.getProp('columns');
    const minColumnWidth = this.getProp('min-column-width', 240);
    const scrollable = this.getProp('scrollable', false);

    const flexAlign: Record<string, string> = {
      start: 'flex-start', end: 'flex-end', center: 'center', stretch: 'stretch', baseline: 'baseline',
      between: 'space-between', around: 'space-around', evenly: 'space-evenly'
    };

    const rules: string[] = ['min-width: 0', 'min-height: 0', 'height: 100%'];
    let extra = '';
    const g = gap !== undefined ? px(gap) : '1rem';
    const sideWidth = px(this.getProp('side-width', '16rem'));
    const contentMin = this.getProp('content-min', '50%');
    const threshold = px(this.getProp('threshold', '30rem'));

    if (layout === 'grid' || layout === 'table') {
      rules.push('display: grid');
      rules.push(columns
        ? `grid-template-columns: repeat(${columns}, minmax(0, 1fr))`
        : `grid-template-columns: repeat(auto-fill, minmax(min(${px(minColumnWidth)}, 100%), 1fr))`);
      // A child can take several columns (or rows): <nx-card span="2">
      for (let n = 2; n <= 12; n++) extra += `::slotted([span="${n}"]) { grid-column: span ${n}; } ::slotted([row-span="${n}"]) { grid-row: span ${n}; }`;
      extra += '::slotted([span="full"]) { grid-column: 1 / -1; }';
    } else if (layout === 'fit') {
      rules.push('display: flex', 'flex-direction: column');
    } else if (layout === 'stack') {
      rules.push('display: flex', 'flex-direction: column', `gap: ${g}`);
    } else if (layout === 'cluster') {
      rules.push('display: flex', 'flex-wrap: wrap', 'align-items: center', `gap: ${g}`);
    } else if (layout === 'sidebar') {
      // The side keeps its width while there is room; when the content would get narrower than `content-min` the two stack
      const end = this.getProp<string>('side', 'start') === 'end';
      rules.push('display: flex', 'flex-wrap: wrap', `gap: ${g}`, 'align-items: flex-start');
      extra += `::slotted(${end ? ':last-child' : ':first-child'}) { flex-basis: ${sideWidth}; flex-grow: 1; }`;
      extra += `::slotted(${end ? ':not(:last-child)' : ':not(:first-child)'}) { flex-basis: 0; flex-grow: 999; min-inline-size: ${px(contentMin)}; }`;
    } else if (layout === 'switcher') {
      // A row while every child can be at least `threshold` wide, a column below that
      rules.push('display: flex', 'flex-wrap: wrap', `gap: ${g}`);
      extra += `::slotted(*) { flex-grow: 1; flex-basis: calc((${threshold} - 100%) * 999); }`;
    } else if (layout === 'center') {
      rules.push('display: flex', 'flex-direction: column', `max-width: ${px(this.getProp('max-width', '60rem'))}`, 'margin-inline: auto', 'height: auto', `gap: ${g}`);
    } else if (layout === 'masonry') {
      rules.push(`column-width: ${px(minColumnWidth)}`, `column-gap: ${g}`, 'height: auto');
      extra += `::slotted(*) { break-inside: avoid; margin-bottom: ${g}; display: block; }`;
    } else if (layout === 'card') {
      // One child at a time, picked by position (the `active` attribute), so server HTML shows the right one before any script runs
      const n = this.getActive();
      rules.push('display: flex', 'flex-direction: column');
      extra += `::slotted(:not(:nth-child(${n + 1}))) { display: none !important; } ::slotted(:nth-child(${n + 1})) { flex: 1; min-height: 0; }`;
    } else {
      rules.push('display: flex', `flex-direction: ${layout === 'hbox' ? 'row' : 'column'}`);
      if (wrap) rules.push('flex-wrap: wrap');
    }

    if (gap !== undefined && !['stack', 'cluster', 'sidebar', 'switcher', 'center', 'masonry'].includes(layout)) rules.push(`gap: ${px(gap)}`);
    if (padding !== undefined) rules.push(`padding: ${px(padding)}`);
    if (align) rules.push(`align-items: ${flexAlign[align] ?? align}`);
    if (pack) rules.push(`justify-content: ${flexAlign[pack] ?? pack}`);
    if (scrollable) rules.push('overflow: auto');

    return `
      :host { display: block; min-width: 0; min-height: 0; }
      :host([align]) { text-align: inherit; }
      .box { ${rules.join('; ')}; }
      ${layout === 'fit' ? '::slotted(*) { flex: 1; min-height: 0; }' : ''}
      ${extra}
      ${layout === 'vbox' && !align ? '::slotted(nx-button:not([full-width])) { align-self: flex-start; }' : ''}
    `;
  }
}

/**
 * Flexible space. In a toolbar or hbox, pushes following items to the end.
 * Shorthand in items arrays: `'->'`.
 */
export class NXSpacer extends HTMLElement {
  connectedCallback(): void {
    this.style.flex = this.style.flex || '1';
    this.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Vertical separator for toolbars / hboxes. Shorthand in items arrays: `'-'`.
 */
export class NXSeparator extends HTMLElement {
  connectedCallback(): void {
    this.setAttribute('role', 'separator');
    this.setAttribute('aria-orientation', 'vertical');
    Object.assign(this.style, {
      display: 'block',
      alignSelf: 'stretch',
      width: '1px',
      minHeight: '1rem',
      margin: '0.25rem 0.25rem',
      background: 'var(--color-border)',
      flexShrink: '0'
    });
  }
}

/**
 * Horizontal rule, optionally with a label.
 *
 * @attr label - Text in the middle of the rule
 */
export class NXDivider extends HTMLElement {
  connectedCallback(): void {
    this.setAttribute('role', 'separator');
    const label = this.getAttribute('label') ?? this.getAttribute('text');
    Object.assign(this.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      margin: '0.5rem 0',
      color: 'var(--color-text-secondary)',
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    });
    // Server-rendered (or already built): keep the existing nodes
    const current = this.children;
    if (label ? current.length === 3 && current[1].textContent === label : current.length === 1 && !current[0].textContent) return;
    const line = () => {
      const span = document.createElement('span');
      span.setAttribute('style', 'flex:1;height:1px;background:var(--color-border)');
      return span;
    };
    const text = document.createElement('span');
    text.textContent = label; // never HTML: labels may come from user data
    this.replaceChildren(...(label ? [line(), text, line()] : [line()]));
  }
}

define('nx-container', NXContainer);
define('nx-spacer', NXSpacer);
define('nx-separator', NXSeparator);
define('nx-divider', NXDivider);
