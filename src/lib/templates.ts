import type { Prisma, TemplateStatus } from '@prisma/client';
import { getPrisma } from '../db/prisma';
import { ApiError } from './api';

export const templateStatuses = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'UNLISTED',
  'ARCHIVED',
] as const;

export const templateStatusMeta: Record<
  TemplateStatus,
  { label: string; description: string; variant: 'neutral' | 'warning' | 'success' | 'danger' | 'info' }
> = {
  DRAFT: {
    label: 'Draft',
    description: 'Only you can see this. Keep building whenever you are ready.',
    variant: 'neutral',
  },
  PENDING_REVIEW: {
    label: 'In review',
    description: 'A moderator is checking the itinerary before it goes public.',
    variant: 'warning',
  },
  PUBLISHED: {
    label: 'Published',
    description: 'Live on your public profile. Edits become a new version when you publish again.',
    variant: 'success',
  },
  REJECTED: {
    label: 'Changes requested',
    description: 'Read the moderator note, revise the draft, and resubmit.',
    variant: 'danger',
  },
  UNLISTED: {
    label: 'Unlisted',
    description: 'Hidden from public listings but still available to existing trips.',
    variant: 'info',
  },
  ARCHIVED: {
    label: 'Archived',
    description: 'Hidden from the public. Existing trips keep their source attribution.',
    variant: 'neutral',
  },
};

export function slugifyTemplate(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

async function uniqueTemplateSlug(base: string, excludeId?: string): Promise<string> {
  const prisma = getPrisma();
  const root = slugifyTemplate(base) || 'untitled-template';
  let candidate = root;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const existing = await prisma.travelTemplate.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${root.slice(0, 80)}-${attempt + 2}`;
  }

  return `${root.slice(0, 70)}-${Date.now().toString(36)}`;
}

export interface CreateTemplateInput {
  title?: string;
  summary?: string;
  provinceId?: string | null;
}

export async function createTemplateDraft(
  creatorId: string,
  input: CreateTemplateInput = {},
) {
  const title = input.title?.trim() || 'Untitled template';
  const slug = await uniqueTemplateSlug(title);

  return getPrisma().travelTemplate.create({
    data: {
      creatorId,
      title,
      slug,
      summary: input.summary?.trim() || null,
      provinceId: input.provinceId || null,
      status: 'DRAFT',
      durationDays: 1,
    },
  });
}

export interface CreatorTemplateListParams {
  status?: TemplateStatus | 'ALL';
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listCreatorTemplates(
  creatorId: string,
  params: CreatorTemplateListParams = {},
) {
  const prisma = getPrisma();
  const pageSize = Math.min(Math.max(params.pageSize ?? 8, 1), 24);
  const requestedPage = Math.max(params.page ?? 1, 1);
  const q = params.q?.trim() ?? '';

  const where: Prisma.TravelTemplateWhereInput = { creatorId };

  if (params.status && params.status !== 'ALL') where.status = params.status;

  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.travelTemplate.count({ where }),
    prisma.travelTemplate.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
      include: {
        province: { select: { name: true } },
        publishedVersion: { select: { versionNumber: true, createdAt: true } },
        _count: { select: { days: true, versions: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  return { templates: rows, total, page, pageSize, totalPages };
}

export async function getCreatorTemplate(id: string, creatorId: string) {
  return getPrisma().travelTemplate.findFirst({
    where: { id, creatorId },
    include: {
      province: { select: { id: true, name: true, slug: true } },
      days: {
        orderBy: { dayNumber: 'asc' },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
            include: {
              destination: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      },
      publishedVersion: {
        select: { id: true, versionNumber: true, createdAt: true },
      },
      _count: { select: { versions: true } },
    },
  });
}

async function requireOwnedTemplate(id: string, creatorId: string) {
  const template = await getPrisma().travelTemplate.findFirst({
    where: { id, creatorId },
  });
  if (!template) {
    throw new ApiError({
      status: 404,
      code: 'not_found',
      message: 'Template not found.',
    });
  }
  return template;
}

async function recordAudit(
  actor: { id: string; email: string },
  action: string,
  templateId: string,
  summary: string,
  metadata: Record<string, unknown> = {},
) {
  await getPrisma().auditEvent.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      entityType: 'travel_template',
      entityId: templateId,
      summary,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

export async function duplicateTemplate(
  id: string,
  creatorId: string,
  actor: { id: string; email: string },
) {
  const original = await getPrisma().travelTemplate.findFirst({
    where: { id, creatorId },
    include: {
      days: {
        orderBy: { dayNumber: 'asc' },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });

  if (!original) {
    throw new ApiError({
      status: 404,
      code: 'not_found',
      message: 'Template not found.',
    });
  }

  const title = `${original.title} (copy)`.slice(0, 120);
  const slug = await uniqueTemplateSlug(title);

  const copy = await getPrisma().$transaction(async (tx) => {
    const created = await tx.travelTemplate.create({
      data: {
        creatorId,
        provinceId: original.provinceId,
        title,
        slug,
        summary: original.summary,
        description: original.description,
        coverPhotoUrl: original.coverPhotoUrl,
        durationDays: original.durationDays,
        budgetMinCents: original.budgetMinCents,
        budgetMaxCents: original.budgetMaxCents,
        currency: original.currency,
        season: original.season,
        transport: original.transport,
        audience: original.audience,
        language: original.language,
        status: 'DRAFT',
        days: {
          create: original.days.map((day) => ({
            dayNumber: day.dayNumber,
            title: day.title,
            summary: day.summary,
            items: {
              create: day.items.map((item) => ({
                destinationId: item.destinationId,
                title: item.title,
                type: item.type,
                description: item.description,
                practicalTips: item.practicalTips,
                startTime: item.startTime,
                endTime: item.endTime,
                durationMinutes: item.durationMinutes,
                estimatedCostCents: item.estimatedCostCents,
                currency: item.currency,
                sortOrder: item.sortOrder,
                photoUrl: item.photoUrl,
              })),
            },
          })),
        },
      },
    });

    return created;
  });

  await recordAudit(actor, 'template.duplicated', copy.id, `Duplicated ${original.title}`, {
    sourceTemplateId: original.id,
  });

  return copy;
}

export async function archiveTemplate(
  id: string,
  creatorId: string,
  actor: { id: string; email: string },
) {
  const template = await requireOwnedTemplate(id, creatorId);

  if (template.status === 'ARCHIVED') return template;

  const archived = await getPrisma().travelTemplate.update({
    where: { id },
    data: { status: 'ARCHIVED' },
  });

  await recordAudit(actor, 'template.archived', id, `Archived ${template.title}`, {
    previousStatus: template.status,
  });

  return archived;
}

export async function restoreTemplate(
  id: string,
  creatorId: string,
  actor: { id: string; email: string },
) {
  const template = await requireOwnedTemplate(id, creatorId);

  if (template.status !== 'ARCHIVED') {
    throw new ApiError({
      status: 409,
      code: 'invalid_transition',
      message: 'Only archived templates can be restored.',
    });
  }

  const restored = await getPrisma().travelTemplate.update({
    where: { id },
    data: { status: 'DRAFT', rejectionReason: null },
  });

  await recordAudit(actor, 'template.restored', id, `Restored ${template.title}`, {
    previousStatus: template.status,
  });

  return restored;
}

export async function submitTemplateForReview(
  id: string,
  creatorId: string,
  actor: { id: string; email: string },
) {
  const template = await requireOwnedTemplate(id, creatorId);

  if (template.status !== 'DRAFT' && template.status !== 'REJECTED') {
    throw new ApiError({
      status: 409,
      code: 'invalid_transition',
      message: 'Only a draft or a rejected template can be submitted for review.',
    });
  }

  const submitted = await getPrisma().travelTemplate.update({
    where: { id },
    data: {
      status: 'PENDING_REVIEW',
      rejectionReason: null,
    },
  });

  await recordAudit(actor, 'template.submitted', id, `Submitted ${template.title} for review`, {
    previousStatus: template.status,
  });

  return submitted;
}
