import { expect, test } from '@playwright/test';

test.describe('admin visual', () => {
  for (const route of [
    { path: '/admin', name: 'dashboard' },
    { path: '/admin/content', name: 'content' },
  ]) {
    test(`admin ${route.name} dark`, async ({ page }) => {
      await page.goto(route.path);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({
        content: 'astro-dev-toolbar { display: none !important; }',
      });

      await expect(page).toHaveScreenshot(`admin-${route.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });

    test(`admin ${route.name} light`, async ({ page }) => {
      await page.addInitScript(() =>
        localStorage.setItem('tosder-admin-theme', 'light'),
      );
      await page.goto(route.path);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({
        content: 'astro-dev-toolbar { display: none !important; }',
      });

      await expect(page).toHaveScreenshot(`admin-${route.name}-light.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
