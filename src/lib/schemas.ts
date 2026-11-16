import { z } from 'zod';

const slug = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens.');

export const destinationListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  province: z.union([z.literal(''), slug]).optional().default(''),
  category: z.union([z.literal(''), slug]).optional().default(''),
  sort: z.enum(['recommended', 'name', 'newest']).optional().default('recommended'),
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(24).optional().default(6),
});

export const destinationSlugSchema = slug;
