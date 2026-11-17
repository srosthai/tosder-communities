/**
 * Builds the public origin from the incoming request so canonical URLs and
 * generated sitemap links match the host the visitor actually used. Proxies can
 * override the protocol and host through the standard forwarded headers.
 */
export function requestOrigin(context: { request: Request; url: URL }): string {
  const headers = context.request.headers;
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) return context.url.origin;

  const protocol =
    headers.get('x-forwarded-proto') ??
    (context.url.protocol === 'https:' ? 'https' : 'http');

  return `${protocol}://${host}`;
}
