import type { Prisma } from '@prisma/client';
import type { APIRoute } from 'astro';
import { getPrisma } from '../../../../db/prisma';
import { getAdministratorAccess } from '../../../../lib/admin-auth';

export const prerender = false;

function csv(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export const GET: APIRoute = async (context) => {
  const { allowed } = await getAdministratorAccess(context);
  if (!allowed) return new Response('Forbidden', { status: 403 });

  const actor = context.url.searchParams.get('actor')?.trim() ?? '';
  const action = context.url.searchParams.get('action')?.trim() ?? '';
  const entityType = context.url.searchParams.get('entity')?.trim() ?? '';
  const from = context.url.searchParams.get('from')?.trim() ?? '';
  const to = context.url.searchParams.get('to')?.trim() ?? '';

  const where: Prisma.AuditEventWhereInput = {};
  if (actor) where.actorEmail = { contains: actor, mode: 'insensitive' };
  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (entityType) where.entityType = entityType;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    };
  }

  const events = await getPrisma().auditEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  const header = [
    'created_at',
    'actor_email',
    'action',
    'entity_type',
    'entity_id',
    'summary',
    'reason',
    'request_id',
  ];
  const body = [header.map(csv).join(','), ...events.map((event) =>
    [
      event.createdAt.toISOString(),
      event.actorEmail,
      event.action,
      event.entityType,
      event.entityId ?? '',
      event.summary,
      event.reason ?? '',
      event.requestId ?? '',
    ].map(csv).join(','),
  )].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="tosder-audit.csv"',
      'cache-control': 'no-store',
    },
  });
};
