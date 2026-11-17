import type { APIRoute } from 'astro';
import { z } from 'zod';
import { apiRoute, ApiError, json, parseJson } from '../../../../../lib/api';
import { getContentAdmin } from '../../../../../lib/admin-auth';
import { overrideUsageEvent } from '../../../../../lib/usage';

export const prerender = false;

const schema = z.object({
  status: z.enum(['QUALIFIED', 'INVALID', 'UNDER_REVIEW', 'VOID']),
  reason: z.string().trim().min(3).max(500),
});

export const POST: APIRoute = apiRoute(async (context, requestId) => {
  const { user, allowed } = await getContentAdmin(context);
  if (!user) throw new ApiError({ status: 401, code: 'unauthenticated', message: 'Sign in first.' });
  if (!allowed) throw new ApiError({ status: 403, code: 'forbidden', message: 'Content admin access required.' });
  const id = z.uuid().safeParse(context.params.id);
  if (!id.success) throw new ApiError({ status: 404, code: 'not_found', message: 'Usage event not found.' });
  const body = await parseJson(context.request, schema);
  const event = await overrideUsageEvent(
    { id: user.id, email: user.email },
    id.data,
    body.status,
    body.reason,
  );
  return json({ data: { id: event.id, status: event.status }, requestId });
});
