/**
 * Server rendering in a real browser: the SSG example (examples/ssg) is built
 * once, then served as static files. Checks that pages render before
 * JavaScript, hydrate without errors, and post forms natively.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve('examples/ssg/dist');
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript' };

test.beforeAll(() => {
  execFileSync('npx', ['tsx', 'examples/ssg/build.tsx'], { stdio: 'pipe' });
});

/** Serve examples/ssg/dist under /ssg/ and record form posts. */
async function serve(page: Page) {
  const posts: { url: string; body: URLSearchParams }[] = [];
  await page.route('**/ssg/**', route => {
    const file = path.join(dist, new URL(route.request().url()).pathname.replace('/ssg/', ''));
    route.fulfill({ body: readFileSync(file), contentType: types[path.extname(file)] ?? 'text/plain' });
  });
  await page.route(/\/(contact|subscribe)$/, route => {
    const request = route.request();
    posts.push({ url: new URL(request.url()).pathname, body: new URLSearchParams(request.postData() ?? '') });
    route.fulfill({ body: '<p id="thanks">Thanks</p>', contentType: 'text/html' });
  });
  return posts;
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => m.type() === 'error' && !m.location().url.endsWith('/favicon.ico') && errors.push(m.text()));
  return errors;
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('pages are fully rendered from Declarative Shadow DOM', async ({ page }) => {
    await serve(page);
    await page.goto('/ssg/index.html');
    await expect(page.getByRole('heading', { name: 'Rendered at build time' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Say hello' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Releases', selected: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Server rendering, template engines' })).toBeVisible();
    // Undefined (not yet upgraded) elements are not hidden when server-rendered
    await expect(page.locator('nx-card')).toBeVisible();
  });
});

test.describe('with JavaScript', () => {
  test('hydrates in place without errors and becomes interactive', async ({ page }) => {
    const errors = collectErrors(page);
    await serve(page);
    await page.goto('/ssg/index.html');
    await page.waitForFunction(() => !!customElements.get('nx-card'));

    // Upgraded, not duplicated
    expect(await page.locator('nx-card').evaluate(el => el.shadowRoot!.querySelectorAll('.card').length)).toBe(1);
    expect(await page.locator('nx-grid tbody tr').count()).toBe(3);

    await page.getByRole('tab', { name: 'FAQ' }).click();
    await expect(page.getByText('No — this page is plain HTML on a CDN.')).toBeVisible();
    await page.getByRole('button', { name: 'Can I use my own template engine?' }).click();
    await expect(page.getByText('Yes, pipe its HTML through renderHTML().')).toBeVisible();

    await page.getByRole('button', { name: 'Say hello' }).click();
    await expect(page.getByText('Hello from the client')).toBeVisible();

    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(errors).toEqual([]);
  });

  test('the saved theme applies before first paint', async ({ page, context }) => {
    await serve(page);
    await context.addCookies([{ name: 'nx-theme', value: 'dark', url: 'http://localhost:5173' }]);
    await page.route('**/ssg/client.js', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
    await page.goto('/ssg/index.html');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('native <form> validates nx fields and posts their values', async ({ page }) => {
    const errors = collectErrors(page);
    const posts = await serve(page);
    await page.goto('/ssg/contact.html');
    await page.waitForFunction(() => !!customElements.get('nx-textfield'));
    const contact = page.locator('#contact');

    const send = contact.getByRole('button', { name: 'Send' });
    await send.click();
    // Blocked by constraint validation; the error shows on the field
    await expect(contact.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(posts).toHaveLength(0);

    await contact.getByLabel('Email').fill('ada@example.com');
    await contact.getByLabel('Message').fill('Hello there, Nexaro!');
    await contact.getByLabel('Topic').selectOption('support');
    await contact.getByText('Send me the newsletter').click();
    await expect(contact.getByRole('checkbox', { name: 'Send me the newsletter' })).toBeChecked();
    await send.click();
    await expect(page.locator('#thanks')).toBeVisible();

    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe('/contact');
    expect(Object.fromEntries(posts[0].body)).toEqual({
      email: 'ada@example.com',
      topic: 'support',
      message: 'Hello there, Nexaro!',
      newsletter: 'on',
      intent: 'send'
    });
    expect(errors).toEqual([]);
  });

  test('reset buttons reset a native form', async ({ page }) => {
    await serve(page);
    await page.goto('/ssg/contact.html');
    await page.waitForFunction(() => !!customElements.get('nx-textfield'));
    const contact = page.locator('#contact');
    await contact.getByLabel('Email').fill('x@example.com');
    await contact.getByRole('button', { name: 'Reset' }).click();
    await expect(contact.getByLabel('Email')).toHaveValue('');
  });

  test('<nx-form action> posts natively after validation', async ({ page }) => {
    const posts = await serve(page);
    await page.goto('/ssg/contact.html');
    await page.waitForFunction(() => !!customElements.get('nx-form'));
    const form = page.locator('#subscribe');

    await form.getByRole('button', { name: 'Subscribe' }).click();
    await expect(form.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(posts).toHaveLength(0);

    await form.getByLabel('Name').fill('Grace');
    await form.getByLabel('Email').fill('grace@example.com');
    await form.getByLabel('Email').press('Enter');
    await expect(page.locator('#thanks')).toBeVisible();
    expect(posts.map(p => [p.url, Object.fromEntries(p.body)])).toEqual([
      ['/subscribe', { name: 'Grace', email: 'grace@example.com' }]
    ]);
  });
});

test('every server-rendered component works after hydration', async ({ page }) => {
  const errors = collectErrors(page);
  await serve(page);
  await page.goto('/ssg/components.html');
  await page.waitForFunction(() => !!customElements.get('nx-card'));

  await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();
  await expect(page.locator('nx-breadcrumb')).toContainText('Components');

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('menuitem', { name: 'File' }).click();
  await expect(page.getByRole('menuitem', { name: 'Open…' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Open dialog' }).click();
  await expect(page.getByRole('dialog', { name: 'Server-rendered dialog' })).toBeVisible();
  await page.locator('#close-dialog').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Open drawer' }).click();
  await expect(page.getByRole('dialog', { name: 'Drawer' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('treeitem', { name: 'ssr' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('treeitem', { name: 'ssr' })).toHaveAttribute('aria-expanded', 'true');

  const profile = page.locator('#profile');
  await profile.getByLabel('Name').fill('Ada');
  await profile.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('"name":"Ada"')).toBeVisible();
  expect(errors).toEqual([]);
});

/** Box and visible text of every Nexaro element, in document order. */
async function layout(page: Page) {
  await page.waitForTimeout(600); // entrance animations
  return page.evaluate(() => Array.from(document.querySelectorAll('body *'))
    .filter(el => el.localName.startsWith('nx-'))
    .map(el => {
      const r = el.getBoundingClientRect();
      return `${el.localName} ${[r.x, r.y, r.width, r.height].map(Math.round).join(',')} ${(el as HTMLElement).innerText.replace(/\s+/g, ' ').trim().slice(0, 60)}`;
    }));
}

for (const name of ['index', 'components', 'contact']) {
  test(`hydration moves nothing: ${name}.html`, async ({ browser }) => {
    const open = async (javaScriptEnabled: boolean) => {
      const page = await (await browser.newContext({ javaScriptEnabled, baseURL: 'http://localhost:5173' })).newPage();
      const errors = collectErrors(page);
      await serve(page);
      await page.goto(`/ssg/${name}.html`);
      if (javaScriptEnabled) await page.waitForFunction(() => !!customElements.get('nx-card'));
      return { boxes: await layout(page), errors };
    };
    const [before, after] = [await open(false), await open(true)];
    expect(after.boxes).toEqual(before.boxes);
    expect(after.errors).toEqual([]);
  });
}

for (const theme of ['light', 'dark']) {
  for (const name of ['index', 'contact']) {
    test(`a11y: ssg ${name}.html (${theme})`, async ({ page, context }) => {
      await serve(page);
      await context.addCookies([{ name: 'nx-theme', value: theme, url: 'http://localhost:5173' }]);
      await page.goto(`/ssg/${name}.html`);
      await page.waitForFunction(() => !!customElements.get('nx-card'));
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const summary = results.violations.map(v => `${v.id} × ${v.nodes.length}: ${v.nodes.slice(0, 3).map(n => n.target.join(' >>> ')).join(', ')}`);
      expect(summary, summary.join('\n')).toEqual([]);
    });
  }
}

test.describe('template-engine server (examples/server)', () => {
  const app = 'http://localhost:5174';

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('the page arrives rendered, JSON config included', async ({ page }) => {
      await page.goto(app);
      await expect(page.getByRole('cell', { name: 'Grace Hopper' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Invite' })).toBeVisible();
      await expect(page.getByLabel('Role')).toHaveValue('Viewer');
    });
  });

  test('a form inside <nx-form> posts natively, then redirects', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(app);
    await page.waitForFunction(() => !!customElements.get('nx-form'));
    await page.getByLabel('Name').fill('Barbara Liskov');
    await page.getByLabel('Email').fill('barbara@example.com');
    await page.getByLabel('Role').selectOption('Editor');
    await page.getByLabel('Email').press('Enter');

    await expect(page).toHaveURL(/invited=Barbara/);
    await expect(page.getByText('Barbara Liskov was invited.')).toBeVisible();
    await expect(page.getByRole('row', { name: /Barbara Liskov barbara@example.com Editor/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
