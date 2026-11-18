#!/usr/bin/env node
const base = (process.env.PRODUCTION_URL ?? 'https://tosder-communities.vercel.app').replace(/\/$/, '');
const paths = ['/api/health', '/', '/explore', '/templates', '/leaderboard', '/admin'];
const failures = [];

for (const path of paths) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : 'request failed'}`);
    console.log(`ERR ${path}`);
    continue;
  }

  const expected = path === '/api/health' ? 200 : 200;
  console.log(`${response.status} ${path}`);
  if (response.status !== expected) {
    failures.push(`${path}: expected ${expected}, received ${response.status}`);
  }

  if (path === '/api/health') {
    const body = await response.json().catch(() => null);
    console.log(JSON.stringify(body?.checks ?? body, null, 2));
    if (body?.checks?.schema !== 'ready') {
      failures.push(`health: schema is ${body?.checks?.schema ?? 'unknown'}`);
    }
  }
}

if (failures.length > 0) {
  console.error('\nProduction checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nProduction checks passed.');
