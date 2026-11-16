import type { Prisma } from '@prisma/client';
import { getPrisma } from '../db/prisma';

export interface DestinationCardData {
  name: string;
  slug: string;
  summary: string | null;
  province: string;
  category: string | null;
  image: string;
  alt: string;
}

export type DestinationSort = 'recommended' | 'name' | 'newest';

export interface DestinationListParams {
  q?: string;
  province?: string;
  category?: string;
  sort?: DestinationSort;
  page?: number;
  pageSize?: number;
}

export interface DestinationSummary extends DestinationCardData {
  id: string;
}

export interface DestinationDetail extends DestinationSummary {
  description: string | null;
  practicalTips: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: Array<{ url: string; alt: string; credit: string | null }>;
  categories: string[];
  tags: string[];
}

const imageFallback = '/image/placeholder-destination.svg';

function orderByFor(sort: DestinationSort): Prisma.DestinationOrderByWithRelationInput[] {
  if (sort === 'name') return [{ name: 'asc' }];
  if (sort === 'newest') return [{ createdAt: 'desc' }];
  return [{ sortOrder: 'asc' }, { name: 'asc' }];
}

export async function listDestinations(params: DestinationListParams = {}) {
  const prisma = getPrisma();
  const pageSize = Math.min(Math.max(params.pageSize ?? 6, 1), 24);
  const requestedPage = Math.max(params.page ?? 1, 1);
  const q = params.q?.trim() ?? '';

  const where: Prisma.DestinationWhereInput = { status: 'PUBLISHED' };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { province: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  if (params.province) where.province = { slug: params.province };
  if (params.category) {
    where.categories = { some: { category: { slug: params.category } } };
  }

  const [total, rows] = await Promise.all([
    prisma.destination.count({ where }),
    prisma.destination.findMany({
      where,
      orderBy: orderByFor(params.sort ?? 'recommended'),
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
      include: {
        province: { select: { name: true } },
        photos: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { url: true, alt: true },
        },
        categories: {
          take: 1,
          include: { category: { select: { name: true } } },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const destinations: DestinationSummary[] = rows.map((destination) => ({
    id: destination.id,
    name: destination.name,
    slug: destination.slug,
    summary: destination.summary,
    province: destination.province.name,
    category: destination.categories[0]?.category.name ?? null,
    image: destination.coverPhotoUrl ?? destination.photos[0]?.url ?? imageFallback,
    alt: destination.photos[0]?.alt ?? destination.name,
  }));

  return { destinations, total, page, pageSize, totalPages };
}

export async function getDestinationBySlug(slug: string): Promise<DestinationDetail | null> {
  const prisma = getPrisma();
  const destination = await prisma.destination.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: {
      province: { select: { name: true } },
      photos: { orderBy: { sortOrder: 'asc' } },
      categories: { include: { category: { select: { name: true } } } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });

  if (!destination) return null;

  return {
    id: destination.id,
    name: destination.name,
    slug: destination.slug,
    summary: destination.summary,
    province: destination.province.name,
    category: destination.categories[0]?.category.name ?? null,
    image: destination.coverPhotoUrl ?? destination.photos[0]?.url ?? imageFallback,
    alt: destination.photos[0]?.alt ?? destination.name,
    description: destination.description,
    practicalTips: destination.practicalTips,
    latitude: destination.latitude,
    longitude: destination.longitude,
    photos: destination.photos.map((photo) => ({
      url: photo.url,
      alt: photo.alt,
      credit: photo.credit,
    })),
    categories: destination.categories.map((item) => item.category.name),
    tags: destination.tags.map((item) => item.tag.name),
  };
}

export async function listRelatedDestinations(
  destinationId: string,
  province: string,
  limit = 3,
): Promise<DestinationSummary[]> {
  const rows = await getPrisma().destination.findMany({
    where: {
      status: 'PUBLISHED',
      id: { not: destinationId },
      province: { name: province },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    take: limit,
    include: {
      province: { select: { name: true } },
      photos: {
        orderBy: { sortOrder: 'asc' },
        take: 1,
        select: { url: true, alt: true },
      },
      categories: {
        take: 1,
        include: { category: { select: { name: true } } },
      },
    },
  });

  return rows.map((destination) => ({
    id: destination.id,
    name: destination.name,
    slug: destination.slug,
    summary: destination.summary,
    province: destination.province.name,
    category: destination.categories[0]?.category.name ?? null,
    image: destination.coverPhotoUrl ?? destination.photos[0]?.url ?? imageFallback,
    alt: destination.photos[0]?.alt ?? destination.name,
  }));
}

export async function listProvinces() {
  return getPrisma().province.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { name: 'asc' },
    select: { name: true, slug: true },
  });
}

export async function listCategories() {
  return getPrisma().category.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { name: true, slug: true },
  });
}
