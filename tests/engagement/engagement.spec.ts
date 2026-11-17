import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { config } from 'dotenv';
import { ensureAdmin } from '../helpers/auth';

config({ path: '.env.local' });

const stamp = Date.now();
const prefix = `Analytics test ${stamp}`;
const testStartedAt = new Date();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function profile() {
  const result = await prisma.memberProfile.findUnique({ where: { username: 'content-admin' } });
  if (!result) throw new Error('Test profile not found');
  return result;
}

async function seedTemplate() {
  const template = await prisma.travelTemplate.findFirst({
    where: { slug: 'kampot-slow-weekend' },
    include: { publishedVersion: true },
  });
  if (!template?.publishedVersion) throw new Error('Seed template not found');
  return template;
}

async function createPublishedTemplate(creatorId: string, title: string) {
  const province = await prisma.province.findUnique({
    where: { slug: 'siem-reap' },
    select: { id: true, name: true, slug: true },
  });
  const template = await prisma.travelTemplate.create({
    data: {
      creatorId,
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      summary: 'Analytics fixture',
      durationDays: 1,
      provinceId: province?.id,
      status: 'DRAFT',
    },
  });
  const version = await prisma.templateVersion.create({
    data: {
      templateId: template.id,
      versionNumber: 1,
      createdById: creatorId,
      snapshot: {
        template: {
          title,
          slug: template.slug,
          summary: 'Analytics fixture',
          description: null,
          coverPhotoUrl: null,
          durationDays: 1,
          budgetMinCents: null,
          budgetMaxCents: null,
          currency: 'USD',
          style: null,
          season: null,
          logisticsNotes: null,
          transport: [],
          audience: [],
          language: 'en',
          province: province ? { name: province.name, slug: province.slug } : null,
        },
        days: [],
      },
      contentHash: `analytics-${stamp}-${Math.random().toString(16).slice(2)}`,
    },
  });
  return prisma.travelTemplate.update({
    where: { id: template.id },
    data: { status: 'PUBLISHED', publishedVersionId: version.id, publishedAt: new Date() },
  });
}

test.afterAll(async () => {
  const member = await prisma.memberProfile.findUnique({ where: { username: 'content-admin' } });
  const seed = await prisma.travelTemplate.findFirst({
    where: { slug: 'kampot-slow-weekend' },
    select: { id: true },
  });

  if (member) {
    const templates = await prisma.travelTemplate.findMany({
      where: { creatorId: member.userId, title: { startsWith: prefix } },
      select: { id: true },
    });
    const ids = templates.map((template) => template.id);
    if (ids.length > 0) {
      await prisma.engagementEvent.deleteMany({ where: { templateId: { in: ids } } });
      await prisma.usageEvent.deleteMany({ where: { templateId: { in: ids } } });
      await prisma.templateLike.deleteMany({ where: { templateId: { in: ids } } });
      await prisma.travelTemplate.updateMany({
        where: { id: { in: ids } },
        data: { publishedVersionId: null },
      });
      await prisma.travelTemplate.deleteMany({ where: { id: { in: ids } } });
    }
    const trips = await prisma.userTrip.findMany({
      where: { ownerId: member.userId, title: { startsWith: prefix } },
      select: { id: true },
    });
    await prisma.userTrip.deleteMany({ where: { id: { in: trips.map((trip) => trip.id) } } });
  }

  if (seed) {
    await prisma.engagementEvent.deleteMany({
      where: { templateId: seed.id, createdAt: { gte: testStartedAt } },
    });
    await prisma.templateLike.deleteMany({ where: { templateId: seed.id } });
    const [saved, qualified] = await Promise.all([
      prisma.savedTemplate.count({ where: { templateId: seed.id } }),
      prisma.usageEvent.count({ where: { templateId: seed.id, status: 'QUALIFIED' } }),
    ]);
    await prisma.travelTemplate.update({
      where: { id: seed.id },
      data: {
        viewCount: 0,
        likeCount: 0,
        saveCount: saved,
        useStartedCount: 0,
        qualifiedUseCount: qualified,
      },
    });
  }

  await prisma.memberProfile.deleteMany({ where: { username: { startsWith: 'analytics-other' } } });
  await prisma.$disconnect();
});

test.describe.serial('engagement, usage, and analytics', () => {
  test.skip(
    process.env.AUTH_E2E !== 'true',
    'Set AUTH_E2E=true and provide the test admin account to run analytics tests.',
  );

  test.setTimeout(120_000);

  test('deduplicates views and likes', async ({ page, context }) => {
    const template = await seedTemplate();
    const before = await prisma.travelTemplate.findUnique({
      where: { id: template.id },
      select: { viewCount: true, likeCount: true },
    });
    const viewBaseline = before?.viewCount ?? 0;

    await context.clearCookies();
    await page.goto('/templates/kampot-slow-weekend');
    await expect.poll(async () => {
      const row = await prisma.travelTemplate.findUnique({
        where: { id: template.id },
        select: { viewCount: true },
      });
      return row?.viewCount ?? 0;
    }).toBe(viewBaseline + 1);

    await page.goto('/templates/kampot-slow-weekend');
    await page.waitForTimeout(300);
    expect(
      (await prisma.travelTemplate.findUnique({
        where: { id: template.id },
        select: { viewCount: true },
      }))?.viewCount,
    ).toBe(viewBaseline + 1);

    await context.clearCookies();
    await page.goto('/templates/kampot-slow-weekend');
    await expect.poll(async () => {
      const row = await prisma.travelTemplate.findUnique({
        where: { id: template.id },
        select: { viewCount: true },
      });
      return row?.viewCount ?? 0;
    }).toBe(viewBaseline + 2);

    await ensureAdmin(page);
    const member = await profile();
    await prisma.templateLike.deleteMany({ where: { templateId: template.id } });
    await prisma.travelTemplate.update({
      where: { id: template.id },
      data: { likeCount: 0 },
    });

    const first = await page.request.put(`/api/likes/templates/${template.id}`);
    expect(first.status()).toBe(200);
    expect((await first.json()).data).toEqual({ liked: true, count: 1 });

    const second = await page.request.put(`/api/likes/templates/${template.id}`);
    expect(second.status()).toBe(200);
    expect((await second.json()).data).toEqual({ liked: true, count: 1 });
    expect(
      await prisma.templateLike.count({ where: { templateId: template.id, userId: member.userId } }),
    ).toBe(1);

    const unlike = await page.request.delete(`/api/likes/templates/${template.id}`);
    expect((await unlike.json()).data).toEqual({ liked: false, count: 0 });
    const unlikeAgain = await page.request.delete(`/api/likes/templates/${template.id}`);
    expect((await unlikeAgain.json()).data).toEqual({ liked: false, count: 0 });
  });

  test('records use-started once and qualifies one use per month', async ({ page }) => {
    const template = await seedTemplate();
    await ensureAdmin(page);
    const member = await profile();
    const month = new Date().toISOString().slice(0, 7);

    await prisma.usageEvent.deleteMany({
      where: { userId: member.userId, templateId: template.id, periodKey: month },
    });

    await page.goto(`/trips/new?template=${template.id}&version=${template.publishedVersion!.id}`);
    await page.goto(`/trips/new?template=${template.id}&version=${template.publishedVersion!.id}`);
    await expect.poll(async () => {
      const row = await prisma.travelTemplate.findUnique({
        where: { id: template.id },
        select: { useStartedCount: true },
      });
      return row?.useStartedCount ?? 0;
    }).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.engagementEvent.count({
        where: { templateId: template.id, eventType: 'USE_STARTED', userId: member.userId },
      }),
    ).toBe(1);

    const first = await page.request.post('/api/trips/copy', {
      data: {
        templateId: template.id,
        versionId: template.publishedVersion!.id,
        idempotencyKey: `analytics-copy-${stamp}-1`,
        title: `${prefix} first`,
      },
    });
    expect(first.status()).toBe(201);
    const firstTrip = (await first.json()).data.id;
    const firstEvent = await prisma.usageEvent.findUnique({
      where: { tripId: firstTrip },
    });
    expect(firstEvent?.status).toBe('QUALIFIED');
    expect(firstEvent?.ruleVersion).toBe('v1');

    const second = await page.request.post('/api/trips/copy', {
      data: {
        templateId: template.id,
        versionId: template.publishedVersion!.id,
        idempotencyKey: `analytics-copy-${stamp}-2`,
        title: `${prefix} second`,
      },
    });
    expect(second.status()).toBe(201);
    const secondTrip = (await second.json()).data.id;
    const secondEvent = await prisma.usageEvent.findUnique({
      where: { tripId: secondTrip },
    });
    expect(secondEvent?.status).toBe('INVALID');
    expect(secondEvent?.decisionReason).toContain('already exists');

    const after = await prisma.travelTemplate.findUnique({
      where: { id: template.id },
      select: { qualifiedUseCount: true },
    });
    expect(after?.qualifiedUseCount).toBe(1);

    if (secondEvent) {
      const override = await page.request.post(
        `/api/admin/usage/${secondEvent.id}/override`,
        { data: { status: 'QUALIFIED', reason: 'Manual review confirmed a distinct trip.' } },
      );
      expect(override.status()).toBe(200);
      const overridden = await prisma.travelTemplate.findUnique({
        where: { id: template.id },
        select: { qualifiedUseCount: true },
      });
      expect(overridden?.qualifiedUseCount).toBe(2);

      await page.request.post(`/api/admin/usage/${secondEvent.id}/override`, {
        data: { status: 'INVALID', reason: 'Restore test fixture after verification.' },
      });
    }

    await prisma.userTrip.deleteMany({
      where: { id: { in: [firstTrip, secondTrip] } },
    });
  });

  test('shows aggregate creator analytics with privacy rounding', async ({ page }) => {
    const template = await seedTemplate();
    await ensureAdmin(page);
    const member = await profile();
    const published = await createPublishedTemplate(member.userId, `${prefix} dashboard`);
    const now = new Date();

    await prisma.engagementEvent.createMany({
      data: Array.from({ length: 10 }, (_, index) => ({
        templateId: published.id,
        eventType: 'VIEW' as const,
        occurredAt: new Date(now.getTime() - index * 60_000),
        dedupeKey: `analytics-view-${stamp}-${index}`,
      })),
    });
    await prisma.engagementEvent.createMany({
      data: [
        { templateId: published.id, eventType: 'LIKE', userId: member.userId },
        { templateId: published.id, eventType: 'SAVE', userId: member.userId },
        { templateId: published.id, eventType: 'USE_STARTED', userId: member.userId },
      ],
    });

    const trip = await prisma.userTrip.create({
      data: {
        ownerId: member.userId,
        title: `${prefix} analytics trip`,
        status: 'COMPLETED',
        endDate: new Date(),
      },
    });
    await prisma.usageEvent.create({
      data: {
        userId: member.userId,
        templateId: published.id,
        templateVersionId: published.publishedVersionId,
        tripId: trip.id,
        status: 'QUALIFIED',
        periodKey: now.toISOString().slice(0, 7),
        ruleVersion: 'v1',
        qualifiedAt: now,
      },
    });

    await page.goto('/creator/analytics');
    await expect(page.getByRole('heading', { name: 'How your templates are doing.' })).toBeVisible();
    await expect(page.getByText(`${prefix} dashboard`)).toBeVisible();
    await expect(page.locator('.stat', { hasText: 'Views' }).locator('strong')).toHaveText('10');
    await expect(page.locator('.stat', { hasText: 'Qualified uses' }).locator('strong')).toHaveText('<5');
    await expect(page.locator('.stat', { hasText: 'View → qualified use' }).locator('strong')).toHaveText('10%');
    await expect(page.locator('body')).not.toContainText('content-admin@example.com');

    expect(template.id).toBeTruthy();
  });
});
