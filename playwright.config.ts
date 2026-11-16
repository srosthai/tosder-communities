import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
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
  reporter: [['list']],
});
