import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { config } from 'dotenv';
import { adminPassword, ensureAdmin } from '../helpers/auth';

config({ path: '.env.local' });

const stamp = Date.now();
const prefix = `Operations test ${stamp}`;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function profile(username = 'content-admin') {
  const result = await prisma.memberProfile.findUnique({ where: { username } });
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
      summary: 'Operations fixture',
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
          summary: 'Operations fixture',
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
      contentHash: `operations-${stamp}-${Math.random().toString(16).slice(2)}`,
    },
  });
  return prisma.travelTemplate.update({
    where: { id: template.id },
    data: { status: 'PUBLISHED', publishedVersionId: version.id, publishedAt: new Date() },
  });
}

test.afterAll(async () => {
  const member = await prisma.memberProfile.findUnique({ where: { username: 'content-admin' } });
  const competitions = await prisma.competition.findMany({
    where: { slug: { startsWith: `operations-${stamp}` } },
    select: { id: true },
  });
  const competitionIds = competitions.map((competition) => competition.id);
  if (competitionIds.length > 0) {
    await prisma.reward.deleteMany({ where: { competitionId: { in: competitionIds } } });
    await prisma.leaderboardSnapshot.deleteMany({
      where: { competitionId: { in: competitionIds } },
    });
    await prisma.competition.deleteMany({ where: { id: { in: competitionIds } } });
  }

  const trips = await prisma.userTrip.findMany({
    where: { title: { startsWith: prefix } },
    select: { id: true },
  });
  const tripIds = trips.map((trip) => trip.id);
  if (tripIds.length > 0) {
    await prisma.usageEvent.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.userTrip.deleteMany({ where: { id: { in: tripIds } } });
  }

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
  }

  await prisma.report.deleteMany({ where: { details: { contains: String(stamp) } } });
  await prisma.memberNotification.deleteMany({
    where: { title: { in: ['Your template was hidden', 'Your account was suspended'] } },
  });

  const seed = await prisma.travelTemplate.findFirst({
    where: { slug: 'kampot-slow-weekend' },
    select: { id: true },
  });
  if (seed) {
    await prisma.travelTemplate.update({
      where: { id: seed.id },
      data: { status: 'PUBLISHED' },
    });
  }
  await prisma.memberProfile.updateMany({
    where: { username: 'dara-lim' },
    data: { suspendedAt: null, role: 'TRUSTED_CREATOR', trustedCreator: true },
  });
  await prisma.memberProfile.deleteMany({
    where: { username: { startsWith: 'ops-member' } },
  });
  await prisma.$disconnect();
});

test.describe.serial('competition, moderation, rewards, and roles', () => {
  test.skip(
    process.env.AUTH_E2E !== 'true',
    'Set AUTH_E2E=true and provide the test admin account.',
  );

  test.setTimeout(180_000);

  test('runs a competition from draft to final rewards', async ({ page }) => {
    await ensureAdmin(page);
    const admin = await profile();
    const dara = await profile('dara-lim');
    const seed = await seedTemplate();
    const adminTemplate = await createPublishedTemplate(admin.userId, `${prefix} admin template`);

    const now = new Date();
    const starts = new Date(now.getTime() - 60 * 60 * 1000);
    const ends = new Date(now.getTime() + 60 * 60 * 1000);
    const toInput = (date: Date) => date.toISOString().slice(0, 16);
    const slug = `operations-${stamp}`;

    await page.goto('/admin/competitions');
    await page.getByLabel('Title').fill(`${prefix} competition`);
    await page.getByLabel('Slug').fill(slug);
    await page.getByLabel('Starts at (UTC)').fill(toInput(starts));
    await page.getByLabel('Ends at (UTC)').fill(toInput(ends));
    await page.getByLabel('Funding source').fill('Tosder launch budget');
    await page.getByLabel('Prize pool (USD)').fill('500');
    await page.getByLabel('Rank 1').fill('300');
    await page.getByLabel('Rank 2').fill('200');
    await page.getByLabel('Rules', { exact: true }).fill('Top 5 by qualified uses. Ties break on earlier completion.');
    await page.getByRole('button', { name: 'Create draft' }).click();
    await expect(page.getByText('Competition draft created.')).toBeVisible();

    const competition = await prisma.competition.findUnique({ where: { slug } });
    expect(competition?.status).toBe('DRAFT');

    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText('Competition started.')).toBeVisible();
    expect((await prisma.competition.findUnique({ where: { slug } }))?.status).toBe('ACTIVE');

    const daraTrip = await prisma.userTrip.create({
      data: { ownerId: dara.userId, title: `${prefix} dara trip`, status: 'COMPLETED' },
    });
    const adminTrip = await prisma.userTrip.create({
      data: { ownerId: admin.userId, title: `${prefix} admin trip`, status: 'COMPLETED' },
    });
    await prisma.usageEvent.createMany({
      data: [
        {
          userId: dara.userId,
          templateId: seed.id,
          templateVersionId: seed.publishedVersion!.id,
          tripId: daraTrip.id,
          status: 'QUALIFIED',
          qualifiedAt: new Date(now.getTime() - 2000),
          periodKey: now.toISOString().slice(0, 7),
          ruleVersion: 'v1',
        },
        {
          userId: admin.userId,
          templateId: adminTemplate.id,
          templateVersionId: adminTemplate.publishedVersionId,
          tripId: adminTrip.id,
          status: 'QUALIFIED',
          qualifiedAt: new Date(now.getTime() - 1000),
          periodKey: now.toISOString().slice(0, 7),
          ruleVersion: 'v1',
        },
      ],
    });

    await page.goto('/leaderboard');
    await expect(page.getByText(`${prefix} competition`)).toBeVisible();
    await expect(page.getByText('provisional').first()).toBeVisible();
    await expect(page.locator('.rank-creator', { hasText: 'Dara Lim' })).toBeVisible();
    await expect(page.locator('.rank-creator', { hasText: 'Content Admin' })).toBeVisible();

    await page.goto(`/admin/competitions?id=${competition!.id}`);
    await page.getByRole('button', { name: 'Close and freeze' }).click();
    await expect(page.getByText('Competition closed')).toBeVisible();
    expect((await prisma.competition.findUnique({ where: { slug } }))?.status).toBe('CLOSED');

    await page.goto(`/admin/competitions?id=${competition!.id}`);
    await page.getByRole('button', { name: 'Finalize' }).click();
    await expect(page.getByText('Competition finalized')).toBeVisible();
    expect((await prisma.competition.findUnique({ where: { slug } }))?.status).toBe('FINALIZED');

    await page.goto('/leaderboard?final=1');
    await expect(page.getByText('Final result')).toBeVisible();

    await page.goto(`/admin/competitions?id=${competition!.id}`);
    await page.getByRole('button', { name: 'Create rewards' }).click();
    await expect(page).toHaveURL(/\/admin\/rewards/);
    const rewards = await prisma.reward.findMany({
      where: { competitionId: competition!.id },
      orderBy: { rank: 'asc' },
    });
    expect(rewards.length).toBe(2);
    expect(rewards[0].amountCents + rewards[1].amountCents).toBe(50000);

    await page.goto(`/admin/rewards?competition=${competition!.id}`);
    const rankOne = page.locator('.reward', { hasText: 'Rank 1' });
    await rankOne.getByPlaceholder('Approval reason / eligibility check').fill('Eligibility verified.');
    await rankOne.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Reward ledger updated.')).toBeVisible();

    const approved = await prisma.reward.findFirst({
      where: { competitionId: competition!.id, rank: 1 },
    });
    expect(approved?.status).toBe('APPROVED');

    await page.goto(`/admin/rewards?competition=${competition!.id}`);
    const approvedRow = page.locator('.reward', { hasText: 'Rank 1' });
    await approvedRow.getByPlaceholder('Payout reference').fill(`PAY-${stamp}`);
    await approvedRow.getByRole('button', { name: 'Mark paid' }).click();
    await expect(page.getByText('Reward ledger updated.')).toBeVisible();

    const paid = await prisma.reward.findFirst({
      where: { competitionId: competition!.id, rank: 1 },
    });
    expect(paid?.status).toBe('PAID');
    expect(paid?.payoutReference).toBe(`PAY-${stamp}`);

    await page.goto(`/admin/rewards?competition=${competition!.id}`);
    const rankTwo = page.locator('.reward', { hasText: 'Rank 2' });
    await rankTwo.getByPlaceholder('Void reason').fill('Test cleanup.');
    await rankTwo.getByRole('button', { name: 'Void' }).click();
    await expect(page.getByText('Reward ledger updated.')).toBeVisible();
    expect(
      (await prisma.reward.findFirst({
        where: { competitionId: competition!.id, rank: 2 },
      }))?.status,
    ).toBe('VOID');

    await page.goto('/admin/audit?action=competition');
    await expect(page.getByText('competition.published').first()).toBeVisible();
    await page.goto('/admin/audit?action=reward');
    await expect(page.getByText('reward.paid').first()).toBeVisible();
  });

  test('reports, hides, suspends, and notifies', async ({ page }) => {
    await ensureAdmin(page);
    const seed = await seedTemplate();
    const dara = await profile('dara-lim');

    const report = await page.request.post('/api/reports', {
      data: {
        targetType: 'TEMPLATE',
        targetId: seed.id,
        reasonCode: 'misleading',
        details: `Unsafe timing claims ${stamp}`,
      },
    });
    expect(report.status()).toBe(201);

    await page.goto('/admin/reports');
    await expect(page.getByText(seed.title).first()).toBeVisible();
    await expect(page.getByText(`Unsafe timing claims ${stamp}`)).toBeVisible();
    const row = page.locator('.report', { hasText: seed.title });
    await row.getByPlaceholder('Reason').fill('Timing is unsafe and unverified.');
    await row.getByRole('button', { name: 'Hide template' }).click();
    await expect(page.getByText('Report resolved.')).toBeVisible();
    expect(
      (await prisma.travelTemplate.findUnique({ where: { id: seed.id } }))?.status,
    ).toBe('UNLISTED');
    expect((await page.request.get('/templates/kampot-slow-weekend')).status()).toBe(404);
    expect(
      await prisma.memberNotification.count({ where: { userId: dara.userId } }),
    ).toBeGreaterThanOrEqual(1);

    await prisma.travelTemplate.update({
      where: { id: seed.id },
      data: { status: 'PUBLISHED' },
    });

    const userReport = await page.request.post('/api/reports', {
      data: {
        targetType: 'USER',
        targetId: dara.userId,
        reasonCode: 'spam',
        details: `Spam profile ${stamp}`,
      },
    });
    expect(userReport.status()).toBe(201);

    await page.goto('/admin/reports?target=USER');
    const userRow = page.locator('.report', { hasText: 'Dara Lim' });
    await userRow.getByPlaceholder('Suspension reason').fill('Spam links confirmed.');
    await userRow.getByRole('button', { name: 'Suspend' }).click();
    await expect(page.getByText('Report resolved.')).toBeVisible();
    expect(
      (await prisma.memberProfile.findUnique({ where: { username: 'dara-lim' } }))?.suspendedAt,
    ).not.toBeNull();
    expect((await page.request.get('/creators/dara-lim')).status()).toBe(404);
    expect((await page.request.get('/templates/kampot-slow-weekend')).status()).toBe(404);

    await prisma.memberProfile.update({
      where: { username: 'dara-lim' },
      data: { suspendedAt: null, role: 'TRUSTED_CREATOR', trustedCreator: true },
    });
    await prisma.travelTemplate.update({
      where: { id: seed.id },
      data: { status: 'PUBLISHED' },
    });

    await page.goto('/admin/audit?action=report');
    await expect(page.getByText('report.hide-template').first()).toBeVisible();
    await expect(page.getByText('report.suspend-user').first()).toBeVisible();
  });

  test('enforces roles and blocks self-escalation', async ({ page, browser }) => {
    await ensureAdmin(page);
    const email = `ops-member-${stamp}@example.com`;

    const context = await browser.newContext();
    const memberPage = await context.newPage();
    await memberPage.goto('/sign-up');
    await memberPage.getByLabel('Display name').fill(`Ops Member ${stamp}`);
    await memberPage.getByLabel('Email address').fill(email);
    await memberPage.getByLabel('Password', { exact: true }).fill(adminPassword);
    await memberPage.getByLabel('Confirm password').fill(adminPassword);
    await memberPage.getByRole('button', { name: 'Create account' }).click();
    await expect(memberPage).toHaveURL(/\/account$/);
    await memberPage.goto('/creator');

    const member = await prisma.memberProfile.findFirst({
      where: { displayName: `Ops Member ${stamp}` },
    });
    expect(member?.role).toBe('MEMBER');

    await memberPage.goto('/admin/users');
    await expect(memberPage.getByText('Administrator access required.')).toBeVisible();
    await memberPage.request.post('/admin/users', {
      form: {
        intent: 'set-role',
        userId: member!.userId,
        role: 'ADMINISTRATOR',
        reason: 'Self escalation attempt',
      },
    });
    expect(
      (await prisma.memberProfile.findUnique({ where: { userId: member!.userId } }))?.role,
    ).toBe('MEMBER');

    await page.goto('/admin/users');
    const memberRow = page.locator('.user-row', { hasText: `Ops Member ${stamp}` });
    await memberRow.getByLabel(`Role for Ops Member ${stamp}`).selectOption('MODERATOR');
    await memberRow.getByPlaceholder('Why is this changing?').fill('Temporary moderation test.');
    await memberRow.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('Role updated and audited.')).toBeVisible();
    expect(
      (await prisma.memberProfile.findUnique({ where: { userId: member!.userId } }))?.role,
    ).toBe('MODERATOR');

    await memberPage.goto('/admin/reports');
    await expect(memberPage.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await memberPage.goto('/admin/competitions');
    await expect(memberPage.getByText('Administrator access required.')).toBeVisible();

    const override = await memberPage.request.post(
      `/api/admin/usage/00000000-0000-4000-8000-000000000000/override`,
      { data: { status: 'QUALIFIED', reason: 'Unauthorized attempt' } },
    );
    expect(override.status()).toBe(403);

    await context.close();
    await prisma.memberProfile.deleteMany({ where: { username: { startsWith: 'ops-member' } } });
  });
});
