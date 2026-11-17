import type { APIRoute } from 'astro';
import { apiRoute, json } from '../../lib/api';
import { checkDatabase, getPrisma } from '../../db/prisma';

export const GET: APIRoute = apiRoute(async (_context, requestId) => {
  const startedAt = performance.now();
  const databaseCheck = await checkDatabase();

  const schema = {
    templates: false,
    roles: false,
    competitions: false,
  };
  let schemaState: 'ready' | 'partial' | 'missing' | 'unknown' = 'unknown';

  if (databaseCheck.reachable) {
    try {
      const rows = await getPrisma().$queryRaw<Array<{
        templates: boolean;
        roles: boolean;
        competitions: boolean;
      }>>`
        SELECT
          to_regclass('public.travel_templates') IS NOT NULL AS templates,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'member_profiles'
              AND column_name = 'suspended_at'
          ) AS roles,
          to_regclass('public.competitions') IS NOT NULL AS competitions
      `;
      const row = rows[0];
      if (row) {
        schema.templates = row.templates;
        schema.roles = row.roles;
        schema.competitions = row.competitions;
        schemaState = row.templates && row.roles && row.competitions ? 'ready' : 'partial';
      }
    } catch {
      schemaState = 'missing';
    }
  }

  const healthy = databaseCheck.reachable === true && schemaState === 'ready';

  return json(
    {
      status: healthy ? 'ok' : 'degraded',
      app: 'tosder-communities',
      checks: {
        database: databaseCheck,
        schema: schemaState,
        features: schema,
      },
      latencyMs: Math.round(performance.now() - startedAt),
      release: process.env.RELEASE ?? process.env.NODE_ENV ?? 'development',
      timestamp: new Date().toISOString(),
      requestId,
    },
    healthy ? 200 : 503,
  );
});
