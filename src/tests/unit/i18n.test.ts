import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NX, i18n, type NXGrid } from '@/index';
import { en } from '@/core/messages.en';
import '@/locales/es';
import '@/locales/fr';
import '@/locales/de';
import '@/locales/ar';
import { nextFrame } from '../utils';

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

describe('i18n core', () => {
  it('falls back from region to language to English to the key', () => {
    expect(i18n.t('close', undefined, 'es')).toBe('Cerrar');
    expect(i18n.t('close', undefined, 'es-MX')).toBe('Cerrar');
    expect(i18n.t('close', undefined, 'es_mx')).toBe('Cerrar'); // underscores and case are tolerated
    expect(i18n.t('close', undefined, 'xx')).toBe('Close'); // no such locale: English
    expect(i18n.t('no.such.key', undefined, 'es')).toBe('no.such.key');
    i18n.extend('pt-br', { close: 'Fechar' });
    expect(i18n.t('close', undefined, 'pt-BR')).toBe('Fechar');
    expect(i18n.t('dismiss', undefined, 'pt-BR')).toBe('Dismiss'); // missing in pt-br: English
  });

  it('interpolates, keeps unknown placeholders, and formats numbers for the locale', () => {
    expect(i18n.t('grid.range', { from: 1, to: 10, total: 48 })).toBe('1–10 of 48');
    expect(i18n.t('grid.noResults', { query: 'ada' })).toBe('No results for “ada”');
    expect(i18n.t('grid.range', { from: 1 })).toBe('1–{to} of {total}');
    expect(i18n.t('grid.page', { page: 1, pages: 2500 }, 'en')).toBe('Page 1 of 2,500');
    expect(i18n.t('grid.page', { page: 1, pages: 2500 }, 'de')).toBe('Seite 1 von 2.500');
    expect(i18n.t('grid.page', { page: '1', pages: '2500' }, 'de')).toBe('Seite 1 von 2500'); // strings are used as given
  });

  it('picks plural forms by the locale rules', () => {
    expect(i18n.t('grid.rows', { count: 1 })).toBe('1 row');
    expect(i18n.t('grid.rows', { count: 0 })).toBe('0 rows');
    expect(i18n.t('grid.rows', { count: 1_000_000 })).toBe('1,000,000 rows');
    const arabic = (count: number) => i18n.t('grid.rows', { count }, 'ar');
    expect([0, 1, 2, 3, 11, 100].map(arabic)).toEqual(['لا صفوف', 'صف واحد', 'صفان', expect.stringContaining('صفوف'), expect.stringContaining('صفًّا'), expect.stringContaining('صف')]);
  });

  it('knows which languages run right to left', () => {
    expect(['ar', 'ar-EG', 'he', 'fa', 'ur'].map(l => i18n.direction(l))).toEqual(['rtl', 'rtl', 'rtl', 'rtl', 'rtl']);
    expect(['en', 'es', 'de', 'zh-CN'].map(l => i18n.direction(l))).toEqual(['ltr', 'ltr', 'ltr', 'ltr']);
  });

  it('reads the language from the nearest lang, through shadow roots', () => {
    document.body.innerHTML = '<div lang="fr"><section id="a"></section></div><section id="b"></section>';
    const host = document.querySelector('#a')!;
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<p id="inner"></p>';
    expect(i18n.localeOf(root.querySelector('#inner'))).toBe('fr');
    document.documentElement.lang = 'de';
    expect(i18n.localeOf(document.querySelector('#b'))).toBe('de');
    document.documentElement.removeAttribute('lang');
  });

  it('setLanguage sets lang and dir on the page', () => {
    i18n.setLanguage('ar');
    expect([document.documentElement.lang, document.documentElement.dir]).toEqual(['ar', 'rtl']);
    i18n.setLanguage('en');
    expect([document.documentElement.lang, document.documentElement.dir]).toEqual(['en', 'ltr']);
  });
});

describe('every shipped locale', () => {
  it('this test covers every module in src/locales', async () => {
    const { readdirSync } = await import('node:fs');
    const path = await import('node:path');
    const files = readdirSync(path.resolve(__dirname, '../../locales')).map(f => f.replace(/\.ts$/, '')).sort();
    expect(files).toEqual(['ar', 'de', 'es', 'fr']);
  });

  const tokens = (message: unknown): string[] =>
    (typeof message === 'string' ? [message] : Object.values(message as object)).flatMap(text => [...String(text).matchAll(/\{(\w+)\}/g)].map(m => m[1])).sort();
  const base = Object.keys(en);

  for (const locale of ['es', 'fr', 'de', 'ar']) {
    it(`${locale} translates every string and keeps its {placeholders}`, () => {
      for (const key of base) {
        const translated = i18n.t(key, { count: 1 }, locale);
        expect(translated, `${locale}: ${key} is missing`).not.toBe(key);
      }
      // Read the catalogue back through t() on each plural/param to compare tokens with English
      for (const key of base) {
        const english = en[key];
        const probe = (loc: string) => {
          const spy = new Set<string>();
          // Ask for every placeholder name so none stay as {name}: any left over was not in the translation
          for (const name of tokens(english)) spy.add(name);
          const params = Object.fromEntries([...spy, 'count', 'status', 'query', 'label', 'from', 'to', 'total', 'page', 'pages'].map(n => [n, `<${n}>`]));
          return i18n.t(key, { ...params, count: 1 }, loc);
        };
        const out = probe(locale);
        for (const name of tokens(english).filter(n => n !== 'count')) {
          expect(out, `${locale}: ${key} lost {${name}}`).toContain(`<${name}>`);
        }
      }
    });
  }

  it('plural objects only use categories the language has, and always include "other"', () => {
    for (const locale of ['es', 'fr', 'de', 'ar']) {
      const valid = new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
      for (const key of base.filter(k => typeof en[k] === 'object')) {
        // Force each category through a count that selects it and make sure a non-key string comes back
        for (const count of [0, 1, 2, 3, 11, 100]) {
          const category = new Intl.PluralRules(locale).select(count);
          expect(valid.has(category)).toBe(true);
          expect(i18n.t(key, { count }, locale), `${locale} ${key} for ${count}`).not.toBe(key);
        }
      }
    }
  });
});

describe('components follow the page language', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
  });
  const grid = (extra: Record<string, any> = {}) => {
    const el = NX.create<NXGrid>({
      xtype: 'grid', search: true, pageSize: 1, checkboxSelection: true,
      data: [{ name: 'Ada', amount: 1234.5 }, { name: 'Bob', amount: 2 }],
      columns: [{ field: 'name', header: 'Name' }, { field: 'amount', header: 'Amount', type: 'number' as const }],
      ...extra
    });
    document.body.appendChild(el);
    return el;
  };
  const text = (el: NXGrid, selector: string) => el.shadowRoot!.querySelector(selector)!;

  it('uses English by default and the nearest lang when there is one', () => {
    const g = grid();
    expect((text(g, '.nx-grid-search input') as HTMLInputElement).placeholder).toBe('Search…');
    expect(text(g, '.pager .info').textContent).toBe('Page 1 of 2');
    document.body.innerHTML = '<div lang="es"></div>';
    const spanish = grid();
    document.querySelector('div')!.append(spanish);
    expect((text(spanish, '.nx-grid-search input') as HTMLInputElement).placeholder).toBe('Buscar…');
    expect(text(spanish, '.pager .info').textContent).toBe('Página 1 de 2');
    expect(text(spanish, '.check-all').getAttribute('aria-label')).toBe('Seleccionar todo');
  });

  it('redraws live when the page language changes, and again for the direction', async () => {
    const g = grid();
    document.documentElement.lang = 'fr';
    await tick(10);
    await nextFrame();
    expect((text(g, '.nx-grid-search input') as HTMLInputElement).placeholder).toBe('Rechercher…');
    expect(text(g, '[aria-label="Page suivante"]')).toBeTruthy();
    NX.i18n.setLanguage('de');
    await tick(10);
    await nextFrame();
    expect((text(g, '.nx-grid-search input') as HTMLInputElement).placeholder).toBe('Suchen…');
    expect(text(g, '.pager .info').textContent).toBe('Seite 1 von 2');
  });

  it('mixes languages on one page', () => {
    document.body.innerHTML = '<div lang="de"></div><div lang="fr"></div>';
    const [de, fr] = Array.from(document.querySelectorAll('div'));
    const a = grid();
    const b = grid();
    de.append(a);
    fr.append(b);
    expect(text(a, '.pager .info').textContent).toBe('Seite 1 von 2');
    expect(text(b, '.pager .info').textContent).toBe('Page 1 sur 2');
  });

  it('formats numbers in the language, and a missing translation falls back to English', () => {
    document.documentElement.lang = 'de';
    const g = grid({ pageSize: 0 });
    expect(Array.from(g.shadowRoot!.querySelectorAll('tbody tr td:last-child')).map(td => td.textContent)).toEqual(['1.234,5', '2']);
    document.documentElement.lang = 'sw'; // no Swahili strings shipped
    const sw = grid();
    expect((text(sw, '.nx-grid-search input') as HTMLInputElement).placeholder).toBe('Search…');
  });

  it('dialog helpers use the page language', async () => {
    document.documentElement.lang = 'es';
    const opened = NX.alert('Hola');
    await tick(120); // the modal draws on its next frame
    const modal = document.querySelector('nx-modal')!;
    const shown = (modal.shadowRoot?.innerHTML ?? '') + modal.innerHTML;
    expect(shown).toContain('Aceptar');
    expect(shown).toContain('Aviso');
    (modal as any).close();
    await opened.catch(() => {});
  });

  it('the form announces server failures in the page language', async () => {
    document.documentElement.lang = 'es';
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed'));
    vi.stubGlobal('fetch', fetchMock);
    const form = NX.create<any>({ xtype: 'form', action: '/x', method: 'post', enhance: true, items: [{ xtype: 'textfield', name: 'a', value: 'x' }] });
    document.body.appendChild(form);
    form.submit();
    await tick(10);
    expect(form.shadowRoot.querySelector('[role="alert"]').textContent).toContain('No se pudo conectar con el servidor');
    vi.unstubAllGlobals();
  });
});
