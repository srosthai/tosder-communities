import { expect, test } from '@playwright/test';

test.describe('public visual', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`home ${theme}`, async ({ page }) => {
      await page.addInitScript((value) => {
        localStorage.setItem('tosder-theme', value);
      }, theme);
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({
        content: 'astro-dev-toolbar { display: none !important; }',
      });

      await expect(page).toHaveScreenshot(`public-home-${theme}.png`, {
        fullPage: true,
      });
    });
  }

  test('explore light', async ({ page }) => {
    await page.goto('/explore');
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: 'astro-dev-toolbar { display: none !important; }',
    });

    await expect(page).toHaveScreenshot('public-explore-light.png', {
      fullPage: true,
    });
  });

  test('destination detail light', async ({ page }) => {
    await page.goto('/destinations/angkor-wat');
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: 'astro-dev-toolbar { display: none !important; }',
    });

    await expect(page).toHaveScreenshot('public-destination-light.png', {
      fullPage: true,
    });
  });

  test('404 page', async ({ page }) => {
    await page.goto('/not-a-real-page');
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: 'astro-dev-toolbar { display: none !important; }',
    });

    await expect(page).toHaveScreenshot('public-404.png', { fullPage: true });
  });
});
