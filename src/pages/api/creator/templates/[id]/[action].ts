import type { APIRoute } from 'astro';
import { z } from 'zod';
import { apiRoute, ApiError, json } from '../../../../../lib/api';
import { getSessionUser } from '../../../../../lib/auth-user';
import { ensureMemberProfile } from '../../../../../lib/profiles';
import {
  archiveTemplate,
  duplicateTemplate,
  restoreTemplate,
  submitTemplateForReview,
} from '../../../../../lib/templates';

export const prerender = false;

const idSchema = z.uuid();
const actions = ['duplicate', 'archive', 'restore', 'submit-review'] as const;
type Action = (typeof actions)[number];

export const POST: APIRoute = apiRoute(async (context, requestId) => {
  const user = await getSessionUser(context);
  if (!user) {
    throw new ApiError({
      status: 401,
      code: 'unauthenticated',
      message: 'Sign in to manage templates.',
    });
  }

  const id = idSchema.safeParse(context.params.id);
  const action = actions.includes(context.params.action as Action)
    ? (context.params.action as Action)
    : null;

  if (!id.success || !action) {
    throw new ApiError({
      status: 404,
      code: 'not_found',
      message: 'Template action not found.',
    });
  }

  await ensureMemberProfile(user);
  const actor = { id: user.id, email: user.email };
  let template;

  switch (action) {
    case 'duplicate':
      template = await duplicateTemplate(id.data, user.id, actor);
      break;
    case 'archive':
      template = await archiveTemplate(id.data, user.id, actor);
      break;
    case 'restore':
      template = await restoreTemplate(id.data, user.id, actor);
      break;
    case 'submit-review':
      template = await submitTemplateForReview(id.data, user.id, actor);
      break;
  }

  return json({
    data: {
      id: template.id,
      title: template.title,
      slug: template.slug,
      status: template.status,
    },
    requestId,
  });
});
