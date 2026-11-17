import type { APIContext, APIRoute } from 'astro';
import { z } from 'zod';
import { apiRoute, ApiError, json } from '../../../../lib/api';
import { getSessionUser } from '../../../../lib/auth-user';
import { likeTemplate, unlikeTemplate } from '../../../../lib/engagement';
import { ensureMemberProfile } from '../../../../lib/profiles';

export const prerender = false;

const idSchema = z.uuid();

async function handle(context: APIContext, requestId: string, like: boolean) {
  const user = await getSessionUser(context);
  if (!user) {
    throw new ApiError({ status: 401, code: 'unauthenticated', message: 'Sign in to like this template.' });
  }
  const id = idSchema.safeParse(context.params.id);
  if (!id.success) throw new ApiError({ status: 404, code: 'not_found', message: 'Template not found.' });
  await ensureMemberProfile(user);
  const result = like ? await likeTemplate(user.id, id.data) : await unlikeTemplate(user.id, id.data);
  return json({ data: result, requestId });
}

export const PUT: APIRoute = apiRoute((context, requestId) => handle(context, requestId, true), {
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const DELETE: APIRoute = apiRoute((context, requestId) => handle(context, requestId, false), {
  rateLimit: { limit: 60, windowMs: 60_000 },
});
