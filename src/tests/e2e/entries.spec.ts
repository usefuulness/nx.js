import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Playwright runs from the repository root
const dist = path.resolve('dist');
const origin = 'http://nx.test';

// Loads the *built* package the way a consumer would. It needs `pnpm build` first (CI does that).
test.describe('built per-component entry points', () => {
  test.skip(!existsSync(path.join(dist, 'entries/badge.js')), 'run `pnpm build` first');

  test.beforeEach(async ({ page }) => {
    // A blank page on a made-up origin (the demo app would register every component), serving
    // dist/ at /__dist/ so modules are imported exactly as published
    await page.route(`${origin}/**`, async route => {
      const { pathname } = new URL(route.request().url());
      if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>blank</title><body></body>' });
      const file = path.join(dist, pathname.replace('/__dist/', ''));
      if (!pathname.startsWith('/__dist/') || !existsSync(file)) return route.fulfill({ status: 404 });
      await route.fulfill({ contentType: 'text/javascript', body: readFileSync(file) });
    });
    await page.goto(`${origin}/`);
  });

  test('importing one component registers only that component, and it renders', async ({ page }) => {
    const result = await page.evaluate(async () => {
      document.body.innerHTML = '<nx-badge tone="success">New</nx-badge><nx-button>Not loaded</nx-button>';
      const before = customElements.get('nx-badge');
      const entry = '/__dist/entries/badge.js';
      await import(/* @vite-ignore */ entry);
      await new Promise(resolve => setTimeout(resolve, 50));
      const badge = document.querySelector('nx-badge')!;
      return {
        before: !!before,
        badge: !!customElements.get('nx-badge'),
        button: !!customElements.get('nx-button'),
        grid: !!customElements.get('nx-grid'),
        rendered: !!badge.shadowRoot?.textContent || !!badge.shadowRoot?.querySelector('slot')
      };
    });
    expect(result).toEqual({ before: false, badge: true, button: false, grid: false, rendered: true });
  });

  test('two entries share one runtime: a form and a button work together', async ({ page }) => {
    const result = await page.evaluate(async () => {
      for (const entry of ['/__dist/entries/form.js', '/__dist/entries/button.js', '/__dist/entries/textfield.js']) {
        await import(/* @vite-ignore */ entry);
      }
      document.body.innerHTML = '<nx-form><nx-input name="q" value="hi"></nx-input></nx-form>';
      await new Promise(resolve => setTimeout(resolve, 50));
      const form = document.querySelector('nx-form') as any;
      return { values: form.getValues(), grid: !!customElements.get('nx-grid'), tooltip: !!customElements.get('nx-tooltip') };
    });
    expect(result.values).toEqual({ q: 'hi' });
    expect(result.grid).toBe(false);
  });
});
