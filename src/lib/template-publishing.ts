import { createHash } from 'node:crypto';
import type { Prisma, TemplateStatus } from '@prisma/client';
import { getPrisma } from '../db/prisma';
import { ApiError } from './api';
import { isTrustedCreator } from './permissions';
import { validateTemplate, type BuilderTemplate } from './template-builder';

export interface TemplateSnapshot {
  template: {
    title: string;
    slug: string;
    summary: string | null;
    description: string | null;
    coverPhotoUrl: string | null;
    durationDays: number;
    budgetMinCents: number | null;
    budgetMaxCents: number | null;
    currency: string;
    style: string | null;
    season: string | null;
    logisticsNotes: string | null;
    transport: string[];
    audience: string[];
    language: string;
    province: { name: string; slug: string } | null;
  };
  days: Array<{
    dayNumber: number;
    title: string | null;
    summary: string | null;
    items: Array<{
      title: string;
      type: string;
      destinationSlug: string | null;
      destinationName: string | null;
      destinationProvince: string | null;
      destinationLatitude: number | null;
      destinationLongitude: number | null;
      description: string | null;
      practicalTips: string | null;
      startTime: string | null;
      endTime: string | null;
      durationMinutes: number | null;
      estimatedCostCents: number | null;
      currency: string;
      photoUrl: string | null;
    }>;
  }>;
}

export function buildTemplateSnapshot(template: BuilderTemplate): TemplateSnapshot {
  return {
    template: {
      title: template.title,
      slug: template.slug,
      summary: template.summary,
      description: template.description,
      coverPhotoUrl: template.coverPhotoUrl,
      durationDays: template.durationDays,
      budgetMinCents: template.budgetMinCents,
      budgetMaxCents: template.budgetMaxCents,
      currency: template.currency,
      style: template.style,
      season: template.season,
      logisticsNotes: template.logisticsNotes,
      transport: template.transport,
      audience: template.audience,
      language: template.language,
      province: template.province
        ? { name: template.province.name, slug: template.province.slug }
        : null,
    },
    days: template.days.map((day) => ({
      dayNumber: day.dayNumber,
      title: day.title,
      summary: day.summary,
      items: day.items.map((item) => ({
        title: item.title,
        type: item.type,
        destinationSlug: item.destination?.slug ?? null,
        destinationName: item.destination?.name ?? null,
        destinationProvince: item.destination?.province?.name ?? null,
        destinationLatitude: item.destination?.latitude ?? null,
        destinationLongitude: item.destination?.longitude ?? null,
        description: item.description,
        practicalTips: item.practicalTips,
        startTime: item.startTime,
        endTime: item.endTime,
        durationMinutes: item.durationMinutes,
        estimatedCostCents: item.estimatedCostCents,
        currency: item.currency,
        photoUrl: item.photoUrl,
      })),
    })),
  };
}

export function templateContentHash(snapshot: TemplateSnapshot): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

export type TemplateVisibility = 'public' | 'unlisted';

export interface PublishOptions {
  visibility: TemplateVisibility;
  guidelines: boolean;
  emailVerified: boolean;
  allowUnverified?: boolean;
}

export interface ModerationOptions {
  visibility?: TemplateVisibility;
}

function publicStatus(visibility: TemplateVisibility): TemplateStatus {
  return visibility === 'unlisted' ? 'UNLISTED' : 'PUBLISHED';
}

async function loadTemplate(id: string) {
  return getPrisma().travelTemplate.findUnique({
    where: { id },
    include: {
      creator: { select: { userId: true, username: true, displayName: true, trustedCreator: true, role: true } },
      province: { select: { id: true, name: true, slug: true } },
      publishedVersion: {
        select: { id: true, versionNumber: true, createdAt: true },
      },
      days: {
        orderBy: { dayNumber: 'asc' },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
            include: {
              destination: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  latitude: true,
                  longitude: true,
                  province: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

async function writeAudit(
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

async function createOrReuseVersion(
  template: BuilderTemplate,
  actor: { id: string; email: string },
  visibility: TemplateVisibility,
) {
  const prisma = getPrisma();
  const snapshot = buildTemplateSnapshot(template);
  const contentHash = templateContentHash(snapshot);
  const validation = validateTemplate(template, {
    emailVerified: true,
    status: template.status,
  });

  if (validation.blocking.length > 0) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: validation.blocking[0] ?? 'The template is not ready to publish.',
      details: validation.blocking.map((message) => ({ message })),
    });
  }

  const existing = await prisma.templateVersion.findFirst({
    where: { templateId: template.id, contentHash },
    orderBy: { versionNumber: 'desc' },
  });

  const version =
    existing ??
    (await prisma.$transaction(async (tx) => {
      const latest = await tx.templateVersion.findFirst({
        where: { templateId: template.id },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });

      return tx.templateVersion.create({
        data: {
          templateId: template.id,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          createdById: actor.id,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          validation: validation as unknown as Prisma.InputJsonValue,
          contentHash,
        },
      });
    }));

  const alreadyLive =
    existing &&
    template.publishedVersionId === existing.id &&
    template.status === publicStatus(visibility);

  const publishedTemplate = alreadyLive
    ? template
    : await prisma.travelTemplate.update({
        where: { id: template.id },
        data: {
          status: publicStatus(visibility),
          publishedVersionId: version.id,
          publishedAt: new Date(),
          reviewedById: actor.id,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });

  return { version, publishedTemplate, snapshot, validation, created: !existing };
}

export async function publishTemplate(
  id: string,
  creatorId: string,
  actor: { id: string; email: string },
  options: PublishOptions,
) {
  const template = await loadTemplate(id);
  if (!template || template.creatorId !== creatorId) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Template not found.' });
  }

  if (template.status === 'ARCHIVED') {
    throw new ApiError({
      status: 409,
      code: 'invalid_transition',
      message: 'Restore this template before publishing it.',
    });
  }

  if (!isTrustedCreator(template.creator)) {
    throw new ApiError({
      status: 403,
      code: 'review_required',
      message: 'Submit this template for review before publishing.',
    });
  }

  if (!options.guidelines) {
    throw new ApiError({
      status: 422,
      code: 'guidelines_required',
      message: 'Confirm the community guidelines before publishing.',
    });
  }

  if (!options.emailVerified && !options.allowUnverified) {
    throw new ApiError({
      status: 422,
      code: 'email_unverified',
      message: 'Verify your email before publishing a template.',
    });
  }

  const result = await createOrReuseVersion(
    template as BuilderTemplate,
    actor,
    options.visibility,
  );

  if (result.created) {
    await writeAudit(
      actor,
      'template.published',
      template.id,
      `Published ${template.title} v${result.version.versionNumber}`,
      {
        versionNumber: result.version.versionNumber,
        visibility: options.visibility,
      },
    );
  }

  return {
    ...result,
    publicUrl: `/templates/${result.publishedTemplate.slug}`,
  };
}

export async function approveTemplate(
  id: string,
  actor: { id: string; email: string },
  options: ModerationOptions = {},
) {
  const template = await loadTemplate(id);
  if (!template) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Template not found.' });
  }
  if (template.status !== 'PENDING_REVIEW') {
    throw new ApiError({
      status: 409,
      code: 'invalid_transition',
      message: 'Only a template in review can be approved.',
    });
  }

  const result = await createOrReuseVersion(
    template as BuilderTemplate,
    actor,
    options.visibility ?? 'public',
  );

  if (result.created) {
    await writeAudit(actor, 'template.approved', id, `Approved ${template.title}`, {
      versionNumber: result.version.versionNumber,
      visibility: options.visibility ?? 'public',
    });
  }

  return {
    ...result,
    publicUrl: `/templates/${result.publishedTemplate.slug}`,
  };
}

export async function rejectTemplate(
  id: string,
  actor: { id: string; email: string },
  reason: string,
) {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'Add a reason so the creator knows what to revise.',
    });
  }

  const template = await loadTemplate(id);
  if (!template) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Template not found.' });
  }
  if (template.status !== 'PENDING_REVIEW') {
    throw new ApiError({
      status: 409,
      code: 'invalid_transition',
      message: 'Only a template in review can be rejected.',
    });
  }

  const rejected = await getPrisma().travelTemplate.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectionReason: trimmed.slice(0, 500),
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
  });

  await writeAudit(actor, 'template.rejected', id, `Requested changes to ${template.title}`, {
    reason: trimmed.slice(0, 500),
  });

  return rejected;
}

export async function listPendingTemplates() {
  return getPrisma().travelTemplate.findMany({
    where: { status: 'PENDING_REVIEW' },
    orderBy: [{ updatedAt: 'asc' }],
    include: {
      creator: { select: { username: true, displayName: true } },
      province: { select: { name: true } },
      _count: { select: { days: true } },
    },
  });
}
