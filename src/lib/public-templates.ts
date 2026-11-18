import { getPrisma } from '../db/prisma';
import type { TemplateSnapshot } from './template-publishing';

export interface PublicTemplateCard {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverPhotoUrl: string | null;
  durationDays: number;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  currency: string;
  style: string | null;
  season: string | null;
  publishedAt: Date | null;
  viewCount: number;
  saveCount: number;
  qualifiedUseCount: number;
  creator: { username: string; displayName: string; avatarUrl: string | null };
  province: { name: string; slug: string } | null;
}

export interface PublicTemplateDetail extends PublicTemplateCard {
  description: string | null;
  logisticsNotes: string | null;
  transport: string[];
  audience: string[];
  language: string;
  likeCount: number;
  version: {
    id: string;
    versionNumber: number;
    createdAt: Date;
    snapshot: TemplateSnapshot;
  };
}

function toCard(
  template: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    coverPhotoUrl: string | null;
    durationDays: number;
    budgetMinCents: number | null;
    budgetMaxCents: number | null;
    currency: string;
    style: string | null;
    season: string | null;
    publishedAt: Date | null;
    viewCount: number;
    saveCount: number;
    qualifiedUseCount: number;
    creator: { username: string; displayName: string; avatarUrl: string | null };
    province: { name: string; slug: string } | null;
  },
  snapshot?: TemplateSnapshot,
): PublicTemplateCard {
  const live = snapshot?.template;
  return {
    id: template.id,
    slug: template.slug,
    title: live?.title ?? template.title,
    summary: live?.summary ?? template.summary,
    coverPhotoUrl: live?.coverPhotoUrl ?? template.coverPhotoUrl,
    durationDays: live?.durationDays ?? template.durationDays,
    budgetMinCents: live?.budgetMinCents ?? template.budgetMinCents,
    budgetMaxCents: live?.budgetMaxCents ?? template.budgetMaxCents,
    currency: live?.currency ?? template.currency,
    style: live?.style ?? template.style,
    season: live?.season ?? template.season,
    publishedAt: template.publishedAt,
    viewCount: template.viewCount,
    saveCount: template.saveCount,
    qualifiedUseCount: template.qualifiedUseCount,
    creator: template.creator,
    province: live?.province ?? template.province,
  };
}

export async function getPublishedTemplateBySlug(
  slug: string,
): Promise<PublicTemplateDetail | null> {
  const template = await getPrisma().travelTemplate.findFirst({
    where: {
      slug,
      status: 'PUBLISHED',
      publishedVersionId: { not: null },
      creator: { suspendedAt: null, deletedAt: null },
    },
    include: {
      creator: { select: { username: true, displayName: true, avatarUrl: true } },
      province: { select: { name: true, slug: true } },
      publishedVersion: {
        select: { id: true, versionNumber: true, createdAt: true, snapshot: true },
      },
    },
  });

  if (!template?.publishedVersion) return null;

  return {
    ...toCard(template, template.publishedVersion.snapshot as unknown as TemplateSnapshot),
    description: (template.publishedVersion.snapshot as unknown as TemplateSnapshot).template.description,
    logisticsNotes: (template.publishedVersion.snapshot as unknown as TemplateSnapshot).template.logisticsNotes,
    transport: (template.publishedVersion.snapshot as unknown as TemplateSnapshot).template.transport,
    audience: (template.publishedVersion.snapshot as unknown as TemplateSnapshot).template.audience,
    language: (template.publishedVersion.snapshot as unknown as TemplateSnapshot).template.language,
    likeCount: template.likeCount,
    version: {
      id: template.publishedVersion.id,
      versionNumber: template.publishedVersion.versionNumber,
      createdAt: template.publishedVersion.createdAt,
      snapshot: template.publishedVersion.snapshot as unknown as TemplateSnapshot,
    },
  };
}


export interface PublishedTemplateListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  province?: string;
}

export async function listPublishedTemplates(params: PublishedTemplateListParams = {}) {
  const prisma = getPrisma();
  const pageSize = Math.min(Math.max(params.pageSize ?? 9, 1), 24);
  const requestedPage = Math.max(params.page ?? 1, 1);
  const q = params.q?.trim() ?? '';

  const where = {
    status: 'PUBLISHED' as const,
    publishedVersionId: { not: null },
    creator: { suspendedAt: null, deletedAt: null },
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { summary: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } },
            { creator: { displayName: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
    ...(params.province ? { province: { slug: params.province } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.travelTemplate.count({ where }),
    prisma.travelTemplate.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
      include: {
        creator: { select: { username: true, displayName: true, avatarUrl: true } },
        province: { select: { name: true, slug: true } },
        publishedVersion: { select: { snapshot: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  return {
    templates: rows.map((row) =>
      toCard(row, row.publishedVersion?.snapshot as unknown as TemplateSnapshot | undefined),
    ),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function listRelatedTemplates(
  template: PublicTemplateDetail,
  limit = 3,
): Promise<PublicTemplateCard[]> {
  const rows = await getPrisma().travelTemplate.findMany({
    where: {
      status: 'PUBLISHED',
      publishedVersionId: { not: null },
      creator: { suspendedAt: null, deletedAt: null },
      id: { not: template.id },
      OR: [
        ...(template.province ? [{ province: { slug: template.province.slug } }] : []),
        { creator: { username: template.creator.username } },
      ],
    },
    orderBy: [{ publishedAt: 'desc' }],
    take: limit,
    include: {
      creator: { select: { username: true, displayName: true, avatarUrl: true } },
      province: { select: { name: true, slug: true } },
      publishedVersion: { select: { snapshot: true } },
    },
  });

  // Province filtering above uses slug, so resolve it through the relation.
  const filtered = rows.filter(
    (row) =>
      !template.province ||
      row.province?.slug === template.province.slug ||
      row.creator.username === template.creator.username,
  );

  return filtered.map((row) =>
    toCard(row, row.publishedVersion?.snapshot as unknown as TemplateSnapshot | undefined),
  );
}

export async function getPublicCreatorProfile(username: string) {
  const profile = await getPrisma().memberProfile.findFirst({
    where: { username, suspendedAt: null, deletedAt: null },
    select: {
      userId: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      socialLinks: true,
      createdAt: true,
      templates: {
        where: { status: 'PUBLISHED', publishedVersionId: { not: null } },
        orderBy: [{ publishedAt: 'desc' }],
        include: {
          creator: { select: { username: true, displayName: true, avatarUrl: true } },
          province: { select: { name: true, slug: true } },
          publishedVersion: { select: { snapshot: true } },
        },
      },
    },
  });

  if (!profile) return null;

  const qualifiedUses = profile.templates.reduce(
    (total, template) => total + template.qualifiedUseCount,
    0,
  );

  return {
    ...profile,
    qualifiedUses,
    templates: profile.templates.map((row) =>
      toCard(row, row.publishedVersion?.snapshot as unknown as TemplateSnapshot | undefined),
    ),
  };
}
