// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { renderToString, renderDocument, renderHTML } from '@/ssr';
import { DataGrid } from '@/index';
import '@/locales/es';
import '@/locales/ar';

const grid = () => (
  <DataGrid search pageSize={1} data={[{ n: 'a' }, { n: 'b' }]} columns={[{ field: 'n', header: 'N' }]} />
);

describe('server rendering in a language', () => {
  it('renders built-in strings in the requested language, English by default', async () => {
    expect(await renderToString(grid())).toContain('Search…');
    const spanish = await renderToString(grid(), { lang: 'es' });
    expect(spanish).toContain('Buscar…');
    expect(spanish).toContain('Página 1 de 2');
    expect(spanish).not.toContain('Search…');
  });

  it('concurrent renders in different languages do not bleed into each other', async () => {
    const results = await Promise.all([
      renderToString(grid(), { lang: 'es' }),
      renderToString(grid(), { lang: 'en' }),
      renderToString(grid(), { lang: 'ar' }),
      renderToString(grid(), { lang: 'es' })
    ]);
    expect(results[0]).toContain('Buscar…');
    expect(results[1]).toContain('Search…');
    expect(results[2]).toContain('بحث…');
    expect(results[3]).toContain('Buscar…');
    expect([results[0], results[1], results[2], results[3]].map(r => /Buscar…|Search…|بحث…/g.exec(r)?.[0]).join('|')).toBe('Buscar…|Search…|بحث…|Buscar…');
  });

  it('renderDocument writes lang and, for right-to-left languages, dir', async () => {
    const html = await renderDocument(grid(), { lang: 'ar', title: 'x' });
    expect(html).toContain('<html lang="ar" dir="rtl"');
    expect(html).toContain('بحث…');
    expect(await renderDocument(grid(), { lang: 'es' })).toMatch(/<html lang="es">/);
  });

  it('renderHTML takes a full document\'s own lang', async () => {
    const out = await renderHTML('<!doctype html><html lang="es"><head></head><body><nx-grid search></nx-grid></body></html>');
    expect(out).toContain('Buscar…');
    const fragment = await renderHTML('<nx-grid search></nx-grid>', { lang: 'es' });
    expect(fragment).toContain('Buscar…');
  });
});
