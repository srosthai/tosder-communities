import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('explore', () => {
  test('lists destinations with pagination', async ({ page }) => {
    await page.goto('/explore');

    await expect(page.getByRole('heading', { name: 'Find a place worth the detour.' })).toBeVisible();
    await expect(page.locator('.destination-card')).toHaveCount(6);
    await expect(page.getByText('10 places')).toBeVisible();
    await expect(page.getByText('Page 1 of 2')).toBeVisible();

    await page.getByRole('link', { name: 'Next page' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator('.destination-card')).toHaveCount(4);
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
  });

  test('searches and keeps the query in the URL', async ({ page }) => {
    await page.goto('/explore');
    await page.getByRole('searchbox', { name: 'Search destinations' }).fill('Angkor');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page).toHaveURL(/q=Angkor/);
    await expect(page.locator('.destination-card')).toHaveCount(2);
    await expect(page.locator('.results-header')).toContainText('2 places');
    await expect(page.locator('.destination-card', { hasText: 'Angkor Wat' })).toBeVisible();
    await expect(page.locator('.destination-card', { hasText: 'Ta Prohm' })).toBeVisible();
  });

  test('filters by province and category', async ({ page }) => {
    await page.goto('/explore');
    await page.getByLabel('Filter by province').selectOption('kampot');
    await expect(page).toHaveURL(/province=kampot/);
    await expect(page.locator('.destination-card', { hasText: 'Bokor Mountain' })).toBeVisible();
    await expect(page.locator('.destination-card')).toHaveCount(2);

    await page.getByRole('link', { name: 'Clear' }).click();
    await expect(page).toHaveURL(/\/explore$/);
    await expect(page.locator('.destination-card')).toHaveCount(6);

    await page.getByLabel('Filter by category').selectOption('food');
    await expect(page).toHaveURL(/category=food/);
    await expect(page.locator('.destination-card', { hasText: 'Kep crab market' })).toBeVisible();
    await expect(page.locator('.destination-card')).toHaveCount(2);
  });

  test('shows an empty state and clears filters', async ({ page }) => {
    await page.goto('/explore?q=not-a-place');
    await expect(page.getByText('No destinations match these filters')).toBeVisible();

    await page.getByRole('link', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/explore$/);
    await expect(page.locator('.destination-card')).toHaveCount(6);
  });

  test('has no serious accessibility violations in both themes', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await page.addInitScript((value) => {
        localStorage.setItem('tosder-theme', value);
      }, theme);

      await page.goto('/explore');
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (violation) =>
          violation.impact === 'critical' || violation.impact === 'serious',
      );

      expect(serious, `${theme}\n${JSON.stringify(serious, null, 2)}`).toEqual([]);
    }
  });
});
