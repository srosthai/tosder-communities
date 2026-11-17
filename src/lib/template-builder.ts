import type {
  TemplateDay,
  TemplateItem,
  TemplateStatus,
  TravelTemplate,
} from '@prisma/client';
import { getPrisma } from '../db/prisma';
import { ApiError } from './api';
import { slugifyTemplate } from './templates';

export const builderSteps = [
  {
    key: 'basics',
    label: 'Basics',
    description: 'Name the trip and choose where it starts.',
  },
  {
    key: 'details',
    label: 'Trip details',
    description: 'Set the style, budget, season, transport, and audience.',
  },
  {
    key: 'plan',
    label: 'Daily plan',
    description: 'Build each day from timed stops and practical notes.',
  },
  {
    key: 'map',
    label: 'Map & logistics',
    description: 'Check the visit order and add travel notes.',
  },
  {
    key: 'preview',
    label: 'Preview',
    description: 'Read the itinerary the way a traveler will.',
  },
  {
    key: 'publish',
    label: 'Publish',
    description: 'Fix blocking errors, then submit for review.',
  },
] as const;

export type BuilderStep = (typeof builderSteps)[number]['key'];

export function parseBuilderStep(value: string | null): BuilderStep {
  return builderSteps.some((step) => step.key === value)
    ? (value as BuilderStep)
    : 'basics';
}

export const templateStyles = [
  'Slow travel',
  'Classic sightseeing',
  'Food and markets',
  'Nature and hiking',
  'Coast and islands',
  'Family friendly',
  'Budget backpacking',
];

export const transportOptions = [
  'Tuk-tuk',
  'Private car',
  'Motorbike',
  'Bicycle',
  'Boat',
  'Walking',
  'Bus',
  'Flight',
];

export const audienceOptions = [
  'Solo travelers',
  'Couples',
  'Families',
  'Friends',
  'First-time visitors',
  'Slow travelers',
];

export const itemTypeLabels: Record<TemplateItem['type'], string> = {
  ATTRACTION: 'Attraction',
  FOOD: 'Food',
  REST: 'Rest',
  TRANSPORT: 'Transport',
  SHOPPING: 'Shopping',
  ACCOMMODATION: 'Accommodation',
  CUSTOM: 'Custom activity',
};

export type BuilderTemplate = TravelTemplate & {
  province: { id: string; name: string; slug: string } | null;
  days: Array<
    TemplateDay & {
      items: Array<
        TemplateItem & {
          destination: {
            id: string;
            name: string;
            slug: string;
            latitude: number | null;
            longitude: number | null;
            province: { name: string } | null;
          } | null;
        }
      >;
    }
  >;
};

export interface BuilderValidation {
  blocking: string[];
  warnings: string[];
}

export function getStepErrors(template: BuilderTemplate, step: BuilderStep): string[] {
  if (step === 'basics') {
    const errors: string[] = [];
    if (template.title.trim().length < 2) errors.push('Add a title with at least two characters.');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(template.slug)) {
      errors.push('Use a URL slug with lowercase words and hyphens.');
    }
    if (!template.summary?.trim()) errors.push('Add a one-line summary.');
    if (!template.provinceId) errors.push('Choose a province.');
    return errors;
  }

  if (step === 'details') {
    const errors: string[] = [];
    if (!template.style) errors.push('Choose a travel style.');
    if (!template.season?.trim()) errors.push('Add the best season.');
    if (template.transport.length === 0) errors.push('Select at least one transport mode.');
    if (template.audience.length === 0) errors.push('Select at least one audience.');
    if (
      template.budgetMinCents != null &&
      template.budgetMaxCents != null &&
      template.budgetMinCents > template.budgetMaxCents
    ) {
      errors.push('The upper budget must be greater than or equal to the lower budget.');
    }
    return errors;
  }

  if (step === 'plan') {
    const errors: string[] = [];
    if (template.days.length === 0) errors.push('Add at least one day.');
    for (const day of template.days) {
      if (day.items.length === 0) {
        errors.push(`Day ${day.dayNumber} needs at least one item.`);
      }
      for (const item of day.items) {
        if (!item.title.trim()) errors.push(`Day ${day.dayNumber} has an item without a title.`);
        if (item.startTime && item.endTime && item.endTime < item.startTime) {
          errors.push(`Day ${day.dayNumber}: ${item.title} ends before it starts.`);
        }
      }
    }
    return errors;
  }

  return [];
}

export function validateTemplate(
  template: BuilderTemplate,
  options: { emailVerified: boolean; status: TemplateStatus },
): BuilderValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];

  blocking.push(...getStepErrors(template, 'basics'));
  blocking.push(...getStepErrors(template, 'details'));
  blocking.push(...getStepErrors(template, 'plan'));

  if (!options.emailVerified) {
    blocking.push('Verify your email before publishing a template.');
  }

  if (!template.coverPhotoUrl) warnings.push('Add a cover image so the template stands out.');
  if (!template.description?.trim()) warnings.push('Add a longer description for the preview.');
  if (!template.logisticsNotes?.trim()) {
    warnings.push('Add logistics notes for transport and timing between stops.');
  }

  for (const day of template.days) {
    if (day.items.length > 0) {
      const conflicts = findScheduleConflicts(day.items);
      for (const conflict of conflicts) {
        warnings.push(
          `Day ${day.dayNumber}: “${conflict.first}” and “${conflict.second}” overlap.`,
        );
      }
    }

    if (day.items.length > 0 && day.items.every((item) => !item.destinationId)) {
      warnings.push(`Day ${day.dayNumber} uses only custom activities.`);
    }
  }

  if (template.status === 'PUBLISHED') {
    warnings.push('This template is published. Saving these edits does not update the live version until you publish again.');
  }

  return { blocking, warnings };
}

export function findScheduleConflicts(
  items: Array<{ id: string; title: string; startTime: string | null; endTime: string | null }>,
): Array<{ first: string; second: string }> {
  const timed = items
    .filter((item) => item.startTime)
    .map((item) => ({
      id: item.id,
      title: item.title || 'Untitled stop',
      start: item.startTime!,
      end: item.endTime ?? item.startTime!,
    }))
    .sort((a, b) => a.start.localeCompare(b.start));

  const conflicts: Array<{ first: string; second: string }> = [];
  for (let index = 1; index < timed.length; index += 1) {
    const previous = timed[index - 1];
    const current = timed[index];
    if (current.start < previous.end) {
      conflicts.push({ first: previous.title, second: current.title });
    }
  }
  return conflicts;
}

export function formatMoney(cents: number | null, currency = 'USD'): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return 'Flexible';
  return end ? `${start}–${end}` : start;
}

export function formatDuration(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function getTemplateProgress(template: BuilderTemplate): Record<BuilderStep, boolean> {
  const basics = getStepErrors(template, 'basics').length === 0;
  const details = getStepErrors(template, 'details').length === 0;
  const plan = getStepErrors(template, 'plan').length === 0;
  const mapReady = Boolean(template.logisticsNotes?.trim()) || plan;
  return {
    basics,
    details,
    plan,
    map: mapReady,
    preview: plan,
    publish: basics && details && plan,
  };
}

export function requireOwnedTemplate(
  id: string,
  creatorId: string,
  includePlan: true,
): Promise<BuilderTemplate>;
export function requireOwnedTemplate(
  id: string,
  creatorId: string,
  includePlan?: false,
): Promise<TravelTemplate>;
export async function requireOwnedTemplate(
  id: string,
  creatorId: string,
  includePlan = false,
): Promise<TravelTemplate | BuilderTemplate> {
  const template = await getPrisma().travelTemplate.findFirst({
    where: { id, creatorId },
    include: includePlan
      ? {
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
                  },                },
              },
            },
          },
        }
      : undefined,
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

export interface MetadataInput {
  title?: string;
  slug?: string;
  summary?: string | null;
  description?: string | null;
  coverPhotoUrl?: string | null;
  provinceId?: string | null;
  language?: string;
  style?: string | null;
  season?: string | null;
  logisticsNotes?: string | null;
  budgetMinCents?: number | null;
  budgetMaxCents?: number | null;
  transport?: string[];
  audience?: string[];
}

export async function saveTemplateMetadata(
  id: string,
  creatorId: string,
  input: MetadataInput,
) {
  await requireOwnedTemplate(id, creatorId);

  if (
    input.budgetMinCents != null &&
    input.budgetMaxCents != null &&
    input.budgetMinCents > input.budgetMaxCents
  ) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'The upper budget must be greater than or equal to the lower budget.',
    });
  }

  const data: MetadataInput = { ...input };

  if (data.slug !== undefined) {
    const slug = slugifyTemplate(data.slug);
    if (!slug) {
      delete data.slug;
    } else {
      const conflict = await getPrisma().travelTemplate.findFirst({
        where: { slug, id: { not: id } },
        select: { id: true },
      });
      if (conflict) {
        throw new ApiError({
          status: 422,
          code: 'validation_error',
          message: 'That slug is already in use. Choose another.',
        });
      }
      data.slug = slug;
    }
  }

  const template = await getPrisma().travelTemplate.update({
    where: { id },
    data,
  });

  await getPrisma().auditEvent.create({
    data: {
      actorId: creatorId,
      actorEmail: 'creator',
      action: 'template.updated',
      entityType: 'travel_template',
      entityId: id,
      summary: `Edited ${template.title || 'Untitled template'}`,
    },
  });

  return template;
}

async function renumberDays(templateId: string) {
  const prisma = getPrisma();
  const days = await prisma.templateDay.findMany({
    where: { templateId },
    orderBy: { dayNumber: 'asc' },
    select: { id: true },
  });

  for (const [index, day] of days.entries()) {
    await prisma.templateDay.update({
      where: { id: day.id },
      data: { dayNumber: index + 1000 },
    });
  }
  for (const [index, day] of days.entries()) {
    await prisma.templateDay.update({
      where: { id: day.id },
      data: { dayNumber: index + 1 },
    });
  }
}

async function renumberItems(dayId: string) {
  const prisma = getPrisma();
  const items = await prisma.templateItem.findMany({
    where: { dayId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });

  for (const [index, item] of items.entries()) {
    await prisma.templateItem.update({
      where: { id: item.id },
      data: { sortOrder: index + 1000 },
    });
  }
  for (const [index, item] of items.entries()) {
    await prisma.templateItem.update({
      where: { id: item.id },
      data: { sortOrder: index },
    });
  }
}

export async function createDay(templateId: string, creatorId: string) {
  const template = await requireOwnedTemplate(templateId, creatorId, true);
  const next = template.days.length
    ? Math.max(...template.days.map((day) => day.dayNumber)) + 1
    : 1;

  const day = await getPrisma().templateDay.create({
    data: { templateId, dayNumber: next, title: `Day ${next}` },
  });

  await getPrisma().travelTemplate.update({
    where: { id: templateId },
    data: { durationDays: template.days.length + 1 },
  });

  return day;
}

export async function updateDay(
  templateId: string,
  creatorId: string,
  dayId: string,
  input: { title?: string; summary?: string | null },
) {
  await requireOwnedTemplate(templateId, creatorId);
  const day = await getPrisma().templateDay.findFirst({
    where: { id: dayId, templateId },
  });
  if (!day) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Day not found.' });
  }
  return getPrisma().templateDay.update({ where: { id: dayId }, data: input });
}

export async function moveDay(
  templateId: string,
  creatorId: string,
  dayId: string,
  direction: 'up' | 'down',
) {
  const template = await requireOwnedTemplate(templateId, creatorId, true);
  const index = template.days.findIndex((day) => day.id === dayId);
  if (index === -1) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Day not found.' });
  }
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= template.days.length) return;

  const reordered = [...template.days];
  [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];

  await getPrisma().$transaction(async (tx) => {
    for (const [position, day] of reordered.entries()) {
      await tx.templateDay.update({
        where: { id: day.id },
        data: { dayNumber: position + 1000 },
      });
    }
    for (const [position, day] of reordered.entries()) {
      await tx.templateDay.update({
        where: { id: day.id },
        data: { dayNumber: position + 1 },
      });
    }
  });
}

export async function duplicateDay(templateId: string, creatorId: string, dayId: string) {
  const template = await requireOwnedTemplate(templateId, creatorId, true);
  const source = template.days.find((day) => day.id === dayId);
  if (!source) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Day not found.' });
  }

  const copy = await getPrisma().$transaction(async (tx) => {
    const created = await tx.templateDay.create({
      data: {
        templateId,
        dayNumber: source.dayNumber + 1000,
        title: source.title ? `${source.title} (copy)` : `Day ${source.dayNumber} (copy)`,
        summary: source.summary,
        items: {
          create: source.items.map((item) => ({
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
      },
    });
    return created;
  });

  await renumberDays(templateId);
  await getPrisma().travelTemplate.update({
    where: { id: templateId },
    data: { durationDays: template.days.length + 1 },
  });
  return copy;
}

export async function removeDay(templateId: string, creatorId: string, dayId: string) {
  const template = await requireOwnedTemplate(templateId, creatorId, true);
  if (template.days.length <= 0) return;
  const day = template.days.find((item) => item.id === dayId);
  if (!day) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Day not found.' });
  }

  await getPrisma().templateDay.delete({ where: { id: dayId } });
  await renumberDays(templateId);
  await getPrisma().travelTemplate.update({
    where: { id: templateId },
    data: { durationDays: Math.max(1, template.days.length - 1) },
  });
}

export interface ItemInput {
  title?: string;
  type?: TemplateItem['type'];
  destinationId?: string | null;
  description?: string | null;
  practicalTips?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  estimatedCostCents?: number | null;
  photoUrl?: string | null;
}

export async function createItem(templateId: string, creatorId: string, dayId: string) {
  const template = await requireOwnedTemplate(templateId, creatorId, true);
  const day = template.days.find((item) => item.id === dayId);
  if (!day) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Day not found.' });
  }

  const sortOrder = day.items.length;
  return getPrisma().templateItem.create({
    data: {
      dayId,
      title: 'New stop',
      type: 'ATTRACTION',
      sortOrder,
    },
  });
}

export async function updateItem(
  templateId: string,
  creatorId: string,
  dayId: string,
  itemId: string,
  input: ItemInput,
) {
  const template = await requireOwnedTemplate(templateId, creatorId, true);
  const day = template.days.find((item) => item.id === dayId);
  const item = day?.items.find((entry) => entry.id === itemId);
  if (!day || !item) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Item not found.' });
  }

  if (input.startTime && input.endTime && input.endTime < input.startTime) {
    throw new ApiError({
      status: 422,
      code: 'invalid_time',
      message: 'End time cannot be before start time.',
    });
  }

  if (input.destinationId) {
    const destination = await getPrisma().destination.findFirst({
      where: { id: input.destinationId, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!destination) {
      throw new ApiError({
        status: 422,
        code: 'invalid_destination',
        message: 'Linked destinations must be published.',
      });
    }
  }

  return getPrisma().templateItem.update({ where: { id: itemId }, data: input });
}

export async function moveItem(
  templateId: string,
  creatorId: string,
  dayId: string,
  itemId: string,
  direction: 'up' | 'down',
) {
  const template = await requireOwnedTemplate(templateId, creatorId, true);
  const day = template.days.find((entry) => entry.id === dayId);
  if (!day) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Day not found.' });
  }
  const index = day.items.findIndex((item) => item.id === itemId);
  if (index === -1) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Item not found.' });
  }
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= day.items.length) return;

  const reordered = [...day.items];
  [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];

  await getPrisma().$transaction(async (tx) => {
    for (const [position, item] of reordered.entries()) {
      await tx.templateItem.update({
        where: { id: item.id },
        data: { sortOrder: position + 1000 },
      });
    }
    for (const [position, item] of reordered.entries()) {
      await tx.templateItem.update({
        where: { id: item.id },
        data: { sortOrder: position },
      });
    }
  });
}

export async function duplicateItem(
  templateId: string,
  creatorId: string,
  dayId: string,
  itemId: string,
) {
  const template = await requireOwnedTemplate(templateId, creatorId, true);
  const day = template.days.find((entry) => entry.id === dayId);
  const item = day?.items.find((entry) => entry.id === itemId);
  if (!day || !item) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Item not found.' });
  }

  const copy = await getPrisma().templateItem.create({
    data: {
      dayId,
      destinationId: item.destinationId,
      title: `${item.title} (copy)`,
      type: item.type,
      description: item.description,
      practicalTips: item.practicalTips,
      startTime: item.startTime,
      endTime: item.endTime,
      durationMinutes: item.durationMinutes,
      estimatedCostCents: item.estimatedCostCents,
      currency: item.currency,
      sortOrder: day.items.length + 1000,
      photoUrl: item.photoUrl,
    },
  });

  await renumberItems(dayId);
  return copy;
}

export async function removeItem(
  templateId: string,
  creatorId: string,
  dayId: string,
  itemId: string,
) {
  const template = await requireOwnedTemplate(templateId, creatorId, true);
  const day = template.days.find((entry) => entry.id === dayId);
  if (!day?.items.some((entry) => entry.id === itemId)) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Item not found.' });
  }

  await getPrisma().templateItem.delete({ where: { id: itemId } });
  await renumberItems(dayId);
}

export function parseTime(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(raw)) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'Times must use the HH:MM format.',
    });
  }
  return raw;
}

export function parseInteger(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'Amounts and durations must be positive numbers.',
    });
  }
  return Math.round(parsed);
}

export function parseMoney(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'Costs must be positive numbers.',
    });
  }
  return Math.round(parsed * 100);
}
