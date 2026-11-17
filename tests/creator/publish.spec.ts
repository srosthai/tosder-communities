import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { ensureAdmin } from '../helpers/auth';
import { config } from 'dotenv';

config({ path: '.env.local' });

const stamp = Date.now();
const prefixes = [`Publish test ${stamp}`, `Moderation test ${stamp}`];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function getCreator(page: import('@playwright/test').Page) {
  await page.goto('/creator');
  const handle = await page.locator('.profile-handle').textContent();
  const username = handle?.replace('@', '').trim();
  const profile = username
    ? await prisma.memberProfile.findUnique({ where: { username } })
    : null;
  if (!profile) throw new Error('Creator profile not found');
  return profile;
}

async function completeTemplate(templateId: string) {
  const template = await prisma.travelTemplate.findUnique({
    where: { id: templateId },
    select: { provinceId: true },
  });
  const province =
    template?.provinceId ??
    (await prisma.province.findUnique({ where: { slug: 'siem-reap' }, select: { id: true } }))?.id;

  await prisma.travelTemplate.update({
    where: { id: templateId },
    data: {
      summary: 'A complete two-day test itinerary.',
      description: 'This itinerary exists to verify the publishing and moderation flow.',
      provinceId: province,
      style: 'Slow travel',
      season: 'November to March',
      transport: ['Tuk-tuk'],
      audience: ['Couples'],
      durationDays: 1,
      coverPhotoUrl: '/image/placeholder-destination.svg',
    },
  });

  const existingDays = await prisma.templateDay.count({ where: { templateId } });
  if (existingDays === 0) {
    await prisma.templateDay.create({
      data: {
        templateId,
        dayNumber: 1,
        title: 'Day 1',
        items: {
          create: [
            {
              title: 'Morning walk',
              type: 'ATTRACTION',
              startTime: '09:00',
              endTime: '10:30',
              estimatedCostCents: 1200,
              sortOrder: 0,
            },
            {
              title: 'Lunch stop',
              type: 'FOOD',
              startTime: '12:00',
              endTime: '13:00',
              sortOrder: 1,
            },
          ],
        },
      },
    });
  }
}

async function createTemplate(creatorId: string, title: string) {
  const province = await prisma.province.findUnique({
    where: { slug: 'siem-reap' },
    select: { id: true },
  });
  return prisma.travelTemplate.create({
    data: {
      creatorId,
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      summary: 'A complete test itinerary.',
      description: 'This itinerary exists to verify the publishing and moderation flow.',
      provinceId: province?.id,
      style: 'Slow travel',
      season: 'November to March',
      transport: ['Tuk-tuk'],
      audience: ['Couples'],
      durationDays: 1,
      coverPhotoUrl: '/image/placeholder-destination.svg',
      days: {
        create: {
          dayNumber: 1,
          title: 'Day 1',
          items: {
            create: [
              {
                title: 'Morning walk',
                type: 'ATTRACTION',
                startTime: '09:00',
                endTime: '10:30',
                estimatedCostCents: 1200,
                sortOrder: 0,
              },
              {
                title: 'Lunch stop',
                type: 'FOOD',
                startTime: '12:00',
                endTime: '13:00',
                sortOrder: 1,
              },
            ],
          },
        },
      },
    },
  });
}

test.afterAll(async () => {
  const templates = await prisma.travelTemplate.findMany({
    where: { OR: prefixes.map((prefix) => ({ title: { startsWith: prefix } })) },
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
  await prisma.memberProfile.updateMany({
    where: { username: 'content-admin' },
    data: { trustedCreator: false },
  });
  await prisma.$disconnect();
});

test.describe.serial('template publishing and moderation', () => {
  test.skip(
    process.env.AUTH_E2E !== 'true',
    'Set AUTH_E2E=true and provide the test admin account to run publishing tests.',
  );

  test.setTimeout(120_000);

  test('requires review for untrusted creators', async ({ page }) => {
    await ensureAdmin(page);
    const creator = await getCreator(page);
    await prisma.memberProfile.update({
      where: { userId: creator.userId },
      data: { trustedCreator: false },
    });

    const created = await page.request.post('/api/creator/templates', {
      data: { title: `Publish test ${stamp} untrusted` },
    });
    const id = (await created.json()).data.id as string;
    await completeTemplate(id);

    const publish = await page.request.post(`/api/creator/templates/${id}/publish`, {
      data: { visibility: 'public', guidelines: true },
    });
    expect(publish.status()).toBe(403);
    expect((await publish.json()).error.code).toBe('review_required');

    const review = await page.request.post(`/api/creator/templates/${id}/submit-review`);
    expect(review.status()).toBe(200);
    expect((await review.json()).data.status).toBe('PENDING_REVIEW');
  });

  test('publishes idempotently and creates revisions for trusted creators', async ({ page }) => {
    await ensureAdmin(page);
    const creator = await getCreator(page);
    await prisma.memberProfile.update({
      where: { userId: creator.userId },
      data: { trustedCreator: true },
    });

    const template = await createTemplate(creator.userId, `Publish test ${stamp} trusted`);

    const first = await page.request.post(`/api/creator/templates/${template.id}/publish`, {
      data: { visibility: 'public', guidelines: true },
    });
    expect(first.status()).toBe(200);
    const firstBody = (await first.json()).data;
    expect(firstBody.status).toBe('PUBLISHED');
    expect(firstBody.versionNumber).toBe(1);
    expect(firstBody.created).toBe(true);
    expect(firstBody.publicUrl).toBe(`/templates/${template.slug}`);

    const second = await page.request.post(`/api/creator/templates/${template.id}/publish`, {
      data: { visibility: 'public', guidelines: true },
    });
    expect(second.status()).toBe(200);
    const secondBody = (await second.json()).data;
    expect(secondBody.versionNumber).toBe(1);
    expect(secondBody.created).toBe(false);

    const versionsAfterSecond = await prisma.templateVersion.count({
      where: { templateId: template.id },
    });
    expect(versionsAfterSecond).toBe(1);

    const day = await prisma.templateDay.findFirst({ where: { templateId: template.id } });
    await prisma.templateItem.update({
      where: { dayId_sortOrder: { dayId: day!.id, sortOrder: 0 } },
      data: { title: 'Longer morning walk' },
    });

    const revision = await page.request.post(`/api/creator/templates/${template.id}/publish`, {
      data: { visibility: 'public', guidelines: true },
    });
    expect(revision.status()).toBe(200);
    const revisionBody = (await revision.json()).data;
    expect(revisionBody.versionNumber).toBe(2);
    expect(revisionBody.created).toBe(true);

    const versionsAfterRevision = await prisma.templateVersion.count({
      where: { templateId: template.id },
    });
    expect(versionsAfterRevision).toBe(2);

    await prisma.memberProfile.update({
      where: { userId: creator.userId },
      data: { trustedCreator: false },
    });
  });


  test('routes signed-in Use Template to a trip copy', async ({ page }) => {
    await ensureAdmin(page);
    await page.goto('/templates/kampot-slow-weekend/use');
    await expect(page).toHaveURL(
      /\/trips\/new\?template=[0-9a-f-]+&version=[0-9a-f-]+$/,
    );
  });

  test('approves, rejects, and surfaces the rejection reason', async ({ page }) => {
    await ensureAdmin(page);
    const creator = await getCreator(page);

    const approved = await createTemplate(creator.userId, `Moderation test ${stamp} approved`);
    const rejected = await createTemplate(creator.userId, `Moderation test ${stamp} rejected`);

    for (const template of [approved, rejected]) {
      const review = await page.request.post(`/api/creator/templates/${template.id}/submit-review`);
      expect(review.status()).toBe(200);
    }

    await page.goto(`/admin/moderation?template=${approved.id}`);
    await expect(page.getByRole('heading', { name: approved.title, level: 2 })).toBeVisible();
    await page.getByRole('button', { name: 'Approve and publish' }).click();
    await expect(page.getByText('Template approved and published.')).toBeVisible();

    const approvedRow = await prisma.travelTemplate.findUnique({
      where: { id: approved.id },
      include: { publishedVersion: true },
    });
    expect(approvedRow?.status).toBe('PUBLISHED');
    expect(approvedRow?.publishedVersion?.versionNumber).toBe(1);

    await page.goto(`/admin/moderation?template=${rejected.id}`);
    await page.getByLabel('Reason for changes').fill('Please add a licensed cover photo.');
    await page.getByRole('button', { name: 'Request changes' }).click();
    await expect(page.getByText('Changes requested.')).toBeVisible();

    const rejectedRow = await prisma.travelTemplate.findUnique({
      where: { id: rejected.id },
    });
    expect(rejectedRow?.status).toBe('REJECTED');
    expect(rejectedRow?.rejectionReason).toBe('Please add a licensed cover photo.');

    await page.goto(`/creator/templates/${rejected.id}?step=publish`);
    await expect(page.getByText('Changes requested: Please add a licensed cover photo.')).toBeVisible();
  });
});
