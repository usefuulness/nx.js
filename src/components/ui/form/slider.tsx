/**
 * @file @/components/ui/form/slider.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { define } from '@/core/registry';
import { NXField, type FieldConfig } from '@/components/ui/form/field';

export interface SliderConfig extends FieldConfig {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  /** Show the current value next to the label */
  showValue?: boolean;
  /** Format the shown value, e.g. `v => `${v}%`` */
  format?: (value: number) => string;
  /** Unit appended to the shown value (HTML-friendly alternative to `format`) */
  unit?: string;
}

/**
 * Slider: pick a number in a range. A native range input underneath, so
 * arrow keys, Page Up/Down, Home/End, touch and form posting all work.
 *
 * ```html
 * <nx-slider name="volume" label="Volume" value="40" show-value unit="%"></nx-slider>
 * ```
 *
 * Events: `input` (while dragging), `change` (detail: `{ value }`).
 */
export class NXSlider extends NXField {
  static get observedAttributes(): string[] {
    return ['name', 'label', 'helper-text', 'error-text', 'disabled', 'min', 'max', 'step', 'value', 'show-value', 'unit'];
  }

  private currentValue: number | null = null;

  get value(): number {
    return this.currentValue ?? this.defaultValue();
  }

  set value(value: number | string | null | undefined) {
    const n = Number(value);
    this.currentValue = value === null || value === undefined || value === '' || Number.isNaN(n) ? null : this.clamp(n);
    const input = this.control() as HTMLInputElement | null;
    if (input && input.value !== String(this.value)) input.value = String(this.value);
    this.syncTrack();
    this.syncFormValue();
  }

  private bounds(): { min: number; max: number; step: number } {
    return {
      min: Number(this.getProp('min', 0)),
      max: Number(this.getProp('max', 100)),
      step: Number(this.getProp('step', 1)) || 1
    };
  }

  private clamp(n: number): number {
    const { min, max } = this.bounds();
    return Math.min(max, Math.max(min, n));
  }

  /** Like a native range: the midpoint when no value is set. */
  protected defaultValue(): number {
    const { min, max, step } = this.bounds();
    return max < min ? min : min + Math.round((max - min) / 2 / step) * step;
  }

  reset(): void {
    this.currentValue = null;
    super.reset();
  }

  formValue(): string {
    return String(this.value);
  }

  protected onAttributeChange(name: string, _old: string | null, value: string | null): void {
    if (name === 'value') this.value = value;
  }

  protected applyConfig(key: string, value: any): void {
    if (key === 'value') {
      this.value = value;
      return;
    }
    super.applyConfig(key, value);
  }

  private display(value: number): string {
    const format = this.getProp<((v: number) => string) | undefined>('format');
    return typeof format === 'function' ? format(value) : `${value}${this.getProp('unit', '')}`;
  }

  /** Fill the track up to the thumb, and update the shown value. */
  private syncTrack(): void {
    const { min, max } = this.bounds();
    const percent = max > min ? ((this.value - min) / (max - min)) * 100 : 0;
    const input = this.control() as HTMLInputElement | null;
    input?.style.setProperty('--fill', `${percent}%`);
    input?.setAttribute('aria-valuetext', this.display(this.value));
    const output = this.$('.value');
    if (output) output.textContent = this.display(this.value);
  }

  protected render(): Node {
    const { min, max, step } = this.bounds();
    const label = this.getProp<string>('label');
    const showValue = this.getProp('show-value', false);

    return this.renderField(
      <div part="control" class="nx-slider">
        {(label || showValue) && (
          <div class="head">
            {label && <label class="nx-field-label" part="label" for={this.fieldId}>{label}</label>}
            {showValue && <output class="value" part="value" for={this.fieldId}>{this.display(this.value)}</output>}
          </div>
        )}
        <input type="range" id={this.fieldId} part="input" name={this.name || undefined}
               min={String(min)} max={String(max)} step={String(step)} value={String(this.value)}
               disabled={!!this.getProp('disabled', false)}
               aria-describedby={`${this.fieldId}-help`}
               onInput={(e: Event) => {
                 this.currentValue = Number((e.target as HTMLInputElement).value);
                 this.syncTrack();
                 this.syncFormValue();
               }}
               onChange={() => this.changed()} />
      </div>,
      { inlineLabel: true }
    );
  }

  protected afterRender(): void {
    this.syncTrack();
    super.afterRender();
  }

  protected styles(): string {
    return `
      ${this.fieldStyles()}

      .nx-slider { display: flex; flex-direction: column; gap: 0.5rem; }
      .head { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
      .value { color: var(--color-text-secondary); font-variant-numeric: tabular-nums; font-size: 0.8125rem; }

      input[type="range"] {
        --fill: 50%;
        appearance: none;
        width: 100%;
        height: 1.25rem;
        margin: 0;
        background: transparent;
        cursor: pointer;
      }

      input[type="range"]:disabled { cursor: not-allowed; opacity: 0.5; }
      input[type="range"]:focus-visible { outline: none; }

      input[type="range"]::-webkit-slider-runnable-track {
        height: 0.375rem;
        border-radius: var(--radius-full);
        background: linear-gradient(to right, var(--color-primary) var(--fill), var(--color-muted) var(--fill));
      }

      input[type="range"]::-moz-range-track {
        height: 0.375rem;
        border-radius: var(--radius-full);
        background: var(--color-muted);
      }

      input[type="range"]::-moz-range-progress {
        height: 0.375rem;
        border-radius: var(--radius-full);
        background: var(--color-primary);
      }

      input[type="range"]::-webkit-slider-thumb {
        appearance: none;
        width: 1.125rem;
        height: 1.125rem;
        margin-top: -0.375rem;
        border: 2px solid var(--color-primary);
        border-radius: var(--radius-full);
        background: var(--color-background);
        box-shadow: var(--shadow-sm);
        transition: box-shadow var(--transition-duration);
      }

      input[type="range"]::-moz-range-thumb {
        width: 1rem;
        height: 1rem;
        border: 2px solid var(--color-primary);
        border-radius: var(--radius-full);
        background: var(--color-background);
      }

      input[type="range"]:focus-visible::-webkit-slider-thumb {
        box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring);
      }

      input[type="range"]:focus-visible::-moz-range-thumb {
        box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring);
      }
    `;
  }
}

define('nx-slider', NXSlider);
