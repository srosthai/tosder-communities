import type { APIRoute } from 'astro';
import { z } from 'zod';
import { apiRoute, ApiError, json, parseJson } from '../../../../lib/api';
import { getSessionUser } from '../../../../lib/auth-user';
import { ensureMemberProfile } from '../../../../lib/profiles';
import { createTemplateDraft } from '../../../../lib/templates';

export const prerender = false;

const createSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  summary: z.string().trim().max(400).optional(),
  provinceId: z.uuid().nullish(),
});

export const POST: APIRoute = apiRoute(async (context, requestId) => {
  const user = await getSessionUser(context);
  if (!user) {
    throw new ApiError({
      status: 401,
      code: 'unauthenticated',
      message: 'Sign in to create a template.',
    });
  }

  await ensureMemberProfile(user);

  const body = context.request.headers.get('content-length') === '0'
    ? {}
    : await parseJson(context.request, createSchema);
  const template = await createTemplateDraft(user.id, body);

  return json(
    {
      data: {
        id: template.id,
        title: template.title,
        slug: template.slug,
        status: template.status,
      },
      requestId,
    },
    201,
  );
});
