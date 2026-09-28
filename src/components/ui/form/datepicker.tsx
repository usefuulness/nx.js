/**
 * @file @/components/ui/form/datepicker.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { place } from '@/core/position';
import { NXField, type FieldConfig, type Validator } from '@/components/ui/form/field';

export interface DatePickerConfig extends FieldConfig {
  /** `YYYY-MM-DD` */
  value?: string;
  /** Earliest selectable date, `YYYY-MM-DD` */
  min?: string;
  /** Latest selectable date, `YYYY-MM-DD` */
  max?: string;
  /** Text shown while empty */
  placeholder?: string;
  /** BCP 47 locale for names and formatting (default: `<html lang>`, then the browser's) */
  locale?: string;
  /** First day of the week, 0 = Sunday … 6 = Saturday (default: from the locale) */
  firstDay?: number;
  /** Control height */
  size?: 'sm' | 'md' | 'lg';
  /** Error shown under the field (for example from the server); marks it invalid */
  errorText?: string;
}

// ────────── Plain calendar dates (no time zones) ──────────

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

/** Same day in another month, clamped to that month's length (Jan 31 + 1 month → Feb 28). */
function addMonths(d: Date, months: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
}

export function parseISODate(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toISO(d) === value ? d : null;
}

function localeFirstDay(locale: string): number {
  try {
    const info = (new Intl.Locale(locale) as any);
    const week = typeof info.getWeekInfo === 'function' ? info.getWeekInfo() : info.weekInfo;
    if (week?.firstDay) return week.firstDay % 7;
  } catch {
    // older engines
  }
  return /-(US|CA|JP|BR|MX|IL|KR|TW|PH|IN)$/i.test(locale) || locale === 'en' ? 0 : 1;
}

/**
 * Date picker: a button that opens a calendar. Full keyboard support in the
 * calendar grid (arrows, Home/End, Page Up/Down for months, with Shift for
 * years), localized names, `min`/`max`, and a `YYYY-MM-DD` form value.
 *
 * ```html
 * <nx-datepicker name="due" label="Due date" min="2025-01-01" required></nx-datepicker>
 * ```
 *
 * Events: `change` (detail: `{ value }`).
 */
export class NXDatePicker extends NXField {
  static get observedAttributes(): string[] {
    return ['name', 'label', 'helper-text', 'error-text', 'required', 'disabled', 'value', 'min', 'max', 'placeholder', 'locale', 'first-day', 'size'];
  }

  private currentValue = '';
  /** The day with keyboard focus in the grid */
  private focusDate = new Date();
  private isOpen = false;
  private openAtPointerDown: boolean | null = null;

  get value(): string {
    return this.currentValue;
  }

  set value(value: string | Date | null | undefined) {
    const iso = value instanceof Date ? toISO(value) : value ?? '';
    this.currentValue = parseISODate(iso) ? iso : '';
    this.syncTrigger();
    this.syncFormValue();
  }

  /** The value as a local `Date` (or null). */
  get valueAsDate(): Date | null {
    return parseISODate(this.currentValue);
  }

  formValue(): string | null {
    return this.currentValue || null;
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

  private locale(): string {
    return this.getProp<string>('locale') || document.documentElement.lang || navigator.language || 'en-US';
  }

  private format(date: Date, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
    try {
      return new Intl.DateTimeFormat(this.locale(), options).format(date);
    } catch {
      return toISO(date);
    }
  }

  private inRange(iso: string): boolean {
    const min = this.getProp<string>('min');
    const max = this.getProp<string>('max');
    return !(min && iso < String(min)) && !(max && iso > String(max));
  }

  /** Required, min/max and the custom validator — reported through ElementInternals. */
  validationMessage(): string {
    const value = this.currentValue;
    const min = parseISODate(this.getProp<string>('min'));
    const max = parseISODate(this.getProp<string>('max'));
    let message = '';
    if (!value && this.getProp('required', false)) message = 'Please select a date.';
    else if (value && min && value < toISO(min)) message = `Choose ${this.format(min)} or later.`;
    else if (value && max && value > toISO(max)) message = `Choose ${this.format(max)} or earlier.`;
    else {
      const validator = this.getProp<Validator>('validator');
      const custom = typeof validator === 'function' ? validator(value, this) : null;
      if (typeof custom === 'string') message = custom;
    }
    const anchor = this.trigger() ?? undefined;
    if (message) this.internals?.setValidity({ customError: true }, message, anchor);
    else this.internals?.setValidity({});
    return message;
  }

  focus(options?: FocusOptions): void {
    this.trigger()?.focus(options);
  }

  /** Before JavaScript: the browser's own date input. */
  nativeStandIns() {
    const trigger = this.trigger();
    if (!trigger) return [];
    const input = document.createElement('input');
    input.type = 'date';
    if (this.currentValue) input.value = this.currentValue;
    const attrs: Record<string, string | true | null> = { name: this.name || null, 'aria-label': this.getProp<string>('label') || null };
    ['min', 'max'].forEach(name => {
      const value = this.getProp<string>(name);
      if (value) attrs[name] = String(value);
    });
    if (this.getProp('required', false)) attrs.required = true;
    if (this.getProp('disabled', false)) attrs.disabled = true;
    return [{ original: trigger, fallback: input, attrs }];
  }

  private trigger(): HTMLButtonElement | null {
    return this.$('.trigger') as HTMLButtonElement | null;
  }

  private panel(): HTMLElement | null {
    return this.$('.calendar-popover') as HTMLElement | null;
  }

  private syncTrigger(): void {
    const text = this.$('.trigger-text');
    const date = this.valueAsDate;
    if (text) {
      text.textContent = date ? this.format(date) : this.getProp('placeholder', 'Pick a date');
      text.classList.toggle('placeholder', !date);
    }
  }

  // ────────── Open / close ──────────

  open(): void {
    const panel = this.panel();
    if (!panel || this.isOpen || this.getProp('disabled', false)) return;
    const today = new Date();
    this.focusDate = this.valueAsDate ?? parseISODate(this.clampISO(toISO(today))) ?? today;
    this.renderCalendar();
    try {
      (panel as any).showPopover();
    } catch {
      return;
    }
    this.isOpen = true;
    place(panel, this.$('.nx-control')!, 'bottom-start', 4);
    this.trigger()?.setAttribute('aria-expanded', 'true');
    this.focusDay();
  }

  close(): void {
    try {
      (this.panel() as any)?.hidePopover();
    } catch {
      // closed already
    }
  }

  private onClosed(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.trigger()?.setAttribute('aria-expanded', 'false');
    const active = this.shadowRoot?.activeElement;
    if (!active || this.panel()?.contains(active)) this.trigger()?.focus({ preventScroll: true });
  }

  private clampISO(iso: string): string {
    const min = this.getProp<string>('min');
    const max = this.getProp<string>('max');
    if (min && iso < String(min)) return String(min);
    if (max && iso > String(max)) return String(max);
    return iso;
  }

  private pick(date: Date): void {
    const iso = toISO(date);
    if (!this.inRange(iso)) return;
    const changed = iso !== this.currentValue;
    this.currentValue = iso;
    this.close();
    this.syncTrigger();
    if (changed) this.changed();
  }

  private moveFocus(date: Date): void {
    const iso = this.clampISO(toISO(date));
    this.focusDate = parseISODate(iso)!;
    this.renderCalendar();
    this.focusDay();
  }

  private focusDay(): void {
    (this.$(`.day[data-date="${toISO(this.focusDate)}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
  }

  private onGridKey(e: KeyboardEvent): void {
    const d = this.focusDate;
    const firstDay = this.firstDay();
    const weekday = (d.getDay() - firstDay + 7) % 7;
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(d, -1),
      ArrowRight: () => addDays(d, 1),
      ArrowUp: () => addDays(d, -7),
      ArrowDown: () => addDays(d, 7),
      Home: () => addDays(d, -weekday),
      End: () => addDays(d, 6 - weekday),
      PageUp: () => addMonths(d, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(d, e.shiftKey ? 12 : 1)
    };
    if (moves[e.key]) {
      e.preventDefault();
      this.moveFocus(moves[e.key]());
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.pick(d);
    }
  }

  private firstDay(): number {
    const prop = this.getProp<number | undefined>('first-day');
    return prop !== undefined && prop !== null && String(prop) !== '' ? Number(prop) % 7 : localeFirstDay(this.locale());
  }

  // ────────── Rendering ──────────

  /** Rebuild the month grid in place (the trigger never re-renders). */
  private renderCalendar(): void {
    const container = this.$('.calendar');
    if (!container) return;
    const focus = this.focusDate;
    const year = focus.getFullYear();
    const month = focus.getMonth();
    const firstDay = this.firstDay();
    const start = addDays(new Date(year, month, 1), -((new Date(year, month, 1).getDay() - firstDay + 7) % 7));
    const todayISO = toISO(new Date());
    const focusISO = toISO(focus);
    const min = this.getProp<string>('min');
    const max = this.getProp<string>('max');
    const prevDisabled = !!min && toISO(new Date(year, month, 0)) < String(min);
    const nextDisabled = !!max && toISO(new Date(year, month + 1, 1)) > String(max);

    const weeks: Date[][] = [];
    for (let w = 0; w < 6; w++) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
    const weekdays = weeks[0].map(day => ({
      short: this.format(day, { weekday: 'short' }).slice(0, 2),
      long: this.format(day, { weekday: 'long' })
    }));

    container.replaceChildren(
      <div class="calendar-head">
        <button type="button" class="nav" part="nav" aria-label="Previous month" disabled={prevDisabled}
                html={Icons.get('chevron-left')} onClick={() => this.moveFocus(addMonths(focus, -1))} />
        <div class="month" part="month" aria-live="polite" id={`${this.fieldId}-month`}>
          {this.format(focus, { month: 'long', year: 'numeric' })}
        </div>
        <button type="button" class="nav" part="nav" aria-label="Next month" disabled={nextDisabled}
                html={Icons.get('chevron-right')} onClick={() => this.moveFocus(addMonths(focus, 1))} />
      </div> as HTMLElement,
      <table role="grid" part="grid" aria-labelledby={`${this.fieldId}-month`} onKeyDown={(e: KeyboardEvent) => this.onGridKey(e)}>
        <thead>
          <tr>{weekdays.map(w => <th scope="col" abbr={w.long}>{w.short}</th>)}</tr>
        </thead>
        <tbody>
          {weeks.map(week => (
            <tr>
              {week.map(day => {
                const iso = toISO(day);
                const outside = day.getMonth() !== month;
                const disabled = (!!min && iso < String(min)) || (!!max && iso > String(max));
                return (
                  <td role="gridcell" aria-selected={String(iso === this.currentValue)}>
                    <button type="button" part="day" data-date={iso} tabindex={iso === focusISO ? 0 : -1}
                            class={['day', { outside, today: iso === todayISO, selected: iso === this.currentValue }]}
                            aria-label={this.format(day, { dateStyle: 'full' })}
                            aria-current={iso === todayISO ? 'date' : undefined}
                            aria-disabled={disabled ? 'true' : undefined}
                            onClick={() => (disabled ? undefined : this.pick(day))}>
                      {day.getDate()}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table> as HTMLElement
    );
  }

  protected render(): Node {
    const date = this.valueAsDate;
    const disabled = !!this.getProp('disabled', false);
    return this.renderField(
      <div part="control" class={['nx-control', `size-${this.getProp('size', 'md')}`]}>
        <button type="button" id={this.fieldId} part="trigger" class="trigger" disabled={disabled}
                aria-haspopup="dialog" aria-expanded="false" aria-describedby={`${this.fieldId}-help`}
                onPointerDown={() => (this.openAtPointerDown = this.isOpen)}
                onClick={() => {
                  const wasOpen = this.openAtPointerDown ?? this.isOpen;
                  this.openAtPointerDown = null;
                  if (wasOpen) this.close();
                  else this.open();
                }}>
          <span class="nx-control-icon" aria-hidden="true" html={Icons.get('calendar')} />
          <span class={['trigger-text', { placeholder: !date }]}>{date ? this.format(date) : this.getProp('placeholder', 'Pick a date')}</span>
        </button>
        <div class="calendar-popover" part="calendar" popover="auto" role="dialog" aria-label="Choose date"
             onToggle={(e: Event) => {
               if ((e as ToggleEvent).newState === 'closed') this.onClosed();
             }}>
          <div class="calendar" />
        </div>
      </div>
    );
  }

  protected afterRender(): void {
    if (this.isOpen) this.renderCalendar();
    super.afterRender();
  }

  protected styles(): string {
    return `
      ${this.fieldStyles()}

      .nx-control { padding: 0; }
      ::slotted([data-nx-native]) { padding: 0 0.75rem !important; }

      .trigger {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        min-height: 2.125rem;
        padding: 0 0.75rem;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .trigger:focus-visible { outline: none; }
      .trigger:disabled { cursor: not-allowed; }
      .placeholder { color: var(--color-text-secondary); }

      .calendar-popover {
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        box-shadow: var(--shadow-lg);
      }

      .calendar-popover:popover-open { animation: nx-cal-in 140ms var(--transition-easing); }
      @keyframes nx-cal-in { from { opacity: 0; transform: translateY(-4px); } }

      .calendar-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
      }

      .month { font-weight: 500; font-size: 0.875rem; }

      .nav {
        display: inline-flex;
        padding: 0.375rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text);
        font-size: 0.875rem;
        cursor: pointer;
      }

      .nav:hover:not(:disabled) { background: var(--color-accent); }
      .nav:disabled { opacity: 0.4; cursor: not-allowed; }

      table { border-collapse: collapse; }

      th {
        width: 2.25rem;
        padding-bottom: 0.25rem;
        color: var(--color-text-secondary);
        font-size: 0.75rem;
        font-weight: 400;
      }

      td { padding: 1px; text-align: center; }

      .day {
        width: 2.25rem;
        height: 2.25rem;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text);
        font: inherit;
        font-size: 0.875rem;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
      }

      .day:hover { background: var(--color-accent); }
      .day.outside { color: var(--color-text-secondary); }
      .day.today { background: var(--color-accent); font-weight: 600; }
      .day.selected { background: var(--color-primary); color: var(--color-primary-foreground); }
      .day[aria-disabled="true"] { opacity: 0.35; cursor: not-allowed; background: transparent; }
      .day:focus-visible, .nav:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring);
      }
    `;
  }
}

define('nx-datepicker', NXDatePicker);
