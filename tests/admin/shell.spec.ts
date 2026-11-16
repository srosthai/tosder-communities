import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('admin shell', () => {
  test('renders navigation and the active section', async ({ page }) => {
    await page.goto('/admin/content');

    await expect(page.getByRole('heading', { name: 'Destinations', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Content', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();

    const headers = page.locator('table thead th');
    await expect(headers).toHaveCount(8);
  });

  test('opens the command palette, filters, and navigates', async ({ page }) => {
    await page.goto('/admin');

    await page.keyboard.press('Control+k');
    const palette = page.locator('#command-palette');
    await expect(palette).toBeVisible();
    await expect(page.locator('#command-input')).toBeFocused();

    await page.locator('#command-input').fill('content');
    await expect(page.getByRole('option', { name: /Content/ })).toBeVisible();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/admin\/content$/);
    await expect(page.getByRole('heading', { name: 'Destinations', level: 1 })).toBeVisible();
  });

  test('closes the palette with Escape and restores focus', async ({ page }) => {
    await page.goto('/admin');
    const trigger = page.getByRole('button', { name: 'Search' });

    await trigger.click();
    await expect(page.locator('#command-palette')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.locator('#command-palette')).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('opens the keyboard shortcut dialog with ?', async ({ page }) => {
    await page.goto('/admin');

    await page.keyboard.press('?');
    const dialog = page.locator('#shortcuts-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Open command palette')).toBeVisible();
    await expect(dialog.getByText('Go to Moderation')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('persists the collapsed sidebar', async ({ page }) => {
    await page.goto('/admin');
    const shell = page.locator('.admin-shell');
    const toggle = page.getByRole('button', { name: 'Collapse sidebar' });

    await expect(shell).toHaveAttribute('data-collapsed', 'false');
    await toggle.click();
    await expect(shell).toHaveAttribute('data-collapsed', 'true');

    await page.reload();
    await expect(shell).toHaveAttribute('data-collapsed', 'true');
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  });

  test('does not trigger shortcuts while typing in a field', async ({ page }) => {
    await page.goto('/admin/content');
    const search = page.locator('[data-datatable-search]');
    await search.focus();

    await page.keyboard.press('?');
    await expect(page.locator('#shortcuts-dialog')).not.toBeVisible();
    await expect(search).toHaveValue('?');
  });

  test('opens and closes the mobile drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin');

    const shell = page.locator('.admin-shell');
    const menu = page.getByRole('button', { name: 'Open navigation' });

    await menu.click();
    await expect(shell).toHaveAttribute('data-mobile-open', 'true');
    await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(shell).toHaveAttribute('data-mobile-open', 'false');
    await expect(menu).toBeFocused();
  });

  test('admin pages have no serious accessibility violations', async ({ page }) => {
    for (const route of ['/admin', '/admin/content', '/admin/moderation', '/admin/competitions']) {
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
