import type { Prisma } from '@prisma/client';
import { z } from 'zod';

export const destinationEditorSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter a destination name.').max(120),
    slug: z
      .string()
      .trim()
      .min(1, 'Enter a slug.')
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.'),
    provinceId: z.uuid('Choose a province.'),
    summary: z.string().trim().max(220).optional().default(''),
    description: z.string().trim().max(6000).optional().default(''),
    practicalTips: z.string().trim().max(3000).optional().default(''),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    coverPhotoUrl: z.string().trim().max(600).optional().default(''),
    categoryIds: z.array(z.uuid()).default([]),
    tagIds: z.array(z.uuid()).default([]),
    photos: z
      .array(
        z.object({
          url: z.string().trim().min(1).max(600),
          alt: z.string().trim().min(1, 'Every photo needs alt text.').max(220),
          credit: z.string().trim().min(1, 'Every photo needs a rights note.').max(220),
        }),
      )
      .default([]),
  })
  .superRefine((value, context) => {
    if (value.status !== 'PUBLISHED') return;

    if (!value.summary) {
      context.addIssue({
        code: 'custom',
        path: ['summary'],
        message: 'A published destination needs a summary.',
      });
    }
    if (!value.description) {
      context.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'A published destination needs a description.',
      });
    }
    if (value.latitude == null || value.longitude == null) {
      context.addIssue({
        code: 'custom',
        path: ['latitude'],
        message: 'A published destination needs coordinates.',
      });
    }
    if (value.photos.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['photos'],
        message: 'A published destination needs at least one licensed photo.',
      });
    }
  });

export type DestinationEditorInput = z.infer<typeof destinationEditorSchema>;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function parseDestinationForm(formData: FormData) {
  const photoUrls = formData.getAll('photoUrl').map((value) => String(value).trim());
  const photoAlts = formData.getAll('photoAlt').map((value) => String(value).trim());
  const photoCredits = formData.getAll('photoCredit').map((value) => String(value).trim());

  const photos = photoUrls
    .map((url, index) => ({
      url,
      alt: photoAlts[index] ?? '',
      credit: photoCredits[index] ?? '',
    }))
    .filter((photo) => photo.url.length > 0);

  return destinationEditorSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    slug: String(formData.get('slug') ?? '').trim(),
    provinceId: String(formData.get('provinceId') ?? ''),
    summary: String(formData.get('summary') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    practicalTips: String(formData.get('practicalTips') ?? '').trim(),
    latitude: numberOrNull(formData.get('latitude')),
    longitude: numberOrNull(formData.get('longitude')),
    status: String(formData.get('status') ?? 'DRAFT'),
    coverPhotoUrl: String(formData.get('coverPhotoUrl') ?? '').trim(),
    categoryIds: formData.getAll('categoryIds').map(String),
    tagIds: formData.getAll('tagIds').map(String),
    photos,
  });
}

export function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'form'}: ${issue.message}`)
    .join(' ');
}

export function auditData(
  actor: { id: string; email?: string | null },
  action: string,
  entityId: string,
  summary: string,
  metadata: Record<string, unknown> = {},
): Prisma.AuditEventCreateInput {
  return {
    actorId: actor.id,
    actorEmail: actor.email ?? 'unknown',
    action,
    entityType: 'destination',
    entityId,
    summary,
    metadata: metadata as Prisma.InputJsonValue,
  };
}
