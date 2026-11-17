import { expect, test } from '@playwright/test';

test.describe('admin data table', () => {
  test('paginates rows and updates the footer', async ({ page }) => {
    await page.goto('/admin/content');

    const rows = page.locator('tbody tr:visible');
    await expect(rows).toHaveCount(5);
    await expect(page.locator('[data-datatable-page]')).toHaveText('Page 1 of 2');
    await expect(page.locator('[data-datatable-range]')).toHaveText('1–5 of 10');

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('[data-datatable-page]')).toHaveText('Page 2 of 2');
    await expect(rows).toHaveCount(5);
    await expect(page.locator('[data-datatable-range]')).toHaveText('6–10 of 10');

    await page.getByRole('button', { name: 'First page' }).click();
    await expect(page.locator('[data-datatable-page]')).toHaveText('Page 1 of 2');
  });

  test('searches, filters, and recovers from an empty result', async ({ page }) => {
    await page.goto('/admin/content');
    const search = page.locator('[data-datatable-search]');
    const rows = page.locator('tbody tr:visible');

    await search.fill('Koh Rong');
    await expect(rows).toHaveCount(1);
    await expect(page.getByRole('cell', { name: /Koh Rong/ })).toBeVisible();
    await expect(page.locator('[data-datatable-range]')).toHaveText('1–1 of 1');

    await search.fill('not-a-destination');
    await expect(rows).toHaveCount(0);
    await expect(page.locator('[data-datatable-empty]')).toBeVisible();

    await search.fill('');
    await expect(rows).toHaveCount(5);

    await page.getByRole('button', { name: 'Filter' }).click();
    await page.getByRole('checkbox', { name: 'Published' }).check();
    await expect(rows).toHaveCount(5);
    await expect(page.locator('[data-datatable-filter-count]')).toHaveText('1');
    await expect(page.locator('[data-datatable-range]')).toHaveText('1–5 of 10');

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(rows).toHaveCount(5);
  });

  test('searches and selects a province in the dropdown', async ({ page }) => {
    await page.goto('/admin/content');

    const trigger = page.getByRole('button', { name: /All provinces/ });
    await trigger.click();
    await expect(page.locator('[data-combobox-panel]')).toBeVisible();

    const search = page.locator('[data-combobox-search]');
    await search.fill('kam');
    await expect(page.getByRole('option', { name: 'Kampot' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Kep' })).toBeHidden();

    await page.getByRole('option', { name: 'Kampot' }).click();
    await expect(page.getByRole('button', { name: /Kampot/ })).toBeVisible();
    await expect(page.locator('tbody tr:visible')).toHaveCount(2);
    await expect(page.locator('[data-datatable-range]')).toHaveText('1–2 of 2');

    await page.getByRole('button', { name: /Kampot/ }).click();
    await page.getByRole('option', { name: 'All provinces' }).click();
    await expect(page.locator('tbody tr:visible')).toHaveCount(5);
  });

  test('supports keyboard selection in the searchable dropdown', async ({ page }) => {
    await page.goto('/admin/content');

    const trigger = page.getByRole('button', { name: /All provinces/ });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-combobox-panel]')).toBeVisible();
    await expect(page.locator('[data-combobox-search]')).toBeFocused();

    await page.keyboard.type('kep');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option', { name: 'Kep' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('button', { name: /Kep/ })).toBeVisible();
    await expect(page.locator('tbody tr:visible')).toHaveCount(1);
  });

  test('keeps eight columns readable at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/admin/content');

    await expect(page.locator('table thead th')).toHaveCount(8);
    const table = page.locator('[data-datatable]');
    await expect(table).toBeVisible();
  });

  test('changes rows per page', async ({ page }) => {
    await page.goto('/admin/content');

    await page.locator('[data-datatable-page-size]').selectOption('10');
    await expect(page.locator('tbody tr:visible')).toHaveCount(10);
    await expect(page.locator('[data-datatable-page]')).toHaveText('Page 1 of 1');
    await expect(page.locator('[data-datatable-range]')).toHaveText('1–10 of 10');
  });
});
