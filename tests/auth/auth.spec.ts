import { expect, test } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.local' });

const email = `auth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const password = process.env.E2E_TEST_PASSWORD ?? '';

test.describe.serial('member authentication', () => {
  test.skip(!password, 'Set E2E_TEST_PASSWORD to run authenticated tests.');

  test('signs up and lands on the protected account page', async ({ page }) => {
    await page.goto('/sign-up');

    await page.getByLabel('Display name').fill('Test Traveler');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Test Traveler', level: 2 })).toBeVisible();
    await expect(page.getByRole('banner').getByText('Test Traveler')).toBeVisible();
  });

  test('restores the session after a reload', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/account$/);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test('rejects a wrong password with a clear message', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/account$/);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/sign-in');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toContainText('do not match');
  });

  test('redirects signed-out visitors away from the account page', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/sign-in\?redirectTo=\/account$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('renders the recovery pages', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();

    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Check your inbox for the password reset link')).toBeVisible();

    await page.goto('/reset-password');
    await expect(page.getByText('This reset link is missing a token')).toBeVisible();

    await page.goto('/verify-email');
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
    await page.getByLabel('Email address').first().fill(email);
    await page.getByRole('button', { name: 'Send verification code' }).click();
    await expect(page.getByRole('status')).toContainText('verification code is on its way');
  });
});
