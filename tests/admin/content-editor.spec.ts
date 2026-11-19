import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { ensureAdmin } from '../helpers/auth';
import { config } from 'dotenv';

config({ path: '.env.local' });

const createdSlugs: string[] = [];

test.afterAll(async () => {
  if (createdSlugs.length === 0) return;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const destinations = await prisma.destination.findMany({
    where: { slug: { in: createdSlugs } },
    select: { id: true },
  });
  const ids = destinations.map((destination) => destination.id);
  if (ids.length > 0) {
    await prisma.auditEvent.deleteMany({
      where: { entityType: 'destination', entityId: { in: ids } },
    });
  }
  await prisma.destination.deleteMany({ where: { slug: { in: createdSlugs } } });
  await prisma.$disconnect();
});


test.describe.serial('admin content editor', () => {
  test.skip(
    process.env.AUTH_E2E !== 'true',
    'Set AUTH_E2E=true and provide the test admin account to run authenticated admin tests.',
  );

  test('creates, previews, publishes, and archives a destination', async ({ page, request }) => {
    await ensureAdmin(page);

    const stamp = Date.now();
    const name = `Editor Test Beach ${stamp}`;
    const slug = `editor-test-${stamp}`;
    createdSlugs.push(slug);
    await page.goto('/admin/content/new');
    await expect(page.getByRole('heading', { name: 'New destination', level: 1 })).toBeVisible();

    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Slug').fill(slug);
    await page.getByLabel('Province').selectOption({ label: 'Siem Reap' });
    await page.getByLabel('Summary').fill('A test destination created through the admin editor.');
    await page
      .getByLabel('Description')
      .fill('This destination verifies the server-side create, edit, publish, and archive workflow.');
    await page.getByLabel('Practical tips').fill('Bring water and check the opening hours.');
    await page.getByLabel('Latitude').fill('13.4125');
    await page.getByLabel('Longitude').fill('103.8670');
    await page.getByLabel('Temple').check();
    await page.getByLabel('Sunrise').check();
    await page.getByLabel('Image URL').first().fill('/image/placeholder-destination.svg');
    await page.getByLabel('Alt text').first().fill('A placeholder landscape for the editor test.');
    await page.getByLabel('Credit / rights').first().fill('Tosder editorial placeholder');
    await page
      .getByLabel('Image URL')
      .nth(1)
      .fill('/image/placeholder-destination.svg?photo=2');
    await page.getByLabel('Alt text').nth(1).fill('A second placeholder for ordering.');
    await page.getByLabel('Credit / rights').nth(1).fill('Tosder editorial placeholder');
    await page.getByRole('button', { name: 'Move photo 2 up' }).click();
    await page.getByRole('button', { name: 'Create destination' }).click();

    await expect(page).toHaveURL(/\/admin\/content\/[0-9a-f-]+(?:\?saved=1)?$/);
    await expect(page.getByText('Destination saved.')).toBeVisible();
    await expect(page.getByLabel('Image URL').first()).toHaveValue(
      '/image/placeholder-destination.svg?photo=2',
    );
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();

    await page.goto(`/destinations/${slug}`);
    await expect(page.getByText(/Preview · Draft/)).toBeVisible();
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Back to editor' }).click();

    await page.getByLabel('Status').selectOption('PUBLISHED');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Destination saved.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View public page' })).toBeVisible();

    await page.goto(`/destinations/${slug}`);
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
    await expect(page.getByText(/Preview · Draft/)).toHaveCount(0);

    await page.goto('/admin/content');
    await page.getByRole('searchbox', { name: 'Search destinations' }).fill(name);
    await page
      .locator('tbody tr', { hasText: name })
      .getByRole('link', { name: /Edit/ })
      .click();
    await page.getByLabel('Status').selectOption('ARCHIVED');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Destination saved.')).toBeVisible();

    const archived = await request.get(`/destinations/${slug}`);
    expect(archived.status()).toBe(404);
  });

  test('requires a content-admin session', async ({ page }) => {
    await page.goto('/admin/content/new');
    await expect(page).toHaveURL(/\/sign-in\?redirectTo=%2Fadmin%2Fcontent%2Fnew$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});
