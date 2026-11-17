/**
 * @file @/components/ui/form/rating.tsx
 */
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { NXField, type FieldConfig } from '@/components/ui/form/field';

export interface RatingConfig extends FieldConfig {
  /** The rating, from 0 (none) to `max` */
  value?: number;
  /** Number of stars (default 5, at most 10) */
  max?: number;
  /** Show the rating without letting people change it */
  readonly?: boolean;
  /** Error shown under the field (for example from the server); marks it invalid */
  errorText?: string;
}

const MAX_STARS = 10;

/**
 * Star rating. A group of native radio buttons underneath, so the arrow keys, **Tab**, form posting
 * and `required` behave like HTML. Each star is announced as "3 of 5", and the filled stars are
 * decoration only: the value is always available as text. With `readonly` it is a plain image
 * with the value as its name.
 *
 * ```html
 * <nx-rating name="score" label="How was it?" value="4"></nx-rating>
 * <nx-rating value="3.5" max="5" readonly></nx-rating>
 * ```
 *
 * Events: `change` (detail: `{ value }`).
 */
export class NXRating extends NXField {
  static get observedAttributes(): string[] {
    return ['name', 'label', 'helper-text', 'error-text', 'required', 'disabled', 'readonly', 'max', 'value'];
  }

  private current = 0;
  private hover = 0;

  private maxStars(): number {
    const n = Math.floor(Number(this.getProp('max', 5)));
    return Math.min(MAX_STARS, Math.max(1, Number.isFinite(n) ? n : 5));
  }

  private isReadonly(): boolean {
    return !!this.getProp('readonly', false);
  }

  get value(): number {
    return this.current;
  }

  set value(value: number | string | null | undefined) {
    const n = Number(value);
    const ok = value !== null && value !== undefined && value !== '' && Number.isFinite(n);
    // Whole stars only for input; a read-only display may show halves
    this.current = ok ? Math.min(this.maxStars(), Math.max(0, this.isReadonly() ? Math.round(n * 2) / 2 : Math.round(n))) : 0;
    this.syncStars();
    this.syncFormValue();
  }

  formValue(): string | null {
    return this.current > 0 ? String(this.current) : null;
  }

  protected defaultValue(): number {
    return 0;
  }

  reset(): void {
    this.current = 0;
    this.syncStars();
    super.reset();
  }

  /** Focus the chosen star (or the first), like a native radio group. */
  focus(options?: FocusOptions): void {
    ((this.$('input:checked') ?? this.control()) as HTMLElement | null)?.focus(options);
  }

  protected onAttributeChange(name: string, _old: string | null, value: string | null): void {
    if (name === 'value') this.value = value;
    else if (name === 'max' || name === 'readonly') this.scheduleUpdate();
  }

  protected applyConfig(key: string, value: any): void {
    if (key === 'value') {
      this.value = value;
      return;
    }
    super.applyConfig(key, value);
  }

  private text(value: number): string {
    return this.t('rating.value', { n: value, max: this.maxStars() });
  }

  /** Fill the stars for the value (or the hovered star), without redrawing, so focus stays put. */
  private syncStars(): void {
    const shown = this.hover || this.current;
    this.$$('.star').forEach((star, i) => {
      const fill = Math.max(0, Math.min(1, shown - i));
      (star as HTMLElement).style.setProperty('--fill', `${fill * 100}%`);
      star.classList.toggle('preview', !!this.hover);
    });
    this.$$('input').forEach(input => ((input as HTMLInputElement).checked = Number((input as HTMLInputElement).value) === this.current));
    const out = this.$('.sr-value');
    if (out) out.textContent = this.current ? this.text(this.current) : this.t('rating.none');
  }

  protected afterRender(): void {
    this.syncStars();
    super.afterRender();
  }

  protected render(): Node {
    const max = this.maxStars();
    const label = this.getProp<string>('label');
    const required = !!this.getProp('required', false);
    const disabled = !!this.getProp('disabled', false);
    const readonly = this.isReadonly();
    const star = <span class="shape" aria-hidden="true" html={Icons.get('star')} />;

    if (readonly) {
      // A display, not a control: one image with the value as its name
      return this.renderField(
        <div part="control" class="nx-rating readonly">
          {label && <span class="nx-field-label" part="label">{label}</span>}
          <span class="stars" part="stars" role="img" aria-label={this.current ? this.text(this.current) : this.t('rating.none')}>
            {Array.from({ length: max }, () => <span class="star" part="star">{star.cloneNode(true)}</span>)}
          </span>
        </div>,
        { inlineLabel: true }
      );
    }

    return this.renderField(
      <div part="control" role="radiogroup" class="nx-rating"
           aria-labelledby={label ? `${this.fieldId}-label` : undefined}
           aria-describedby={`${this.fieldId}-help`} aria-required={required ? 'true' : undefined}
           onMouseLeave={() => { this.hover = 0; this.syncStars(); }}>
        {label && (
          <span class="nx-field-label" part="label" id={`${this.fieldId}-label`}>
            {label}{required && <span class="required" aria-hidden="true">*</span>}
          </span>
        )}
        <span class="stars" part="stars">
          {Array.from({ length: max }, (_, i) => (
            <label class={['star', { disabled }]} part="star"
                   onMouseEnter={() => { if (!disabled) { this.hover = i + 1; this.syncStars(); } }}>
              <input type="radio" id={i === 0 ? this.fieldId : undefined} name={this.fieldId} value={String(i + 1)}
                     aria-label={this.text(i + 1)} required={required} disabled={disabled}
                     onChange={(e: Event) => {
                       this.current = Number((e.target as HTMLInputElement).value);
                       this.hover = 0;
                       this.syncStars();
                       this.changed();
                     }} />
              {star.cloneNode(true)}
            </label>
          ))}
        </span>
        <span class="sr-value sr-only" role="status" />
      </div>,
      { inlineLabel: true }
    );
  }

  protected styles(): string {
    return `
      ${this.fieldStyles()}

      .nx-rating { display: flex; flex-direction: column; gap: 0.375rem; }
      .stars { display: inline-flex; gap: 0.125rem; }

      .star { --star-mask: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath fill=%22%23000%22 d=%22m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z%22/%3E%3C/svg%3E"); --fill: 0%; position: relative; display: inline-flex; width: 1.5rem; height: 1.5rem; cursor: pointer; }
      .readonly .star { cursor: default; }
      .star.disabled { cursor: not-allowed; opacity: 0.5; }

      .shape { display: block; width: 100%; height: 100%; }
      .shape svg { display: block; width: 100%; height: 100%; fill: none; stroke: var(--color-text-secondary); stroke-width: 1.75; }

      /* The filled part is a second copy of the star, clipped to the fill */
      .star::after {
        content: '';
        position: absolute;
        inset: 0;
        background: var(--color-warning);
        clip-path: inset(0 calc(100% - var(--fill)) 0 0);
        -webkit-mask: var(--star-mask) center / 100% 100% no-repeat;
        mask: var(--star-mask) center / 100% 100% no-repeat;
        pointer-events: none;
      }
      .star.preview::after { opacity: 0.7; }

      /* Visually hidden, but still focusable and clickable through its label */
      .star input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: inherit; }
      .star:has(input:focus-visible) { outline: 2px solid var(--color-ring); outline-offset: 2px; border-radius: var(--radius-sm); }

      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    `;
  }
}

define('nx-rating', NXRating);
