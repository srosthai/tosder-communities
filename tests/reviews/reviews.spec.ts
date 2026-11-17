import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { config } from 'dotenv';
import { ensureAdmin } from '../helpers/auth';

config({ path: '.env.local' });

const stamp = Date.now();
const prefix = `Review test ${stamp}`;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function seedTemplate() {
  const template = await prisma.travelTemplate.findFirst({
    where: { slug: 'kampot-slow-weekend' },
    include: { publishedVersion: true },
  });
  if (!template?.publishedVersion) throw new Error('Seed template not found');
  return template;
}

async function adminProfile() {
  const profile = await prisma.memberProfile.findUnique({ where: { username: 'content-admin' } });
  if (!profile) throw new Error('Test profile not found');
  return profile;
}

test.afterAll(async () => {
  const profiles = await prisma.memberProfile.findMany({
    where: {
      OR: [
        { username: 'content-admin' },
        { username: { startsWith: 'review-other' } },
      ],
    },
    select: { userId: true },
  });
  const userIds = profiles.map((profile) => profile.userId);
  const trips = await prisma.userTrip.findMany({
    where: { ownerId: { in: userIds }, title: { startsWith: prefix } },
    select: { id: true },
  });
  const tripIds = trips.map((trip) => trip.id);
  if (tripIds.length > 0) {
    const reviews = await prisma.tripReview.findMany({
      where: { tripId: { in: tripIds } },
      select: { id: true },
    });
    const reviewIds = reviews.map((review) => review.id);
    if (reviewIds.length > 0) {
      await prisma.auditEvent.deleteMany({
        where: { entityType: 'trip_review', entityId: { in: reviewIds } },
      });
    }
    await prisma.tripReview.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.auditEvent.deleteMany({
      where: { entityType: 'user_trip', entityId: { in: tripIds } },
    });
    await prisma.usageEvent.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.userTrip.deleteMany({ where: { id: { in: tripIds } } });
  }
  await prisma.memberProfile.deleteMany({ where: { username: { startsWith: 'review-other' } } });
  await prisma.$disconnect();
});

test.describe.serial('reviews', () => {
  test.skip(
    process.env.AUTH_E2E !== 'true',
    'Set AUTH_E2E=true and provide the test admin account to run review tests.',
  );

  test.setTimeout(120_000);

  test('creates, aggregates, edits, and prevents duplicate reviews', async ({ page }) => {
    const template = await seedTemplate();
    await ensureAdmin(page);
    const profile = await adminProfile();
    const key = `review-key-${stamp}`;

    const copied = await page.request.post('/api/trips/copy', {
      data: {
        templateId: template.id,
        versionId: template.publishedVersion!.id,
        idempotencyKey: key,
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        title: `${prefix} completed`,
      },
    });
    const tripId = (await copied.json()).data.id as string;
    await prisma.userTrip.update({
      where: { id: tripId },
      data: { status: 'COMPLETED', startDate: new Date('2026-01-01T00:00:00.000Z'), endDate: new Date('2026-01-02T00:00:00.000Z') },
    });

    const created = await page.request.post('/api/reviews', {
      data: { tripId, rating: 5, body: 'A genuinely useful itinerary. The timing notes were accurate.' },
    });
    expect(created.status()).toBe(201);
    const reviewId = (await created.json()).data.id as string;

    const duplicate = await page.request.post('/api/reviews', {
      data: { tripId, rating: 3, body: 'Trying again.' },
    });
    expect(duplicate.status()).toBe(409);
    expect((await duplicate.json()).error.code).toBe('duplicate_review');

    await page.goto('/templates/kampot-slow-weekend');
    await expect(page.getByText('A genuinely useful itinerary.')).toBeVisible();
    await expect(page.getByText('★ 5.0 · 1 review')).toBeVisible();

    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').first().textContent()) ?? '{}',
    );
    expect(jsonLd.aggregateRating.reviewCount).toBe(1);
    expect(jsonLd.aggregateRating.ratingValue).toBe(5);

    const updated = await page.request.patch(`/api/reviews/${reviewId}`, {
      data: { rating: 4, body: 'Updated after a second read: still useful, slightly optimistic on timing.' },
    });
    expect(updated.status()).toBe(200);

    await page.reload();
    await expect(page.getByText('Updated after a second read')).toBeVisible();
    expect(await prisma.tripReview.count({ where: { tripId } })).toBe(1);
    expect(profile.userId).toBeTruthy();
  });

  test('reports and hides a review and excludes it from aggregates', async ({ page }) => {
    const template = await seedTemplate();
    await ensureAdmin(page);
    const profile = await adminProfile();

    const other = await prisma.memberProfile.create({
      data: {
        userId: `review-other-${stamp}`,
        username: `review-other-${stamp}`.slice(0, 30),
        displayName: 'Review Other',
      },
    });

    const trip = await prisma.userTrip.create({
      data: {
        ownerId: other.userId,
        title: `${prefix} other`,
        status: 'COMPLETED',
        endDate: new Date('2026-02-02T00:00:00.000Z'),
        sourceTemplateId: template.id,
        sourceTemplateVersionId: template.publishedVersion!.id,
        sourceTemplateTitle: template.title,
        sourceVersionNumber: template.publishedVersion!.versionNumber,
      },
    });

    const review = await prisma.tripReview.create({
      data: {
        tripId: trip.id,
        templateId: template.id,
        templateVersionId: template.publishedVersion!.id,
        reviewerId: other.userId,
        rating: 1,
        body: 'Reported review body that should disappear.',
      },
    });

    const report = await page.request.post(`/api/reviews/${review.id}/report`, {
      data: { reason: 'Unverified claims about the route.' },
    });
    expect(report.status()).toBe(200);
    expect((await report.json()).data.status).toBe('REPORTED');

    await page.goto('/templates/kampot-slow-weekend');
    await expect(page.getByText('Reported review body that should disappear.')).toHaveCount(0);

    await page.goto('/admin/reviews');
    await expect(page.getByText('Reported review body that should disappear.')).toBeVisible();
    const row = page.locator('.review-row', { hasText: 'Reported review body' });
    await row.getByRole('button', { name: 'Hide' }).click();
    await expect(page.getByText('Review hidden.')).toBeVisible();

    const hidden = await prisma.tripReview.findUnique({ where: { id: review.id } });
    expect(hidden?.status).toBe('HIDDEN');

    await page.goto('/templates/kampot-slow-weekend');
    await expect(page.getByText('Reported review body that should disappear.')).toHaveCount(0);

    expect(profile.userId).toBeTruthy();
  });

  test('rejects reviews before the trip is complete', async ({ page }) => {
    const template = await seedTemplate();
    await ensureAdmin(page);
    const profile = await adminProfile();
    const key = `review-key-${stamp}-future`;

    const copied = await page.request.post('/api/trips/copy', {
      data: {
        templateId: template.id,
        versionId: template.publishedVersion!.id,
        idempotencyKey: key,
        startDate: '2099-01-01',
        endDate: '2099-01-02',
        title: `${prefix} future`,
      },
    });
    const tripId = (await copied.json()).data.id as string;

    const review = await page.request.post('/api/reviews', {
      data: { tripId, rating: 5, body: 'Too early.' },
    });
    expect(review.status()).toBe(409);
    expect((await review.json()).error.code).toBe('not_eligible');
    expect(profile.userId).toBeTruthy();
  });
});
