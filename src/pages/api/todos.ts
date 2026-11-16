import type { APIRoute } from 'astro';
import {
  ApiError,
  apiRoute,
  getIdempotencyKey,
  json,
  parseJson,
  rememberIdempotent,
  replayIdempotent,
} from '../../lib/api';
import { getPrisma } from '../../db/prisma';
import { z } from 'zod';

const todoSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const GET: APIRoute = apiRoute(
  async (_context, requestId) => {
    const data = await getPrisma().todo.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return json({ data, requestId });
  },
  { rateLimit: { limit: 120, windowMs: 60_000 } },
);

export const POST: APIRoute = apiRoute(
  async ({ request }, requestId) => {
    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey) {
      throw new ApiError({
        status: 400,
        code: 'idempotency_key_required',
        message: 'Send an Idempotency-Key header with this mutation.',
      });
    }

    const cached = replayIdempotent(request, idempotencyKey);
    if (cached) {
      return json(cached.body, cached.status, {
        ...cached.headers,
        'idempotent-replayed': 'true',
      });
    }

    const input = await parseJson(request, todoSchema);
    const todo = await getPrisma().todo.create({ data: { name: input.name } });

    const body = { data: todo, requestId };
    rememberIdempotent(request, idempotencyKey, {
      status: 201,
      body,
      headers: { location: `/api/todos/${todo.id}` },
    });

    return json(body, 201);
  },
  { rateLimit: { limit: 30, windowMs: 60_000 } },
);
