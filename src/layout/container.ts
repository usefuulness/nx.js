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
 */
export class NXContainer extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['layout', 'gap', 'padding', 'align', 'pack', 'wrap', 'columns', 'min-column-width', 'scrollable'];
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

  protected render(): string {
    // Layout lives on an inner box: page-level resets (e.g. Tailwind's preflight)
    // override :host padding/margin, but can't reach inside the shadow root.
    return '<div class="box" part="box"><slot></slot></div>';
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

    if (layout === 'grid') {
      rules.push('display: grid');
      rules.push(columns
        ? `grid-template-columns: repeat(${columns}, minmax(0, 1fr))`
        : `grid-template-columns: repeat(auto-fill, minmax(min(${px(minColumnWidth)}, 100%), 1fr))`);
    } else if (layout === 'fit') {
      rules.push('display: flex', 'flex-direction: column');
    } else {
      rules.push('display: flex', `flex-direction: ${layout === 'hbox' ? 'row' : 'column'}`);
      if (wrap) rules.push('flex-wrap: wrap');
    }

    if (gap !== undefined) rules.push(`gap: ${px(gap)}`);
    if (padding !== undefined) rules.push(`padding: ${px(padding)}`);
    if (align) rules.push(`align-items: ${flexAlign[align] ?? align}`);
    if (pack) rules.push(`justify-content: ${flexAlign[pack] ?? pack}`);
    if (scrollable) rules.push('overflow: auto');

    return `
      :host { display: block; min-width: 0; min-height: 0; }
      :host([align]) { text-align: inherit; }
      .box { ${rules.join('; ')}; }
      ${layout === 'fit' ? '::slotted(*) { flex: 1; min-height: 0; }' : ''}
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
    const line = '<span style="flex:1;height:1px;background:var(--color-border)"></span>';
    this.innerHTML = label ? `${line}<span>${label}</span>${line}` : line;
  }
}

define('nx-container', NXContainer);
define('nx-spacer', NXSpacer);
define('nx-separator', NXSeparator);
define('nx-divider', NXDivider);
