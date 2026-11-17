import type { APIRoute } from 'astro';
import { requestOrigin } from '../lib/request-origin';

export const GET: APIRoute = (context) => {
  const origin = requestOrigin(context);
  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /account
Disallow: /sign-in
Disallow: /sign-up
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify-email
Disallow: /status

Sitemap: ${new URL('/sitemap.xml', origin).toString()}
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
