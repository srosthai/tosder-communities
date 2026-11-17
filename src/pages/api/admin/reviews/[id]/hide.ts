import type { APIRoute } from 'astro';
import { z } from 'zod';
import { apiRoute, ApiError, json } from '../../../../../lib/api';
import { getContentAdmin } from '../../../../../lib/admin-auth';
import { hideReview } from '../../../../../lib/reviews';

export const prerender = false;

export const POST: APIRoute = apiRoute(async (context, requestId) => {
  const { user, allowed } = await getContentAdmin(context);
  if (!user) throw new ApiError({ status: 401, code: 'unauthenticated', message: 'Sign in first.' });
  if (!allowed) throw new ApiError({ status: 403, code: 'forbidden', message: 'Content admin access required.' });
  const id = z.uuid().safeParse(context.params.id);
  if (!id.success) throw new ApiError({ status: 404, code: 'not_found', message: 'Review not found.' });
  const review = await hideReview({ id: user.id, email: user.email }, id.data);
  return json({ data: { id: review.id, status: review.status }, requestId });
});
