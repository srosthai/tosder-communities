import { CONTENT_ADMIN_EMAILS } from 'astro:env/server';

export function isContentAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const allowlist = (CONTENT_ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(email.toLowerCase());
}
