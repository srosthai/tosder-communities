import type { APIRoute } from 'astro';
import { z } from 'zod';
import { ApiError, apiRoute, json, parseJson } from '../../../lib/api';
import { deleteAccount } from '../../../lib/account';
import { getAuthForRequest } from '../../../lib/auth-server';
import { getSessionUser } from '../../../lib/auth-user';
import { ensureMemberProfile } from '../../../lib/profiles';

export const prerender = false;

const schema = z.object({
  confirmation: z.literal('DELETE', {
    error: 'Type DELETE to confirm account deletion.',
  }),
});

export const POST: APIRoute = apiRoute(
  async (context, requestId) => {
    const user = await getSessionUser(context);
    if (!user) {
      throw new ApiError({
        status: 401,
        code: 'unauthenticated',
        message: 'Sign in to delete your account.',
      });
    }

    await parseJson(context.request, schema);
    await ensureMemberProfile(user);
    const result = await deleteAccount(user.id);

    try {
      await getAuthForRequest(context).signOut();
    } catch {
      // The data deletion has already committed; cookie cleanup is best effort.
    }

    return json({ data: result, requestId });
  },
  { rateLimit: { limit: 3, windowMs: 60_000 } },
);
