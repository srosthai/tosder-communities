import type { APIRoute } from 'astro';
import { z } from 'zod';
import { apiRoute, ApiError, json, parseJson } from '../../../../lib/api';
import { getSessionUser } from '../../../../lib/auth-user';
import { ensureMemberProfile } from '../../../../lib/profiles';
import { reportReview } from '../../../../lib/reviews';

export const prerender = false;

const schema = z.object({ reason: z.string().trim().min(3).max(500) });
const idSchema = z.uuid();

export const POST: APIRoute = apiRoute(async (context, requestId) => {
  const user = await getSessionUser(context);
  if (!user) throw new ApiError({ status: 401, code: 'unauthenticated', message: 'Sign in to report a review.' });
  await ensureMemberProfile(user);
  const id = idSchema.safeParse(context.params.id);
  if (!id.success) throw new ApiError({ status: 404, code: 'not_found', message: 'Review not found.' });
  const body = await parseJson(context.request, schema);
  const review = await reportReview(user.id, id.data, body.reason);
  return json({ data: { id: review.id, status: review.status }, requestId });
});
