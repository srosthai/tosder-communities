import type { APIContext } from 'astro';
import { getMemberAccess } from './permissions';

export { isContentAdminEmail } from './admin-allowlist';

export async function getContentAdmin(context: APIContext) {
  const access = await getMemberAccess(context);
  return { user: access.user, allowed: access.can('content.manage') };
}

export async function getModeratorAccess(context: APIContext) {
  const access = await getMemberAccess(context);
  return { user: access.user, allowed: access.can('moderation.queue') };
}

export async function getAdministratorAccess(context: APIContext) {
  const access = await getMemberAccess(context);
  return { user: access.user, allowed: access.can('users.roles') };
}
