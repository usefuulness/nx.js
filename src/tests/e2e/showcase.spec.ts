/**
 * The showcase's live data demos in a real browser: the page is built once, then served as static files,
 * and each demo talks to the small server that lives in the page.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve('examples/showcase/dist');
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

test.beforeAll(() => {
  execFileSync('npx', ['tsx', 'examples/showcase/build.tsx'], { stdio: 'pipe' });
});

/** Serve examples/showcase/dist under /showcase/ (the host page wraps the rendered content in <html>) */
async function open(page: Page, scheme: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.route('**/showcase/**', route => {
    const rel = new URL(route.request().url()).pathname.replace(/^.*\/showcase\//, '') || 'index.html';
    const file = path.join(dist, rel);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
    if (rel === 'index.html') {
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${readFileSync(file, 'utf8')}</body></html>`;
      return route.fulfill({ body: html, contentType: 'text/html' });
    }
    route.fulfill({ body: readFileSync(file), contentType: types[path.extname(file)] ?? 'text/plain' });
  });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => m.type() === 'error' && !/favicon|fonts\.g/.test(m.location().url) && errors.push(m.text()));
  await page.goto('/showcase/index.html');
  await page.waitForFunction(() => !!customElements.get('nx-grid') && document.getElementById('oa-read'));
  await page.locator('#data').scrollIntoViewIfNeeded();
  return errors;
}

const rows = (page: Page, id: string) => page.locator(`#${id}`).locator('tbody tr');
const log = (page: Page, id: string) => page.locator(`#${id} li`);

test.describe('OpenAPI demo', () => {
  test('reads the document, then sorts, searches, pages and saves through the server', async ({ page }) => {
    const errors = await open(page);
    await expect(rows(page, 'oa-grid')).toHaveCount(1);
    await expect(rows(page, 'oa-grid')).toContainText('Nothing loaded yet');
    await page.locator('#oa-read').click();
    await expect(rows(page, 'oa-grid')).toHaveCount(8);
    await expect(page.locator('#oa-status')).toContainText('Read 5 operations and 1 resource');
    await expect(page.locator('#oa-ops .sc-chip')).toHaveCount(5);
    await expect(log(page, 'oa-log').filter({ hasText: '/openapi.json' })).toHaveCount(1);
    await expect(log(page, 'oa-log').filter({ hasText: 'limit=8' }).first()).toContainText('GET');

    // Sorting and searching are the server's job: look at what was sent
    await page.locator('#oa-grid').getByRole('button', { name: 'Age' }).click();
    await expect(log(page, 'oa-log').filter({ hasText: 'sort=age' }).first()).toBeVisible();
    const ages = await rows(page, 'oa-grid').evaluateAll(trs => trs.map(tr => Number((tr.querySelectorAll('td')[3] as HTMLElement).textContent)));
    expect(ages).toEqual([...ages].sort((a, b) => a - b));
    await page.locator('#oa-grid').locator('.nx-grid-search input').fill('rex');
    await expect(log(page, 'oa-log').filter({ hasText: 'q=rex' }).first()).toBeVisible();
    await expect(rows(page, 'oa-grid').first()).toContainText('Rex');

    // Paging: the pager asks for the next offset
    await page.locator('#oa-grid').locator('.nx-grid-search input').fill('');
    await expect(rows(page, 'oa-grid')).toHaveCount(8);
    await page.locator('#oa-pager').getByRole('button', { name: /next/i }).click();
    await expect(log(page, 'oa-log').filter({ hasText: 'offset=8' }).first()).toBeVisible();

    // An operation can be called from its chip
    await page.locator('#oa-ops .sc-chip', { hasText: 'listPets' }).click();
    await expect(page.locator('#oa-result')).toContainText('"items"');

    // The form checks the document's rules as you type, and the server checks again
    const add = page.locator('#oa-add');
    await page.locator('#oa-name').getByRole('textbox').fill('X');
    await expect(page.locator('#oa-name')).toHaveAttribute('error-text', 'Use at least 2 characters');
    await expect(add).toHaveAttribute('disabled', '');
    await page.locator('#oa-name').getByRole('textbox').fill('Zeta');
    await expect(add).not.toHaveAttribute('disabled', /.*/);
    await add.click();
    await expect(log(page, 'oa-log').filter({ hasText: 'POST' }).first()).toContainText('201');
    await expect(page.getByText('Saved as pet #49')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('HAL demo', () => {
  test('finds its stores by following links, pages with the template, and follows a record\'s own links', async ({ page }) => {
    const errors = await open(page);
    await page.locator('#hal-start').click();
    await expect(rows(page, 'hal-grid')).toHaveCount(6);
    await expect(page.locator('#hal-rels .sc-chip')).toHaveText(['books', 'authors']);
    await expect(log(page, 'hal-log').filter({ hasText: 'page=0&size=6' }).first()).toBeVisible(); // the template's variables, filled in
    await page.locator('#hal-pager').getByRole('button', { name: /next/i }).click();
    await expect(log(page, 'hal-log').filter({ hasText: 'page=1&size=6' }).first()).toBeVisible();

    await rows(page, 'hal-grid').first().click();
    await expect(page.locator('#hal-trail')).toContainText('book');
    await expect(page.locator('#hal-detail')).toContainText('"title"');
    await page.locator('#hal-links .sc-chip', { hasText: 'author' }).click();
    await expect(page.locator('#hal-detail')).toContainText('"name"');
    await expect(page.locator('#hal-trail')).toContainText('author');
    expect(errors).toEqual([]);
  });
});

test.describe('view model demo', () => {
  test('every figure, chart and row follows the filters', async ({ page }) => {
    const errors = await open(page);
    const count = page.locator('#dash-count');
    await expect(count).toHaveText('72');
    await expect(page.locator('#dash-revenue')).toHaveText(/^\$[\d,]+$/);
    await expect(page.locator('#dash-state')).toContainText('"region": "all"');
    await page.locator('#dash-region').getByText('EU', { exact: true }).click();
    await expect(page.locator('#dash-state')).toContainText('"region": "eu"');
    await expect(count).toHaveText('24');
    await page.locator('#dash-query').getByRole('textbox').fill('cloud');
    await expect(count).not.toHaveText('24');
    const filtered = Number(await count.textContent());
    expect(filtered).toBeGreaterThan(0);
    await expect(page.locator('#dash-top')).toHaveText('Cloud suite');
    await expect(page.locator('#dash-split').locator('svg path.slice')).toHaveCount(1); // only one region is left
    await page.locator('#dash-query').getByRole('textbox').fill('');
    await page.locator('#dash-region').getByText('All', { exact: true }).click();
    await expect(count).toHaveText('72');
    await expect(page.locator('#dash-split').locator('svg path.slice')).toHaveCount(3);
    expect(errors).toEqual([]);
  });
});

test.describe('tree store demo', () => {
  test('folders load when first opened, and a search keeps the way to each match', async ({ page }) => {
    const errors = await open(page);
    const tree = page.locator('#tree-view');
    await expect(tree.getByText('report.pdf')).toBeVisible();
    await expect(tree.getByText('beach.jpg')).toHaveCount(0);
    await tree.getByText('Pictures', { exact: true }).click();
    await expect(log(page, 'tree-log').filter({ hasText: 'node=pictures' }).first()).toContainText('200');
    await expect(tree.getByText('Holiday', { exact: true })).toBeVisible();
    await page.locator('#tree-expand').click();
    await expect(tree.getByText('beach.jpg')).toBeVisible();
    await page.locator('#tree-collapse').click();
    await expect(tree.getByText('beach.jpg')).toHaveCount(0);
    await page.locator('#tree-query').getByRole('textbox').fill('jpg');
    await expect(tree.getByText('beach.jpg')).toBeVisible();        // the way down is open for the match…
    await expect(tree.getByText('Holiday', { exact: true })).toBeVisible();
    await expect(tree.getByText('report.pdf')).toHaveCount(0);      // …and the rest is out of the way
    await page.locator('#tree-query').getByRole('textbox').fill('');
    await expect(tree.getByText('beach.jpg')).toHaveCount(0);       // the search left nothing open for good
    expect(errors).toEqual([]);
  });
});

test.describe('the data section is accessible', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`axe finds nothing in the demos once they have run (${scheme})`, async ({ page }) => {
      await open(page, scheme);
      await page.locator('#oa-read').click();
      await page.locator('#hal-start').click();
      await expect(rows(page, 'oa-grid')).toHaveCount(8);
      await expect(rows(page, 'hal-grid')).toHaveCount(6);
      await page.locator('#tree-view').getByText('Music', { exact: true }).click();
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
      const results = await new AxeBuilder({ page }).include('#data').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const summary = results.violations.map(v => `${v.id} × ${v.nodes.length}: ${v.nodes.slice(0, 3).map(n => n.target.join(' >>> ')).join(', ')}`);
      expect(summary, summary.join('\n')).toEqual([]);
    });
  }
});
