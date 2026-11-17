import type { APIRoute } from 'astro';
import { z } from 'zod';
import { apiRoute, ApiError, json, parseJson } from '../../../../../lib/api';
import { isContentAdminEmail } from '../../../../../lib/admin-auth';
import { getSessionUser } from '../../../../../lib/auth-user';
import { ensureMemberProfile } from '../../../../../lib/profiles';
import { publishTemplate } from '../../../../../lib/template-publishing';

export const prerender = false;

const schema = z.object({
  visibility: z.enum(['public', 'unlisted']).default('public'),
  guidelines: z.literal(true),
});

export const POST: APIRoute = apiRoute(async (context, requestId) => {
  const user = await getSessionUser(context);
  if (!user) {
    throw new ApiError({
      status: 401,
      code: 'unauthenticated',
      message: 'Sign in to publish a template.',
    });
  }

  const id = z.uuid().safeParse(context.params.id);
  if (!id.success) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Template not found.' });
  }

  await ensureMemberProfile(user);
  const body = await parseJson(context.request, schema);
  const result = await publishTemplate(
    id.data,
    user.id,
    { id: user.id, email: user.email },
    {
      visibility: body.visibility,
      guidelines: body.guidelines,
      emailVerified: Boolean(user.emailVerified),
      allowUnverified: isContentAdminEmail(user.email),
    },
  );

  return json({
    data: {
      id: result.publishedTemplate.id,
      status: result.publishedTemplate.status,
      slug: result.publishedTemplate.slug,
      publicUrl: result.publicUrl,
      versionNumber: result.version.versionNumber,
      created: result.created,
    },
    requestId,
  });
});
