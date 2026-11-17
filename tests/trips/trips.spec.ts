import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { config } from 'dotenv';
import { adminPassword, ensureAdmin } from '../helpers/auth';

config({ path: '.env.local' });

const stamp = Date.now();
const prefix = `Trip test ${stamp}`;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function waitForTripSave(page: import('@playwright/test').Page) {
  const state = page.locator('[data-save-state]');
  await expect(state).toHaveText(/Unsaved changes|Saving/);
  await expect(state).toHaveText('Saved', { timeout: 10_000 });
}

async function getProfile() {
  const profile = await prisma.memberProfile.findUnique({
    where: { username: 'content-admin' },
  });
  if (!profile) throw new Error('Test profile not found');
  return profile;
}

async function seedTemplate() {
  const template = await prisma.travelTemplate.findFirst({
    where: { slug: 'kampot-slow-weekend' },
    include: { publishedVersion: true },
  });
  if (!template?.publishedVersion) throw new Error('Seed template not found');
  return template;
}

test.afterAll(async () => {
  const profile = await prisma.memberProfile.findUnique({
    where: { username: 'content-admin' },
  });
  if (profile) {
    const trips = await prisma.userTrip.findMany({
      where: { ownerId: profile.userId, title: { startsWith: prefix } },
      select: { id: true },
    });
    const ids = trips.map((trip) => trip.id);
    if (ids.length > 0) {
      await prisma.auditEvent.deleteMany({
        where: { entityType: 'user_trip', entityId: { in: ids } },
      });
      await prisma.usageEvent.deleteMany({ where: { tripId: { in: ids } } });
      await prisma.userTrip.deleteMany({ where: { id: { in: ids } } });
    }
  }
  await prisma.memberProfile.deleteMany({
    where: { username: { startsWith: 'trip-other' } },
  });
  const seed = await prisma.travelTemplate.findFirst({
    where: { slug: 'kampot-slow-weekend' },
    select: { id: true },
  });
  if (seed) {
    const qualified = await prisma.usageEvent.count({
      where: { templateId: seed.id, status: 'QUALIFIED' },
    });
    await prisma.travelTemplate.update({
      where: { id: seed.id },
      data: { qualifiedUseCount: qualified },
    });
  }
  await prisma.$disconnect();
});

test.describe.serial('trip copy flow', () => {
  test.skip(
    process.env.AUTH_E2E !== 'true',
    'Set AUTH_E2E=true and provide the test admin account to run trip tests.',
  );

  test.setTimeout(120_000);

  test('copies a published version idempotently and atomically', async ({ page, request }) => {
    const template = await seedTemplate();
    await ensureAdmin(page);
    const profile = await getProfile();
    const key = `copy-key-${stamp}`;

    const first = await page.request.post('/api/trips/copy', {
      data: {
        templateId: template.id,
        versionId: template.publishedVersion!.id,
        idempotencyKey: key,
        startDate: '2026-12-01',
        endDate: '2026-12-02',
        title: `${prefix} copied`,
      },
    });
    expect(first.status()).toBe(201);
    const firstBody = await first.json();
    expect(firstBody.data.created).toBe(true);
    const tripId = firstBody.data.id as string;

    const trip = await prisma.userTrip.findUnique({
      where: { id: tripId },
      include: { days: { include: { items: true } }, usageEvent: true },
    });
    expect(trip?.ownerId).toBe(profile.userId);
    expect(trip?.sourceTemplateId).toBe(template.id);
    expect(trip?.sourceTemplateVersionId).toBe(template.publishedVersion!.id);
    expect(trip?.sourceTemplateTitle).toBe(template.title);
    expect(trip?.sourceVersionNumber).toBe(template.publishedVersion!.versionNumber);
    expect(trip?.days.length).toBe(2);
    expect(trip?.days[0].items.length).toBeGreaterThan(0);
    expect(trip?.usageEvent?.status).toBe('QUALIFIED');
    expect(trip?.usageEvent?.requestId).toBeTruthy();
    expect(trip?.usageEvent?.templateVersionId).toBe(template.publishedVersion!.id);

    const second = await page.request.post('/api/trips/copy', {
      data: {
        templateId: template.id,
        versionId: template.publishedVersion!.id,
        idempotencyKey: key,
        startDate: '2026-12-01',
        endDate: '2026-12-02',
        title: `${prefix} copied`,
      },
    });
    expect(second.status()).toBe(200);
    expect((await second.json()).data.id).toBe(tripId);

    expect(await prisma.userTrip.count({ where: { ownerId: profile.userId, copyKey: key } })).toBe(1);
    expect(await prisma.usageEvent.count({ where: { idempotencyKey: key } })).toBe(1);

    const [left, right] = await Promise.all([
      page.request.post('/api/trips/copy', {
        data: {
          templateId: template.id,
          versionId: template.publishedVersion!.id,
          idempotencyKey: `copy-key-${stamp}-race`,
          title: `${prefix} race`,
        },
      }),
      page.request.post('/api/trips/copy', {
        data: {
          templateId: template.id,
          versionId: template.publishedVersion!.id,
          idempotencyKey: `copy-key-${stamp}-race`,
          title: `${prefix} race`,
        },
      }),
    ]);

    const statuses = [left.status(), right.status()].sort();
    expect(statuses).toEqual([200, 201]);
    const leftBody = await left.json();
    const rightBody = await right.json();
    expect(leftBody.data.id).toBe(rightBody.data.id);
    expect(
      await prisma.userTrip.count({ where: { ownerId: profile.userId, copyKey: `copy-key-${stamp}-race` } }),
    ).toBe(1);
    expect(
      await prisma.usageEvent.count({ where: { idempotencyKey: `copy-key-${stamp}-race` } }),
    ).toBe(1);

    const invalidDates = await page.request.post('/api/trips/copy', {
      data: {
        templateId: template.id,
        versionId: template.publishedVersion!.id,
        idempotencyKey: `copy-key-${stamp}-invalid`,
        startDate: '2026-12-05',
        endDate: '2026-12-01',
        title: `${prefix} invalid`,
      },
    });
    expect(invalidDates.status()).toBe(422);
    expect(
      await prisma.userTrip.count({ where: { copyKey: `copy-key-${stamp}-invalid` } }),
    ).toBe(0);

    const signedOut = await request.post('/api/trips/copy', {
      data: {
        templateId: template.id,
        versionId: template.publishedVersion!.id,
        idempotencyKey: `copy-key-${stamp}-signedout`,
      },
    });
    expect(signedOut.status()).toBe(401);
  });

  test('lists, edits, duplicates, archives, and deletes a trip', async ({ page, browser }) => {
    const template = await seedTemplate();
    await ensureAdmin(page);
    const profile = await getProfile();
    const key = `trip-ui-${stamp}`;

    const created = await page.request.post('/api/trips/copy', {
      data: {
        templateId: template.id,
        versionId: template.publishedVersion!.id,
        idempotencyKey: key,
        startDate: '2026-12-01',
        endDate: '2026-12-02',
        title: `${prefix} editable`,
      },
    });
    const tripId = (await created.json()).data.id as string;

    await page.goto('/trips');
    const row = page.locator(`[data-trip-id="${tripId}"]`);
    await expect(row).toContainText(`${prefix} editable`);
    await expect(row).toContainText('Kampot slow weekend');

    await row.getByRole('link', { name: 'Open' }).click();
    await expect(page.getByRole('heading', { name: `${prefix} editable`, level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /Kampot slow weekend/ }).first()).toBeVisible();

    await page.locator('.meta-form').getByLabel('Title').fill(`${prefix} edited`);
    await waitForTripSave(page);
    await page.reload();
    await expect(page.getByRole('heading', { name: `${prefix} edited`, level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Add day', exact: true }).click();
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+\?day=/);
    const newDayId = new URL(page.url()).searchParams.get('day');
    const newDay = page.locator(`#day-${newDayId}`);
    await newDay.getByRole('button', { name: 'Add item' }).click();
    await expect(page).toHaveURL(/item=/);
    await page.locator('.item[open]').getByLabel('Title', { exact: true }).fill('My extra stop');
    await page.locator('.item[open]').getByRole('button', { name: 'Save item' }).click();
    await page.waitForURL(/\/trips\/[0-9a-f-]+\?saved=1$/);
    await page.reload();
    await expect(page.getByText('My extra stop')).toBeVisible();

    await page.getByLabel('New checklist item').fill('Buy travel insurance');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Buy travel insurance')).toBeVisible();
    await page.getByRole('checkbox', { name: /Mark Buy travel insurance/ }).check();
    await expect(page.locator('.is-done', { hasText: 'Buy travel insurance' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove Buy travel insurance' }).click();
    await expect(page.getByText('Buy travel insurance')).toHaveCount(0);

    await page.goto('/trips');
    await page.locator(`[data-trip-id="${tripId}"]`).getByRole('button', { name: 'Duplicate' }).click();
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+\?copied=1/);
    const copyUrl = page.url();
    const copyId = new URL(copyUrl).pathname.split('/').pop()!;

    await page.goto('/trips');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator(`[data-trip-id="${tripId}"]`).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Trip deleted.')).toBeVisible();
    expect(await prisma.userTrip.count({ where: { id: tripId } })).toBe(0);

    await page.goto('/trips');
    await page.locator(`[data-trip-id="${copyId}"]`).getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText('Trip archived.')).toBeVisible();
    await page.goto('/trips?filter=archived');
    await expect(page.locator(`[data-trip-id="${copyId}"]`)).toBeVisible();

    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await other.goto('/sign-up');
    await other.getByLabel('Display name').fill(`Trip Other ${stamp}`);
    await other.getByLabel('Email address').fill(`trip-other-${stamp}@example.com`);
    await other.getByLabel('Password', { exact: true }).fill(adminPassword);
    await other.getByLabel('Confirm password').fill(adminPassword);
    await other.getByRole('button', { name: 'Create account' }).click();
    await expect(other).toHaveURL(/\/account$/);

    await other.goto(`/trips/${copyId}`);
    await expect(other.getByRole('heading', { name: 'Trip not found.' })).toBeVisible();
    await other.goto('/trips');
    await expect(other.getByText(`${prefix} edited`)).toHaveCount(0);
    await otherContext.close();

  });
});
