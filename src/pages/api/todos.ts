import type { APIRoute } from 'astro';
import { getSupabase } from '../../db/supabase';

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
  try {
    const { data, error } = await getSupabase()
      .from('todos')
      .select('id, name, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      return json(
        {
          error: 'todos_unavailable',
          message: error.message,
          hint:
            error.code === 'PGRST205'
              ? 'Apply the initial Prisma migration or run the SQL from prisma/migrations in the Supabase SQL editor.'
              : undefined,
        },
        503,
      );
    }

    return json({ data });
  } catch (error) {
    return json(
      {
        error: 'supabase_unavailable',
        message:
          error instanceof Error ? error.message : 'Unknown Supabase error.',
      },
      503,
    );
  }
};
