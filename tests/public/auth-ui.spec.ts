import { expect, test } from '@playwright/test';

test.describe('authentication UI', () => {
  test('renders the split sign-in layout and starts Google OAuth', async ({ page }) => {
    const response = await page.goto('/sign-in');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();

    // CI uses a placeholder Neon Auth URL; the real OAuth redirect is checked
    // against the local/dev auth branch.
    if (!process.env.CI) {
      await page.getByRole('button', { name: 'Continue with Google' }).click();
      await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 20_000 });
      expect(new URL(page.url()).hostname).toMatch(/google\.com|neon\.tech/);
    }
  });

  test('renders the split sign-up layout and Google option', async ({ page }) => {
    const response = await page.goto('/sign-up');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByLabel('Display name')).toBeVisible();
    await expect(page.getByLabel('Confirm password')).toBeVisible();
    await expect(page.getByText('By creating an account')).toBeVisible();

    if (!process.env.CI) {
      await page.getByRole('button', { name: 'Continue with Google' }).click();
      await page.waitForURL((url) => !url.pathname.startsWith('/sign-up'), { timeout: 20_000 });
      expect(new URL(page.url()).hostname).toMatch(/google\.com|neon\.tech/);
    }
  });
});
