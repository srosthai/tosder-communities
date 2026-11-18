import type { APIRoute } from 'astro';
import { ApiError, apiRoute } from '../../../lib/api';
import { exportAccountData } from '../../../lib/account';
import { getSessionUser } from '../../../lib/auth-user';
import { ensureMemberProfile } from '../../../lib/profiles';

export const prerender = false;

export const GET: APIRoute = apiRoute(
  async (context) => {
    const user = await getSessionUser(context);
    if (!user) {
      throw new ApiError({
        status: 401,
        code: 'unauthenticated',
        message: 'Sign in to export your data.',
      });
    }

    await ensureMemberProfile(user);
    const data = await exportAccountData(user.id, user.email);
    if (!data) {
      throw new ApiError({
        status: 404,
        code: 'not_found',
        message: 'No profile is available for this account.',
      });
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="tosder-account-${stamp}.json"`,
        'cache-control': 'no-store',
      },
    });
  },
  { rateLimit: { limit: 5, windowMs: 60_000 } },
);
