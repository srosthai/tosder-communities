import type { APIRoute } from 'astro';
import { z } from 'zod';
import { apiRoute, ApiError, json, parseJson } from '../../../lib/api';
import { getSessionUser } from '../../../lib/auth-user';
import { ensureMemberProfile } from '../../../lib/profiles';
import { createReview } from '../../../lib/reviews';

export const prerender = false;

const schema = z.object({
  tripId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(4000).nullish(),
});

export const POST: APIRoute = apiRoute(async (context, requestId) => {
  const user = await getSessionUser(context);
  if (!user) {
    throw new ApiError({ status: 401, code: 'unauthenticated', message: 'Sign in to review a trip.' });
  }
  await ensureMemberProfile(user);
  const body = await parseJson(context.request, schema);
  const review = await createReview({
    userId: user.id,
    tripId: body.tripId,
    rating: body.rating,
    body: body.body,
  });
  return json({ data: { id: review.id, rating: review.rating }, requestId }, 201);
});
