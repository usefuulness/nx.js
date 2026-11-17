/**
 * @file @/core/i18n.ts
 *
 * Built-in strings and their translations. A component reads the language from the DOM, like
 * HTML does: the nearest `lang` attribute above it (across shadow roots), then the browser's.
 * That keeps server rendering right when requests use different languages, and lets one page mix
 * languages. English is always there; other locales are opt-in modules that call `extend()`:
 *
 * ```ts
 * import 'nx.js/locales/es';           // adds Spanish
 * document.documentElement.lang = 'es';
 * ```
 *
 * DOM-free at load; the DOM is only touched when a language is looked up.
 */
import { en } from '@/core/messages.en';

/** A string, or one string per plural category (`one`, `other`, `few`…) chosen by `{count}` */
export type Message = string | Partial<Record<Intl.LDMLPluralRule, string>>;
export type Messages = Record<string, Message>;

const catalogs = new Map<string, Messages>([['en', en]]);

/** Languages written right to left (the base language of a tag such as `ar-EG`) */
const RTL = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'dv', 'ku', 'ug']);

const normalize = (locale: string): string => locale.trim().toLowerCase().replace(/_/g, '-');

/** `es-MX` → `es-mx`, `es`, then English */
function chain(locale: string): string[] {
  const tag = normalize(locale);
  const parts = tag.split('-');
  const out: string[] = [];
  for (let n = parts.length; n > 0; n--) out.push(parts.slice(0, n).join('-'));
  if (!out.includes('en')) out.push('en');
  return out;
}

/** `{name}` becomes the parameter; numbers are formatted for the locale (1,000 · 1.000 · ١٬٠٠٠), strings are used as given. */
function interpolate(text: string, params: Record<string, unknown> | undefined, locale: string): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name) => {
    if (!(name in params)) return whole;
    const value = params[name];
    if (typeof value !== 'number') return String(value);
    try {
      return new Intl.NumberFormat(locale).format(value);
    } catch {
      return String(value);
    }
  });
}

export const i18n = {
  /** Add or override strings for a locale (`es`, `pt-br`). Later calls win. */
  extend(locale: string, messages: Messages): void {
    const key = normalize(locale);
    catalogs.set(key, { ...catalogs.get(key), ...messages });
  },

  /** Whether strings were added for this exact locale or its base language. */
  has(locale: string): boolean {
    return chain(locale).some(tag => tag !== 'en' && catalogs.has(tag)) || normalize(locale).split('-')[0] === 'en';
  },

  /** The text for `key` in `locale`, falling back region → language → English → the key itself. */
  t(key: string, params?: Record<string, unknown>, locale = 'en'): string {
    for (const tag of chain(locale)) {
      let message = catalogs.get(tag)?.[key];
      if (message === undefined) continue;
      if (typeof message === 'object') {
        let category: Intl.LDMLPluralRule = 'other';
        try {
          category = new Intl.PluralRules(tag).select(Number(params?.count ?? 0));
        } catch {
          // An unknown tag for Intl: use the generic form
        }
        message = message[category] ?? message.other ?? Object.values(message)[0] ?? key;
      }
      return interpolate(message, params, tag);
    }
    return key;
  },

  /** `rtl` for Arabic, Hebrew, Persian, Urdu…, else `ltr`. */
  direction(locale: string): 'ltr' | 'rtl' {
    return RTL.has(normalize(locale).split('-')[0]) ? 'rtl' : 'ltr';
  },

  /** The language an element is in: its nearest `lang` (through shadow roots), else the browser's. */
  localeOf(node: Node | null): string {
    for (let n: Node | null = node; n; n = n.parentNode ?? (n as ShadowRoot).host ?? null) {
      const lang = (n as Element).getAttribute?.('lang');
      if (lang) return lang;
    }
    return (typeof navigator !== 'undefined' && navigator.language) || 'en';
  },

  /**
   * Switch the whole page: sets `lang` and `dir` on the root element, so every component
   * redraws in that language and layout direction.
   */
  setLanguage(locale: string, root: HTMLElement = document.documentElement): void {
    root.setAttribute('lang', locale);
    root.setAttribute('dir', i18n.direction(locale));
  }
};
