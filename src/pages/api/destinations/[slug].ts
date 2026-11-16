import type { APIRoute } from 'astro';
import { ApiError, apiRoute, json } from '../../../lib/api';
import { getDestinationBySlug } from '../../../lib/destinations';
import { destinationSlugSchema } from '../../../lib/schemas';

export const GET: APIRoute = apiRoute(
  async ({ params }, requestId) => {
    const parsed = destinationSlugSchema.safeParse(params.slug);

    if (!parsed.success) {
      throw new ApiError({
        status: 400,
        code: 'invalid_slug',
        message: 'The destination slug is invalid.',
      });
    }

    const destination = await getDestinationBySlug(parsed.data);
    if (!destination) {
      throw new ApiError({
        status: 404,
        code: 'not_found',
        message: 'Destination not found.',
      });
    }

    return json({ data: destination, requestId });
  },
  { rateLimit: { limit: 120, windowMs: 60_000 } },
);
