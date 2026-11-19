import { randomBytes } from 'node:crypto';
import { writeFileSync, chmodSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '/home/dev/Native-project/tosder/.env.local', quiet: true });

const base = process.env.PROVISION_BASE_URL ?? 'http://127.0.0.1:4327';
const email = process.env.SEED_ADMIN_EMAIL ?? 'seed@tosder.com';
const name = 'Tosder Seed';
const password = `${randomBytes(18).toString('base64url')}!a9`;

const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await page.goto(`${base}/sign-up`);
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/account$/, { timeout: 30_000 });
} catch (error) {
  console.error('Could not create the seeder account:', error instanceof Error ? error.message : error);
  console.error((await page.locator('body').innerText().catch(() => '')).slice(0, 600));
  await browser.close();
  process.exit(1);
}
await browser.close();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const rows = await prisma.$queryRawUnsafe(
  'select id from neon_auth."user" where email = $1',
  email,
);
const authUser = rows[0];
if (!authUser) {
  console.error('Auth user was created but could not be found.');
  await prisma.$disconnect();
  process.exit(1);
}

const profile = await prisma.memberProfile.upsert({
  where: { userId: authUser.id },
  update: {
    username: 'tosder-seed',
    displayName: name,
    role: 'ADMINISTRATOR',
    trustedCreator: true,
    suspendedAt: null,
    deletedAt: null,
  },
  create: {
    userId: authUser.id,
    username: 'tosder-seed',
    displayName: name,
    role: 'ADMINISTRATOR',
    trustedCreator: true,
  },
});

await prisma.auditEvent.create({
  data: {
    actorId: authUser.id,
    actorEmail: email,
    action: 'account.provisioned',
    entityType: 'member',
    entityId: authUser.id,
    summary: 'Provisioned the production seeder account',
    metadata: { role: 'ADMINISTRATOR', trustedCreator: true },
  },
});
await prisma.$disconnect();

const path = '/home/dev/Native-project/tosder/.secrets/production-accounts.txt';
writeFileSync(
  path,
  [
    'Tosder Communities production accounts',
    'Generated: ' + new Date().toISOString(),
    '',
    'Superadmin (Google sign-in):',
    `  email: ${process.env.SUPERADMIN_EMAIL ?? 'srosthai00@gmail.com'}`,
    '  role: ADMINISTRATOR',
    '  password: use Google sign-in; no local password is stored',
    '',
    'Seeder (email/password):',
    `  email: ${email}`,
    `  password: ${password}`,
    '  role: ADMINISTRATOR (content + publishing)',
    `  auth user id: ${authUser.id}`,
    `  username: ${profile.username}`,
    '',
    'Change the seeder password after the first production sign-in.',
    '',
  ].join('\n'),
  { mode: 0o600 },
);
chmodSync(path, 0o600);

console.log('Provisioned seeder:', profile.username, profile.role);
console.log('Credentials written to', path);
