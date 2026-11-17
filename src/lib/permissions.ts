import type { MemberRole, MemberProfile } from '@prisma/client';
import type { APIContext } from 'astro';
import { isContentAdminEmail } from './admin-allowlist';
import { getSessionUser } from './auth-user';
import { getPrisma } from '../db/prisma';
import { ApiError } from './api';

export const permissions = [
  'content.manage',
  'templates.review',
  'templates.publish.trusted',
  'moderation.queue',
  'moderation.act',
  'competitions.manage',
  'rewards.approve',
  'users.roles',
  'audit.view',
  'usage.override',
] as const;

export type Permission = (typeof permissions)[number];

const matrix: Record<MemberRole, Permission[]> = {
  MEMBER: [],
  TRUSTED_CREATOR: ['templates.publish.trusted'],
  MODERATOR: ['templates.review', 'moderation.queue', 'moderation.act'],
  ADMINISTRATOR: [
    'content.manage',
    'templates.review',
    'templates.publish.trusted',
    'moderation.queue',
    'moderation.act',
    'competitions.manage',
    'rewards.approve',
    'users.roles',
    'audit.view',
    'usage.override',
  ],
};

export function rolePermissions(role: MemberRole): Permission[] {
  return matrix[role] ?? [];
}

export function isTrustedCreator(profile: Pick<MemberProfile, 'role' | 'trustedCreator'> | null) {
  if (!profile) return false;
  return (
    profile.role === 'TRUSTED_CREATOR' ||
    profile.role === 'ADMINISTRATOR' ||
    profile.trustedCreator
  );
}

export interface MemberAccess {
  user: Awaited<ReturnType<typeof getSessionUser>>;
  profile: MemberProfile | null;
  role: MemberRole | null;
  bootstrapAdmin: boolean;
  permissions: Set<Permission>;
  can: (permission: Permission) => boolean;
  trusted: boolean;
}

export async function getMemberAccess(context: APIContext): Promise<MemberAccess> {
  const user = await getSessionUser(context);
  if (!user) {
    return {
      user: null,
      profile: null,
      role: null,
      bootstrapAdmin: false,
      permissions: new Set(),
      can: () => false,
      trusted: false,
    };
  }

  const profile = await getPrisma().memberProfile.findUnique({
    where: { userId: user.id },
  });
  const role = profile?.role ?? 'MEMBER';
  const bootstrapAdmin = isContentAdminEmail(user.email);
  const permissionsSet = new Set<Permission>(rolePermissions(role));
  if (bootstrapAdmin) {
    for (const permission of permissions) permissionsSet.add(permission);
  }

  return {
    user,
    profile,
    role,
    bootstrapAdmin,
    permissions: permissionsSet,
    can: (permission) => permissionsSet.has(permission),
    trusted: isTrustedCreator(profile) || role === 'ADMINISTRATOR',
  };
}

export async function requirePermission(context: APIContext, permission: Permission) {
  const access = await getMemberAccess(context);
  if (!access.user) {
    throw new ApiError({ status: 401, code: 'unauthenticated', message: 'Sign in first.' });
  }
  if (!access.can(permission)) {
    throw new ApiError({
      status: 403,
      code: 'forbidden',
      message: 'You do not have permission to do that.',
    });
  }
  return access;
}

export const roleLabels: Record<MemberRole, string> = {
  MEMBER: 'Member',
  TRUSTED_CREATOR: 'Trusted creator',
  MODERATOR: 'Moderator',
  ADMINISTRATOR: 'Administrator',
};
