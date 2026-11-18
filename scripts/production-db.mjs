#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const command = process.argv[2];
const url = process.env.PRODUCTION_DATABASE_URL;
const directUrl = process.env.PRODUCTION_DIRECT_URL ?? url;

if (!url) {
  console.error(
    [
      'Set PRODUCTION_DATABASE_URL to the production Neon connection string.',
      'Optionally set PRODUCTION_DIRECT_URL to the direct (non-pooled) URL.',
      'Example:',
      '  PRODUCTION_DATABASE_URL="postgresql://..." npm run db:production:migrate',
    ].join('\n'),
  );
  process.exit(1);
}

if (!['migrate', 'seed'].includes(command)) {
  console.error('Usage: node scripts/production-db.mjs <migrate|seed>');
  process.exit(1);
}

try {
  const target = new URL(url);
  console.log(`Target: ${target.hostname}${target.pathname}`);
  console.log('Credentials are read from the environment and are not printed.');
} catch {
  console.error('PRODUCTION_DATABASE_URL is not a valid URL.');
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_URL: url,
  DIRECT_URL: directUrl,
  NODE_ENV: 'production',
};

const [bin, args] =
  command === 'migrate'
    ? ['npx', ['prisma', 'migrate', 'deploy']]
    : ['node', ['prisma/seed.mjs']];

const result = spawnSync(bin, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
