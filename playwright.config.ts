import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {})
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: [
    {
      command: 'pnpm dev --port 5173 --strictPort',
      port: 5173,
      reuseExistingServer: !process.env.CI
    },
    {
      // examples/server: a non-JSX template app pre-rendered with renderHTML()
      command: 'PORT=5174 pnpm example:server',
      port: 5174,
      reuseExistingServer: !process.env.CI
    }
  ]
});
