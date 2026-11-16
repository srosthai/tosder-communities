import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: process.env.AUTH_E2E === 'true' ? [] : ['tests/auth/**'],
  timeout: 30_000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.001,
      animations: 'disabled',
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4321',
    viewport: { width: 1440, height: 1200 },
    colorScheme: 'light',
  },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
