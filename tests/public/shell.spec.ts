import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('public shell', () => {
  test('renders the header, navigation, and hero', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.headers()['x-request-id']).toMatch(/^req_/);

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /Cambodia, planned by people who have been there/,
      }),
    ).toBeVisible();

    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Explore' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Travel templates' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Leaderboard' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Get started' })).toBeVisible();
  });

  test('renders seeded destinations and featured collections', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.destination-card', { hasText: 'Angkor Wat' })).toBeVisible();
    await expect(page.locator('.destination-card', { hasText: 'Kampot riverside' })).toBeVisible();
    await expect(page.getByText('Temples and quiet roads')).toBeVisible();
    await expect(page.getByText('Coast and islands')).toBeVisible();
  });

  test('puts the skip link first in the tab order', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  });

  test('toggles and persists the public theme', async ({ page }) => {
    await page.goto('/');
    const root = page.locator('html');
    const toggle = page.getByRole('button', { name: 'Switch to dark theme' });

    await expect(root).not.toHaveClass(/dark/);
    await toggle.click();
    await expect(root).toHaveClass(/dark/);
    await expect(root).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('tosder-theme'))).toBe('dark');

    await page.reload();
    await expect(root).toHaveClass(/dark/);
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();

    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(root).not.toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem('tosder-theme'))).toBe('light');
  });

  test('opens, traps, and closes the mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const menu = page.locator('[data-mobile-menu]');
    const toggle = page.getByRole('button', { name: 'Open menu' });

    await toggle.click();
    await expect(menu).toHaveClass(/is-open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('link', { name: 'Explore' })).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(menu.getByRole('button', { name: 'Close menu' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(menu).not.toHaveClass(/is-open/);
    await expect(toggle).toBeFocused();
  });

  test('fits 320, 768, 1024, and 1440 without horizontal scroll', async ({ page }) => {
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const size = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(size.scrollWidth, `viewport ${width}`).toBeLessThanOrEqual(size.clientWidth);
    }
  });

  test('renders a useful 404 page', async ({ page }) => {
    const response = await page.goto('/not-a-real-page');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible();
  });

  test('public pages have no serious accessibility violations in both themes', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await page.addInitScript((value) => {
        localStorage.setItem('tosder-theme', value);
      }, theme);

      for (const route of [
        '/',
        '/explore',
        '/templates',
        '/leaderboard',
        '/sign-in',
        '/sign-up',
        '/forgot-password',
        '/reset-password',
        '/verify-email',
        '/status',
      ]) {
        await page.goto(route);
        const results = await new AxeBuilder({ page }).analyze();
        const serious = results.violations.filter(
          (violation) =>
            violation.impact === 'critical' || violation.impact === 'serious',
        );

        expect(serious, `${theme} ${route}\n${JSON.stringify(serious, null, 2)}`).toEqual([]);
      }
    }
  });
});
