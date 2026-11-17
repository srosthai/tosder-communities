import type { APIRoute } from 'astro';
import { apiRoute, json } from '../../lib/api';
import { checkDatabase, getPrisma } from '../../db/prisma';

export const GET: APIRoute = apiRoute(async (_context, requestId) => {
  const startedAt = performance.now();
  const databaseCheck = await checkDatabase();

  let schema: 'ready' | 'missing' | 'unknown' = 'unknown';

  if (databaseCheck.reachable) {
    try {
      await getPrisma().$queryRaw`SELECT 1 FROM travel_templates LIMIT 1`;
      schema = 'ready';
    } catch {
      schema = 'missing';
    }
  }

  const healthy = databaseCheck.reachable === true && schema === 'ready';

  return json(
    {
      status: healthy ? 'ok' : 'degraded',
      app: 'tosder-communities',
      checks: {
        database: databaseCheck,
        schema,
      },
      latencyMs: Math.round(performance.now() - startedAt),
      release: process.env.RELEASE ?? process.env.NODE_ENV ?? 'development',
      timestamp: new Date().toISOString(),
      requestId,
    },
    healthy ? 200 : 503,
  );
});
