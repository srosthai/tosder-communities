import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.local' });

const adminEmail = 'admin@example.com';
const adminPassword = 'AdminTest123!';
const stamp = Date.now();
const title = `Builder test ${stamp}`;

async function waitForAutosave(page: import('@playwright/test').Page) {
  const state = page.locator('[data-save-state]');
  await expect(state).toHaveText(/Unsaved changes|Saving…/);
  await expect(state).toHaveText('Saved', { timeout: 10_000 });
}

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
    where: { title: { startsWith: title } },
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
    where: { username: { startsWith: 'builder-other' } },
    select: { userId: true },
  });
  const otherIds = otherProfiles.map((profile) => profile.userId);
  if (otherIds.length > 0) {
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: otherIds } } });
    await prisma.memberProfile.deleteMany({ where: { userId: { in: otherIds } } });
  }
  await prisma.$disconnect();
});

test.describe.serial('template builder', () => {
  test.skip(
    process.env.AUTH_E2E !== 'true',
    'Set AUTH_E2E=true and provide the test admin account to run builder tests.',
  );

  test.setTimeout(120_000);

  test('builds, autosaves, reorders, previews, and validates an itinerary', async ({ page }) => {
    await ensureAdmin(page);

    const created = await page.request.post('/api/creator/templates', {
      data: { title },
    });
    expect(created.status()).toBe(201);
    const id = (await created.json()).data.id as string;

    await page.goto(`/creator/templates/${id}?step=basics`);
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
    await expect(page.getByText('0 of 6 steps complete')).toBeVisible();

    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByText('Add a one-line summary.')).toBeVisible();
    await expect(page).toHaveURL(/step=basics/);

    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Summary').fill('Two slow days around Siem Reap.');
    await page.getByLabel('Description').fill('A short itinerary for the builder test.');
    await page.getByLabel('Province').selectOption({ label: 'Siem Reap' });

    await page.getByLabel('Summary').fill('Two slow days around Siem Reap, with temples and food.');
    await waitForAutosave(page);
    await page.reload();
    await expect(page.getByLabel('Summary')).toHaveValue(
      'Two slow days around Siem Reap, with temples and food.',
    );

    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL(/step=details/);

    await page.getByLabel('Travel style').selectOption('Slow travel');
    await page.getByLabel('Best season').fill('November to March');
    await page.getByLabel('Budget from (USD)').fill('150');
    await page.getByLabel('Budget to (USD)').fill('320');
    await page.getByLabel('Tuk-tuk').check();
    await page.getByLabel('Walking').check();
    await page.getByLabel('Couples').check();
    await page.getByLabel('Slow travelers').check();
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL(/step=plan/);

    await page.getByRole('button', { name: 'Add day 1' }).click();
    await expect(page).toHaveURL(/step=plan&day=/);
    const dayUrl = page.url();

    await page.getByRole('button', { name: 'Add item' }).click();
    await expect(page).toHaveURL(/step=plan&day=.*&item=/);

    await page.locator('.item[open]').getByLabel('Title', { exact: true }).fill('Morning at the temples');
    await page.locator('.item[open]').getByLabel('Type').selectOption('ATTRACTION');
    await page.locator('.item[open]').getByLabel('Start time').fill('09:00');
    await page.locator('.item[open]').getByLabel('End time').fill('11:00');
    await page.locator('.item[open]').getByLabel('Estimated cost (USD)').fill('35');
    await page.locator('.item[open]').getByLabel('Description').fill('Start before the heat and walk the outer galleries.');
    await page.locator('.item[open]').getByRole('button', { name: 'Save item' }).click();
    await page.waitForURL(/step=plan&saved=1$/);

    await page.getByRole('button', { name: 'Add item' }).click();
    await page.locator('.item[open]').getByLabel('Title', { exact: true }).fill('Coffee stop');
    await page.locator('.item[open]').getByLabel('Type').selectOption('FOOD');
    await page.locator('.item[open]').getByLabel('Start time').fill('10:30');
    await page.locator('.item[open]').getByLabel('End time').fill('11:15');
    await page.locator('.item[open]').getByRole('button', { name: 'Save item' }).click();
    await page.waitForURL(/step=plan&saved=1$/);

    await page.reload();
    await expect(page.locator('.item__title', { hasText: 'Morning at the temples' })).toBeVisible();
    await expect(page.locator('.item__title', { hasText: 'Coffee stop' })).toBeVisible();
    await expect(page.getByText('overlaps')).toBeVisible();

    const firstItem = page.locator('.item').first();
    await firstItem.locator('summary').click();
    const moveDown = firstItem.getByRole('button', { name: 'Move down' });
    await expect(moveDown).toBeEnabled();
    await moveDown.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/saved=1/, { timeout: 10_000 });
    await expect(page.locator('.item__title').first()).toHaveText('Coffee stop');

    await page.locator('.item').first().getByRole('button', { name: 'Duplicate' }).click();
    await expect(page.locator('.item__title', { hasText: 'Coffee stop (copy)' })).toBeVisible();

    const copyItem = page.locator('.item', { hasText: 'Coffee stop (copy)' });
    await copyItem.locator('summary').click();
    page.once('dialog', (dialog) => dialog.accept());
    await copyItem.getByRole('button', { name: 'Remove' }).click();
    await expect(page.locator('.item__title', { hasText: 'Coffee stop (copy)' })).toHaveCount(0);

    await page.getByRole('link', { name: 'Continue to map' }).click();
    await expect(page).toHaveURL(/step=map/);
    await page.getByLabel('Travel notes').fill('Book a tuk-tuk the night before. Carry small notes for tickets.');
    await page.getByRole('button', { name: 'Save and preview' }).click();

    await expect(page).toHaveURL(/step=preview/);
    await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible();
    await expect(page.getByText('Morning at the temples')).toBeVisible();
    await expect(page.getByText('Book a tuk-tuk the night before.')).toBeVisible();

    await page.getByRole('link', { name: 'Continue to publish' }).click();
    await expect(page).toHaveURL(/step=publish/);
    await expect(page.getByRole('heading', { name: 'Blocking issues' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /community guidelines/ })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Travel notes')).toHaveCount(0);
    await page.goto(`/creator/templates/${id}?step=map`);
    await expect(page.getByLabel('Travel notes')).toHaveValue(
      'Book a tuk-tuk the night before. Carry small notes for tickets.',
    );
    await page.goto(dayUrl);
    await expect(page.locator('.item__title', { hasText: 'Morning at the temples' })).toBeVisible();

    await page.goto('/account');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/');
    await ensureAdmin(page);

    await page.goto(`/creator/templates/${id}?step=map`);
    await expect(page.getByLabel('Travel notes')).toHaveValue(
      'Book a tuk-tuk the night before. Carry small notes for tickets.',
    );
  });

  test('keeps the builder private to its owner', async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    await ensureAdmin(owner);
    const created = await owner.request.post('/api/creator/templates', {
      data: { title: `${title} private` },
    });
    const id = (await created.json()).data.id as string;
    await ownerContext.close();

    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await other.goto('/sign-up');
    await other.getByLabel('Display name').fill(`Builder Other ${stamp}`);
    await other.getByLabel('Email address').fill(`builder-other-${stamp}@example.com`);
    await other.getByLabel('Password', { exact: true }).fill(adminPassword);
    await other.getByLabel('Confirm password').fill(adminPassword);
    await other.getByRole('button', { name: 'Create account' }).click();
    await expect(other).toHaveURL(/\/account$/);

    await other.goto(`/creator/templates/${id}?step=basics`);
    await expect(other.getByRole('heading', { name: 'Template not found.' })).toBeVisible();
    await otherContext.close();
  });

  test('adds, removes, and lays out days on a mobile viewport', async ({ page }) => {
    await ensureAdmin(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const created = await page.request.post('/api/creator/templates', {
      data: { title: `${title} mobile` },
    });
    const id = (await created.json()).data.id as string;

    await page.goto(`/creator/templates/${id}?step=plan`);
    await page.getByRole('button', { name: 'Add day 1' }).click();
    await expect(page.getByText('Day 1', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Add day', exact: true }).click();
    await expect(page.getByText('Day 2', { exact: true })).toBeVisible();

    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits).toBe(true);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Remove day 2' }).click();
    await expect(page.getByText('Day 2', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Day 1', { exact: true })).toBeVisible();
  });
});
