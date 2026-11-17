import { getPrisma } from '../db/prisma';
import { ApiError } from './api';
import type { PublicTemplateCard } from './public-templates';
import type { TemplateSnapshot } from './template-publishing';
import type { DestinationCardData } from './destinations';

const imageFallback = '/image/placeholder-destination.svg';

export async function saveTemplate(userId: string, templateId: string) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const template = await tx.travelTemplate.findFirst({
      where: { id: templateId, status: 'PUBLISHED', publishedVersionId: { not: null } },
      select: { id: true },
    });
    if (!template) {
      throw new ApiError({ status: 404, code: 'not_found', message: 'Template not found.' });
    }

    const inserted = await tx.savedTemplate.createMany({
      data: [{ userId, templateId }],
      skipDuplicates: true,
    });
    if (inserted.count > 0) {
      await tx.travelTemplate.update({
        where: { id: templateId },
        data: { saveCount: { increment: 1 } },
      });
      await tx.engagementEvent.create({
        data: { templateId, userId, eventType: 'SAVE', metadata: { saved: true } },
      });
    }

    const count = await tx.savedTemplate.count({ where: { templateId } });
    return { saved: true, count };
  });
}

export async function unsaveTemplate(userId: string, templateId: string) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const removed = await tx.savedTemplate.deleteMany({
      where: { userId, templateId },
    });
    if (removed.count > 0) {
      const template = await tx.travelTemplate.findUnique({
        where: { id: templateId },
        select: { saveCount: true },
      });
      if (template) {
        await tx.travelTemplate.update({
          where: { id: templateId },
          data: { saveCount: Math.max(0, template.saveCount - 1) },
        });
      }
      await tx.engagementEvent.create({
        data: { templateId, userId, eventType: 'SAVE', metadata: { saved: false } },
      });
    }
    const count = await tx.savedTemplate.count({ where: { templateId } });
    return { saved: false, count };
  });
}

export async function saveDestination(userId: string, destinationId: string) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const destination = await tx.destination.findFirst({
      where: { id: destinationId, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!destination) {
      throw new ApiError({ status: 404, code: 'not_found', message: 'Destination not found.' });
    }

    const inserted = await tx.savedDestination.createMany({
      data: [{ userId, destinationId }],
      skipDuplicates: true,
    });
    if (inserted.count > 0) {
      await tx.destination.update({
        where: { id: destinationId },
        data: { saveCount: { increment: 1 } },
      });
    }

    const count = await tx.savedDestination.count({ where: { destinationId } });
    return { saved: true, count };
  });
}

export async function unsaveDestination(userId: string, destinationId: string) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const removed = await tx.savedDestination.deleteMany({
      where: { userId, destinationId },
    });
    if (removed.count > 0) {
      const destination = await tx.destination.findUnique({
        where: { id: destinationId },
        select: { saveCount: true },
      });
      if (destination) {
        await tx.destination.update({
          where: { id: destinationId },
          data: { saveCount: Math.max(0, destination.saveCount - 1) },
        });
      }
    }
    const count = await tx.savedDestination.count({ where: { destinationId } });
    return { saved: false, count };
  });
}

export async function getTemplateSaveState(userId: string | null, templateId: string) {
  const template = await getPrisma().travelTemplate.findUnique({
    where: { id: templateId },
    select: { saveCount: true },
  });
  if (!template) return { saved: false, count: 0 };
  const saved = userId
    ? Boolean(
        await getPrisma().savedTemplate.findUnique({
          where: { userId_templateId: { userId, templateId } },
          select: { id: true },
        }),
      )
    : false;
  return { saved, count: template.saveCount };
}

export async function getDestinationSaveState(userId: string | null, destinationId: string) {
  const destination = await getPrisma().destination.findUnique({
    where: { id: destinationId },
    select: { saveCount: true },
  });
  if (!destination) return { saved: false, count: 0 };
  const saved = userId
    ? Boolean(
        await getPrisma().savedDestination.findUnique({
          where: { userId_destinationId: { userId, destinationId } },
          select: { id: true },
        }),
      )
    : false;
  return { saved, count: destination.saveCount };
}

export async function listSavedTemplates(userId: string, page = 1, pageSize = 9) {
  const prisma = getPrisma();
  const size = Math.min(Math.max(pageSize, 1), 24);
  const requested = Math.max(page, 1);
  const [total, rows] = await Promise.all([
    prisma.savedTemplate.count({ where: { userId } }),
    prisma.savedTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (requested - 1) * size,
      take: size,
      include: {
        template: {
          include: {
            creator: { select: { username: true, displayName: true, avatarUrl: true } },
            province: { select: { name: true, slug: true } },
            publishedVersion: { select: { snapshot: true } },
          },
        },
      },
    }),
  ]);

  const templates: PublicTemplateCard[] = rows
    .filter(
      (row) =>
        row.template.status === 'PUBLISHED' && row.template.publishedVersionId !== null,
    )
    .map((row) => {
      const live = row.template.publishedVersion?.snapshot as unknown as TemplateSnapshot | undefined;
      return {
        id: row.template.id,
        slug: row.template.slug,
        title: live?.template.title ?? row.template.title,
        summary: live?.template.summary ?? row.template.summary,
        coverPhotoUrl: live?.template.coverPhotoUrl ?? row.template.coverPhotoUrl,
        durationDays: live?.template.durationDays ?? row.template.durationDays,
        budgetMinCents: live?.template.budgetMinCents ?? row.template.budgetMinCents,
        budgetMaxCents: live?.template.budgetMaxCents ?? row.template.budgetMaxCents,
        currency: live?.template.currency ?? row.template.currency,
        style: live?.template.style ?? row.template.style,
        season: live?.template.season ?? row.template.season,
        publishedAt: row.template.publishedAt,
        viewCount: row.template.viewCount,
        saveCount: row.template.saveCount,
        qualifiedUseCount: row.template.qualifiedUseCount,
        creator: row.template.creator,
        province: live?.template.province ?? row.template.province,
      };
    });

  const totalPages = Math.max(1, Math.ceil(total / size));
  return { templates, total, page: Math.min(requested, totalPages), totalPages };
}

export async function listSavedDestinations(userId: string, page = 1, pageSize = 12) {
  const prisma = getPrisma();
  const size = Math.min(Math.max(pageSize, 1), 24);
  const requested = Math.max(page, 1);
  const [total, rows] = await Promise.all([
    prisma.savedDestination.count({ where: { userId } }),
    prisma.savedDestination.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (requested - 1) * size,
      take: size,
      include: {
        destination: {
          include: {
            province: { select: { name: true } },
            photos: { orderBy: { sortOrder: 'asc' }, take: 1 },
            categories: { take: 1, include: { category: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);

  const destinations: Array<DestinationCardData & { id: string }> = rows
    .filter((row) => row.destination.status === 'PUBLISHED')
    .map((row) => ({
      id: row.destination.id,
      name: row.destination.name,
      slug: row.destination.slug,
      summary: row.destination.summary,
      province: row.destination.province.name,
      category: row.destination.categories[0]?.category.name ?? null,
      image:
        row.destination.coverPhotoUrl ??
        row.destination.photos[0]?.url ??
        imageFallback,
      alt: row.destination.photos[0]?.alt ?? row.destination.name,
    }));

  const totalPages = Math.max(1, Math.ceil(total / size));
  return { destinations, total, page: Math.min(requested, totalPages), totalPages };
}
