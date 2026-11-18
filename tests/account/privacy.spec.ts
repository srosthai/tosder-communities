import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { config } from 'dotenv';
import { adminPassword } from '../helpers/auth';

config({ path: '.env.local' });

const stamp = Date.now();
const displayName = `Privacy Test ${stamp}`;
const email = `privacy-${stamp}@example.com`;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

test.afterAll(async () => {
  await prisma.memberProfile.deleteMany({ where: { displayName } });
  await prisma.memberProfile.deleteMany({
    where: { username: { startsWith: 'deleted-' }, displayName: 'Deleted member', createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
  });
  await prisma.$disconnect();
});

test.describe.serial('account privacy', () => {
  test.skip(
    process.env.AUTH_E2E !== 'true',
    'Set AUTH_E2E=true and provide the test password.',
  );

  test.setTimeout(120_000);

  test('exports and deletes an account with confirmation', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByLabel('Display name').fill(displayName);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(adminPassword);
    await page.getByLabel('Confirm password').fill(adminPassword);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 20_000 });

    await page.goto('/creator');
    await expect(page.getByRole('heading', { name: 'Your templates, in one place.' })).toBeVisible();

    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Privacy and account data' })).toBeVisible();

    const exported = await page.request.get('/api/account/export');
    expect(exported.status()).toBe(200);
    expect(exported.headers()['content-disposition']).toContain('attachment');
    const payload = await exported.json();
    expect(payload.account.displayName).toBe(displayName);

    const rejected = await page.request.post('/api/account/delete', {
      data: { confirmation: 'delete' },
    });
    expect(rejected.status()).toBe(422);

    const deleted = await page.request.post('/api/account/delete', {
      data: { confirmation: 'DELETE' },
    });
    expect(deleted.status()).toBe(200);
    expect((await deleted.json()).data.deleted).toBe(true);

    expect((await page.request.get('/api/account/export')).status()).toBe(401);

    const profile = await prisma.memberProfile.findFirst({
      where: { displayName: 'Deleted member', deletedAt: { not: null } },
      orderBy: { updatedAt: 'desc' },
    });
    expect(profile).not.toBeNull();
    expect(profile?.username.startsWith('deleted-')).toBe(true);
    expect(profile?.suspendedAt).not.toBeNull();
  });
});
