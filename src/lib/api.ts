import type { APIContext, APIRoute } from 'astro';
import { ZodError, type ZodType } from 'zod';

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

interface ApiErrorOptions {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  headers?: Record<string, string>;

  constructor({ status, code, message, details, headers }: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }
}

export function newRequestId(): string {
  return `req_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export function parseQuery<T>(url: URL, schema: ZodType<T>): T {
  const input = Object.fromEntries(url.searchParams.entries());
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'One or more query parameters are invalid.',
      details: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  return result.data;
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiError({
      status: 400,
      code: 'invalid_json',
      message: 'The request body must be valid JSON.',
    });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'One or more fields are invalid.',
      details: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  return result.data;
}

interface Bucket {
  count: number;
  resetAt: number;
}

interface CachedIdempotentResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  expiresAt: number;
}

const idempotencyCache = new Map<string, CachedIdempotentResponse>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

export function getIdempotencyKey(request: Request): string | null {
  const key = request.headers.get('idempotency-key')?.trim();
  return key ? key : null;
}

export function replayIdempotent(
  request: Request,
  key: string,
): CachedIdempotentResponse | null {
  const cacheKey = `${request.method}:${new URL(request.url).pathname}:${key}`;
  const cached = idempotencyCache.get(cacheKey);

  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    idempotencyCache.delete(cacheKey);
    return null;
  }

  return cached;
}

export function rememberIdempotent(
  request: Request,
  key: string,
  response: { status: number; body: unknown; headers?: Record<string, string> },
): void {
  const cacheKey = `${request.method}:${new URL(request.url).pathname}:${key}`;
  idempotencyCache.set(cacheKey, {
    status: response.status,
    body: response.body,
    headers: response.headers ?? {},
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });

  if (idempotencyCache.size > 5_000) {
    for (const [cacheEntry, value] of idempotencyCache) {
      if (value.expiresAt <= Date.now()) idempotencyCache.delete(cacheEntry);
    }
  }
}

const buckets = new Map<string, Bucket>();

export function enforceRateLimit(key: string, options: RateLimitOptions): Record<string, string> {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
  } else {
    existing.count += 1;
  }

  const bucket = buckets.get(key)!;
  const remaining = Math.max(0, options.limit - bucket.count);
  const resetSeconds = Math.ceil(bucket.resetAt / 1000);
  const headers: Record<string, string> = {
    'x-ratelimit-limit': String(options.limit),
    'x-ratelimit-remaining': String(remaining),
    'x-ratelimit-reset': String(resetSeconds),
  };

  if (bucket.count > options.limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new ApiError({
      status: 429,
      code: 'rate_limited',
      message: 'Too many requests. Try again shortly.',
      headers: { ...headers, 'retry-after': String(retryAfter) },
    });
  }

  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
  }

  return headers;
}

function errorResponse(error: unknown, requestId: string): Response {
  const headers: Record<string, string> = { 'x-request-id': requestId };

  if (error instanceof ApiError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      error.status,
      { ...headers, ...(error.headers ?? {}) },
    );
  }

  if (error instanceof ZodError) {
    return json(
      {
        error: {
          code: 'validation_error',
          message: 'The request is invalid.',
          requestId,
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
      422,
      headers,
    );
  }

  console.error(`[api] ${requestId}`, error);

  return json(
    {
      error: {
        code: 'internal_error',
        message: 'The server could not complete this request.',
        requestId,
      },
    },
    500,
    headers,
  );
}

export function apiRoute(
  handler: (context: APIContext, requestId: string) => Promise<Response> | Response,
  options?: { rateLimit?: RateLimitOptions },
): APIRoute {
  return async (context) => {
    const requestId = newRequestId();

    try {
      let rateHeaders: Record<string, string> = {};

      if (options?.rateLimit) {
        const forwarded = context.request.headers.get('x-forwarded-for');
        const client = forwarded?.split(',')[0]?.trim() || context.clientAddress || 'unknown';
        const key = `${context.request.method}:${new URL(context.request.url).pathname}:${client}`;
        rateHeaders = enforceRateLimit(key, options.rateLimit);
      }

      const response = await handler(context, requestId);
      response.headers.set('x-request-id', requestId);
      Object.entries(rateHeaders).forEach(([name, value]) => response.headers.set(name, value));
      return response;
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}
