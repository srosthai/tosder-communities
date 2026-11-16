import type { APIRoute } from 'astro';
import { checkDatabase, getPrisma } from '../../db/prisma';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export const GET: APIRoute = async () => {
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
    },
    healthy ? 200 : 503,
  );
};
