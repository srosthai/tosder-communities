import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

/**
 * Server-side Supabase client.
 *
 * Keep this lazy so builds and health checks can run before credentials are
 * provisioned. The publishable key is safe for client use, but this client is
 * intentionally server-only for now.
 */
export function getSupabase(): SupabaseClient {
  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Add SUPABASE_URL and SUPABASE_KEY to .env.local.',
    );
  }

  client ??= createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}
