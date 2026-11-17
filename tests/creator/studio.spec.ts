import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.local' });

const adminEmail = 'admin@example.com';
const adminPassword = 'AdminTest123!';
const stamp = Date.now();
const prefixes = [`Studio test ${stamp}`, `API studio test ${stamp}`];

async function ensureAdmin(page: import('@playwright/test').Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(adminEmail);
  await page.getByLabel('Password', { exact: true }).fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForURL(/\/account$/, { timeout: 5000 }).catch(() => undefined);

  if (new URL(page.url()).pathname === '/sign-in') {
    await page.goto('/sign-up');
    await page.getByLabel('Display name').fill('Content Admin');
    await page.getByLabel('Email address').fill(adminEmail);
    await page.getByLabel('Password', { exact: true }).fill(adminPassword);
    await page.getByLabel('Confirm password').fill(adminPassword);
    await page.getByRole('button', { name: 'Create account' }).click();
  }

  await expect(page).toHaveURL(/\/account$/);
}

test.afterAll(async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const templates = await prisma.travelTemplate.findMany({
    where: {
      OR: prefixes.map((prefix) => ({ title: { startsWith: prefix } })),
    },
    select: { id: true },
  });
  const ids = templates.map((template) => template.id);
  if (ids.length > 0) {
    await prisma.auditEvent.deleteMany({
      where: { entityType: 'travel_template', entityId: { in: ids } },
    });
    await prisma.travelTemplate.updateMany({
      where: { id: { in: ids } },
      data: { publishedVersionId: null },
    });
    await prisma.travelTemplate.deleteMany({ where: { id: { in: ids } } });
  }

  const otherProfiles = await prisma.memberProfile.findMany({
    where: { username: { startsWith: 'studio-other' } },
    select: { userId: true },
  });
  const otherIds = otherProfiles.map((profile) => profile.userId);
  if (otherIds.length > 0) {
    const otherTemplates = await prisma.travelTemplate.findMany({
      where: { creatorId: { in: otherIds } },
      select: { id: true },
    });
    const otherTemplateIds = otherTemplates.map((template) => template.id);
    if (otherTemplateIds.length > 0) {
      await prisma.travelTemplate.updateMany({
        where: { id: { in: otherTemplateIds } },
        data: { publishedVersionId: null },
      });
      await prisma.travelTemplate.deleteMany({ where: { id: { in: otherTemplateIds } } });
    }
    await prisma.auditEvent.deleteMany({
      where: { actorId: { in: otherIds } },
    });
    await prisma.memberProfile.deleteMany({ where: { userId: { in: otherIds } } });
  }

  await prisma.$disconnect();
});

test.describe.serial('Creator Studio', () => {
  test.skip(
    process.env.AUTH_E2E !== 'true',
    'Set AUTH_E2E=true and provide the test admin account to run creator tests.',
  );

  test('creates, renames, submits, duplicates, archives, and restores', async ({ page }) => {
    await ensureAdmin(page);
    await page.goto('/creator');
    await expect(page.getByRole('heading', { name: 'Your templates, in one place.' })).toBeVisible();

    await page.getByRole('button', { name: 'Create template' }).click();
    await expect(page).toHaveURL(/\/creator\?notice=created&open=[0-9a-f-]+$/);
    const templateId = new URL(page.url()).searchParams.get('open');
    expect(templateId).toBeTruthy();

    await page.getByRole('link', { name: /Open the editor/ }).click();
    await expect(page.getByRole('heading', { name: 'Untitled template' })).toBeVisible();
    await page.getByLabel('Title', { exact: true }).fill(`Studio test ${stamp}`);
    await page.getByLabel('Summary').fill('A two-day test itinerary.');
    await page.getByLabel('Province').selectOption({ label: 'Siem Reap' });
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL(/step=details/);

    await page.goto('/creator');
    const row = page.locator(`[data-template-id="${templateId}"]`);
    await expect(row).toContainText(`Studio test ${stamp}`);
    await expect(row).toContainText('Draft');

    await row.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('Submitted for review.')).toBeVisible();
    await expect(page.locator(`[data-template-id="${templateId}"]`)).toContainText('In review');

    await page.locator(`[data-template-id="${templateId}"]`).getByRole('button', { name: 'Duplicate' }).click();
    await expect(page.getByText('A copy was created as an independent draft.')).toBeVisible();
    await expect(page.locator('.template-row', { hasText: `${stamp} (copy)` })).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator(`[data-template-id="${templateId}"]`).getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText('Template archived.')).toBeVisible();
    await expect(page.locator(`[data-template-id="${templateId}"]`)).toContainText('Archived');

    await page.locator(`[data-template-id="${templateId}"]`).getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('Template restored as a draft.')).toBeVisible();
    await expect(page.locator(`[data-template-id="${templateId}"]`)).toContainText('Draft');

    await page.getByRole('searchbox', { name: 'Search templates' }).fill(`Studio test ${stamp}`);
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('.template-row')).toHaveCount(2);
    await expect(page.getByText('2 templates')).toBeVisible();
  });

  test('enforces lifecycle transitions through the API', async ({ page }) => {
    await ensureAdmin(page);

    const created = await page.request.post('/api/creator/templates', {
      data: { title: `API studio test ${stamp}` },
    });
    expect(created.status()).toBe(201);
    const body = await created.json();
    const id = body.data.id as string;
    expect(body.data.status).toBe('DRAFT');

    const submitted = await page.request.post(`/api/creator/templates/${id}/submit-review`);
    expect(submitted.status()).toBe(200);
    expect((await submitted.json()).data.status).toBe('PENDING_REVIEW');

    const invalid = await page.request.post(`/api/creator/templates/${id}/submit-review`);
    expect(invalid.status()).toBe(409);
    expect((await invalid.json()).error.code).toBe('invalid_transition');

    const archived = await page.request.post(`/api/creator/templates/${id}/archive`);
    expect(archived.status()).toBe(200);
    expect((await archived.json()).data.status).toBe('ARCHIVED');

    const restored = await page.request.post(`/api/creator/templates/${id}/restore`);
    expect(restored.status()).toBe(200);
    expect((await restored.json()).data.status).toBe('DRAFT');

    const duplicate = await page.request.post(`/api/creator/templates/${id}/duplicate`);
    expect(duplicate.status()).toBe(200);
    const copy = (await duplicate.json()).data;
    expect(copy.id).not.toBe(id);
    expect(copy.status).toBe('DRAFT');
    expect(copy.title).toContain('(copy)');
  });

  test('rejects unauthenticated creator API requests and redirects the studio', async ({
    page,
    request,
  }) => {
    const unauthenticated = await request.post('/api/creator/templates', {
      data: { title: 'Should not exist' },
    });
    expect(unauthenticated.status()).toBe(401);
    expect((await unauthenticated.json()).error.code).toBe('unauthenticated');

    await page.goto('/creator');
    await expect(page).toHaveURL(/\/sign-in\?redirectTo=%2Fcreator$/);
  });

  test('hides another creator’s template from the studio and API', async ({ page, browser }) => {
    await ensureAdmin(page);

    const created = await page.request.post('/api/creator/templates', {
      data: { title: `Studio test ${stamp} owner` },
    });
    expect(created.status()).toBe(201);
    const id = (await created.json()).data.id as string;

    const context = await browser.newContext();
    const otherPage = await context.newPage();
    await otherPage.goto('/sign-up');
    await otherPage.getByLabel('Display name').fill(`Studio Other ${stamp}`);
    await otherPage.getByLabel('Email address').fill(`studio-other-${stamp}@example.com`);
    await otherPage.getByLabel('Password', { exact: true }).fill(adminPassword);
    await otherPage.getByLabel('Confirm password').fill(adminPassword);
    await otherPage.getByRole('button', { name: 'Create account' }).click();
    await expect(otherPage).toHaveURL(/\/account$/);

    await otherPage.goto('/creator');
    await expect(otherPage.locator('.template-row', { hasText: `Studio test ${stamp}` })).toHaveCount(0);

    const duplicate = await otherPage.request.post(`/api/creator/templates/${id}/duplicate`);
    expect(duplicate.status()).toBe(404);

    const archive = await otherPage.request.post(`/api/creator/templates/${id}/archive`);
    expect(archive.status()).toBe(404);

    await otherPage.goto(`/creator/templates/${id}`);
    await expect(otherPage.getByRole('heading', { name: 'Template not found' })).toBeVisible();

    await context.close();
  });
});
