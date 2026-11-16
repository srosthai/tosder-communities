import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('admin theme', () => {
  test('toggles between dark and light and persists the choice', async ({ page }) => {
    await page.goto('/admin');
    const root = page.locator('html');
    const toggle = page.getByRole('button', { name: 'Switch to light theme' });

    await expect(root).toHaveClass(/dark/);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();

    await expect(root).not.toHaveClass(/dark/);
    await expect(root).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('tosder-admin-theme'))).toBe('light');

    await page.reload();
    await expect(root).not.toHaveClass(/dark/);
    await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();

    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(root).toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem('tosder-admin-theme'))).toBe('dark');
  });

  test('light admin pages have no serious accessibility violations', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tosder-admin-theme', 'light'));

    for (const route of ['/admin', '/admin/content', '/admin/templates', '/admin/users']) {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (violation) =>
          violation.impact === 'critical' || violation.impact === 'serious',
      );

      expect(serious, `${route}\n${JSON.stringify(serious, null, 2)}`).toEqual([]);
    }
  });
});
