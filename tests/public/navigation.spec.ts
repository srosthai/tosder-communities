import { expect, test } from '@playwright/test';

test.describe('client navigation', () => {
  test('navigates public links without a full page reload', async ({ page }) => {
    await page.addInitScript(() => {
      const target = window as unknown as { __tosderDocumentLoads?: number };
      target.__tosderDocumentLoads = (target.__tosderDocumentLoads ?? 0) + 1;
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __tosderDocumentLoads?: number }).__tosderDocumentLoads)).toBe(1);

    await page.getByRole('banner').getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL(/\/explore$/);
    await expect(page.getByRole('heading', { name: /Find a place worth the detour/ })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __tosderDocumentLoads?: number }).__tosderDocumentLoads)).toBe(1);

    await page.getByRole('banner').getByRole('link', { name: 'Travel templates' }).click();
    await expect(page).toHaveURL(/\/templates$/);
    expect(await page.evaluate(() => (window as unknown as { __tosderDocumentLoads?: number }).__tosderDocumentLoads)).toBe(1);

    await page.getByRole('banner').getByRole('link', { name: 'Tosder Communities' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => (window as unknown as { __tosderDocumentLoads?: number }).__tosderDocumentLoads)).toBe(1);
  });

  test('keeps the theme toggle and mobile menu interactive after navigation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('banner').getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL(/\/explore$/);

    const toggle = page.getByRole('button', { name: 'Switch to dark theme' });
    await toggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.locator('[data-mobile-menu]')).toHaveClass(/is-open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-mobile-menu]')).not.toHaveClass(/is-open/);
  });
});

test.describe('admin client navigation', () => {
  test('keeps admin navigation and controls interactive', async ({ page }) => {
    await page.addInitScript(() => {
      const target = window as unknown as { __tosderDocumentLoads?: number };
      target.__tosderDocumentLoads = (target.__tosderDocumentLoads ?? 0) + 1;
    });

    await page.goto('/admin');
    await expect(page.getByRole('link', { name: 'Content', exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __tosderDocumentLoads?: number }).__tosderDocumentLoads)).toBe(1);

    await page.getByRole('link', { name: 'Content', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/content$/);
    await expect(page.getByRole('heading', { name: 'Destinations', level: 1 })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __tosderDocumentLoads?: number }).__tosderDocumentLoads)).toBe(1);

    const root = page.locator('html');
    const wasDark = await root.evaluate((element) => element.classList.contains('dark'));
    await page.locator('[data-admin-theme-toggle]').click();
    if (wasDark) {
      await expect(root).not.toHaveClass(/dark/);
    } else {
      await expect(root).toHaveClass(/dark/);
    }

    await page.keyboard.press('Control+k');
    await expect(page.locator('#command-palette')).toBeVisible();
  });
});

test.describe('client navigation components', () => {
  test('initializes the map after client navigation', async ({ page }) => {
    await page.goto('/');
    await page.locator('.destination-card', { hasText: 'Angkor Wat' }).click();
    await expect(page).toHaveURL(/\/destinations\/angkor-wat$/);
    await page.getByRole('button', { name: 'Open map' }).click();
    await expect(page.locator('[data-map-canvas]')).toBeVisible({ timeout: 20_000 });
  });

  test('keeps the admin data table interactive after client navigation', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: 'Content', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/content$/);
    const search = page.locator('[data-datatable-search]');
    await search.fill('Angkor');
    await expect(page.locator('tbody tr', { hasText: 'Angkor Wat' })).toBeVisible();
  });
});
