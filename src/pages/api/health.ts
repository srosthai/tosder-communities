import type { APIRoute } from 'astro';
import { apiRoute, json } from '../../lib/api';
import { checkDatabase, getPrisma } from '../../db/prisma';

export const GET: APIRoute = apiRoute(async (_context, requestId) => {
  const startedAt = performance.now();
  const databaseCheck = await checkDatabase();

  let todosTable: 'available' | 'missing' | 'unknown' = 'unknown';

  if (databaseCheck.reachable) {
    try {
      await getPrisma().todo.count();
      todosTable = 'available';
    } catch {
      todosTable = 'missing';
    }
  }

  const healthy = databaseCheck.reachable === true && todosTable === 'available';

  return json(
    {
      status: healthy ? 'ok' : 'degraded',
      app: 'tosder-communities',
      checks: {
        database: databaseCheck,
        todosTable,
      },
      latencyMs: Math.round(performance.now() - startedAt),
      timestamp: new Date().toISOString(),
      requestId,
    },
    healthy ? 200 : 503,
  );
});
