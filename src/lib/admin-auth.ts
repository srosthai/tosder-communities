import { CONTENT_ADMIN_EMAILS } from 'astro:env/server';
import type { APIContext } from 'astro';
import { getAuthForRequest } from './auth-server';

export function isContentAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const allowlist = (CONTENT_ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(email.toLowerCase());
}

export async function getContentAdmin(context: APIContext) {
  try {
    const auth = getAuthForRequest(context);
    const { data } = await auth.getSession();
    const user = data?.user ?? null;
    return { user, allowed: Boolean(user && isContentAdminEmail(user.email)) };
  } catch {
    return { user: null, allowed: false };
  }
}
