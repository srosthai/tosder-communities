import { expect, type Page } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.local' });

export const adminEmail = process.env.E2E_TEST_EMAIL ?? 'admin@example.com';
export const adminPassword = process.env.E2E_TEST_PASSWORD ?? '';

async function attemptSignIn(page: Page) {
  await page.goto('/sign-in');

  // A valid session redirects straight to the account page.
  if (new URL(page.url()).pathname === '/account') return true;

  await page.getByLabel('Email address').fill(adminEmail);
  await page.getByLabel('Password', { exact: true }).fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page
    .waitForURL(/\/account$/, { timeout: 15_000 })
    .catch(() => undefined);
  return new URL(page.url()).pathname === '/account';
}

export async function ensureAdmin(page: Page) {
  if (!adminPassword) {
    throw new Error('Set E2E_TEST_PASSWORD in .env.local or the test environment.');
  }
  if (await attemptSignIn(page)) return;
  await new Promise((resolve) => setTimeout(resolve, 1500));
  if (await attemptSignIn(page)) return;

  await page.goto('/sign-up');
  await page.getByLabel('Display name').fill('Content Admin');
  await page.getByLabel('Email address').fill(adminEmail);
  await page.getByLabel('Password', { exact: true }).fill(adminPassword);
  await page.getByLabel('Confirm password').fill(adminPassword);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/(account|sign-up)$/, { timeout: 15_000 }).catch(() => undefined);

  if (new URL(page.url()).pathname === '/sign-up') {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (await attemptSignIn(page)) return;
  }

  await expect(page).toHaveURL(/\/account$/, { timeout: 15_000 });
}
