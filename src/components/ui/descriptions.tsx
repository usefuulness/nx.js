import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';

export interface DescriptionItem {
  label: string;
  /** Text (shown as text, never as HTML) */
  value?: string | number | boolean | null;
  /** Take this many columns */
  span?: number;
}

export interface DescriptionsConfig {
  /** The facts to show */
  data?: DescriptionItem[];
  /** How many columns (default: as many as fit) */
  columns?: number;
  /** Label above the value, or beside it (default `vertical`) */
  layout?: 'vertical' | 'horizontal';
  /** Shown for a missing value (default `—`) */
  emptyText?: string;
}

/**
 * Label and value pairs for a record's details, as a real description list (`<dl>`).
 *
 * ```tsx
 * <Descriptions columns={2} data={[{ label: 'Customer', value: 'Acme Corp' }, { label: 'Total', value: '$2,400' }]} />
 * ```
 */
export class NXDescriptions extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['data', 'columns', 'layout', 'empty-text'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  protected render(): Node {
    const items = this.getProp<DescriptionItem[]>('data', []) ?? [];
    const empty = this.getProp<string>('empty-text', '—');
    return (
      <dl class={['list', this.getProp<string>('layout', 'vertical')]} part="list">
        {items.map(item => (
          <div class="item" part="item" style={item.span && item.span > 1 ? { gridColumn: `span ${item.span}` } : undefined}>
            <dt part="label">{item.label}</dt>
            <dd part="value">{item.value === undefined || item.value === null || item.value === '' ? empty : String(item.value)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  protected styles(): string {
    const columns = Number(this.getProp('columns', 0));
    return `
      :host { display: block; }
      .list { display: grid; gap: 1rem 1.5rem; margin: 0;
        grid-template-columns: ${columns > 0 ? `repeat(${columns}, minmax(0, 1fr))` : 'repeat(auto-fill, minmax(min(14rem, 100%), 1fr))'}; }
      .item { min-width: 0; }
      dt { font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.125rem; }
      dd { margin: 0; font-size: 0.875rem; overflow-wrap: anywhere; }
      .horizontal .item { display: flex; gap: 0.75rem; align-items: baseline; }
      .horizontal dt { margin: 0; flex: 0 0 9rem; }
    `;
  }
}

define('nx-descriptions', NXDescriptions);
