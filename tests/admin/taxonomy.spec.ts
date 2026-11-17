import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { config } from 'dotenv';
import { ensureAdmin } from '../helpers/auth';

config({ path: '.env.local' });

const stamp = Date.now();
const prefix = `Taxonomy test ${stamp}`;
const slugs = {
  province: `taxonomy-province-${stamp}`,
  category: `taxonomy-category-${stamp}`,
  tag: `taxonomy-tag-${stamp}`,
  collection: `taxonomy-collection-${stamp}`,
};
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

test.afterAll(async () => {
  await prisma.featuredCollection.deleteMany({ where: { slug: slugs.collection } });
  await prisma.province.deleteMany({ where: { slug: slugs.province } });
  await prisma.category.deleteMany({ where: { slug: slugs.category } });
  await prisma.tag.deleteMany({ where: { slug: slugs.tag } });
  await prisma.auditEvent.deleteMany({
    where: { summary: { contains: String(stamp) } },
  });
  await prisma.$disconnect();
});

test.describe.serial('content taxonomy', () => {
  test.skip(
    process.env.AUTH_E2E !== 'true',
    'Set AUTH_E2E=true and provide the test admin account.',
  );

  test.setTimeout(120_000);

  test('creates, edits, and archives taxonomy records with audit entries', async ({ page }) => {
    await ensureAdmin(page);

    await page.goto('/admin/content/taxonomy?tab=provinces');
    await page.getByLabel('Name').first().fill(`${prefix} province`);
    await page.getByLabel('Slug').first().fill(slugs.province);
    await page.getByLabel('Summary').first().fill('A test province for taxonomy coverage.');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(page.getByText(`${prefix} province`)).toBeVisible();

    const provinceRow = page.locator('details.row', { hasText: `${prefix} province` });
    await provinceRow.locator('summary').click();
    await provinceRow.getByLabel('Name').fill(`${prefix} province edited`);
    await provinceRow.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(page.getByText(`${prefix} province edited`)).toBeVisible();

    await page.goto('/admin/content/taxonomy?tab=categories');
    await page.getByLabel('Name').first().fill(`${prefix} category`);
    await page.getByLabel('Slug').first().fill(slugs.category);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.goto('/admin/content/taxonomy?tab=tags');
    await page.getByLabel('Name').first().fill(`${prefix} tag`);
    await page.getByLabel('Slug').first().fill(slugs.tag);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    const destination = await prisma.destination.findFirst({
      where: { status: 'PUBLISHED' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(destination).not.toBeNull();

    await page.goto('/admin/content/taxonomy?tab=collections');
    await page.getByLabel('Title').first().fill(`${prefix} collection`);
    await page.getByLabel('Slug').first().fill(slugs.collection);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    const collectionRow = page.locator('details.row', { hasText: `${prefix} collection` });
    await collectionRow.locator('summary').click();
    await collectionRow.getByRole('checkbox', { name: new RegExp(destination!.name) }).check();
    await collectionRow.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    const collection = await prisma.featuredCollection.findUnique({
      where: { slug: slugs.collection },
      include: { items: true },
    });
    expect(collection?.items).toHaveLength(1);

    await page.goto(`/admin/content/taxonomy?tab=collections&q=${slugs.collection}`);
    const archivedRow = page.locator('details.row', { hasText: `${prefix} collection` });
    await archivedRow.locator('summary').click();
    await archivedRow.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText('Archived.')).toBeVisible();
    expect(
      (await prisma.featuredCollection.findUnique({ where: { slug: slugs.collection } }))?.status,
    ).toBe('ARCHIVED');

    await page.goto('/admin/audit?action=province');
    await expect(page.getByText(`${prefix} province edited`).first()).toBeVisible();
    await page.goto('/admin/audit?action=collection');
    await expect(page.getByText(`${prefix} collection`).first()).toBeVisible();
  });
});
