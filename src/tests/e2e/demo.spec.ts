import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
    const list = page.getByRole('listbox', { name: 'Framework' });
    // Any scroll closes an open list, and a scroll event fires a frame after the scroll itself:
    // scroll the field into view and let that event pass before the list opens
    await box.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await box.fill('re');
    await expect(list.getByRole('option')).toHaveText(['Remix']);
    await box.press('Enter');
    await expect(box).toHaveValue('Remix');
    await expect(box).toHaveAttribute('aria-expanded', 'false');

    await box.press('ArrowDown');
    await expect(list).toBeVisible();
    await expect(list.getByRole('option', { name: 'Remix' })).toHaveAttribute('aria-selected', 'true');
    await box.press('Escape');
    await expect(list).toBeHidden();
  });
});

test.describe('more components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/components');
    await page.waitForFunction(() => !!customElements.get('nx-command'));
  });

  test('button tooltips are real tooltips that describe the button', async ({ page }) => {
    await page.goto('/#/');
    const toggle = page.getByRole('button', { name: 'Toggle theme' });
    await toggle.hover();
    await expect(page.getByRole('tooltip', { name: 'Toggle theme' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip', { name: 'Toggle theme' })).toBeHidden();
  });

  test('slider moves with the keyboard and shows its value', async ({ page }) => {
    const slider = page.getByRole('slider', { name: 'Opacity' });
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('72');
    await expect(slider).toHaveAttribute('aria-valuetext', '72%');
    await page.keyboard.press('End');
    await expect(page.locator('nx-slider[name=demo-slider]')).toContainText('100%');
  });

  test('date picker: calendar grid keyboard, picking, and the form value', async ({ page }) => {
    const trigger = page.getByRole('button', { name: /Due date/ });
    await expect(trigger).toContainText('Jun 15, 2025');
    await trigger.click();
    const calendar = page.getByRole('dialog', { name: 'Choose date' });
    await expect(calendar).toBeVisible();
    await expect(calendar.getByRole('grid', { name: 'June 2025' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sunday, June 15, 2025' })).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('PageDown');
    await expect(calendar.getByRole('grid', { name: 'July 2025' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Wednesday, July 16, 2025' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(calendar).toBeHidden();
    await expect(trigger).toContainText('Jul 16, 2025');
    await expect(trigger).toBeFocused();
    expect(await page.locator('nx-datepicker[name=demo-date]').evaluate(el => (el as any).value)).toBe('2025-07-16');
  });

  test('date picker respects max and reports it in a form', async ({ page }) => {
    await page.goto('/#/forms');
    await page.waitForFunction(() => !!customElements.get('nx-datepicker'));
    const picker = page.locator('nx-datepicker[name=birthday]');
    await picker.evaluate(el => ((el as any).value = '2024-05-01'));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(picker).toContainText('Choose Dec 31, 2020 or earlier.');
  });

  test('command palette opens with the shortcut, filters and runs', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    const search = page.locator('nx-modal').getByRole('combobox');
    await expect(search).toBeFocused();
    await search.fill('pref');
    await expect(page.locator('nx-modal').getByRole('option')).toHaveText(['Settings']);
    await page.keyboard.press('Enter');
    await expect(palette).toBeHidden();
    await expect(page).toHaveURL(/#\/forms$/);
  });

  test('avatar falls back to initials when the image fails; alerts dismiss', async ({ page }) => {
    const broken = page.getByRole('img', { name: 'Grace Hopper' });
    await expect(broken).toContainText('GH');
    await expect(broken.locator('img')).toHaveCount(0);

    const alert = page.locator('nx-alert', { hasText: 'Heads up!' });
    await alert.getByRole('button', { name: 'Dismiss' }).click();
    await expect(alert).toHaveCount(0);
  });
});

test('virtual grid renders a window of 20,000 rows and scrolls to the end', async ({ page }) => {
  await page.goto('/#/');
  const rows = page.locator('#events-grid tbody tr:not(.spacer)');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeLessThan(60);
  await page.locator('#events-grid .nx-grid-body').evaluate(el => (el.scrollTop = el.scrollHeight));
  await expect(page.locator('#events-grid tbody tr', { hasText: '20,000' }).first()).toBeVisible();
  expect(await rows.count()).toBeLessThan(60);
});

test('grid columns resize with the pointer and the keyboard, and the width is remembered', async ({ page }) => {
  await page.goto('/#/users');
  const handle = page.locator('#users-grid th[data-field="email"] .resize-handle');
  const th = page.locator('#users-grid th[data-field="email"]');
  const before = (await th.boundingBox())!.width;
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  const after = (await th.boundingBox())!.width;
  expect(after).toBeGreaterThan(before + 60);

  await handle.focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(handle).toBeFocused();
  expect((await th.boundingBox())!.width).toBeLessThan(after - 40);

  const saved = await page.evaluate(() => localStorage.getItem('nx-grid:users-grid'));
  expect(JSON.parse(saved!).widths.email).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('#users-grid th[data-field="email"]')).toBeVisible();
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('nx-grid:users-grid')))!).widths.email).toBeGreaterThan(0);
});

test('grid columns reorder with Alt+Arrow and a pinned column stays put while scrolling sideways', async ({ page }) => {
  await page.goto('/#/users');
  const order = () => page.locator('#users-grid thead th[data-field]').evaluateAll(ths => ths.map(th => (th as HTMLElement).dataset.field));
  expect((await order())[0]).toBe('name');
  await page.locator('#users-grid th[data-field="name"] .sort-btn').focus();
  await page.keyboard.press('Alt+ArrowRight');
  expect((await order())[1]).toBe('name');

  await page.goto('/#/');
  const pinned = page.locator('#events-grid th[data-field="id"]');
  await expect(pinned).toBeVisible();
  const x = (await pinned.boundingBox())!.x;
  await page.locator('#events-grid .nx-grid-body').evaluate(el => (el.scrollLeft = 50));
  expect(Math.abs((await pinned.boundingBox())!.x - x)).toBeLessThan(1);
});

test('grid cells edit from the keyboard: Enter, type, Enter saves; Escape cancels; errors are announced', async ({ page }) => {
  await page.goto('/#/');
  const cell = (pos: number, col: number) => page.locator(`#events-grid td[data-pos="${pos}"][data-col="${col}"]`);
  await cell(0, 1).focus();
  await page.keyboard.press('Enter');
  const editor = page.locator('#events-grid .cell-editor');
  await expect(editor).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('gateway');
  await page.keyboard.press('Enter');
  await expect(cell(0, 1)).toHaveText('gateway');
  await expect(cell(1, 1)).toBeFocused();

  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('nope');
  await page.keyboard.press('Escape');
  await expect(cell(1, 1)).toHaveText('worker');
  await expect(cell(1, 1)).toBeFocused();

  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  await expect(page.locator('#events-grid [role="alert"]')).toHaveText('Source is required');
  await expect(editor).toHaveAttribute('aria-invalid', 'true');
  await expect(editor).toBeFocused();
  await page.keyboard.press('Escape');

  // Level is a select: choose with the keyboard
  await cell(1, 2).focus();
  await page.keyboard.press('Enter');
  const select = page.locator('#events-grid select.cell-editor');
  await expect(select).toBeFocused();
  await select.selectOption('Error');
  await page.keyboard.press('Enter');
  await expect(cell(1, 2)).toContainText('Error');
});

test('a virtual grid edits and navigates to the last row without losing the cell', async ({ page }) => {
  await page.goto('/#/');
  await page.locator('#events-grid td[data-pos="0"][data-col="1"]').focus();
  await page.keyboard.press('Control+End');
  const last = page.locator('#events-grid td[data-pos="19999"][data-col="2"]');
  await expect(last).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('tail');
  await page.keyboard.press('Enter');
  await expect(page.locator('#events-grid td[data-pos="19999"][data-col="1"]')).toHaveText('tail');
});

test('route loaders: the old page stays up and the outlet is busy until data arrives', async ({ page }) => {
  await page.goto('/#/users');
  await expect(page.locator('#users-grid')).toBeVisible();
  await page.evaluate(() => (location.hash = '#/users/3'));
  await expect(page.locator('nx-outlet')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#users-grid')).toBeVisible(); // still the previous page
  await expect(page.locator('#user-email')).toHaveText(/@example\.com$/);
  await expect(page.locator('nx-outlet')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/\S/);
  await expect(page).toHaveTitle(/User/);
});

test('a loader that throws shows the route errorView, and the app stays usable', async ({ page }) => {
  await page.goto('/#/users/999');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('User not found');
  await expect(page.getByText('No user with id 999')).toBeVisible();
  await page.getByRole('button', { name: 'All users' }).click();
  await expect(page.locator('#users-grid')).toBeVisible();
});

test('a new page opens at the top; Back restores where the previous page was scrolled', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 420 });
  await page.goto('/#/');
  const outlet = page.locator('nx-outlet');
  await expect(page.getByText('Everything at a glance.')).toBeVisible();
  await outlet.evaluate(el => (el.scrollTop = 160));
  expect(await outlet.evaluate(el => el.scrollTop)).toBeGreaterThan(100);

  await page.locator('nx-tree .nx-tree-node-content', { hasText: 'Users' }).first().click();
  await expect(page).toHaveURL(/#\/users$/);
  await expect(page.locator('#users-grid')).toBeVisible();
  expect(await outlet.evaluate(el => el.scrollTop)).toBe(0);

  await page.goBack();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByText('Everything at a glance.')).toBeAttached();
  await expect.poll(() => outlet.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
});

test('enhanced form: posts with fetch, shows the server error on its field and focuses it, without navigating', async ({ page }) => {
  await page.goto('/#/');
  let posted = '';
  await page.route('**/api/signup', async route => {
    posted = route.request().postData() ?? '';
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ errors: { email: 'That email is already registered' } })
    });
  });
  await page.evaluate(() => {
    const form = document.createElement('nx-form');
    form.id = 'signup';
    form.setAttribute('action', '/api/signup');
    form.setAttribute('method', 'post');
    form.setAttribute('enhance', '');
    form.innerHTML = `
      <nx-input name="email" type="email" label="Email" value="ada@example.com" required></nx-input>
      <nx-button slot="buttons" type="submit">Sign up</nx-button>`;
    document.querySelector('nx-outlet')!.append(form);
  });
  const url = page.url();
  await page.locator('#signup nx-button').click();
  await expect(page.locator('#signup nx-input')).toContainText('That email is already registered');
  await expect(page.locator('#signup nx-input input')).toBeFocused();
  await expect(page.locator('#signup nx-input input')).toHaveAttribute('aria-invalid', 'true');
  expect(posted).toBe('email=ada%40example.com');
  expect(page.url()).toBe(url);
  await expect(page.locator('#signup')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#signup nx-button')).not.toHaveAttribute('disabled', '');
});

test('a buffered grid over 1,000,000 server rows: skeletons, few requests, server sort and search, and accessible', async ({ page }) => {
  const TOTAL = 1_000_000;
  const starts: number[] = [];
  let lastSort = '';
  let lastFilter = '';
  await page.route('**/api/big**', async route => {
    const url = new URL(route.request().url());
    const start = Number(url.searchParams.get('start'));
    const limit = Number(url.searchParams.get('limit'));
    starts.push(start);
    lastSort = url.searchParams.get('sort') ?? '';
    lastFilter = url.searchParams.get('filter') ?? '';
    const desc = lastSort.includes('DESC');
    const search = lastFilter ? JSON.parse(lastFilter)[0].value : '';
    // A search narrows the data to the rows whose number ends with the text
    const count = search ? 10 : TOTAL;
    const data = Array.from({ length: Math.max(0, Math.min(limit, count - start)) }, (_, i) => {
      const n = start + i;
      return { id: desc ? TOTAL - 1 - n : n, name: search ? `Match ${search}-${n}` : `Row ${desc ? TOTAL - 1 - n : n}` };
    });
    await new Promise(resolve => setTimeout(resolve, 150)); // a real server takes a moment
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data, total: count }) });
  });

  await page.goto('/#/');
  await page.evaluate(async () => {
    // The page's own module (same instance as the demo app); a variable keeps TypeScript out of it
    const entry = '/src/index.ts';
    const { NX, Store } = await import(/* @vite-ignore */ entry);
    const store = new Store({ buffered: true, pageSize: 100, autoLoad: true, proxy: { type: 'rest', url: '/api/big' } });
    const grid = NX.create({
      xtype: 'grid', id: 'big-grid', title: 'Big data', store, search: true, rowHeight: 40, height: 320,
      columns: [{ field: 'id', header: 'Id', width: 120 }, { field: 'name', header: 'Name' }]
    } as any);
    document.querySelector('nx-outlet')!.prepend(grid);
  });

  const body = page.locator('#big-grid .nx-grid-body');
  await expect(page.locator('#big-grid td', { hasText: 'Row 0' }).first()).toBeVisible();
  await expect(page.locator('#big-grid .nx-grid-footer')).toContainText('1,000,000 rows');
  expect(await page.locator('#big-grid tbody tr:not(.spacer)').count()).toBeLessThan(60);

  // Jump to the middle: skeletons first, then the rows, and only a few pages are requested
  const before = starts.length;
  await body.evaluate(el => (el.scrollTop = 40 * 500_000));
  await expect(page.locator('#big-grid tr.loading-row').first()).toBeVisible();
  await expect(page.locator('#big-grid td', { hasText: 'Row 500000' }).first()).toBeVisible();
  expect(starts.length - before).toBeLessThanOrEqual(3);

  // Axe on the grid while a page is still loading (skeleton rows)
  await body.evaluate(el => (el.scrollTop = 40 * 700_000));
  await expect(page.locator('#big-grid tr.loading-row').first()).toBeVisible();
  const results = await new AxeBuilder({ page }).include('#big-grid').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map(v => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  await expect(page.locator('#big-grid td', { hasText: 'Row 700000' }).first()).toBeVisible();

  // Sort and search are the server's job
  await page.locator('#big-grid th[data-field="id"] button').click();
  await page.locator('#big-grid th[data-field="id"] button').click();
  await expect.poll(() => lastSort).toContain('DESC');
  await expect(page.locator('#big-grid td', { hasText: 'Row 999999' }).first()).toBeVisible();
  await page.locator('#big-grid .nx-grid-search input').fill('42');
  await expect(page.locator('#big-grid td', { hasText: 'Match 42-0' }).first()).toBeVisible();
  expect(lastFilter).toContain('"value":"42"');
  await expect(page.locator('#big-grid .nx-grid-footer')).toContainText('10 rows');
});

test('Export Excel downloads a real .xlsx of the rows the grid shows', async ({ page }) => {
  await page.goto('/#/users');
  await expect(page.locator('#users-grid tbody tr')).toHaveCount(10);
  // Narrow the grid first: the file holds what search shows, from every page
  await page.locator('#users-grid .nx-grid-search input').fill('ada');
  await expect(page.locator('#users-grid tbody tr')).toHaveCount(3);

  await page.locator('nx-menu').first().click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Export Excel' }).click()
  ]);
  expect(download.suggestedFilename()).toBe('users.xlsx');
  const file = await download.path();
  const bytes = (await import('node:fs')).readFileSync(file);
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  // Stored (uncompressed) entries, so the part names and cell text are readable in the bytes
  const text = bytes.toString('latin1');
  expect(text).toContain('xl/worksheets/sheet1.xml');
  expect(text).toContain('<autoFilter ref="A1:F4"/>'); // header plus the 3 matching rows, 6 columns
  expect(text).toContain('Ada Lovelace');
  expect(text).not.toContain('Grace Hopper');
  await download.saveAs(process.env.NX_XLSX_OUT ?? file); // lets a person open it in Excel
});

test('grouped grid: headers collapse from the keyboard, totals follow, and the footer totals everything', async ({ page }) => {
  await page.goto('/#/');
  const grid = page.locator('#orders-grid');
  await expect(grid.locator('.group-toggle')).toHaveCount(3); // Paid, Pending, Refunded
  await expect(grid.locator('.group-toggle').first()).toContainText('Paid');
  await expect(grid.locator('.group-toggle').first()).toContainText('3 rows');
  // Paid: 249 + 1290 + 72; the grid total is every order
  await expect(grid.locator('tr.summary-row').first()).toContainText('$1,611.00');
  await expect(grid.locator('tfoot')).toContainText('$4,239.00');

  const paid = grid.locator('.group-toggle').first();
  await paid.focus();
  await page.keyboard.press('Enter');
  await expect(paid).toHaveAttribute('aria-expanded', 'false');
  await expect(paid).toBeFocused();
  await expect(grid.locator('tbody tr:not(.group-row):not(.summary-row)')).toHaveCount(3); // Pending 2 + Refunded 1
  await expect(grid.locator('tfoot')).toContainText('$4,239.00');
  await page.keyboard.press('Space');
  await expect(paid).toHaveAttribute('aria-expanded', 'true');
  await expect(grid.locator('tbody tr:not(.group-row):not(.summary-row)')).toHaveCount(6);
});

test('tree grid: Right opens, Left closes and climbs to the parent, with treegrid semantics', async ({ page }) => {
  await page.goto('/#/components');
  const grid = page.locator('#files-grid');
  await expect(grid.locator('table')).toHaveAttribute('role', 'treegrid');
  await expect(grid.locator('tbody tr')).toHaveCount(3); // docs, src, README.md
  const cell = (pos: number, col = 0) => grid.locator(`td[data-pos="${pos}"][data-col="${col}"]`);

  await cell(0).focus();
  await page.keyboard.press('ArrowRight'); // opens docs
  await expect(grid.locator('tbody tr')).toHaveCount(5);
  await expect(grid.locator('tbody tr').first()).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown'); // guide.md
  await page.keyboard.press('ArrowDown'); // api
  await page.keyboard.press('ArrowRight'); // opens api
  await expect(grid.locator('tbody tr')).toHaveCount(7);
  await expect(grid.locator('tbody tr').nth(3)).toHaveAttribute('aria-level', '3'); // grid.md
  await page.keyboard.press('ArrowDown'); // grid.md
  await page.keyboard.press('ArrowLeft'); // climbs to api
  await expect(cell(2)).toBeFocused();
  await page.keyboard.press('ArrowLeft'); // closes api
  await expect(grid.locator('tbody tr')).toHaveCount(5);

  // The expander works with the mouse, and the footer totals every node
  await grid.locator('td[data-pos="1"] .tree-toggle').count();
  await cell(0).locator('.tree-toggle').click();
  await expect(grid.locator('tbody tr')).toHaveCount(3);
  await expect(grid.locator('tfoot')).toContainText('75'); // 30+7+3+12+21+2
});
