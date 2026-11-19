/**
 * @file @/core/util.ts
 * Small helpers an app keeps needing: debounce and throttle, repeating tasks, and number, date and
 * text formatting that follows the page's language. Must not touch the DOM when it loads.
 */
import { i18n } from '@/core/i18n';

// ────────── Timing ──────────

export interface Cancelable<A extends unknown[]> {
  (...args: A): void;
  /** Drop a call that is waiting */
  cancel(): void;
  /** Run a waiting call now */
  flush(): void;
  /** Whether a call is waiting */
  pending(): boolean;
}

/** Call `fn` only after `ms` of quiet: the last call wins. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Cancelable<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last: A | null = null;
  const run = () => { timer = null; const args = last!; last = null; fn(...args); };
  const wrapped = ((...args: A) => {
    last = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, ms);
  }) as Cancelable<A>;
  wrapped.cancel = () => { if (timer) clearTimeout(timer); timer = null; last = null; };
  wrapped.flush = () => { if (timer) { clearTimeout(timer); run(); } };
  wrapped.pending = () => timer !== null;
  return wrapped;
}

/** Call `fn` at most once every `ms`: the first call runs at once, and the last one in the window runs when it ends. */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number): Cancelable<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last: A | null = null;
  let lastRun = -Infinity;
  const fire = (args: A) => { lastRun = Date.now(); fn(...args); };
  const wrapped = ((...args: A) => {
    const wait = ms - (Date.now() - lastRun);
    if (wait <= 0 && !timer) { fire(args); return; }
    last = args;
    if (!timer) timer = setTimeout(() => { timer = null; const a = last!; last = null; fire(a); }, Math.max(0, wait));
  }) as Cancelable<A>;
  wrapped.cancel = () => { if (timer) clearTimeout(timer); timer = null; last = null; };
  wrapped.flush = () => { if (timer) { clearTimeout(timer); timer = null; const a = last!; last = null; fire(a); } };
  wrapped.pending = () => timer !== null;
  return wrapped;
}

export interface TaskConfig {
  /** Called every `interval` ms. Return `false` to stop. */
  run: (count: number) => void | boolean | Promise<void | boolean>;
  interval: number;
  /** Stop after this many runs */
  repeat?: number;
  /** Called when `run` throws or rejects (the task keeps going unless you stop it) */
  onError?: (error: unknown) => void;
}

export interface Task {
  /** Runs so far */
  readonly count: number;
  readonly running: boolean;
  stop(): void;
  start(): void;
}

const tasks = new Set<Task>();

/**
 * Run something on an interval, with a run count, a limit, and a stop. A slow `run` is never overlapped
 * by the next one: the next run waits.
 */
export function startTask(config: TaskConfig): Task {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let count = 0;
  let busy = false;
  let running = false;
  const task: Task = {
    get count() { return count; },
    get running() { return running; },
    stop() { running = false; if (timer) clearTimeout(timer); timer = null; tasks.delete(task); },
    start() { if (running) return; running = true; tasks.add(task); schedule(); }
  };
  const schedule = () => { timer = setTimeout(tick, config.interval); };
  const tick = async () => {
    timer = null;
    if (!running) return;
    if (busy) { schedule(); return; }
    busy = true;
    count++;
    let keep: unknown = true;
    try {
      keep = await config.run(count);
    } catch (e) {
      if (config.onError) config.onError(e); else console.error(e);
    }
    busy = false;
    if (keep === false || (config.repeat !== undefined && count >= config.repeat)) task.stop();
    else if (running) schedule();
  };
  task.start();
  return task;
}

/** Stop every task started with `startTask` */
export function stopAllTasks(): void {
  [...tasks].forEach(t => t.stop());
}

// ────────── Formatting ──────────

const langOf = (locale?: string): string => locale || (typeof document !== 'undefined' ? i18n.localeOf(document.documentElement) : 'en');

function intl<T>(make: () => T, fallback: () => T): T {
  try { return make(); } catch { return fallback(); }
}

/** The same formatters the components use, so an app's numbers and dates look like theirs. All take an optional `locale`. */
export const Format = {
  /** `1234.5` → `1,234.5`. Not a finite number: an empty string. */
  number(value: unknown, options: { decimals?: number; locale?: string } = {}): string {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return '';
    const locale = langOf(options.locale);
    const d = options.decimals;
    return intl(
      () => new Intl.NumberFormat(locale, d === undefined ? { maximumFractionDigits: 20 } : { minimumFractionDigits: d, maximumFractionDigits: d }).format(n),
      () => String(n)
    );
  },

  /** `1234.5, 'USD'` → `$1,234.50` */
  currency(value: unknown, currency = 'USD', locale?: string): string {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return '';
    return intl(() => new Intl.NumberFormat(langOf(locale), { style: 'currency', currency }).format(n), () => `${currency} ${n.toFixed(2)}`);
  },

  /** `0.256` → `25.6%` (the value is a fraction) */
  percent(value: unknown, decimals = 0, locale?: string): string {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return '';
    return intl(() => new Intl.NumberFormat(langOf(locale), { style: 'percent', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n), () => `${(n * 100).toFixed(decimals)}%`);
  },

  /** `1536` → `1.5 KB` (1024-based) */
  fileSize(bytes: unknown, locale?: string): string {
    let n = Number(bytes);
    if (bytes === null || bytes === undefined || bytes === '' || !Number.isFinite(n) || n < 0) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${Format.number(i === 0 ? n : Math.round(n * 10) / 10, { locale })} ${units[i]}`;
  },

  /** A date in the page's language: `'short'`, `'medium'` (default), `'long'` or `'full'`; with `time` it adds the time. Not a date: an empty string. */
  date(value: unknown, style: 'short' | 'medium' | 'long' | 'full' = 'medium', options: { time?: boolean; locale?: string } = {}): string {
    if (value === null || value === undefined || value === '') return '';
    const d = value instanceof Date ? value : new Date(value as string | number);
    if (Number.isNaN(d.getTime())) return '';
    return intl(
      () => new Intl.DateTimeFormat(langOf(options.locale), options.time ? { dateStyle: style, timeStyle: 'short' } : { dateStyle: style }).format(d),
      () => d.toISOString()
    );
  },

  /** `3 minutes ago`, `in 2 days`: the largest unit that fits */
  relativeTime(value: unknown, now: Date | number = Date.now(), locale?: string): string {
    if (value === null || value === undefined || value === '') return '';
    const then = value instanceof Date ? value.getTime() : new Date(value as string | number).getTime();
    if (Number.isNaN(then)) return '';
    const seconds = Math.round((then - (now instanceof Date ? now.getTime() : now)) / 1000);
    const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
    const [unit, size] = steps.find(([, s]) => Math.abs(seconds) >= s) ?? ['second', 1];
    return intl(() => new Intl.RelativeTimeFormat(langOf(locale), { numeric: 'auto' }).format(Math.round(seconds / size), unit), () => `${Math.round(seconds / size)} ${unit}`);
  },

  /** `3725000` → `1h 2m 5s` (milliseconds; zero parts are left out) */
  duration(ms: unknown): string {
    const n = Math.round(Number(ms));
    if (ms === null || ms === undefined || ms === '' || !Number.isFinite(n) || n < 0) return '';
    if (n < 1000) return `${n}ms`;
    const parts: string[] = [];
    let s = Math.floor(n / 1000);
    for (const [unit, size] of [['d', 86400], ['h', 3600], ['m', 60]] as const) {
      if (s >= size) { parts.push(`${Math.floor(s / size)}${unit}`); s %= size; }
    }
    if (s || !parts.length) parts.push(`${s}s`);
    return parts.join(' ');
  },

  /** Cut text to at most `length` characters, ending in `…` (it never splits a surrogate pair) */
  ellipsis(text: unknown, length: number): string {
    const chars = Array.from(String(text ?? ''));
    return chars.length <= length ? chars.join('') : chars.slice(0, Math.max(0, length - 1)).join('').trimEnd() + '…';
  },

  capitalize(text: unknown): string {
    const s = String(text ?? '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  },

  /** `1, { one: 'item', other: 'items' }` → `item`: the right word for a count in the page's language */
  plural(count: number, forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }, locale?: string): string {
    const category = intl(() => new Intl.PluralRules(langOf(locale)).select(count), () => 'other' as Intl.LDMLPluralRule);
    return forms[category] ?? forms.other;
  },

  /** Make text safe to put in HTML */
  htmlEncode(text: unknown): string {
    return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  },

  /** The opposite of `htmlEncode` for the five characters it writes (nothing else is decoded) */
  htmlDecode(text: unknown): string {
    return String(text ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (_m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e as string]!);
  }
};
