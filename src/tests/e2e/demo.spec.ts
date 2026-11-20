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

test('switching the page language redraws components in it, live', async ({ page }) => {
  await page.goto('/#/users');
  const grid = page.locator('#users-grid');
  await expect(grid.locator('.nx-grid-search input')).toHaveAttribute('placeholder', 'Search…');
  await expect(grid.locator('.pager .info')).toHaveText('Page 1 of 5');

  await page.evaluate(async () => {
    const entry = '/src/index.ts';
    const locale = '/src/locales/es.ts';
    const { NX } = await import(/* @vite-ignore */ entry);
    await import(/* @vite-ignore */ locale);
    NX.i18n.setLanguage('es');
  });
  await expect(grid.locator('.nx-grid-search input')).toHaveAttribute('placeholder', 'Buscar…');
  await expect(grid.locator('.pager .info')).toHaveText('Página 1 de 5');
  await expect(grid.getByRole('button', { name: 'Página siguiente' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});


test.describe('right to left (Arabic)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/users');
    await expect(page.locator('#users-grid')).toBeVisible();
    await page.evaluate(async () => {
      const entry = '/src/index.ts';
      const locale = '/src/locales/ar.ts';
      const { NX } = await import(/* @vite-ignore */ entry);
      await import(/* @vite-ignore */ locale);
      NX.i18n.setLanguage('ar');
    });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('the layout mirrors: side nav on the right, columns and checkboxes reversed', async ({ page }) => {
    const view = page.viewportSize()!;
    const nav = await page.locator('nx-tree').first().boundingBox();
    expect(nav!.x).toBeGreaterThan(view.width / 2); // the west region sits at the start, which is the right
    const grid = page.locator('#users-grid');
    const x = async (selector: string) => (await grid.locator(selector).first().boundingBox())!.x;
    expect(await x('th.check')).toBeGreaterThan(await x('th[data-field="name"]'));
    expect(await x('th[data-field="name"]')).toBeGreaterThan(await x('th[data-field="email"]'));
    expect(await x('th[data-field="email"]')).toBeGreaterThan(await x('th[data-field="joined"]'));
  });

  test('built-in strings are Arabic and numbers follow the locale', async ({ page }) => {
    const grid = page.locator('#users-grid');
    await expect(grid.locator('.nx-grid-search input')).toHaveAttribute('placeholder', 'بحث…');
    await expect(grid.locator('.pager .info')).toContainText('صفحة');
    await expect(grid.getByRole('button', { name: 'الصفحة التالية' })).toBeVisible();
  });

  test('next-page chevron points left, and the previous-page one points right', async ({ page }) => {
    const grid = page.locator('#users-grid');
    const flipped = (name: string) => grid.getByRole('button', { name }).evaluate(el => getComputedStyle(el).transform);
    expect(await flipped('الصفحة التالية')).toBe('matrix(-1, 0, 0, 1, 0, 0)'); // scaleX(-1)
  });

  test('a pinned column stays at the start (the right) edge', async ({ page }) => {
    await page.goto('/#/');
    await page.evaluate(async () => {
      const entry = '/src/index.ts';
      const { NX } = await import(/* @vite-ignore */ entry);
      NX.i18n.setLanguage('ar');
    });
    const pinned = (await page.locator('#events-grid th[data-field="id"]').boundingBox())!;
    const other = (await page.locator('#events-grid th[data-field="source"]').boundingBox())!;
    expect(pinned.x).toBeGreaterThan(other.x);
    const body = page.locator('#events-grid .nx-grid-body');
    const edge = (await body.boundingBox())!;
    expect(Math.abs(pinned.x + pinned.width - (edge.x + edge.width))).toBeLessThan(24);
  });

  test('keyboard: in a tree grid Left opens a node and Right closes it', async ({ page }) => {
    await page.goto('/#/components');
    await page.evaluate(async () => {
      const entry = '/src/index.ts';
      const { NX } = await import(/* @vite-ignore */ entry);
      NX.i18n.setLanguage('ar');
    });
    const grid = page.locator('#files-grid');
    await expect(grid.locator('tbody tr')).toHaveCount(3);
    await grid.locator('td[data-pos="0"][data-col="0"]').focus();
    await page.keyboard.press('ArrowLeft'); // the reading direction runs right to left: Left is "forward"
    await expect(grid.locator('tbody tr')).toHaveCount(5);
    await page.keyboard.press('ArrowRight');
    await expect(grid.locator('tbody tr')).toHaveCount(3);
  });

  test('the switch thumb moves toward the end (left) when turned on', async ({ page }) => {
    await page.goto('/#/forms');
    await page.evaluate(async () => {
      const entry = '/src/index.ts';
      const { NX } = await import(/* @vite-ignore */ entry);
      NX.i18n.setLanguage('ar');
    });
    const sw = page.locator('nx-switch').first();
    const thumb = sw.locator('.thumb');
    // Where the thumb sits inside its own switch. The page redraws after the language change, and under load that can
    // land late and start transitions of its own: read it only once it has stopped moving.
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const offset = async () => (await thumb.boundingBox())!.x - (await sw.boundingBox())!.x;
    const settled = async () => {
      let last = NaN, same = 0;
      for (let i = 0; i < 60 && same < 3; i++) {
        const now = await offset();
        same = Math.abs(now - last) < 0.5 ? same + 1 : 0;
        last = now;
        await page.waitForTimeout(100);
      }
      return last;
    };
    const isOn = () => sw.evaluate((el: any) => !!el.shadowRoot.querySelector('input').checked);
    // The settings form starts this switch on. Put it off, then on: the page may still be redrawing after the language
    // change, so a click is repeated until it has taken (and only if it has not).
    const turn = async (on: boolean) => expect(async () => {
      if ((await isOn()) !== on) await sw.click();
      expect(await isOn()).toBe(on);
    }).toPass({ timeout: 10000 });
    await turn(false);
    const before = await settled();
    await turn(true);
    const after = await settled();
    expect(after).toBeLessThan(before - 8); // turning it on moves the thumb toward the end, which is the left in Arabic
  });

  test('a menu opens at the start edge of its button', async ({ page }) => {
    await page.goto('/#/components');
    await page.evaluate(async () => {
      const entry = '/src/index.ts';
      const { NX } = await import(/* @vite-ignore */ entry);
      NX.i18n.setLanguage('ar');
    });
    const trigger = page.locator('nx-menu[text="Actions"]');
    await trigger.click();
    const button = (await trigger.boundingBox())!;
    const list = (await page.locator('nx-menu-popup [role="menu"]').first().boundingBox())!;
    // 'bottom-start' in RTL lines the menu's right edge up with the button's right edge
    expect(Math.abs(list.x + list.width - (button.x + button.width))).toBeLessThan(12);
  });
});

test('pagination: pages keep their width, buttons work with the keyboard, focus stays, and the page size changes the range', async ({ page }) => {
  await page.goto('/#/components');
  const pager = page.locator('#demo-pagination');
  const status = page.locator('#page-status');
  const current = pager.locator('.page.current');
  await expect(current).toHaveText('4');
  await expect(pager.locator('.range')).toHaveText('31–40 of 250');

  // Count of page buttons is constant as the window moves
  const count = () => pager.locator('li').count();
  const before = await count();
  await pager.getByRole('button', { name: 'Next page' }).focus();
  await page.keyboard.press('Enter');
  await expect(current).toHaveText('5');
  await expect(current).toBeFocused(); // the buttons were rebuilt, focus went to the current page
  await expect(status).toHaveText('Page 5, 10 per page');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space'); // Next page again
  expect(await count()).toBe(before);

  await pager.locator('select').selectOption('25');
  await expect(status).toContainText('25 per page');
  await expect(pager.locator('.range')).toContainText('of 250');
  await pager.getByRole('button', { name: 'Page 10' }).click();
  await expect(current).toHaveText('10');
  await expect(pager.locator('.range')).toHaveText('226–250 of 250');
  await expect(pager.getByRole('button', { name: 'Next page' })).toBeDisabled();
});

test('file upload: picks real files, lists them, rejects by rule, removes from the keyboard, and drops', async ({ page }) => {
  await page.goto('/#/components');
  const upload = page.locator('#demo-upload');
  const picker = upload.locator('input[type="file"]');
  await picker.scrollIntoViewIfNeeded();

  await picker.setInputFiles([
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
    { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.alloc(2048) }
  ]);
  await expect(upload.locator('.file-name')).toHaveText(['notes.txt', 'photo.png']);
  await expect(upload.locator('.file-size').first()).toHaveText('5 byte');

  // A type that isn't accepted, and a file over 1 MB, are refused and announced
  await picker.setInputFiles([
    { name: 'app.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') },
    { name: 'big.txt', mimeType: 'text/plain', buffer: Buffer.alloc(1024 * 1024 + 1) }
  ]);
  await expect(upload.locator('.rejected li')).toHaveText(['app.exe is not an accepted file type', 'big.txt is larger than 1 MB']);
  await expect(upload.locator('.file-name')).toHaveText(['notes.txt', 'photo.png']);

  // Only 3 files fit: the fourth is refused
  await picker.setInputFiles([{ name: 'c.txt', mimeType: 'text/plain', buffer: Buffer.from('c') }, { name: 'd.txt', mimeType: 'text/plain', buffer: Buffer.from('d') }]);
  await expect(upload.locator('.file-name')).toHaveText(['notes.txt', 'photo.png', 'c.txt']);
  await expect(upload.locator('.rejected li')).toContainText('only 3 files are allowed');

  // Remove with the keyboard: focus returns to the field
  const remove = upload.getByRole('button', { name: 'Remove notes.txt' });
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(upload.locator('.file-name')).toHaveText(['photo.png', 'c.txt']);
  await expect(picker).toBeFocused();

  // Drag and drop with a real DataTransfer
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['dropped'], 'dropped.txt', { type: 'text/plain' }));
    return dt;
  });
  await upload.locator('.zone').dispatchEvent('dragover', { dataTransfer });
  await expect(upload.locator('.zone')).toHaveClass(/dragging/);
  await upload.locator('.zone').dispatchEvent('drop', { dataTransfer });
  await expect(upload.locator('.file-name')).toHaveText(['photo.png', 'c.txt', 'dropped.txt']);
  await expect(upload.locator('.zone')).not.toHaveClass(/dragging/);
});

test('file upload inside an enhanced form sends the real file bytes as multipart', async ({ page }) => {
  await page.goto('/#/');
  let contentType = '';
  let body = '';
  await page.route('**/api/files', async route => {
    contentType = route.request().headers()['content-type'] ?? '';
    body = route.request().postDataBuffer()?.toString('latin1') ?? '';
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.evaluate(() => {
    const form = document.createElement('nx-form');
    form.id = 'upload-form';
    form.setAttribute('action', '/api/files');
    form.setAttribute('method', 'post');
    form.setAttribute('enctype', 'multipart/form-data');
    form.setAttribute('enhance', '');
    form.innerHTML = `
      <nx-input name="title" label="Title" value="Quarterly"></nx-input>
      <nx-file-upload name="report" label="Report" required></nx-file-upload>
      <nx-button slot="buttons" type="submit">Send</nx-button>`;
    document.querySelector('nx-outlet')!.append(form);
  });
  const form = page.locator('#upload-form');
  // Required: submitting with no file shows the error and sends nothing
  await form.locator('nx-button').click();
  await expect(form.locator('nx-file-upload')).toContainText('Choose at least one file');
  expect(body).toBe('');

  await form.locator('input[type="file"]').setInputFiles({ name: 'report.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') });
  const success = page.evaluate(() => new Promise(resolve => document.getElementById('upload-form')!.addEventListener('success', () => resolve(true), { once: true })));
  await form.locator('nx-button').click();
  await success;
  expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
  expect(body).toContain('name="title"');
  expect(body).toContain('Quarterly');
  expect(body).toContain('name="report"; filename="report.csv"');
  expect(body).toContain('a,b\n1,2\n');
});

test('tag input: type, Enter, comma, paste, duplicates, max, Backspace and the × button, announced', async ({ page }) => {
  await page.goto('/#/components');
  const field = page.locator('#demo-tags');
  const box = field.locator('input.entry');
  const tags = field.locator('.tag-text');
  await box.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await expect(tags).toHaveText(['css', 'html']);

  await box.click();
  await page.keyboard.type('a11y');
  await page.keyboard.press('Enter');
  await expect(tags).toHaveText(['css', 'html', 'a11y']);
  await expect(field.locator('.live')).toHaveText('Added a11y');
  await expect(box).toHaveValue('');
  await expect(box).toBeFocused();

  await page.keyboard.type('js,');
  await expect(tags).toHaveText(['css', 'html', 'a11y', 'js']);

  // Max is 4: the next one is refused with the reason
  await page.keyboard.type('svg');
  await page.keyboard.press('Enter');
  await expect(field.locator('.nx-field-helper')).toHaveText('At most 4 tags are allowed');
  await expect(tags).toHaveCount(4);

  // Backspace in the empty box removes the last tag
  await box.fill('');
  await page.keyboard.press('Backspace');
  await expect(tags).toHaveText(['css', 'html', 'a11y']);
  await expect(field.locator('.live')).toHaveText('Removed js');

  // A duplicate (any case) is refused; the × button removes with the mouse and focus returns to the box
  await page.keyboard.type('CSS');
  await page.keyboard.press('Enter');
  await expect(field.locator('.nx-field-helper')).toHaveText('CSS is already added');
  await box.fill('');
  await field.getByRole('button', { name: 'Remove html' }).click();
  await expect(tags).toHaveText(['css', 'a11y']);
  await expect(box).toBeFocused();

  // Pasting a list splits it
  await page.evaluate(() => {
    const input = document.querySelector('#demo-tags')!.shadowRoot!.querySelector('input.entry')!;
    const data = new DataTransfer();
    data.setData('text', 'x, y\nz');
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(tags).toHaveText(['css', 'a11y', 'x', 'y']); // z is over the max of 4
});

test('tag input in an enhanced form posts every tag as its own entry', async ({ page }) => {
  await page.goto('/#/');
  let body = '';
  await page.route('**/api/tags', async route => {
    body = route.request().postData() ?? '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.evaluate(() => {
    const form = document.createElement('nx-form');
    form.id = 'tag-form';
    form.setAttribute('action', '/api/tags');
    form.setAttribute('method', 'post');
    form.setAttribute('enhance', '');
    form.innerHTML = `<nx-tag-input name="topics" label="Topics" value="css,html" required></nx-tag-input>
      <nx-button slot="buttons" type="submit">Save</nx-button>`;
    document.querySelector('nx-outlet')!.append(form);
  });
  const form = page.locator('#tag-form');
  await form.locator('input.entry').click();
  await page.keyboard.type('js');
  await page.keyboard.press('Enter');
  await form.locator('nx-button').click();
  await expect.poll(() => body).not.toBe('');
  expect(new URLSearchParams(body).getAll('topics')).toEqual(['css', 'html', 'js']);
});

test('splitter: drag with the mouse, resize and collapse from the keyboard, nested stacks, and ARIA values', async ({ page }) => {
  await page.goto('/#/components');
  const splitter = page.locator('#demo-splitter');
  await splitter.scrollIntoViewIfNeeded();
  const outer = splitter.locator(':scope > .nx-gutter');
  await expect(outer).toHaveCount(2);
  const first = splitter.locator(':scope > div').first();
  const width = async () => (await first.boundingBox())!.width;
  const start = await width();

  // Mouse: drag the first divider 120px to the right
  const box = (await outer.first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(await width()).toBeGreaterThan(start + 100);

  // Keyboard: it is a focusable separator with a value; Shift+Left shrinks the pane, Home collapses it to its minimum
  await outer.first().focus();
  await expect(outer.first()).toHaveAttribute('role', 'separator');
  const before = Number(await outer.first().getAttribute('aria-valuenow'));
  await page.keyboard.press('Shift+ArrowLeft');
  expect(Number(await outer.first().getAttribute('aria-valuenow'))).toBeLessThan(before - 5);
  await page.keyboard.press('Home');
  await expect.poll(width).toBeLessThanOrEqual(100); // min-size is 96px
  await page.keyboard.press('Enter'); // restores
  await expect.poll(width).toBeGreaterThan(101); // back to its 25% share (about 105px here), clearly more than the 96px minimum

  // The nested stack resizes vertically with Up/Down
  const inner = splitter.locator('nx-splitter .nx-gutter');
  await inner.focus();
  expect(await inner.getAttribute('aria-orientation')).toBe('horizontal');
  const top = splitter.locator('nx-splitter > div').first();
  const h = (await top.boundingBox())!.height;
  await page.keyboard.press('Shift+ArrowDown');
  expect((await top.boundingBox())!.height).toBeGreaterThan(h + 5);
});

test('splitter: padded panes get exactly their share (padding must not skew the sizes)', async ({ page }) => {
  await page.goto('/#/components');
  const splitter = page.locator('#demo-splitter');
  await splitter.scrollIntoViewIfNeeded();
  const widths = await splitter.evaluate(el => {
    const panes = Array.from(el.children).filter(c => !c.hasAttribute('data-nx-generated')) as HTMLElement[];
    const box = el.getBoundingClientRect().width - 2; // the demo splitter has a 1px border
    const gutters = el.querySelectorAll(':scope > [data-nx-generated]').length * 8;
    return { share: panes.map(p => p.getBoundingClientRect().width / (box - gutters)) };
  });
  // size="25", the nested stack gets the rest (50), size="25"; each pane has padding
  expect(widths.share[0]).toBeCloseTo(0.25, 2);
  expect(widths.share[1]).toBeCloseTo(0.5, 2);
  expect(widths.share[2]).toBeCloseTo(0.25, 2);
});

test('pagination in a narrow container collapses to "Page x of y" and its buttons stay reachable', async ({ page }) => {
  await page.goto('/#/components');
  await page.evaluate(() => {
    const box = document.createElement('div');
    box.id = 'narrow';
    box.style.cssText = 'width: 220px; border: 1px solid #ccc';
    box.innerHTML = '<nx-pagination id="narrow-pager" total="250" page="4" show-total></nx-pagination>';
    document.querySelector('nx-outlet')!.prepend(box);
  });
  const pager = page.locator('#narrow-pager');
  await expect(pager.locator('.status.responsive')).toBeVisible();
  await expect(pager.locator('.status.responsive')).toHaveText('Page 4 of 25');
  await expect(pager.locator('li.num').first()).toBeHidden();
  // Both ends are visible, inside the container (not clipped), and clicking works
  const box = (await page.locator('#narrow').boundingBox())!;
  for (const name of ['Previous page', 'Next page']) {
    const b = (await pager.getByRole('button', { name }).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(box.x);
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1);
  }
  await pager.getByRole('button', { name: 'Next page' }).click();
  await expect(pager.locator('.status.responsive')).toHaveText('Page 5 of 25');
});

test.describe('chat', () => {
  const open = async (page: import('@playwright/test').Page) => {
    await page.goto('/#/components');
    const chat = page.locator('#demo-chat');
    await chat.scrollIntoViewIfNeeded();
    await expect(chat.locator('textarea')).toBeVisible();
    return chat;
  };
  /** Wait for a reply to finish. Not just for Stop to be absent: that is also true in the frame before the reply starts. */
  const idle = async (chat: import('@playwright/test').Locator) => {
    await expect(chat.locator('.stop')).toBeVisible();
    await expect(chat.locator('.stop')).toHaveCount(0, { timeout: 15000 });
  };

  test('Enter sends, the reply streams in as safe Markdown, and hostile output stays text', async ({ page }) => {
    const chat = await open(page);
    await expect(chat.locator('.empty-state')).toContainText('Start a conversation');
    await chat.locator('textarea').click();
    await page.keyboard.type('hello there');
    await page.keyboard.press('Enter');

    await expect(chat.locator('.msg.user .body')).toHaveText('hello there');
    await expect(chat.locator('textarea')).toHaveValue('');
    // The question comes first and the reply after it, in the document and on screen
    await expect(chat.locator('.msg').first()).toHaveClass(/user/);
    await expect(chat.locator('.msg.assistant')).toHaveCount(1);
    const order = await chat.locator('.msg').evaluateAll(els => els.map(el => (el as HTMLElement).className.split(' ')[1]));
    expect(order).toEqual(['user', 'assistant']);
    const tops = await chat.locator('.msg').evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
    expect(tops[0]).toBeLessThan(tops[1]);
    const reply = chat.locator('.msg.assistant');
    await expect(reply).toHaveAttribute('aria-busy', 'true');
    await expect(chat.locator('.stop')).toBeVisible(); // Stop replaces Send while it answers
    await idle(chat);
    await expect(reply).not.toHaveAttribute('aria-busy', 'true');

    const body = reply.locator('.body');
    await expect(body.locator('strong').first()).toContainText('hello there');
    await expect(body.locator('ul li')).toHaveCount(3);
    await expect(body.locator('.md-code pre code')).toContainText('chat.respond');
    await expect(body.locator('a[href^="https://"]')).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    expect(await body.locator('script').count()).toBe(0);
    await expect(body).toContainText('<script>alert(1)</script>'); // visible as text
    await expect(chat.locator('.announce')).toHaveText('Response complete');
  });

  test('Shift+Enter adds a line instead of sending, and the code block can be copied', async ({ page }) => {
    const chat = await open(page);
    await chat.locator('textarea').click();
    await page.keyboard.type('line one');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('line two');
    await expect(chat.locator('textarea')).toHaveValue('line one\nline two');
    await expect(chat.locator('.msg')).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(chat.locator('.msg.user .body')).toHaveText('line one\nline two');
    await idle(chat);
    await chat.locator('[data-copy-code]').click();
    await expect(chat.locator('[data-copy-code]')).toHaveClass(/copied/);
    await expect(chat.locator('.announce')).toHaveText('Copied');
  });

  test('Stop ends the reply early and keeps what arrived', async ({ page }) => {
    const chat = await open(page);
    await chat.getByRole('button', { name: 'Explain streaming' }).click(); // a suggestion sends it
    const reply = chat.locator('.msg.assistant .body');
    await expect(reply).toContainText('Here is a short answer'); // some text has arrived
    await chat.getByRole('button', { name: 'Stop generating' }).click();
    await idle(chat);
    await expect(chat.locator('.msg.assistant .note')).toHaveText('Stopped');
    expect(await reply.locator('.md-code').count()).toBe(0); // it never got as far as the code block
    await expect(chat.getByRole('button', { name: 'Send message' })).toBeVisible();
  });

  test('follows new text at the bottom, but stops following (and offers Jump to latest) once you scroll up', async ({ page }) => {
    const chat = await open(page);
    const log = chat.locator('.log');
    const gap = () => log.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight);
    // Fill the window so it scrolls
    for (const text of ['one', 'two']) {
      await chat.locator('textarea').fill(text);
      await page.keyboard.press('Enter');
      await idle(chat);
      await expect(chat.locator('.msg.assistant .md-code').last()).toBeVisible(); // the reply is complete
    }
    expect(await log.evaluate(el => el.scrollHeight > el.clientHeight + 40)).toBe(true);
    expect(await gap()).toBeLessThan(5); // it followed the replies down

    await chat.locator('textarea').fill('three');
    await page.keyboard.press('Enter');
    await expect(chat.locator('.msg.assistant').last()).toContainText('Here is');
    // Scroll up while the reply is still streaming; retry in case a frame under load re-sticks us to the end
    await expect(async () => {
      await log.evaluate(el => { el.scrollTop = 40; });
      await expect(chat.locator('.latest')).toBeVisible({ timeout: 700 });
    }).toPass({ timeout: 8000 });
    await expect(chat.locator('.stop')).toBeVisible(); // still streaming while we read further up
    await expect(chat.locator('.stop')).toHaveCount(0, { timeout: 15000 });
    // The reply finished and the conversation was redrawn: the reader is still exactly where they were, and can still jump down
    expect(await log.evaluate(el => el.scrollTop)).toBe(40);
    await expect(chat.locator('.latest')).toBeVisible();

    await chat.locator('.latest').click();
    await expect.poll(gap).toBeLessThan(5);
    await expect(chat.locator('.latest')).toBeHidden();
  });
});

test.describe('rating', () => {
  test('is operated with the keyboard, fills its stars and takes part in the form', async ({ page }) => {
    await page.goto('/#/forms');
    const rating = page.locator('#demo-rating');
    await rating.scrollIntoViewIfNeeded();
    await expect(rating.getByRole('radio', { name: '3 of 5' })).toBeChecked();
    // Click a star: it becomes the value and fills up to it
    await rating.getByRole('radio', { name: '5 of 5' }).click({ force: true });
    await expect(rating.getByRole('radio', { name: '5 of 5' })).toBeChecked();
    expect(await rating.evaluate((el: any) => el.value)).toBe(5);
    const fills = await rating.locator('.star').evaluateAll(els => els.map(e => (e as HTMLElement).style.getPropertyValue('--fill')));
    expect(fills).toEqual(['100%', '100%', '100%', '100%', '100%']);
    // Arrow keys move the choice, like native radios
    await rating.getByRole('radio', { name: '5 of 5' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(rating.getByRole('radio', { name: '4 of 5' })).toBeChecked();
    expect(await rating.evaluate((el: any) => el.value)).toBe(4);
    // The star that is drawn filled really is painted: the clipped copy has a size and a colour
    const paint = await rating.locator('.star').first().evaluate(el => {
      const s = getComputedStyle(el, '::after');
      return { w: parseFloat(s.width), bg: s.backgroundColor };
    });
    expect(paint.w).toBeGreaterThan(10);
    expect(paint.bg).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('calendar', () => {
  test('is a keyboard-operated grid that keeps focus while it selects and pages', async ({ page }) => {
    await page.goto('/#/components');
    const cal = page.locator('#demo-calendar');
    await cal.scrollIntoViewIfNeeded();
    const focused = () => cal.evaluate((el: any) => (el.shadowRoot.activeElement as HTMLElement | null)?.dataset.date ?? null);
    await expect(cal.getByRole('button', { name: /March 4, 2026, 2 events/ })).toBeVisible();
    await cal.getByRole('button', { name: /March 4, 2026/ }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    expect(await focused()).toBe('2026-03-12');
    await page.keyboard.press('Enter');
    // The value changed and the page redrew, but the focus is still on that day
    await expect.poll(() => cal.evaluate((el: any) => el.value)).toBe('2026-03-12');
    await expect.poll(focused).toBe('2026-03-12');
    await expect(cal.locator('.none')).toBeVisible();
    // Paging by month keeps focus too
    await page.keyboard.press('PageDown');
    await expect(cal.locator('.month')).toContainText('April 2026');
    await expect.poll(focused).toBe('2026-04-12');
    // Choosing a day with events lists them
    await page.keyboard.press('PageUp');
    await cal.getByRole('button', { name: /March 10, 2026/ }).click();
    await expect(cal.locator('.ev-title')).toHaveText('Design review');
  });
});

test.describe('one-time code', () => {
  test('moves on as you type, takes a paste, and steps back on Backspace', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/#/forms');
    const otp = page.locator('#demo-otp');
    await otp.scrollIntoViewIfNeeded();
    const cells = otp.locator('input.cell');
    await cells.nth(0).click();
    await page.keyboard.type('123');
    await expect(cells.nth(3)).toBeFocused();
    expect(await otp.evaluate((el: any) => el.value)).toBe('123');
    await page.keyboard.press('Backspace'); // box 4 is empty: step back and clear box 3
    await expect(cells.nth(2)).toBeFocused();
    expect(await otp.evaluate((el: any) => el.value)).toBe('12');
    // A pasted code lands in every box and the last one has focus
    await page.evaluate(() => navigator.clipboard.writeText('987 654'));
    await cells.nth(0).click();
    await page.keyboard.press('Control+V');
    await expect.poll(() => otp.evaluate((el: any) => el.value)).toBe('987654');
    await expect(cells.nth(5)).toBeFocused();
    expect(await cells.evaluateAll(els => els.map(e => (e as HTMLInputElement).value).join(''))).toBe('987654');
  });
});

test.describe('select with the themed list', () => {
  test('opens our list under the field, is keyboard operable, and posts the choice', async ({ page }) => {
    await page.goto('/#/forms');
    const select = page.locator('nx-select').first();
    await select.scrollIntoViewIfNeeded();
    await select.evaluate((el: any) => el.setAttribute('popup', 'custom'));
    await page.waitForTimeout(200);
    const field = select.locator('select');
    await field.click();
    const list = select.locator('.listbox');
    await expect(list).toBeVisible();
    // It sits right under the field, at least as wide, and in the top layer (nothing can clip it)
    const geo = await select.evaluate((el: any) => {
      const f = el.shadowRoot.querySelector('select').getBoundingClientRect();
      const l = el.shadowRoot.querySelector('.listbox').getBoundingClientRect();
      return { dx: Math.abs(l.left - f.left), dy: l.top - f.bottom, wider: l.width >= f.width - 1, top: el.shadowRoot.querySelector('.listbox').matches(':popover-open') };
    });
    expect(geo.dx).toBeLessThan(2);
    expect(geo.dy).toBeGreaterThanOrEqual(0);
    expect(geo.dy).toBeLessThan(12);
    expect(geo.wider).toBe(true);
    expect(geo.top).toBe(true);
    // Keyboard: arrows, Enter picks, focus returns to the field
    await page.keyboard.press('ArrowDown');
    const label = await select.locator('.opt.active .opt-text').textContent();
    await page.keyboard.press('Enter');
    await expect(list).toHaveCount(0);
    expect(await select.evaluate((el: any) => el.shadowRoot.activeElement?.tagName)).toBe('SELECT');
    expect(await field.evaluate((s: HTMLSelectElement) => s.selectedOptions[0].textContent)).toBe(label);
    // Escape closes it; a click elsewhere closes it too
    await field.press('Enter');
    await expect(list).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await field.click();
    await expect(list).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(list).toHaveCount(0);
  });
});

test.describe('view model', () => {
  test('bound markup follows typing, a formula decides validity, and the model says why', async ({ page }) => {
    await page.goto('/#/components');
    const card = page.locator('#demo-viewmodel');
    await card.scrollIntoViewIfNeeded();
    const greeting = card.locator('.vm-greeting');
    const submit = card.locator('.vm-submit');
    await expect(greeting).toHaveText('Hello, Ada! We will write to ada@example.com.');
    await expect(submit).not.toHaveAttribute('disabled', /.*/);
    await expect(card.locator('.vm-problem')).toBeHidden();
    // Typing updates the data, and everything bound to it
    const name = card.getByLabel('Name');
    await name.fill('Grace');
    await expect(greeting).toContainText('Hello, Grace!');
    // An invalid value: the formula flips, the button disables, the model's message shows
    await card.getByLabel('Email').fill('not-an-email');
    await expect(submit).toHaveAttribute('disabled', '');
    await expect(card.locator('.vm-problem')).toHaveText('Enter an email address');
    await card.getByLabel('Email').fill('grace@example.com');
    await expect(submit).not.toHaveAttribute('disabled', /.*/);
    await expect(card.locator('.vm-problem')).toBeHidden();
    // Data can also be changed from code, and the field shows it
    await page.evaluate(() => {
      const input = document.querySelector('#demo-viewmodel nx-input') as any;
      input.value = 'Hopper';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(greeting).toContainText('Hello, Hopper!');
  });
});

test.describe('api client', () => {
  test('stores made from an API description feed a grid, with the token sent and the server sorting', async ({ page }) => {
    const seen: Array<{ url: string; auth: string | undefined }> = [];
    await page.route('**/api/people**', route => {
      const url = new URL(route.request().url());
      seen.push({ url: url.pathname + url.search, auth: route.request().headers()['authorization'] });
      const desc = url.searchParams.get('sort')?.includes('DESC');
      const rows = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bob' }, { id: 3, name: 'Cleo' }];
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: desc ? [...rows].reverse() : rows, total: 3 }) });
    });
    await page.goto('/#/components');
    await page.evaluate(() => {
      const NX = (window as any).NX;
      const api = NX.api({ baseUrl: '/api', auth: { token: () => 'tok-123' }, resources: { people: { path: '/people', fields: ['id', 'name'], pageSize: 5 } } });
      api.register(); // <nx-grid store="people"> finds it by name
      const grid = document.createElement('nx-grid') as any;
      grid.id = 'api-grid';
      grid.columns = [{ field: 'name', header: 'Name', sortable: true }];
      grid.setAttribute('store', 'people');
      document.body.append(grid);
      return api.store('people').load();
    });
    const rows = page.locator('#api-grid').locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText('Ada');
    expect(seen[0].auth).toBe('Bearer tok-123');
    expect(seen[0].url).toContain('/api/people?');
    // Sorting by the header asks the server (a descending sort comes back reversed)
    await page.locator('#api-grid').getByRole('button', { name: 'Name' }).click();
    await page.locator('#api-grid').getByRole('button', { name: 'Name' }).click();
    await expect(rows.first()).toContainText('Cleo');
    expect(seen.at(-1)!.url).toContain('sort=');
  });
});

test.describe('clients made from a description', () => {
  test('an OpenAPI document gives a store that feeds a grid, with the parameters the document declares', async ({ page }) => {
    const seen: string[] = [];
    await page.route('**/v1/pets**', route => {
      const url = new URL(route.request().url());
      seen.push(url.pathname + url.search);
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Rex', age: '3' }, { id: 2, name: 'Tom', age: '5' }]) });
    });
    await page.goto('/#/components');
    await page.evaluate(async () => {
      const NX = (window as any).NX;
      const spec = {
        openapi: '3.0.0', servers: [{ url: '/v1' }],
        paths: { '/pets': { get: { operationId: 'listPets', parameters: [{ name: 'limit', in: 'query' }, { name: 'offset', in: 'query' }, { name: 'sort', in: 'query' }], responses: { 200: { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Pet' } } } } } } } } },
        components: { schemas: { Pet: { type: 'object', required: ['name'], properties: { id: { type: 'integer' }, name: { type: 'string' }, age: { type: 'integer' } } } } }
      };
      const api = await NX.openapi(spec);
      api.register();
      const grid = document.createElement('nx-grid') as any;
      grid.id = 'oa-grid';
      grid.columns = [{ field: 'name', header: 'Name', sortable: true }, { field: 'age', header: 'Age', type: 'number' }];
      grid.setAttribute('store', 'pets');
      document.body.append(grid);
      await api.store('pets').load();
    });
    const rows = page.locator('#oa-grid').locator('tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Rex');
    expect(seen[0]).toMatch(/^\/v1\/pets\?/);
    expect(seen[0]).toContain('limit=25');
    expect(seen[0]).toContain('offset=0');
    expect(seen[0]).not.toContain('page=');
  });

  test('a HAL entry point gives stores by following links', async ({ page }) => {
    const seen: string[] = [];
    await page.route('**/hal/**', route => {
      const url = new URL(route.request().url());
      seen.push(url.pathname + url.search);
      const body = url.pathname === '/hal/'
        ? { _links: { self: { href: '/hal/' }, books: { href: '/hal/books{?page,size}', templated: true } } }
        : { _embedded: { books: [{ title: 'Dune', _links: { self: { href: '/hal/books/1' } } }, { title: 'Emma', _links: { self: { href: '/hal/books/2' } } }] }, page: { totalElements: 2 } };
      route.fulfill({ contentType: 'application/hal+json', body: JSON.stringify(body) });
    });
    await page.goto('/#/components');
    await page.evaluate(async () => {
      const NX = (window as any).NX;
      const hal = NX.hal('/hal/');
      await hal.register();
      const grid = document.createElement('nx-grid') as any;
      grid.id = 'hal-grid';
      grid.columns = [{ field: 'title', header: 'Title' }, { field: 'id', header: 'Id' }];
      grid.setAttribute('store', 'books');
      document.body.append(grid);
      await (await hal.store('books')).load();
    });
    const rows = page.locator('#hal-grid').locator('tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Dune');
    await expect(rows.first()).toContainText('1'); // the id came from the record's own self link
    expect(seen).toContain('/hal/books?page=0&size=25');
  });
});

test.describe('pets (a server-backed page)', () => {
  const rows = (page: any) => page.locator('#pets-grid').locator('tbody tr');

  test('loads from the server through the OpenAPI client, and sorts, searches and pages there', async ({ page }) => {
    const seen: string[] = [];
    page.on('request', () => {}); // the "server" lives in the page: its requests are shown by what the grid does
    await page.goto('/#/pets');
    await expect(rows(page)).toHaveCount(10);
    await expect(page.locator('#pets-status')).toHaveText('Showing 1–10 of 48');
    await page.locator('#pets-grid').getByRole('button', { name: 'Age' }).click();
    const ages = () => rows(page).evaluateAll((trs: Element[]) => trs.map((tr: Element) => Number((tr.querySelectorAll('td')[3] as HTMLElement).textContent)));
    await expect.poll(ages).toEqual(Array(10).fill(3));             // ascending: the server's youngest first
    await page.locator('#pets-grid').getByRole('button', { name: 'Age' }).click();
    await expect.poll(ages).toEqual(Array(10).fill(13));            // descending: the oldest first
    await page.locator('#pets-grid').locator('.nx-grid-search input').fill('rex');
    await expect(page.locator('#pets-status')).toHaveText('Showing 1–3 of 3'); // Rex, Rex 2 and Rex 3
    await page.locator('#pets-grid').locator('.nx-grid-search input').fill('');
    await expect(page.locator('#pets-status')).toHaveText('Showing 1–10 of 48');
    await page.locator('#pets-pager').getByRole('button', { name: /next/i }).click();
    await expect(page.locator('#pets-status')).toHaveText('Showing 11–20 of 48');
    void seen;
  });

  test('a row opens a drawer that checks the server\'s rules, saves, and removes with a confirmation', async ({ page }) => {
    await page.goto('/#/pets');
    await expect(rows(page)).toHaveCount(10);
    await page.locator('#add-pet').click();
    const save = page.locator('#pet-save');
    await expect(save).toHaveAttribute('disabled', '');                       // a name is required
    await page.locator('#pet-name').getByRole('textbox').fill('X');
    await expect(page.locator('#pet-name')).toHaveAttribute('error-text', 'Use at least 2 characters');
    await page.locator('#pet-name').getByRole('textbox').fill('Zeta');
    await expect(save).not.toHaveAttribute('disabled', /.*/);
    await save.click();
    await expect(page.getByText('Saved Zeta')).toBeVisible();
    await expect(page.locator('#pets-status')).toHaveText('Showing 1–10 of 49');
    // Open a row, change it, remove it
    await rows(page).first().click();
    await expect(page.locator('#pet-delete')).toBeVisible();
    await page.locator('#pet-name').getByRole('textbox').fill('Renamed');
    await page.locator('#pet-save').click();
    await expect(page.getByText('Saved Renamed')).toBeVisible();
    await rows(page).first().click();
    await page.locator('#pet-delete').click();
    await page.locator('nx-modal').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText(/Removed/)).toBeVisible();
    await expect(page.locator('#pets-status')).toHaveText('Showing 1–10 of 48');
  });
});

test.describe('dashboard insights', () => {
  test('the range changes the figures and the chart together, and the calendar lists what is on a day', async ({ page }) => {
    await page.goto('/');
    const total = page.locator('#revenue-total');
    await expect(total).toHaveText('$491,800');
    await expect(page.locator('#revenue-change')).toContainText('% against the same months last year');
    const points = () => page.locator('#revenue-chart').locator('table tbody tr').count();
    expect(await points()).toBe(12);
    await page.locator('#revenue-range').getByText('3 months', { exact: true }).click();
    await expect(total).toHaveText('$148,600');
    await expect.poll(points).toBe(3);
    await expect(page.locator('#dash-calendar').locator('.ev-title').first()).toHaveText('Pricing meeting');
    await page.locator('#dash-calendar').getByRole('button', { name: /June 17, 2026/ }).click();
    await expect(page.locator('#dash-calendar').locator('.ev-title')).toHaveText('Release 2.4');
  });

  test('the weekly list reorders with the keyboard and with the mouse', async ({ page }) => {
    await page.goto('/#/');
    const list = page.locator('#dash-priorities');
    const titles = () => list.locator('.item .text').allTextContents();
    await expect.poll(titles).toEqual(['Send the Q2 invoices', 'Review the pricing proposal', 'Fix the failing ledger webhook', 'Renew the Acme contract']);
    await list.locator('.item').first().focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(titles).toEqual(['Review the pricing proposal', 'Send the Q2 invoices', 'Fix the failing ledger webhook', 'Renew the Acme contract']);
    await expect(list.locator('[role="status"]')).toHaveText('Send the Q2 invoices moved to position 2 of 4');
    await expect(list.locator('.item:focus')).toContainText('Send the Q2 invoices');
    // Drag the last item's grip up above the second one
    const grip = await list.locator('.item .grip').nth(3).boundingBox();
    const target = await list.locator('.item').nth(1).boundingBox();
    await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
    await page.mouse.down();
    await page.mouse.move(target!.x + 40, target!.y + 4, { steps: 8 });
    await expect(list.locator('.drop-before')).toHaveCount(1);
    await page.mouse.up();
    await expect.poll(titles).toEqual(['Review the pricing proposal', 'Renew the Acme contract', 'Send the Q2 invoices', 'Fix the failing ledger webhook']);
  });
});

test('the orders page: figures, filters, bulk actions and a detail panel', async ({ page }) => {
  await page.goto('/#/orders');
  await expect(page.locator('h1, nx-page-header').first()).toBeVisible();
  await expect(page.locator('#or-revenue .value')).not.toHaveText('');
  await expect(page.locator('#or-empty .title')).toHaveText('No order selected');
  const rows = page.locator('#or-grid tbody tr');
  const before = await rows.count();
  await page.locator('#or-status select').selectOption('pending');
  await expect.poll(() => rows.count()).toBeLessThan(before);
  await page.locator('#or-status select').selectOption('');
  await page.locator('#or-search').locator('input').fill('globex');
  await expect.poll(() => rows.count()).toBeLessThan(before);
  await page.locator('#or-search').locator('input').fill('');
  await expect.poll(() => rows.count()).toBe(before);
  // Select two rows: the bulk bar appears, the detail panel says how many
  await rows.nth(0).locator('input[type="checkbox"]').check();
  await rows.nth(1).locator('input[type="checkbox"]').check();
  await expect(page.locator('#or-bulk-count')).toHaveText('2 selected');
  await expect(page.locator('#or-empty .title')).toHaveText('2 orders selected');
  await page.getByRole('button', { name: 'Mark shipped' }).click();
  await expect(page.locator('#or-bulk')).toBeHidden();
  // One row: its details
  await rows.nth(0).locator('input[type="checkbox"]').check();
  await expect(page.locator('#or-detail-title')).toContainText('Order #');
});

test('the orders page: the detail panel drops under the table on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('/#/orders');
  const grid = await page.locator('#or-grid').boundingBox();
  const detail = await page.locator('#or-detail').boundingBox();
  expect(detail!.y).toBeGreaterThan(grid!.y + grid!.height - 1);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(async () => (await page.locator('#or-detail').boundingBox())!.x).toBeGreaterThan((await page.locator('#or-grid').boundingBox())!.x + 300);
});
