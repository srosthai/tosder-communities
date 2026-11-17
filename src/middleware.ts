import { defineMiddleware } from 'astro:middleware';
import { captureException, log, newRequestId } from './lib/logger';

const mutating = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function applySecurityHeaders(response: Response, requestUrl: URL) {
  const headers = response.headers;
  const set = (name: string, value: string) => {
    if (!headers.has(name)) headers.set(name, value);
  };

  set('x-content-type-options', 'nosniff');
  set('referrer-policy', 'strict-origin-when-cross-origin');
  set('x-frame-options', 'DENY');
  set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  set('content-security-policy', "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (requestUrl.protocol === 'https:') {
    set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const startedAt = performance.now();
  const headerId = context.request.headers.get('x-request-id');
  const requestId = headerId ?? newRequestId();

  try {
    if (mutating.has(context.request.method)) {
      const origin = context.request.headers.get('origin');
      const fetchSite = context.request.headers.get('sec-fetch-site');
      const host =
        context.request.headers.get('x-forwarded-host') ??
        context.request.headers.get('host') ??
        context.url.host;
      const sameOrigin = !origin || new URL(origin).host === host;

      if (!sameOrigin || fetchSite === 'cross-site') {
        return new Response('Cross-site request blocked.', {
          status: 403,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }
    }

    const response = await next();
    const responseId = response.headers.get('x-request-id') ?? requestId;
    if (!response.headers.has('x-request-id')) {
      try {
        response.headers.set('x-request-id', responseId);
      } catch {
        /* Some response types expose immutable headers. */
      }
    }

    try {
      applySecurityHeaders(response, context.url);
    } catch {
      /* Immutable streaming responses still get request logging. */
    }

    const status = response.status;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    log(level, 'request', {
      requestId: responseId,
      method: context.request.method,
      path: context.url.pathname,
      status,
      durationMs: Math.round(performance.now() - startedAt),
    });

    return response;
  } catch (error) {
    captureException(error, {
      requestId,
      method: context.request.method,
      path: context.url.pathname,
      durationMs: Math.round(performance.now() - startedAt),
    });
    throw error;
  }
});
