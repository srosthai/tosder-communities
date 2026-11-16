import { defineMiddleware } from 'astro:middleware';
import { captureException, log, newRequestId } from './lib/logger';

export const onRequest = defineMiddleware(async (context, next) => {
  const startedAt = performance.now();
  const headerId = context.request.headers.get('x-request-id');
  const requestId = headerId ?? newRequestId();

  try {
    const response = await next();
    const responseId = response.headers.get('x-request-id') ?? requestId;
    if (!response.headers.has('x-request-id')) {
      try {
        response.headers.set('x-request-id', responseId);
      } catch {
        /* Some response types expose immutable headers. */
      }
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
