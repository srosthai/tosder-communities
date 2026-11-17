import type { APIRoute } from 'astro';
import { getSessionUser } from '../../../lib/auth-user';
import { getPublishedTemplateBySlug } from '../../../lib/public-templates';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const slug = context.params.slug ?? '';
  const template = await getPublishedTemplateBySlug(slug);

  if (!template) {
    return new Response('Template not found', { status: 404 });
  }

  const user = await getSessionUser(context);
  const target = `/trips/new?template=${template.id}&version=${template.version.id}`;

  if (!user) {
    return context.redirect(
      `/sign-in?redirectTo=${encodeURIComponent(`/templates/${slug}/use`)}`,
    );
  }

  return context.redirect(target);
};
