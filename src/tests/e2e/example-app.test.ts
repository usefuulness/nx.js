import { test, expect } from '@playwright/test';

test.describe('Example App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the application', async ({ page }) => {
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('nx-viewport')).toBeVisible();
  });

  test('should navigate between routes', async ({ page }) => {
    // Click navigation link
    await page.click('a[href="#/about"]');
    await expect(page.url()).toContain('#/about');
    
    // Go back
    await page.goBack();
    await expect(page.url()).not.toContain('#/about');
  });

  test('should open and close drawer', async ({ page }) => {
    const drawer = page.locator('nx-drawer');
    const menuButton = page.locator('button[aria-label="Menu"]');
    
    // Initially closed
    await expect(drawer).not.toHaveAttribute('open');
    
    // Open drawer
    await menuButton.click();
    await expect(drawer).toHaveAttribute('open');
    
    // Close drawer
    await page.locator('.nx-drawer-close').click();
    await expect(drawer).not.toHaveAttribute('open');
  });

  test('should show modal dialog', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).NX.app.modal({
        title: 'Test Modal',
        content: 'This is a test modal'
      });
    });
    
    const modal = page.locator('nx-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Test Modal');
    
    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('should handle form submission', async ({ page }) => {
    // Fill form
    await page.fill('nx-textfield[name="username"]', 'testuser');
    await page.fill('nx-textfield[name="email"]', 'test@example.com');
    
    // Submit
    await page.click('nx-button[type="submit"]');
    
    // Check for success message
    await expect(page.locator('nx-toast')).toContainText('Success');
  });

  test('should load and display data', async ({ page }) => {
    // Wait for data to load
    await page.waitForSelector('nx-data-table');
    
    // Check if data is displayed
    const rows = page.locator('nx-data-table tbody tr');
    await expect(rows).toHaveCount(10); // Assuming 10 items per page
    
    // Sort by column
    await page.click('th[data-field="name"]');
    await expect(rows.first()).toContainText('A'); // Assuming alphabetical sort
  });

  test('should toggle theme', async ({ page }) => {
    const root = page.locator(':root');
    
    // Check initial theme
    await expect(root).toHaveAttribute('data-theme', 'light');
    
    // Toggle theme
    await page.click('button[aria-label="Toggle theme"]');
    await expect(root).toHaveAttribute('data-theme', 'dark');
  });
});
