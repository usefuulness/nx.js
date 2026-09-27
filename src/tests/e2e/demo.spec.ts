import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('renders the dashboard', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('nx-viewport')).toBeVisible();
  await expect(page.getByText('Everything at a glance.')).toBeVisible();
});

test('navigates with the sidebar tree', async ({ page }) => {
  await page.goto('/#/');
  await page.locator('nx-tree .nx-tree-node-content', { hasText: 'Users' }).first().click();
  await expect(page).toHaveURL(/#\/users$/);
  await expect(page.locator('#users-grid tbody tr')).toHaveCount(10);
});

test('grid search keeps focus while typing', async ({ page }) => {
  await page.goto('/#/users');
  const search = page.locator('#users-grid .nx-grid-search input');
  await search.click();
  await page.keyboard.type('ada');
  await expect(search).toBeFocused();
  await expect(page.locator('#users-grid tbody tr')).toHaveCount(3);
});

test('add user dialog validates and adds a row', async ({ page }) => {
  await page.goto('/#/users');
  await page.locator('nx-button', { hasText: 'Add user' }).click();
  await page.locator('nx-modal nx-button', { hasText: 'Invite' }).click();
  await expect(page.locator('nx-modal').getByText('Please fill out this field.').first()).toBeVisible();

  await page.locator('nx-modal nx-textfield[name=name] input').fill('Test Person');
  await page.locator('nx-modal nx-textfield[name=email] input').fill('test@example.com');
  await page.locator('nx-modal nx-button', { hasText: 'Invite' }).click();
  await expect(page.locator('nx-modal')).toHaveCount(0);
  await expect(page.locator('nx-toast')).toContainText('Invited Test Person');
});

test('theme toggle switches and persists', async ({ page }) => {
  await page.goto('/#/');
  const before = await page.locator('html').getAttribute('data-theme');
  await page.locator('#theme-toggle').click();
  const after = await page.locator('html').getAttribute('data-theme');
  expect(after).not.toBe(before);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', after!);
});
