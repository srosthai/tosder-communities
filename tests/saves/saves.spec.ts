import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { config } from 'dotenv';
import { ensureAdmin } from '../helpers/auth';

config({ path: '.env.local' });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function profile() {
  const result = await prisma.memberProfile.findUnique({ where: { username: 'content-admin' } });
  if (!result) throw new Error('Test profile not found');
  return result;
}

async function seedTargets() {
  const template = await prisma.travelTemplate.findFirst({
    where: { slug: 'kampot-slow-weekend' },
    select: { id: true, saveCount: true },
  });
  const destination = await prisma.destination.findFirst({
    where: { slug: 'kampot-riverside' },
    select: { id: true, saveCount: true },
  });
  if (!template || !destination) throw new Error('Seed targets not found');
  return { template, destination };
}

test.afterAll(async () => {
  const member = await prisma.memberProfile.findUnique({ where: { username: 'content-admin' } });
  if (member) {
    await prisma.savedTemplate.deleteMany({ where: { userId: member.userId } });
    await prisma.savedDestination.deleteMany({ where: { userId: member.userId } });
  }
  const template = await prisma.travelTemplate.findFirst({
    where: { slug: 'kampot-slow-weekend' },
    select: { id: true },
  });
  const destination = await prisma.destination.findFirst({
    where: { slug: 'kampot-riverside' },
    select: { id: true },
  });
  if (template) {
    const count = await prisma.savedTemplate.count({ where: { templateId: template.id } });
    await prisma.travelTemplate.update({ where: { id: template.id }, data: { saveCount: count } });
  }
  if (destination) {
    const count = await prisma.savedDestination.count({
      where: { destinationId: destination.id },
    });
    await prisma.destination.update({
      where: { id: destination.id },
      data: { saveCount: count },
    });
  }
  await prisma.memberProfile.deleteMany({ where: { username: { startsWith: 'save-other' } } });
  await prisma.$disconnect();
});

test.describe.serial('saved items', () => {
  test.skip(
    process.env.AUTH_E2E !== 'true',
    'Set AUTH_E2E=true and provide the test admin account to run save tests.',
  );

  test('saves and unsaves idempotently and enforces authentication', async ({ page, request }) => {
    const { template, destination } = await seedTargets();
    await ensureAdmin(page);
    const member = await profile();

    const beforeTemplate = await prisma.savedTemplate.count({
      where: { templateId: template.id },
    });

    const first = await page.request.put(`/api/saves/templates/${template.id}`);
    expect(first.status()).toBe(200);
    expect((await first.json()).data).toEqual({ saved: true, count: beforeTemplate + 1 });

    const second = await page.request.put(`/api/saves/templates/${template.id}`);
    expect(second.status()).toBe(200);
    expect((await second.json()).data).toEqual({ saved: true, count: beforeTemplate + 1 });

    expect(
      await prisma.savedTemplate.count({
        where: { userId: member.userId, templateId: template.id },
      }),
    ).toBe(1);

    const unsave = await page.request.delete(`/api/saves/templates/${template.id}`);
    expect(unsave.status()).toBe(200);
    expect((await unsave.json()).data).toEqual({ saved: false, count: beforeTemplate });

    const unsaveAgain = await page.request.delete(`/api/saves/templates/${template.id}`);
    expect(unsaveAgain.status()).toBe(200);
    expect((await unsaveAgain.json()).data).toEqual({ saved: false, count: beforeTemplate });

    const beforeDestination = await prisma.savedDestination.count({
      where: { destinationId: destination.id },
    });
    const destinationSave = await page.request.put(`/api/saves/destinations/${destination.id}`);
    expect(destinationSave.status()).toBe(200);
    expect((await destinationSave.json()).data).toEqual({
      saved: true,
      count: beforeDestination + 1,
    });

    const signedOut = await request.put(`/api/saves/templates/${template.id}`);
    expect(signedOut.status()).toBe(401);
    expect((await signedOut.json()).error.code).toBe('unauthenticated');
  });

  test('toggles optimistically and rolls back on failure', async ({ page }) => {
    const { template } = await seedTargets();
    await ensureAdmin(page);
    await prisma.savedTemplate.deleteMany({
      where: {
        templateId: template.id,
        user: { username: 'content-admin' },
      },
    });

    await page.goto('/templates/kampot-slow-weekend');
    const button = page.locator('[data-save-button][data-save-type="template"]');
    await expect(button).toBeVisible();
    const initialCount = Number(await button.locator('[data-save-count]').textContent());

    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/saves/templates/${template.id}`) &&
        response.request().method() === 'PUT',
    );
    await button.click();
    await saveResponse;
    await expect(button).toHaveAttribute('data-saved', 'true');
    await expect(button.locator('[data-save-label]')).toHaveText('Saved');
    await expect(button.locator('[data-save-count]')).toHaveText(String(initialCount + 1));

    await page.reload();
    await expect(page.locator('[data-save-button][data-save-type="template"]')).toHaveAttribute(
      'data-saved',
      'true',
    );

    await page.route(`**/api/saves/templates/${template.id}`, (route) => route.abort());
    const savedButton = page.locator('[data-save-button][data-save-type="template"]');
    await savedButton.click();
    await expect(savedButton).toHaveAttribute('data-saved', 'true');
    await expect(savedButton.locator('[data-save-label]')).toHaveText('Saved');
    await expect(savedButton.locator('[data-save-count]')).toHaveText(String(initialCount + 1));
    await page.unroute(`**/api/saves/templates/${template.id}`);

    await savedButton.click();
    await expect(savedButton).toHaveAttribute('data-saved', 'false');
  });

  test('shows saved templates and destinations privately and removes them', async ({ page, browser }) => {
    const { template, destination } = await seedTargets();
    await ensureAdmin(page);

    await page.request.put(`/api/saves/templates/${template.id}`);
    await page.request.put(`/api/saves/destinations/${destination.id}`);

    await page.goto('/saved');
    await expect(page.getByRole('heading', { name: 'Ideas worth coming back to.' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Kampot slow weekend/ })).toBeVisible();

    const templateItem = page.locator('.saved-item', { hasText: 'Kampot slow weekend' });
    await templateItem.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('Removed from saved items.')).toBeVisible();
    await expect(page.locator('.saved-item', { hasText: 'Kampot slow weekend' })).toHaveCount(0);

    await page.goto('/saved?type=destinations');
    await expect(page.getByRole('link', { name: /Kampot riverside/ })).toBeVisible();
    const destinationItem = page.locator('.saved-item', { hasText: 'Kampot riverside' });
    await destinationItem.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('Removed from saved items.')).toBeVisible();

    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await other.goto('/sign-up');
    await other.getByLabel('Display name').fill(`Save Other ${Date.now()}`);
    await other.getByLabel('Email address').fill(`save-other-${Date.now()}@example.com`);
    await other.getByLabel('Password', { exact: true }).fill('AdminTest123!');
    await other.getByLabel('Confirm password').fill('AdminTest123!');
    await other.getByRole('button', { name: 'Create account' }).click();
    await expect(other).toHaveURL(/\/account$/);
    await other.goto('/saved');
    await expect(other.getByText('No saved templates yet')).toBeVisible();
    await otherContext.close();
  });
});
