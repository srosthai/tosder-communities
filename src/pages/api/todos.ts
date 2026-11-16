import type { APIRoute } from 'astro';
import { getPrisma, isDatabaseConfigured } from '../../db/prisma';

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
  if (!isDatabaseConfigured()) {
    return json(
      {
        error: 'database_not_configured',
        message:
          'Set DATABASE_URL and DIRECT_URL in .env.local to your Neon connection strings.',
      },
      503,
    );
  }

  try {
    const data = await getPrisma().todo.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return json({ data });
  } catch (error) {
    return json(
      {
        error: 'database_unavailable',
        message:
          error instanceof Error ? error.message : 'Unknown database error.',
      },
      503,
    );
  }
};
