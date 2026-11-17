import type { APIRoute } from 'astro';
import { z } from 'zod';
import { apiRoute, ApiError, json, parseJson } from '../../../lib/api';
import { getSessionUser } from '../../../lib/auth-user';
import { ensureMemberProfile } from '../../../lib/profiles';
import { createReport } from '../../../lib/reports';

export const prerender = false;

const schema = z.object({
  targetType: z.enum(['TEMPLATE', 'REVIEW', 'USER', 'COMMENT']),
  targetId: z.string().trim().min(1).max(100),
  reasonCode: z.string().trim().min(1).max(60).default('other'),
  details: z.string().trim().max(2000).nullish(),
});

export const POST: APIRoute = apiRoute(async (context, requestId) => {
  const user = await getSessionUser(context);
  if (!user) {
    throw new ApiError({ status: 401, code: 'unauthenticated', message: 'Sign in to report this.' });
  }
  await ensureMemberProfile(user);
  const body = await parseJson(context.request, schema);
  const report = await createReport({
    reporterId: user.id,
    targetType: body.targetType,
    targetId: body.targetId,
    reasonCode: body.reasonCode,
    details: body.details,
  });
  return json({ data: { id: report.id, status: report.status }, requestId }, 201);
}, { rateLimit: { limit: 20, windowMs: 60_000 } });
