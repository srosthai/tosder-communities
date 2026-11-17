import { expect, type Page } from '@playwright/test';

export const adminEmail = 'admin@example.com';
export const adminPassword = 'AdminTest123!';

async function attemptSignIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(adminEmail);
  await page.getByLabel('Password', { exact: true }).fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page
    .waitForURL(/\/(account|sign-in)$/, { timeout: 10_000 })
    .catch(() => undefined);
  return new URL(page.url()).pathname === '/account';
}

export async function ensureAdmin(page: Page) {
  if (await attemptSignIn(page)) return;
  if (await attemptSignIn(page)) return;

  await page.goto('/sign-up');
  await page.getByLabel('Display name').fill('Content Admin');
  await page.getByLabel('Email address').fill(adminEmail);
  await page.getByLabel('Password', { exact: true }).fill(adminPassword);
  await page.getByLabel('Confirm password').fill(adminPassword);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 15_000 });
}
