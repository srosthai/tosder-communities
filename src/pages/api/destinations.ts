import type { APIRoute } from 'astro';
import { apiRoute, json, parseQuery } from '../../lib/api';
import { listDestinations } from '../../lib/destinations';
import { destinationListQuerySchema } from '../../lib/schemas';

export const GET: APIRoute = apiRoute(
  async ({ url }, requestId) => {
    const query = parseQuery(url, destinationListQuerySchema);
    const result = await listDestinations(query);

    return json({
      data: result.destinations,
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
      requestId,
    });
  },
  { rateLimit: { limit: 120, windowMs: 60_000 } },
);
