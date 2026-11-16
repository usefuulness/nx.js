/**
 * @file @/components/ui/pagination.tsx
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { MIRROR_CSS } from '@/core/dom-utils';

export interface PaginationConfig {
  /** Total number of items */
  total?: number;
  /** Items per page (default 10) */
  pageSize?: number;
  /** Current page, starting at 1; kept in the attribute, so server HTML carries it */
  page?: number;
  /** Page buttons shown each side of the current page (default 1) */
  siblings?: number;
  /** Page buttons always shown at each end (default 1) */
  boundary?: number;
  /** Page sizes to offer in a selector, comma separated in HTML (`"10,25,50"`) */
  sizes?: Array<number | string> | string;
  /** Show "1–10 of 250" */
  showTotal?: boolean;
  /** Only previous, "Page 3 of 25" and next: for narrow spaces */
  compact?: boolean;
  /** Accessible name of the navigation (default "Pagination") */
  label?: string;
  disabled?: boolean;
}

type Item = number | 'gap-start' | 'gap-end';

const range = (from: number, to: number): number[] => (from > to ? [] : Array.from({ length: to - from + 1 }, (_, i) => from + i));

/**
 * The page buttons to show: the first and last `boundary` pages, `siblings` around the current page,
 * and a gap in between. The count stays the same as you move, so the control doesn't change width.
 */
export function pageItems(page: number, pages: number, siblings = 1, boundary = 1): Item[] {
  const startPages = range(1, Math.min(boundary, pages));
  const endPages = range(Math.max(pages - boundary + 1, boundary + 1), pages);
  const start = Math.max(Math.min(page - siblings, pages - boundary - siblings * 2 - 1), boundary + 2);
  const end = Math.min(Math.max(page + siblings, boundary + siblings * 2 + 2), endPages.length ? endPages[0] - 2 : pages - 1);
  return [
    ...startPages,
    ...(start > boundary + 2 ? ['gap-start' as const] : boundary + 1 < pages - boundary ? [boundary + 1] : []),
    ...range(start, end),
    ...(end < pages - boundary - 1 ? ['gap-end' as const] : pages - boundary > boundary ? [pages - boundary] : []),
    ...endPages
  ];
}

/**
 * Page navigation: previous, numbered pages with gaps, next, and optionally a range label and
 * a page-size selector. It only tracks the page; you load that page's data.
 *
 * ```tsx
 * <Pagination total={250} pageSize={10} onPageChange={e => load(e.detail.page)} />
 * <Pagination total={1000} sizes="10,25,50" showTotal />
 * ```
 *
 * Keyboard: every control is a button (**Tab**, **Enter**, **Space**). The current page has `aria-current="page"`.
 *
 * Events: `page-change` (`{ page, pageSize }`), `page-size-change` (`{ pageSize }`).
 */
export class NXPagination extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['total', 'page-size', 'page', 'siblings', 'boundary', 'sizes', 'show-total', 'compact', 'label', 'disabled'];
  }

  /** Move focus to the current page after the next draw (the buttons are rebuilt each time) */
  private refocus = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  private count(name: string, fallback: number, min = 0): number {
    const n = Number(this.getProp(name, fallback));
    return Number.isFinite(n) ? Math.max(min, Math.floor(n)) : fallback;
  }

  getPageSize(): number {
    return this.count('page-size', 10, 1);
  }

  /** Number of pages (at least 1). */
  pageCount(): number {
    return Math.max(1, Math.ceil(this.count('total', 0) / this.getPageSize()));
  }

  getPage(): number {
    return Math.min(this.count('page', 1, 1), this.pageCount());
  }

  /**
   * Go to a page (clamped to the range) the way a click would: emits `page-change` when it moved.
   * (Named `goTo`, not `setPage`: the base class turns `setX` methods into config setters, so
   * `{ page: 2 }` must just set the attribute without events.)
   */
  goTo(page: number): void {
    const next = Math.max(1, Math.min(Math.floor(page) || 1, this.pageCount()));
    if (next === this.getPage() || this.getProp('disabled', false)) return;
    this.refocus = !!this.shadow?.activeElement;
    this.setAttribute('page', String(next));
    this.emit('page-change', { page: next, pageSize: this.getPageSize() });
  }

  private changePageSize(size: number): void {
    if (!(size > 0) || size === this.getPageSize()) return;
    // Keep the first item of the page in view
    const first = (this.getPage() - 1) * this.getPageSize();
    this.setAttribute('page-size', String(size));
    this.setAttribute('page', String(Math.floor(first / size) + 1));
    this.emit('page-size-change', { pageSize: size });
    this.emit('page-change', { page: this.getPage(), pageSize: size });
  }

  private sizes(): number[] {
    const raw = this.getProp<Array<number | string> | string>('sizes', '');
    const list = Array.isArray(raw) ? raw : String(raw).split(',');
    const sizes = list.map(s => Number(String(s).trim())).filter(n => n > 0);
    // The current size is always selectable, even when it isn't in the list
    return sizes.length && !sizes.includes(this.getPageSize()) ? [...sizes, this.getPageSize()].sort((a, b) => a - b) : sizes;
  }

  protected afterRender(): void {
    if (!this.refocus) return;
    this.refocus = false;
    (this.$('.page.current') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  protected render(): Node {
    const page = this.getPage();
    const pages = this.pageCount();
    const total = this.count('total', 0);
    const size = this.getPageSize();
    const disabled = this.getProp('disabled', false);
    const compact = this.getProp('compact', false);
    const sizes = this.sizes();
    const from = total ? (page - 1) * size + 1 : 0;
    const to = Math.min(total, page * size);

    const step = (label: string, target: number, icon: string, off: boolean) => (
      <li>
        <button type="button" class="page step mirror" aria-label={label} disabled={disabled || off}
                onClick={() => this.goTo(target)} html={Icons.get(icon)} />
      </li>
    );

    return (
      <nav part="pagination" class="pagination" aria-label={this.getProp<string>('label') || this.t('pagination.label')}>
        {this.getProp('show-total', false) && <span class="range" part="range">{this.t('pagination.range', { from, to, total })}</span>}
        <ul class="pages" part="pages">
          {step(this.t('pagination.previous'), page - 1, 'chevron-left', page <= 1)}
          {compact
            ? <li class="status" aria-live="polite">{this.t('pagination.status', { page, pages })}</li>
            : pageItems(page, pages, this.count('siblings', 1), this.count('boundary', 1)).map(item =>
                typeof item === 'number' ? (
                  <li>
                    <button type="button" class={['page', { current: item === page }]} part={item === page ? 'page current' : 'page'}
                            aria-current={item === page ? 'page' : undefined} aria-label={this.t('pagination.page', { page: item })}
                            disabled={disabled} onClick={() => this.goTo(item)}>
                      {item.toLocaleString(this.locale())}
                    </button>
                  </li>
                ) : (
                  <li class="gap" aria-hidden="true">…</li>
                ))}
          {step(this.t('pagination.next'), page + 1, 'chevron-right', page >= pages)}
        </ul>
        {sizes.length > 0 && (
          <label class="size">
            <span>{this.t('pagination.perPage')}</span>
            <select disabled={disabled} onChange={(e: Event) => this.changePageSize(Number((e.target as HTMLSelectElement).value))}>
              {sizes.map(n => <option value={String(n)} selected={n === size}>{n.toLocaleString(this.locale())}</option>)}
            </select>
          </label>
        )}
      </nav>
    );
  }

  protected styles(): string {
    return `
      ${MIRROR_CSS}
      :host { display: block; font-size: 0.875rem; }

      .pagination { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1rem; }
      .range { color: var(--color-text-secondary); margin-inline-end: auto; }
      .pages { display: flex; align-items: center; gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
      .pages > li { display: flex; }

      .page {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 2.25rem;
        height: 2.25rem;
        padding: 0 0.5rem;
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-text);
        font: inherit;
        cursor: pointer;
        transition: background-color var(--transition-duration), border-color var(--transition-duration);
      }

      .page:hover:not(:disabled):not(.current) { background: var(--color-accent); }
      .page:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring); }
      .page:disabled { opacity: 0.5; cursor: not-allowed; }
      .page.current { border-color: var(--color-border); background: var(--color-background); font-weight: 600; box-shadow: var(--shadow-sm); }
      .gap, .status { display: inline-flex; align-items: center; justify-content: center; min-width: 2.25rem; color: var(--color-text-secondary); }
      .status { min-width: 0; padding: 0 0.5rem; color: var(--color-text); }

      .size { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--color-text-secondary); }
      .size select {
        height: 2.25rem;
        padding: 0 0.5rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-background);
        color: var(--color-text);
        font: inherit;
      }
      .size select:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring); }
    `;
  }
}

define('nx-pagination', NXPagination);
