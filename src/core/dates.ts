/**
 * @file @/core/dates.ts
 * Plain calendar dates (no time zones), shared by the date picker and the calendar.
 */

export const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

/** Same day in another month, clamped to that month's length (Jan 31 + 1 month → Feb 28). */
export function addMonths(d: Date, months: number): Date {
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

export function localeFirstDay(locale: string): number {
  try {
    const info = (new Intl.Locale(locale) as any);
    const week = typeof info.getWeekInfo === 'function' ? info.getWeekInfo() : info.weekInfo;
    if (week?.firstDay) return week.firstDay % 7;
  } catch {
    // older engines
  }
  return /-(US|CA|JP|BR|MX|IL|KR|TW|PH|IN)$/i.test(locale) || locale === 'en' ? 0 : 1;
}

