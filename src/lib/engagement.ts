import { createHash } from 'node:crypto';
import { getPrisma } from '../db/prisma';
import { ApiError } from './api';

export function dayBucket(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function visitorDedupeKey(templateId: string, visitorId: string, now = new Date()): string {
  const hash = createHash('sha256')
    .update(`${visitorId}:${templateId}:${dayBucket(now)}`)
    .digest('hex');
  return `view:${templateId}:${hash}`;
}

export async function recordView(input: {
  templateId: string;
  visitorId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dedupeKey = visitorDedupeKey(input.templateId, input.visitorId, now);

  const inserted = await getPrisma().engagementEvent.createMany({
    data: [
      {
        templateId: input.templateId,
        eventType: 'VIEW',
        occurredAt: now,
        dedupeKey,
      },
    ],
    skipDuplicates: true,
  });

  if (inserted.count > 0) {
    await getPrisma().travelTemplate.update({
      where: { id: input.templateId },
      data: { viewCount: { increment: 1 } },
    });
  }

  return { counted: inserted.count > 0 };
}

export async function recordUseStarted(input: {
  templateId: string;
  versionId: string;
  userId: string;
  requestId?: string | null;
}) {
  const dedupeKey = `use-started:${input.templateId}:${input.versionId}:${input.userId}`;

  const inserted = await getPrisma().engagementEvent.createMany({
    data: [
      {
        templateId: input.templateId,
        userId: input.userId,
        eventType: 'USE_STARTED',
        dedupeKey,
        metadata: {
          versionId: input.versionId,
          requestId: input.requestId ?? null,
        },
      },
    ],
    skipDuplicates: true,
  });

  if (inserted.count > 0) {
    await getPrisma().travelTemplate.update({
      where: { id: input.templateId },
      data: { useStartedCount: { increment: 1 } },
    });
  }

  return { counted: inserted.count > 0 };
}

export async function likeTemplate(userId: string, templateId: string) {
  return getPrisma().$transaction(async (tx) => {
    const template = await tx.travelTemplate.findFirst({
      where: { id: templateId, status: 'PUBLISHED', publishedVersionId: { not: null } },
      select: { id: true },
    });
    if (!template) {
      throw new ApiError({ status: 404, code: 'not_found', message: 'Template not found.' });
    }

    const inserted = await tx.templateLike.createMany({
      data: [{ userId, templateId }],
      skipDuplicates: true,
    });

    if (inserted.count > 0) {
      await tx.travelTemplate.update({
        where: { id: templateId },
        data: { likeCount: { increment: 1 } },
      });
      await tx.engagementEvent.create({
        data: { templateId, userId, eventType: 'LIKE', metadata: { liked: true } },
      });
    }

    const count = await tx.templateLike.count({ where: { templateId } });
    return { liked: true, count };
  });
}

export async function unlikeTemplate(userId: string, templateId: string) {
  return getPrisma().$transaction(async (tx) => {
    const removed = await tx.templateLike.deleteMany({ where: { userId, templateId } });
    if (removed.count > 0) {
      const template = await tx.travelTemplate.findUnique({
        where: { id: templateId },
        select: { likeCount: true },
      });
      if (template) {
        await tx.travelTemplate.update({
          where: { id: templateId },
          data: { likeCount: Math.max(0, template.likeCount - 1) },
        });
      }
      await tx.engagementEvent.create({
        data: { templateId, userId, eventType: 'LIKE', metadata: { liked: false } },
      });
    }
    const count = await tx.templateLike.count({ where: { templateId } });
    return { liked: false, count };
  });
}

export async function getTemplateLikeState(userId: string | null, templateId: string) {
  const template = await getPrisma().travelTemplate.findUnique({
    where: { id: templateId },
    select: { likeCount: true },
  });
  if (!template) return { liked: false, count: 0 };
  const liked = userId
    ? Boolean(
        await getPrisma().templateLike.findUnique({
          where: { userId_templateId: { userId, templateId } },
          select: { id: true },
        }),
      )
    : false;
  return { liked, count: template.likeCount };
}
