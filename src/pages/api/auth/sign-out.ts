import type { APIRoute } from 'astro';
import { getAuthForRequest } from '../../../lib/auth-server';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const auth = getAuthForRequest(context);
  await auth.signOut();
  return context.redirect('/');
};
