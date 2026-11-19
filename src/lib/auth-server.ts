import { createAuthServer, type RequestContext } from '@neon/auth/server';
import { NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET } from 'astro:env/server';
import type { APIContext } from 'astro';

function authConfig() {
  const baseUrl = NEON_AUTH_BASE_URL;
  const cookieSecret = NEON_AUTH_COOKIE_SECRET;

  if (!baseUrl || !cookieSecret) {
    throw new Error(
      'Neon Auth is not configured. Add NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET to .env.local.',
    );
  }

  return { baseUrl, cookieSecret };
}

/**
 * Framework-agnostic Neon Auth server bound to the current Astro request.
 *
 * The upstream auth server is Neon-hosted. This adapter forwards request
 * cookies and writes refreshed cookies back through Astro's cookie API.
 */
export function getAuthForRequest(context: APIContext) {
  const { baseUrl, cookieSecret } = authConfig();

  const requestContext: RequestContext = {
    getCookies: () => context.request.headers.get('cookie') ?? '',
    setCookie: (name, value, options) => {
      context.cookies.set(name, value, {
        path: options.path ?? '/',
        maxAge: options.maxAge,
        expires: options.expires,
        domain: options.domain,
        secure: options.secure,
        httpOnly: options.httpOnly,
        sameSite: options.sameSite,
      });
    },
    getHeader: (name) => context.request.headers.get(name),
    getOrigin: () => new URL(context.request.url).origin,
    getFramework: () => 'astro',
  };

  return createAuthServer({
    baseUrl,
    cookieSecret,
    context: () => requestContext,
  });
}

export function safeRedirect(value: FormDataEntryValue | string | null, fallback = '/account') {
  const target = typeof value === 'string' ? value : '';
  if (!target.startsWith('/') || target.startsWith('//')) return fallback;
  return target;
}

export async function startSocialSignIn(
  context: APIContext,
  provider: 'google',
  callbackURL: string,
) {
  const auth = getAuthForRequest(context);
  const result = await auth.signIn.social({
    provider,
    callbackURL,
    errorCallbackURL: `${new URL(context.request.url).origin}/sign-in?error=google`,
  });

  if (result.error) {
    return { error: result.error.message ?? 'Google sign-in could not be started.' };
  }

  const url = result.data?.url;
  return url ? { url } : { error: 'Google sign-in could not be started.' };
}
