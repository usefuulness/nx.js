/**
 * @file @/components/ui/calendar.tsx
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { inlineStep } from '@/core/dom-utils';
import { toISO, addDays, addMonths, parseISODate, localeFirstDay } from '@/core/dates';

export interface CalendarEvent {
  /** The day, `YYYY-MM-DD` */
  date: string;
  /** What is happening */
  title: string;
  /** A time of day to show, such as `14:30` (text only) */
  time?: string;
  /** Colour by meaning */
  status?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export interface CalendarConfig {
  /** The selected day, `YYYY-MM-DD` */
  value?: string;
  /** The month to show first, as any `YYYY-MM-DD` date in it (default: the selected day, or today) */
  month?: string;
  /** Days with something on them: dots on the grid, and the list under it for the selected day */
  events?: CalendarEvent[];
  /** Earliest day that can be selected, `YYYY-MM-DD` */
  min?: string;
  /** Latest day that can be selected, `YYYY-MM-DD` */
  max?: string;
  /** First day of the week, 0 (Sunday) to 6 (default: from the language) */
  firstDay?: number;
  /** Accessible name of the calendar (default "Calendar") */
  label?: string;
  /** Hide the list of the selected day's events */
  hideAgenda?: boolean;
}

const MAX_EVENTS = 2000;

/**
 * A month calendar that is always on the page: pick a day, and see what is on it. Use it for
 * schedules, bookings and availability; for a date field in a form use `<nx-datepicker>`.
 *
 * ```html
 * <nx-calendar value="2026-03-04" events='[{"date":"2026-03-04","title":"Standup","time":"09:30"}]'></nx-calendar>
 * ```
 *
 * The grid is an ARIA grid: **←** **→** move a day, **↑** **↓** a week, **Home** **End** the start and end of
 * the week, **Page Up/Down** a month (with **Shift**, a year), **Enter** or **Space** selects. Each day is
 * named in full with how many events it has, so dots are never the only cue.
 *
 * Events: `select` (detail: `{ value, events }`), `month-change` (detail: `{ month }`).
 */
export class NXCalendar extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['value', 'month', 'events', 'min', 'max', 'first-day', 'label', 'hide-agenda'];
  }

  private focusDate: Date | null = null;
  private uid = `c${Math.random().toString(36).slice(2, 8)}`;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  get value(): string {
    return parseISODate(this.getProp<string>('value', '')) ? String(this.getProp('value')) : '';
  }

  set value(value: string | null | undefined) {
    if (value) this.setAttribute('value', String(value));
    else this.removeAttribute('value');
  }

  /** Show the month that contains this day (`YYYY-MM-DD`), keeping it focusable. */
  showMonth(date: string): void {
    const d = parseISODate(date);
    if (!d) return;
    this.focusDate = d;
    this.draw();
    this.emit('month-change', { month: date.slice(0, 7) });
  }

  protected onAttributeChange(name: string): void {
    if (name === 'value') this.focusDate = parseISODate(this.value) ?? this.focusDate;
    if (name === 'month') this.focusDate = parseISODate(this.getProp('month')) ?? this.focusDate;
  }

  private firstDay(): number {
    const prop = this.getProp<number | string | undefined>('first-day');
    return prop !== undefined && prop !== null && String(prop) !== '' && Number.isFinite(Number(prop))
      ? ((Math.floor(Number(prop)) % 7) + 7) % 7
      : localeFirstDay(this.locale());
  }

  private format(date: Date, options: Intl.DateTimeFormatOptions): string {
    try { return new Intl.DateTimeFormat(this.locale(), options).format(date); } catch { return toISO(date); }
  }

  /** Events grouped by day. Bad entries are skipped; the list is capped. */
  private eventsByDay(): Map<string, CalendarEvent[]> {
    let raw = this.getProp<unknown>('events');
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = []; } }
    const map = new Map<string, CalendarEvent[]>();
    if (!Array.isArray(raw)) return map;
    for (const e of raw.slice(0, MAX_EVENTS)) {
      if (!e || typeof e !== 'object' || !parseISODate((e as CalendarEvent).date)) continue;
      const list = map.get((e as CalendarEvent).date) ?? [];
      list.push(e as CalendarEvent);
      map.set((e as CalendarEvent).date, list);
    }
    return map;
  }

  private outOfRange(iso: string): boolean {
    const min = this.getProp<string>('min');
    const max = this.getProp<string>('max');
    return (!!min && iso < String(min)) || (!!max && iso > String(max));
  }

  private select(date: Date): void {
    const iso = toISO(date);
    if (this.outOfRange(iso)) return;
    this.focusDate = date;
    this.setAttribute('value', iso);
    this.draw();
    this.focusDay();
    this.emit('select', { value: iso, events: this.eventsByDay().get(iso) ?? [] });
  }

  private move(date: Date): void {
    const before = this.focusDate;
    this.focusDate = date;
    this.draw();
    this.focusDay();
    if (!before || before.getMonth() !== date.getMonth() || before.getFullYear() !== date.getFullYear()) {
      this.emit('month-change', { month: toISO(date).slice(0, 7) });
    }
  }

  private focusDay(): void {
    if (this.focusDate) (this.$(`.day[data-date="${toISO(this.focusDate)}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
  }

  private onKey(e: KeyboardEvent): void {
    const d = this.focusDate;
    if (!d) return;
    const weekday = (d.getDay() - this.firstDay() + 7) % 7;
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(d, inlineStep('ArrowLeft', this)),
      ArrowRight: () => addDays(d, inlineStep('ArrowRight', this)),
      ArrowUp: () => addDays(d, -7),
      ArrowDown: () => addDays(d, 7),
      Home: () => addDays(d, -weekday),
      End: () => addDays(d, 6 - weekday),
      PageUp: () => addMonths(d, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(d, e.shiftKey ? 12 : 1)
    };
    if (moves[e.key]) {
      e.preventDefault();
      this.move(moves[e.key]());
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.select(d);
    }
  }

  protected render(): Node {
    return (
      <div part="calendar" class="calendar" role="group" aria-label={this.getProp<string>('label') || this.t('calendar.label')}>
        <div class="grid-host" />
        <div class="agenda-host" />
      </div>
    );
  }

  /** A redraw (after the value attribute changes) replaces the shadow root: keep keyboard focus on the day it was on. */
  protected update(): void {
    const active = this.shadowRoot?.activeElement as HTMLElement | null;
    this.refocus = !!active && active.classList.contains('day');
    super.update();
  }

  private refocus = false;

  protected afterRender(): void {
    this.focusDate ??= parseISODate(this.value) ?? parseISODate(this.getProp('month')) ?? new Date();
    this.draw();
    if (this.refocus) this.focusDay();
    this.refocus = false;
  }

  /** Rebuild the month and the agenda in place, so focus and the host element are never replaced. */
  private draw(): void {
    const host = this.$('.grid-host');
    const agenda = this.$('.agenda-host');
    if (!host || !agenda || !this.focusDate) return;
    const focus = this.focusDate;
    const year = focus.getFullYear();
    const month = focus.getMonth();
    const first = this.firstDay();
    const start = addDays(new Date(year, month, 1), -((new Date(year, month, 1).getDay() - first + 7) % 7));
    const today = toISO(new Date());
    const focusISO = toISO(focus);
    const selected = this.value;
    const events = this.eventsByDay();
    const min = this.getProp<string>('min');
    const max = this.getProp<string>('max');
    const weeks: Date[][] = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
    const names = weeks[0].map(day => ({ short: this.format(day, { weekday: 'short' }).slice(0, 2), long: this.format(day, { weekday: 'long' }) }));

    host.replaceChildren(
      <div class="head">
        <button type="button" class="nav mirror" part="nav" aria-label={this.t('datepicker.previousMonth')} html={Icons.get('chevron-left')}
                disabled={!!min && toISO(new Date(year, month, 0)) < String(min)} onClick={() => this.move(addMonths(focus, -1))} />
        <div class="month" part="month" id={`${this.uid}-m`} aria-live="polite">{this.format(focus, { month: 'long', year: 'numeric' })}</div>
        <button type="button" class="nav mirror" part="nav" aria-label={this.t('datepicker.nextMonth')} html={Icons.get('chevron-right')}
                disabled={!!max && toISO(new Date(year, month + 1, 1)) > String(max)} onClick={() => this.move(addMonths(focus, 1))} />
      </div> as HTMLElement,
      <table role="grid" part="grid" aria-labelledby={`${this.uid}-m`} onKeyDown={(e: KeyboardEvent) => this.onKey(e)}>
        <thead><tr>{names.map(n => <th scope="col" abbr={n.long}>{n.short}</th>)}</tr></thead>
        <tbody>
          {weeks.map(week => (
            <tr>
              {week.map(day => {
                const iso = toISO(day);
                const list = events.get(iso) ?? [];
                const label = this.format(day, { dateStyle: 'full' }) + (list.length ? `, ${this.t('calendar.events', { count: list.length })}` : '');
                return (
                  <td role="gridcell" aria-selected={String(iso === selected)}>
                    <button type="button" part="day" data-date={iso} tabindex={iso === focusISO ? 0 : -1}
                            class={['day', { outside: day.getMonth() !== month, today: iso === today, selected: iso === selected, busy: list.length > 0 }]}
                            aria-label={label} aria-current={iso === today ? 'date' : undefined}
                            aria-disabled={this.outOfRange(iso) ? 'true' : undefined}
                            onClick={() => this.select(day)}>
                      <span class="num">{day.getDate()}</span>
                      {list.length > 0 && (
                        <span class="dots" aria-hidden="true">
                          {list.slice(0, 3).map(ev => <span class={['dot', ev.status || 'default']} />)}
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table> as HTMLElement
    );

    const day = parseISODate(selected);
    const todays = day ? events.get(selected) ?? [] : [];
    if (this.getProp('hide-agenda', false) || !day) {
      agenda.replaceChildren();
      return;
    }
    agenda.replaceChildren(
      <section class="agenda" part="agenda" aria-live="polite">
        <h3 class="agenda-title" part="agenda-title">{this.format(day, { dateStyle: 'full' })}</h3>
        {todays.length === 0 ? <p class="none">{this.t('calendar.none')}</p> : (
          <ul class="list">
            {todays.map(ev => (
              <li class={['ev', ev.status || 'default']}>
                {ev.time && <span class="ev-time">{String(ev.time)}</span>}
                <span class="ev-title">{String(ev.title ?? '')}</span>
                {ev.status && ev.status !== 'default' && <span class="sr-only">{`(${this.t(`timeline.${ev.status}`)})`}</span>}
              </li>
            ))}
          </ul>
        )}
      </section> as HTMLElement
    );
  }

  protected styles(): string {
    return `
      :host { display: block; font-size: 0.875rem; }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
      .month { font-weight: 600; }
      .nav { display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border: none; border-radius: var(--radius-md); background: transparent; color: var(--color-text); cursor: pointer; }
      .nav:hover:not(:disabled) { background: var(--color-accent); }
      .nav:disabled { opacity: 0.4; cursor: not-allowed; }
      .nav:focus-visible, .day:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring); }
      .nav svg { width: 1rem; height: 1rem; }

      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th { padding: 0.25rem 0; font-size: 0.75rem; font-weight: 500; color: var(--color-text-secondary); }
      td { padding: 1px; text-align: center; }

      .day { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; width: 100%; min-height: 2.75rem; padding: 0.125rem 0; border: none; border-radius: var(--radius-md); background: transparent; color: var(--color-text); font: inherit; cursor: pointer; }
      .day:hover { background: var(--color-accent); }
      /* Days of the neighbouring months: quieter, but never below the contrast a reader needs (no opacity on top of the colour) */
      .day.outside .num { color: var(--color-text-secondary); }
      .day.today .num { font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
      .day.selected { background: var(--color-primary); color: var(--color-primary-foreground); }
      .day.selected .num { color: inherit; opacity: 1; }
      .day[aria-disabled="true"] { opacity: 0.4; cursor: not-allowed; }

      .dots { display: inline-flex; gap: 2px; height: 6px; }
      .dot { --dot: var(--color-text-secondary); width: 5px; height: 5px; border-radius: 50%; background: var(--dot); }
      .dot.success { --dot: var(--color-success); }
      .dot.warning { --dot: var(--color-warning); }
      .dot.error { --dot: var(--color-error); }
      .dot.info { --dot: var(--color-info); }
      .day.selected .dot { background: var(--color-primary-foreground); }

      .agenda { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--color-border); }
      .agenda-title { margin: 0 0 0.375rem; font-size: 0.8125rem; font-weight: 600; color: var(--color-text-secondary); }
      .none { margin: 0; color: var(--color-text-secondary); }
      .list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.375rem; }
      .ev { display: flex; align-items: baseline; gap: 0.625rem; padding-inline-start: 0.625rem; border-inline-start: 3px solid var(--color-border); }
      .ev.success { border-color: var(--color-success); }
      .ev.warning { border-color: var(--color-warning); }
      .ev.error { border-color: var(--color-error); }
      .ev.info { border-color: var(--color-info); }
      .ev-time { color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
      .ev-title { overflow-wrap: anywhere; }
      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    `;
  }
}

define('nx-calendar', NXCalendar);
