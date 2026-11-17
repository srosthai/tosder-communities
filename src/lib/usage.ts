import type { Prisma, PrismaClient, UsageStatus } from '@prisma/client';
import { getPrisma } from '../db/prisma';
import { ApiError } from './api';

export const USAGE_RULE_VERSION = 'v1';

export function periodKeyFor(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function periodBounds(periodKey: string) {
  const [year, month] = periodKey.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export async function decideUsageEvent(eventId: string, now = new Date()) {
  const prisma = getPrisma();
  const event = await prisma.usageEvent.findUnique({
    where: { id: eventId },
    include: {
      template: { select: { id: true, creatorId: true, status: true } },
      trip: {
        select: {
          id: true,
          ownerId: true,
          sourceTemplateId: true,
          sourceTemplateVersionId: true,
        },
      },
    },
  });

  if (!event) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Usage event not found.' });
  }
  if (event.status !== 'PENDING' && event.status !== 'UNDER_REVIEW') {
    return event;
  }

  let status: UsageStatus = 'QUALIFIED';
  let reason = 'Eligible qualified use.';

  if (!event.template) {
    status = 'INVALID';
    reason = 'The source template no longer exists.';
  } else if (!event.trip) {
    status = 'INVALID';
    reason = 'The copied trip no longer exists.';
  } else if (event.template.creatorId === event.userId) {
    status = 'INVALID';
    reason = 'Self-use is excluded from qualified usage.';
  } else if (event.trip.ownerId !== event.userId) {
    status = 'INVALID';
    reason = 'The trip owner does not match the usage actor.';
  } else if (
    event.trip.sourceTemplateId !== event.templateId ||
    event.trip.sourceTemplateVersionId !== event.templateVersionId
  ) {
    status = 'INVALID';
    reason = 'The trip source attribution does not match this event.';
  } else if (!event.periodKey) {
    status = 'INVALID';
    reason = 'The usage event has no competition period.';
  } else {
    const { start, end } = periodBounds(event.periodKey);
    if (event.createdAt < start || event.createdAt >= end) {
      status = 'INVALID';
      reason = 'The usage occurred outside its competition period.';
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.usageEvent.update({
      where: { id: eventId },
      data: {
        status,
        qualifiedAt: status === 'QUALIFIED' ? now : null,
        decidedAt: now,
        decisionReason: reason,
        ruleVersion: USAGE_RULE_VERSION,
      },
    });

    await tx.auditEvent.create({
      data: {
        actorId: null,
        actorEmail: 'system',
        action: status === 'QUALIFIED' ? 'usage.qualified' : 'usage.invalid',
        entityType: 'usage_event',
        entityId: eventId,
        summary: reason,
        metadata: { periodKey: event.periodKey, ruleVersion: USAGE_RULE_VERSION },
      },
    });

    if (event.templateId) {
      await recomputeTemplateQualifiedUses(event.templateId, tx);
    }

    return updated;
  });
}

export async function recomputeTemplateQualifiedUses(
  templateId: string,
  client: PrismaClient | Prisma.TransactionClient = getPrisma(),
) {
  const count = await client.usageEvent.count({
    where: { templateId, status: 'QUALIFIED' },
  });
  await client.travelTemplate.update({
    where: { id: templateId },
    data: { qualifiedUseCount: count },
  });
  return count;
}

export async function qualifyPendingUsageEvents(limit = 200) {
  const events = await getPrisma().usageEvent.findMany({
    where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  });

  const results = [];
  for (const event of events) {
    results.push(await decideUsageEvent(event.id));
  }
  return results;
}

export async function overrideUsageEvent(
  actor: { id: string; email: string },
  eventId: string,
  status: UsageStatus,
  reason: string,
) {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'Add a reason for the override.',
    });
  }
  if (!['QUALIFIED', 'INVALID', 'UNDER_REVIEW', 'VOID'].includes(status)) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'That usage status cannot be set manually.',
    });
  }

  const event = await getPrisma().usageEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new ApiError({ status: 404, code: 'not_found', message: 'Usage event not found.' });

  const updated = await getPrisma().$transaction(async (tx) => {
    const next = await tx.usageEvent.update({
      where: { id: eventId },
      data: {
        status,
        decisionReason: trimmed.slice(0, 500),
        decidedAt: new Date(),
        qualifiedAt: status === 'QUALIFIED' ? new Date() : null,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    });

    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'usage.override',
        entityType: 'usage_event',
        entityId: eventId,
        summary: `Set usage to ${status}`,
        metadata: { reason: trimmed.slice(0, 500), previousStatus: event.status },
      },
    });

    if (event.templateId) {
      await recomputeTemplateQualifiedUses(event.templateId, tx);
    }

    return next;
  });

  return updated;
}

export async function creatorUsageTotals(creatorId: string) {
  const rows = await getPrisma().usageEvent.groupBy({
    by: ['status'],
    where: { template: { creatorId } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}
