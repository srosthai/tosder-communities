import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.local' });

const stamp = Date.now();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

test.afterAll(async () => {
  await prisma.travelTemplate.deleteMany({
    where: { slug: { startsWith: `template-visibility-${stamp}` } },
  });
  await prisma.$disconnect();
});

test.describe('public templates', () => {
  test('lists published templates and opens the detail page', async ({ page }) => {
    await page.goto('/templates');
    const origin = new URL(page.url()).origin;

    await expect(page.getByRole('heading', { name: 'Reusable itineraries, not generic listicles.' })).toBeVisible();
    await expect(page.locator('.template-card')).toHaveCount(3);
    await expect(page.getByText('3 templates')).toBeVisible();

    await page.locator('.template-card', { hasText: 'Kampot slow weekend' }).click();
    await expect(page.getByRole('heading', { name: 'Kampot slow weekend', level: 1 })).toBeVisible();
    await expect(page.getByText('Day 1', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Day 2', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dara Lim', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Use this template' }).first()).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${origin}/templates/kampot-slow-weekend`,
    );

    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').first().textContent()) ?? '{}',
    );
    expect(jsonLd['@type']).toBe('TouristTrip');
    expect(jsonLd.name).toBe('Kampot slow weekend');
    expect(jsonLd.author.name).toBe('Dara Lim');
  });

  test('returns 404 for drafts and unlisted templates', async ({ request }) => {
    const creator = await prisma.memberProfile.findUnique({
      where: { username: 'dara-lim' },
      select: { userId: true },
    });
    expect(creator).not.toBeNull();

    const draft = await prisma.travelTemplate.create({
      data: {
        creatorId: creator!.userId,
        title: 'Template visibility draft',
        slug: `template-visibility-${stamp}-draft`,
        status: 'DRAFT',
      },
    });
    const unlisted = await prisma.travelTemplate.create({
      data: {
        creatorId: creator!.userId,
        title: 'Template visibility unlisted',
        slug: `template-visibility-${stamp}-unlisted`,
        status: 'UNLISTED',
      },
    });

    expect((await request.get(`/templates/${draft.slug}`)).status()).toBe(404);
    expect((await request.get(`/templates/${unlisted.slug}`)).status()).toBe(404);
  });

  test('routes signed-out Use Template through sign-in', async ({ page }) => {
    await page.goto('/templates/kampot-slow-weekend');
    await page.getByRole('link', { name: 'Use this template' }).first().click();
    await expect(page).toHaveURL(
      /\/sign-in\?redirectTo=%2Ftemplates%2Fkampot-slow-weekend%2Fuse$/,
    );
  });

  test('renders a creator profile without leaking drafts', async ({ page }) => {
    const creator = await prisma.memberProfile.findUnique({
      where: { username: 'dara-lim' },
      select: { userId: true },
    });
    const draft = await prisma.travelTemplate.create({
      data: {
        creatorId: creator!.userId,
        title: 'Profile draft leak check',
        slug: `template-visibility-${stamp}-profile-draft`,
        status: 'DRAFT',
      },
    });

    await page.goto('/creators/dara-lim');
    await expect(page.getByRole('heading', { name: 'Dara Lim', level: 1 })).toBeVisible();
    await expect(page.getByText('3 published templates')).toBeVisible();
    await expect(page.getByText('Profile draft leak check')).toHaveCount(0);
    await expect(page.locator('.template-card')).toHaveCount(3);

    await page.goto(`/creators/${draft.id}`);
    await expect(page.getByRole('heading', { name: 'Creator not found.' })).toBeVisible();
  });

  test('has no serious accessibility violations on the template detail page', async ({ page }) => {
    await page.goto('/templates/angkor-first-light');
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
