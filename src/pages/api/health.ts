import type { APIRoute } from 'astro';
import { checkDatabase } from '../../db/prisma';
import { getSupabase } from '../../db/supabase';

type TodoTableStatus = 'available' | 'missing' | 'error' | 'unknown';

interface SupabaseCheck {
  configured: boolean;
  reachable: boolean;
  todosTable: TodoTableStatus;
  error: string | null;
}

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

  const supabaseCheck: SupabaseCheck = {
    configured: false,
    reachable: false,
    todosTable: 'unknown',
    error: null,
  };

  try {
    const supabase = getSupabase();
    supabaseCheck.configured = true;

    const { error } = await supabase.from('todos').select('id').limit(1);

    supabaseCheck.reachable = true;

    if (!error) {
      supabaseCheck.todosTable = 'available';
    } else if (error.code === 'PGRST205') {
      supabaseCheck.todosTable = 'missing';
      supabaseCheck.error = error.message;
    } else {
      supabaseCheck.todosTable = 'error';
      supabaseCheck.error = error.message;
    }
  } catch (error) {
    supabaseCheck.error =
      error instanceof Error ? error.message : 'Unknown Supabase error.';
  }

  const databaseCheck = await checkDatabase();
  const healthy =
    supabaseCheck.reachable && databaseCheck.reachable !== false;

  return json(
    {
      status: healthy ? 'ok' : 'degraded',
      app: 'tosder-communities',
      checks: {
        supabase: supabaseCheck,
        database: databaseCheck,
      },
      latencyMs: Math.round(performance.now() - startedAt),
      timestamp: new Date().toISOString(),
    },
    healthy ? 200 : 503,
  );
};
