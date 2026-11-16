import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('destination detail', () => {
  test('renders the destination, tips, and related places', async ({ page }) => {
    await page.goto('/destinations/angkor-wat');

    await expect(page.getByRole('heading', { name: 'Angkor Wat', level: 1 })).toBeVisible();
    await expect(page.getByText('Practical tips')).toBeVisible();
    await expect(page.getByText('Templates that include Angkor Wat')).toBeVisible();
    await expect(page.getByText('No templates yet')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'More in Siem Reap' })).toBeVisible();
    await expect(page.locator('.destination-card', { hasText: 'Ta Prohm' })).toBeVisible();

    await page.getByRole('link', { name: 'Explore', exact: true }).first().click();
    await expect(page).toHaveURL(/\/explore$/);
  });

  test('returns a designed 404 for an unknown destination', async ({ page }) => {
    const response = await page.goto('/destinations/not-a-real-place');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Destination not found.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Explore' })).toBeVisible();
  });

  test('is reachable from an Explore card', async ({ page }) => {
    await page.goto('/explore');
    await page.locator('.destination-card', { hasText: 'Angkor Wat' }).click();
    await expect(page).toHaveURL(/\/destinations\/angkor-wat$/);
    await expect(page.getByRole('heading', { name: 'Angkor Wat', level: 1 })).toBeVisible();
  });

  test('has no serious accessibility violations in both themes', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await page.addInitScript((value) => {
        localStorage.setItem('tosder-theme', value);
      }, theme);

      await page.goto('/destinations/angkor-wat');
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (violation) =>
          violation.impact === 'critical' || violation.impact === 'serious',
      );

      expect(serious, `${theme}\n${JSON.stringify(serious, null, 2)}`).toEqual([]);
    }
  });
});
