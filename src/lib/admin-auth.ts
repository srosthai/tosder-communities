import { CONTENT_ADMIN_EMAILS } from 'astro:env/server';
import type { APIContext } from 'astro';
import { getSessionUser } from './auth-user';

export function isContentAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const allowlist = (CONTENT_ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(email.toLowerCase());
}

export async function getContentAdmin(context: APIContext) {
  const user = await getSessionUser(context);
  return { user, allowed: Boolean(user && isContentAdminEmail(user.email)) };
}
