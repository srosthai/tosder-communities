import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { config } from 'dotenv';
import { ensureAdmin } from '../helpers/auth';

config({ path: '.env.local' });

const stamp = Date.now();
const title = `Journey test ${stamp}`;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

test.afterAll(async () => {
  const trips = await prisma.userTrip.findMany({
    where: { title: { startsWith: 'Journey test ' } },
    select: { id: true },
  });
  const ids = trips.map((trip) => trip.id);
  if (ids.length > 0) {
    const reviews = await prisma.tripReview.findMany({
      where: { tripId: { in: ids } },
      select: { id: true },
    });
    const reviewIds = reviews.map((review) => review.id);
    if (reviewIds.length > 0) {
      await prisma.auditEvent.deleteMany({
        where: { entityType: 'trip_review', entityId: { in: reviewIds } },
      });
    }
    await prisma.tripReview.deleteMany({ where: { tripId: { in: ids } } });
    await prisma.usageEvent.deleteMany({ where: { tripId: { in: ids } } });
    await prisma.userTrip.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
});

test.describe.serial('critical traveler journey', () => {
  test.skip(
    process.env.AUTH_E2E !== 'true',
    'Set AUTH_E2E=true and provide the test admin account.',
  );

  test.setTimeout(180_000);

  test('browse, copy, edit, complete, review, and see the public result', async ({ page }) => {
    await ensureAdmin(page);

    await page.goto('/templates/kampot-slow-weekend');
    await page.getByRole('link', { name: 'Use this template' }).first().click();
    await expect(page).toHaveURL(/\/trips\/new\?template=.*&version=/);
    await expect(page.getByRole('heading', { name: 'Make it yours.' })).toBeVisible();

    await page.getByLabel('Trip title').fill(title);
    await page.getByLabel('Start date').fill('2026-12-01');
    await page.getByLabel('End date').fill('2026-12-02');
    await page.getByRole('button', { name: 'Create my trip' }).click();

    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+\?copied=1$/);
    const tripId = new URL(page.url()).pathname.split('/').pop()!;
    await expect(page.getByText('Your trip copy is ready.')).toBeVisible();

    await page.locator('.meta-form').getByLabel('Title').fill(`${title} edited`);
    await expect(page.locator('[data-save-state]')).toHaveText(/Unsaved changes|Saving/);
    await expect(page.locator('[data-save-state]')).toHaveText('Saved', { timeout: 10_000 });
    await page.reload();
    await expect(page.getByRole('heading', { name: `${title} edited`, level: 1 })).toBeVisible();

    await page.goto('/trips');
    const row = page.locator(`[data-trip-id="${tripId}"]`);
    await row.getByRole('button', { name: 'Mark complete' }).click();
    await expect(page.getByText('Trip marked complete.')).toBeVisible();

    await page.goto(`/trips/${tripId}`);
    await expect(page.getByRole('heading', { name: 'Review this trip' })).toBeVisible();
    await page.getByLabel('Rating').selectOption('5');
    await page
      .getByLabel('What should other travelers know?')
      .fill(`Excellent pacing and reliable timing notes. Journey ${stamp}.`);
    await page.getByRole('button', { name: 'Publish review' }).click();
    await expect(page.locator('.review-stars')).toBeVisible();

    await page.goto('/templates/kampot-slow-weekend');
    await expect(page.getByText(`Excellent pacing and reliable timing notes. Journey ${stamp}.`)).toBeVisible();
    await expect(page.getByText('★ 5.0 · 1 review').first()).toBeVisible();
  });
});
