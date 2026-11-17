import type { APIContext } from 'astro';
import { getAuthForRequest } from './auth-server';

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
    return (data?.user as SessionUser | undefined) ?? null;
  } catch {
    return null;
  }
}
