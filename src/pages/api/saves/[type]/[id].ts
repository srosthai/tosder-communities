import type { APIContext, APIRoute } from 'astro';
import { z } from 'zod';
import { apiRoute, ApiError, json } from '../../../../lib/api';
import { getSessionUser } from '../../../../lib/auth-user';
import { ensureMemberProfile } from '../../../../lib/profiles';
import {
  saveDestination,
  saveTemplate,
  unsaveDestination,
  unsaveTemplate,
} from '../../../../lib/saves';

export const prerender = false;

const idSchema = z.uuid();

async function handle(context: APIContext, requestId: string, save: boolean) {
  const user = await getSessionUser(context);
  if (!user) {
    throw new ApiError({
      status: 401,
      code: 'unauthenticated',
      message: 'Sign in to save this.',
    });
  }

  const type = context.params.type;
  const id = idSchema.safeParse(context.params.id);
  if (!id.success || (type !== 'templates' && type !== 'destinations')) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Save target not found.' });
  }

  await ensureMemberProfile(user);

  const result =
    type === 'templates'
      ? save
        ? await saveTemplate(user.id, id.data)
        : await unsaveTemplate(user.id, id.data)
      : save
        ? await saveDestination(user.id, id.data)
        : await unsaveDestination(user.id, id.data);

  return json({ data: result, requestId });
}

export const PUT: APIRoute = apiRoute(
  (context, requestId) => handle(context, requestId, true),
  { rateLimit: { limit: 60, windowMs: 60_000 } },
);

export const DELETE: APIRoute = apiRoute(
  (context, requestId) => handle(context, requestId, false),
  { rateLimit: { limit: 60, windowMs: 60_000 } },
);
