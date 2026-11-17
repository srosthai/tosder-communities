import { Prisma } from '@prisma/client';
import { getPrisma } from '../db/prisma';
import type { SessionUser } from './auth-user';

const usernamePattern = /^[a-z0-9][a-z0-9-]{2,29}$/;

export function toUsername(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

export function isValidUsername(value: string): boolean {
  return usernamePattern.test(value);
}

function fallbackUsername(user: SessionUser): string {
  const base = toUsername(user.name ?? user.email.split('@')[0] ?? '');
  if (base.length >= 3) return base;
  return `creator-${user.id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()}`;
}

/**
 * Returns the public profile for the signed-in member, creating a safe default
 * on first use. The username can be changed later without affecting auth.
 */
export async function ensureMemberProfile(user: SessionUser) {
  const prisma = getPrisma();
  const existing = await prisma.memberProfile.findUnique({
    where: { userId: user.id },
  });
  if (existing) return existing;

  const base = fallbackUsername(user);
  let username = base;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const taken = await prisma.memberProfile.findUnique({ where: { username } });
    if (!taken) break;
    username = `${base.slice(0, 24)}-${attempt + 1}`;
  }

  try {
    return await prisma.memberProfile.create({
      data: {
        userId: user.id,
        username,
        displayName: user.name?.trim() || user.email.split('@')[0] || 'Creator',
        avatarUrl: user.image ?? null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const raced = await prisma.memberProfile.findUnique({
        where: { userId: user.id },
      });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function getMemberProfile(userId: string) {
  return getPrisma().memberProfile.findUnique({ where: { userId } });
}
