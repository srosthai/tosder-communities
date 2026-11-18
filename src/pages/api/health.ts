import type { APIRoute } from 'astro';
import { apiRoute, json } from '../../lib/api';
import { checkDatabase, getPrisma } from '../../db/prisma';
import { DATABASE_URL, NEON_AUTH_BASE_URL } from 'astro:env/server';

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

  const target = (() => {
    if (!DATABASE_URL) return null;
    try {
      const url = new URL(DATABASE_URL);
      return { host: url.hostname, database: url.pathname.replace(/^\//, '') || 'unknown' };
    } catch {
      return null;
    }
  })();

  const authConfigured = Boolean(NEON_AUTH_BASE_URL);
  const storageConfigured = Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );

  const healthy = databaseCheck.reachable === true && schemaState === 'ready';

  return json(
    {
      status: healthy ? 'ok' : 'degraded',
      app: 'tosder-communities',
      checks: {
        database: databaseCheck,
        target,
        schema: schemaState,
        features: schema,
        auth: { configured: authConfigured },
        storage: { configured: storageConfigured },
      },
      latencyMs: Math.round(performance.now() - startedAt),
      release: process.env.RELEASE ?? process.env.NODE_ENV ?? 'development',
      timestamp: new Date().toISOString(),
      requestId,
    },
    healthy ? 200 : 503,
  );
});
