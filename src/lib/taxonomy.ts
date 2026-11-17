import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getPrisma } from '../db/prisma';
import { Prisma as PrismaRuntime } from '@prisma/client';

const slug = z
  .string()
  .trim()
  .min(1, 'Enter a slug.')
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.');

const status = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

export const provinceSchema = z.object({
  name: z.string().trim().min(2, 'Enter a province name.').max(120),
  slug,
  summary: z.string().trim().max(400).optional().default(''),
  description: z.string().trim().max(4000).optional().default(''),
  heroImageUrl: z.string().trim().max(600).optional().default(''),
  status,
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Enter a category name.').max(80),
  slug,
  description: z.string().trim().max(400).optional().default(''),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

export const tagSchema = z.object({
  name: z.string().trim().min(1, 'Enter a tag name.').max(60),
  slug,
});

export const collectionSchema = z.object({
  title: z.string().trim().min(2, 'Enter a collection title.').max(120),
  slug,
  description: z.string().trim().max(600).optional().default(''),
  status,
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional().default(0),
  destinationIds: z.array(z.uuid()).default([]),
});

export type TaxonomyTab = 'provinces' | 'categories' | 'tags' | 'collections';

export function parseTaxonomyForm(tab: TaxonomyTab, formData: FormData) {
  const value = (key: string) => String(formData.get(key) ?? '').trim();
  const number = (key: string) => Number(value(key) || 0);

  if (tab === 'provinces') {
    return provinceSchema.safeParse({
      name: value('name'),
      slug: value('slug'),
      summary: value('summary'),
      description: value('description'),
      heroImageUrl: value('heroImageUrl'),
      status: value('status') || 'DRAFT',
      sortOrder: number('sortOrder'),
    });
  }
  if (tab === 'categories') {
    return categorySchema.safeParse({
      name: value('name'),
      slug: value('slug'),
      description: value('description'),
      sortOrder: number('sortOrder'),
    });
  }
  if (tab === 'tags') {
    return tagSchema.safeParse({ name: value('name'), slug: value('slug') });
  }
  return collectionSchema.safeParse({
    title: value('title'),
    slug: value('slug'),
    description: value('description'),
    status: value('status') || 'DRAFT',
    sortOrder: number('sortOrder'),
    destinationIds: formData.getAll('destinationIds').map(String),
  });
}

export function formatTaxonomyError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'form'}: ${issue.message}`)
    .join(' ');
}

export function taxonomyAudit(
  actor: { id: string; email?: string | null },
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  metadata: Record<string, unknown> = {},
): Prisma.AuditEventCreateInput {
  return {
    actorId: actor.id,
    actorEmail: actor.email ?? 'unknown',
    action,
    entityType,
    entityId,
    summary,
    metadata: metadata as Prisma.InputJsonValue,
  };
}

export async function slugIsTaken(error: unknown): Promise<boolean> {
  return (
    error instanceof PrismaRuntime.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export async function saveTaxonomy(
  tab: TaxonomyTab,
  intent: 'create' | 'update',
  id: string | null,
  data: z.infer<typeof provinceSchema> | z.infer<typeof categorySchema> | z.infer<typeof tagSchema> | z.infer<typeof collectionSchema>,
  actor: { id: string; email?: string | null },
) {
  const prisma = getPrisma();

  if (tab === 'provinces') {
    const value = data as z.infer<typeof provinceSchema>;
    const record = intent === 'create'
      ? await prisma.province.create({
          data: {
            name: value.name,
            slug: value.slug,
            summary: value.summary || null,
            description: value.description || null,
            heroImageUrl: value.heroImageUrl || null,
            status: value.status,
            sortOrder: value.sortOrder,
          },
        })
      : await prisma.province.update({
          where: { id: id! },
          data: {
            name: value.name,
            slug: value.slug,
            summary: value.summary || null,
            description: value.description || null,
            heroImageUrl: value.heroImageUrl || null,
            status: value.status,
            sortOrder: value.sortOrder,
          },
        });
    await prisma.auditEvent.create({
      data: taxonomyAudit(
        actor,
        intent === 'create' ? 'province.created' : 'province.updated',
        'province',
        record.id,
        `${intent === 'create' ? 'Created' : 'Updated'} ${record.name}`,
        { slug: record.slug, status: record.status },
      ),
    });
    return record.id;
  }

  if (tab === 'categories') {
    const value = data as z.infer<typeof categorySchema>;
    const record = intent === 'create'
      ? await prisma.category.create({
          data: {
            name: value.name,
            slug: value.slug,
            description: value.description || null,
            sortOrder: value.sortOrder,
          },
        })
      : await prisma.category.update({
          where: { id: id! },
          data: {
            name: value.name,
            slug: value.slug,
            description: value.description || null,
            sortOrder: value.sortOrder,
          },
        });
    await prisma.auditEvent.create({
      data: taxonomyAudit(
        actor,
        intent === 'create' ? 'category.created' : 'category.updated',
        'category',
        record.id,
        `${intent === 'create' ? 'Created' : 'Updated'} ${record.name}`,
        { slug: record.slug },
      ),
    });
    return record.id;
  }

  if (tab === 'tags') {
    const value = data as z.infer<typeof tagSchema>;
    const record = intent === 'create'
      ? await prisma.tag.create({ data: { name: value.name, slug: value.slug } })
      : await prisma.tag.update({
          where: { id: id! },
          data: { name: value.name, slug: value.slug },
        });
    await prisma.auditEvent.create({
      data: taxonomyAudit(
        actor,
        intent === 'create' ? 'tag.created' : 'tag.updated',
        'tag',
        record.id,
        `${intent === 'create' ? 'Created' : 'Updated'} ${record.name}`,
        { slug: record.slug },
      ),
    });
    return record.id;
  }

  const value = data as z.infer<typeof collectionSchema>;
  const record = await prisma.$transaction(async (tx) => {
    const collection = intent === 'create'
      ? await tx.featuredCollection.create({
          data: {
            title: value.title,
            slug: value.slug,
            description: value.description || null,
            status: value.status,
            sortOrder: value.sortOrder,
          },
        })
      : await tx.featuredCollection.update({
          where: { id: id! },
          data: {
            title: value.title,
            slug: value.slug,
            description: value.description || null,
            status: value.status,
            sortOrder: value.sortOrder,
          },
        });

    await tx.featuredCollectionItem.deleteMany({ where: { collectionId: collection.id } });
    if (value.destinationIds.length > 0) {
      await tx.featuredCollectionItem.createMany({
        data: value.destinationIds.map((destinationId, index) => ({
          collectionId: collection.id,
          destinationId,
          sortOrder: index,
        })),
      });
    }

    await tx.auditEvent.create({
      data: taxonomyAudit(
        actor,
        intent === 'create' ? 'collection.created' : 'collection.updated',
        'featured_collection',
        collection.id,
        `${intent === 'create' ? 'Created' : 'Updated'} ${collection.title}`,
        {
          slug: collection.slug,
          status: collection.status,
          destinations: value.destinationIds.length,
        },
      ),
    });
    return collection;
  });
  return record.id;
}
