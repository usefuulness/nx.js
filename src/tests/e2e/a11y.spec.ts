/**
 * Accessibility audit (axe-core, WCAG 2.1 A/AA) of the demo: every page in
 * every built-in theme, plus open overlays (dialog, menu, toast) and error states.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const themes = ['light', 'dark', 'midnight'];
const pages = ['/', '/users', '/forms', '/components'];

async function open(page: Page, path: string, theme: string) {
  await page.goto('/');
  await page.evaluate(t => localStorage.setItem('nx-theme', t), theme);
  await page.goto(`/#${path}`);
  await page.reload();
  await page.waitForTimeout(400);
}

async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map(v =>
    `${v.id} (${v.impact}) × ${v.nodes.length}: ${v.help}\n      ${v.nodes.slice(0, 3).map(n => n.target.join(' >>> ')).join('\n      ')}`
  );
  expect(summary, `\n${summary.join('\n')}`).toEqual([]);
}

for (const theme of themes) {
  for (const path of pages) {
    test(`a11y: ${path} (${theme})`, async ({ page }) => {
      await open(page, path, theme);
      await audit(page);
    });
  }

  test(`a11y: dialog with validation errors (${theme})`, async ({ page }) => {
    await open(page, '/users', theme);
    await page.locator('nx-button', { hasText: 'Add user' }).click();
    await page.locator('nx-modal nx-button', { hasText: 'Invite' }).click();
    await page.waitForTimeout(250);
    await audit(page);
  });

  test(`a11y: open menu and toast (${theme})`, async ({ page }) => {
    await open(page, '/components', theme);
    await page.locator('nx-button', { hasText: 'Success' }).click();
    await page.locator('nx-menu[text="Actions"]').click();
    await page.waitForTimeout(250);
    await audit(page);
  });

  test(`a11y: open popover, tooltip and combobox (${theme})`, async ({ page }) => {
    await open(page, '/components', theme);
    await page.getByRole('combobox', { name: 'Framework' }).fill('n');
    await audit(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Add' }).hover();
    await expect(page.getByRole('tooltip', { name: 'Add to library' })).toBeVisible();
    await audit(page);
    await page.getByRole('button', { name: 'Dimensions' }).click();
    await expect(page.getByRole('dialog', { name: 'Dimensions' })).toBeVisible();
    await audit(page);
  });

  test(`a11y: open date picker and command palette (${theme})`, async ({ page }) => {
    await open(page, '/components', theme);
    await page.getByRole('button', { name: /Due date/ }).click();
    await expect(page.getByRole('dialog', { name: 'Choose date' })).toBeVisible();
    await page.waitForTimeout(200);
    await audit(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    await page.waitForTimeout(300); // opening animation (opacity)
    await audit(page);
  });

  test(`a11y: form errors (${theme})`, async ({ page }) => {
    await open(page, '/forms', theme);
    await page.locator('nx-button', { hasText: 'Save changes' }).click();
    await page.waitForTimeout(250);
    await audit(page);
  });
}
