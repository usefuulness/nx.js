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

  await page.locator('nx-modal [name=name] input').fill('Test Person');
  await page.locator('nx-modal [name=email] input').fill('test@example.com');
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

test('menus inside a modal dialog are usable (not inert)', async ({ page }) => {
  await page.goto('/#/components');
  await page.evaluate(() => {
    (window as any).picked = null;
    (window as any).NX.dialog({
      title: 'Dialog with a menu',
      items: [{ xtype: 'menu', text: 'Choose', id: 'm-in-dialog', items: [{ text: 'Pick me', handler: () => ((window as any).picked = 'yes') }] }],
      buttons: [{ text: 'Close' }]
    });
  });
  await page.locator('#m-in-dialog').click();
  await page.getByRole('menuitem', { name: 'Pick me' }).click();
  expect(await page.evaluate(() => (window as any).picked)).toBe('yes');
});

test.describe('floating UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/components');
    await page.waitForFunction(() => !!customElements.get('nx-popover'));
  });

  test('popover opens, moves focus in, and closes with Escape, outside click or the trigger', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Dimensions' });
    const panel = page.getByRole('dialog', { name: 'Dimensions' });

    await trigger.click();
    await expect(panel).toBeVisible();
    await expect(page.locator('nx-popover nx-button')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Width')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(panel).toBeVisible();
    await trigger.click(); // the trigger toggles; light dismiss must not reopen it
    await expect(panel).toBeHidden();

    await trigger.click();
    await page.mouse.click(5, 5);
    await expect(panel).toBeHidden();
  });

  test('tooltip shows on hover and keyboard focus, hides with Escape', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Add', exact: true });
    const tooltip = page.getByRole('tooltip', { name: 'Add to library' });

    await button.hover();
    await expect(tooltip).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(tooltip).toBeHidden();

    await page.getByRole('button', { name: 'Dimensions' }).focus();
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    // Described by the tooltip for assistive tech
    await expect(page.locator('nx-tooltip nx-button').first()).toHaveAttribute('aria-describedby', /nx-tooltip-/);
  });

  test('combobox filters and picks with the keyboard', async ({ page }) => {
    const box = page.getByRole('combobox', { name: 'Framework' });
    await box.fill('re');
    await expect(page.getByRole('option')).toHaveText(['Remix']);
    await box.press('Enter');
    await expect(box).toHaveValue('Remix');
    await expect(box).toHaveAttribute('aria-expanded', 'false');

    await box.press('ArrowDown');
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.getByRole('option', { name: 'Remix' })).toHaveAttribute('aria-selected', 'true');
    await box.press('Escape');
    await expect(page.getByRole('listbox')).toBeHidden();
  });
});
