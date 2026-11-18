import type { APIContext } from 'astro';
import { getAuthForRequest } from './auth-server';
import { getPrisma } from '../db/prisma';

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean;
  image?: string | null;
}

export async function getSessionUser(
  context: APIContext,
): Promise<SessionUser | null> {
  try {
    const auth = getAuthForRequest(context);
    const { data } = await auth.getSession();
    const user = (data?.user as SessionUser | undefined) ?? null;
    if (!user) return null;

    // Deleted accounts keep an anonymized profile for financial/audit
    // integrity, but must behave as signed out for every application surface.
    const profile = await getPrisma().memberProfile.findUnique({
      where: { userId: user.id },
      select: { deletedAt: true },
    });
    if (profile?.deletedAt) return null;

    return user;
  } catch {
    return null;
  }
}
