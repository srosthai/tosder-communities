import { expect, test } from '@playwright/test';

test.describe('leaflet maps', () => {
  test('loads the detail map on demand and keeps a list fallback', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/destinations/angkor-wat');

    await expect(page.getByText('1 place on the map')).toBeVisible();
    await expect(page.locator('.leaflet-container')).toHaveCount(0);
    await page.locator('.map__list summary').click();
    await expect(page.locator('.map__list a', { hasText: 'Angkor Wat' })).toBeVisible();

    await page.getByRole('button', { name: 'Open map' }).click();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('loads the explore map with the current result set', async ({ page }) => {
    await page.goto('/explore');

    await expect(page.getByText('6 places on the map')).toBeVisible();
    await expect(page.locator('.leaflet-container')).toHaveCount(0);

    await page.getByRole('button', { name: 'Open map' }).click();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await page.locator('.map__list summary').click();
    await expect(page.locator('.map__list a')).toHaveCount(6);
  });
});
