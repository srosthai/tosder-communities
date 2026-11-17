import type { APIRoute } from 'astro';
import { z } from 'zod';
import { apiRoute, ApiError, json, parseJson } from '../../../lib/api';
import { getSessionUser } from '../../../lib/auth-user';
import { deleteReview, updateReview } from '../../../lib/reviews';

export const prerender = false;

const idSchema = z.uuid();
const schema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(4000).nullish(),
});

export const PATCH: APIRoute = apiRoute(async (context, requestId) => {
  const user = await getSessionUser(context);
  if (!user) throw new ApiError({ status: 401, code: 'unauthenticated', message: 'Sign in first.' });
  const id = idSchema.safeParse(context.params.id);
  if (!id.success) throw new ApiError({ status: 404, code: 'not_found', message: 'Review not found.' });
  const body = await parseJson(context.request, schema);
  const review = await updateReview(user.id, id.data, body);
  return json({ data: { id: review.id, rating: review.rating }, requestId });
});

export const DELETE: APIRoute = apiRoute(async (context, requestId) => {
  const user = await getSessionUser(context);
  if (!user) throw new ApiError({ status: 401, code: 'unauthenticated', message: 'Sign in first.' });
  const id = idSchema.safeParse(context.params.id);
  if (!id.success) throw new ApiError({ status: 404, code: 'not_found', message: 'Review not found.' });
  await deleteReview(user.id, id.data);
  return json({ data: { deleted: true }, requestId });
});
