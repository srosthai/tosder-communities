import type { APIRoute } from 'astro';
import { z } from 'zod';
import { apiRoute, ApiError, json, parseJson } from '../../../lib/api';
import { getSessionUser } from '../../../lib/auth-user';
import { ensureMemberProfile } from '../../../lib/profiles';
import { copyTemplateToTrip } from '../../../lib/trips';

export const prerender = false;

const schema = z.object({
  templateId: z.uuid(),
  versionId: z.uuid(),
  idempotencyKey: z.string().trim().min(8).max(120),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  title: z.string().trim().max(160).nullish(),
});

export const POST: APIRoute = apiRoute(
  async (context, requestId) => {
    const user = await getSessionUser(context);
    if (!user) {
      throw new ApiError({
        status: 401,
        code: 'unauthenticated',
        message: 'Sign in to copy a template.',
      });
    }

    await ensureMemberProfile(user);
    const body = await parseJson(context.request, schema);

    const result = await copyTemplateToTrip({
      ...body,
      requestId,
      actor: { id: user.id, email: user.email },
    });

    return json(
      {
        data: {
          id: result.trip.id,
          title: result.trip.title,
          created: result.created,
        },
        requestId,
      },
      result.created ? 201 : 200,
    );
  },
  { rateLimit: { limit: 30, windowMs: 60_000 } },
);
