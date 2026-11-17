import { Prisma } from '@prisma/client';
import type { TemplateItemType, TripStatus } from '@prisma/client';
import { getPrisma } from '../db/prisma';
import { ApiError } from './api';
import { findScheduleConflicts } from './template-builder';
import { decideUsageEvent } from './usage';

export type TripPhase = 'draft' | 'upcoming' | 'current' | 'past' | 'archived';

export function deriveTripPhase(
  trip: { status: TripStatus; startDate: Date | null; endDate: Date | null },
  now = new Date(),
): TripPhase {
  if (trip.status === 'ARCHIVED') return 'archived';
  if (trip.status === 'COMPLETED') return 'past';

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (trip.endDate && trip.endDate < today) return 'past';
  if (trip.startDate && trip.startDate > today) return 'upcoming';
  if (trip.startDate || trip.endDate) return 'current';
  return 'draft';
}

export function tripStatusLabel(phase: TripPhase): string {
  return {
    draft: 'Draft',
    upcoming: 'Upcoming',
    current: 'In progress',
    past: 'Past',
    archived: 'Archived',
  }[phase];
}

export interface CopyTemplateInput {
  templateId: string;
  versionId: string;
  idempotencyKey: string;
  startDate?: string | null;
  endDate?: string | null;
  title?: string | null;
  requestId?: string | null;
  actor: { id: string; email: string };
}

function parseDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'Dates must use the YYYY-MM-DD format.',
    });
  }
  return date;
}

function validateDateRange(startDate: Date | null, endDate: Date | null) {
  if (startDate && endDate && endDate < startDate) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'The trip end date cannot be before the start date.',
    });
  }
}

export async function copyTemplateToTrip(input: CopyTemplateInput) {
  const prisma = getPrisma();
  const key = input.idempotencyKey.trim().slice(0, 120);
  if (!key) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'An idempotency key is required.',
    });
  }

  const existing = await prisma.userTrip.findFirst({
    where: { ownerId: input.actor.id, copyKey: key },
  });
  if (existing) {
    return { trip: existing, created: false };
  }

  const template = await prisma.travelTemplate.findFirst({
    where: {
      id: input.templateId,
      status: 'PUBLISHED',
      publishedVersionId: input.versionId,
    },
    include: {
      publishedVersion: true,
    },
  });

  if (!template?.publishedVersion) {
    throw new ApiError({
      status: 404,
      code: 'not_found',
      message: 'That published template version is not available.',
    });
  }

  const occurredAt = new Date();
  const periodKey = occurredAt.toISOString().slice(0, 7);
  const existingUse = await prisma.usageEvent.findFirst({
    where: {
      userId: input.actor.id,
      templateId: template.id,
      periodKey,
    },
    select: { id: true },
  });
  const selfUse = template.creatorId === input.actor.id;
  const duplicateUse = Boolean(existingUse);
  const initialStatus = selfUse || duplicateUse ? 'INVALID' : 'PENDING';
  const eventPeriodKey = selfUse || duplicateUse ? null : periodKey;
  const decisionReason = selfUse
    ? 'Self-use is excluded from qualified usage.'
    : duplicateUse
      ? 'Another qualified-use candidate already exists for this template and month.'
      : null;

  const snapshot = template.publishedVersion.snapshot as {
    template: {
      title: string;
      summary: string | null;
      durationDays: number;
      timezone?: string;
      transport?: string[];
    };
    days: Array<{
      dayNumber: number;
      title: string | null;
      summary: string | null;
      items: Array<{
        title: string;
        type: TemplateItemType;
        destinationSlug: string | null;
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
  };

  const startDate = parseDate(input.startDate);
  const endDate = parseDate(input.endDate);
  validateDateRange(startDate, endDate);

  const destinationSlugs = Array.from(
    new Set(
      snapshot.days.flatMap((day) =>
        day.items.map((item) => item.destinationSlug).filter((slug): slug is string => Boolean(slug)),
      ),
    ),
  );
  const destinations = destinationSlugs.length
    ? await prisma.destination.findMany({
        where: { slug: { in: destinationSlugs }, status: 'PUBLISHED' },
        select: { id: true, slug: true },
      })
    : [];
  const destinationIds = new Map(destinations.map((destination) => [destination.slug, destination.id]));

  try {
    const trip = await prisma.$transaction(async (tx) => {
      const created = await tx.userTrip.create({
        data: {
          ownerId: input.actor.id,
          title: input.title?.trim() || snapshot.template.title,
          status: startDate ? 'PLANNED' : 'DRAFT',
          startDate,
          endDate,
          sourceTemplateId: template.id,
          sourceTemplateVersionId: template.publishedVersion!.id,
          sourceTemplateTitle: template.title,
          sourceVersionNumber: template.publishedVersion!.versionNumber,
          copyKey: key,
          copiedAt: new Date(),
          days: {
            create: snapshot.days.map((day) => ({
              dayNumber: day.dayNumber,
              title: day.title,
              summary: day.summary,
              items: {
                create: day.items.map((item, index) => ({
                  destinationId: item.destinationSlug
                    ? destinationIds.get(item.destinationSlug) ?? null
                    : null,
                  title: item.title,
                  type: item.type,
                  description: item.description,
                  practicalTips: item.practicalTips,
                  startTime: item.startTime,
                  endTime: item.endTime,
                  durationMinutes: item.durationMinutes,
                  estimatedCostCents: item.estimatedCostCents,
                  currency: item.currency,
                  sortOrder: index,
                  photoUrl: item.photoUrl,
                })),
              },
            })),
          },
        },
      });

      await tx.usageEvent.create({
        data: {
          userId: input.actor.id,
          templateId: template.id,
          templateVersionId: template.publishedVersion!.id,
          tripId: created.id,
          eventType: 'template_copy',
          status: initialStatus,
          requestId: input.requestId ?? null,
          idempotencyKey: key,
          periodKey: eventPeriodKey,
          ruleVersion: 'v1',
          decidedAt: initialStatus === 'INVALID' ? occurredAt : null,
          decisionReason,
          metadata: {
            templateSlug: template.slug,
            versionNumber: template.publishedVersion!.versionNumber,
            period: periodKey,
            ...(existingUse ? { duplicateOf: existingUse.id } : {}),
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: input.actor.id,
          actorEmail: input.actor.email,
          action: 'trip.copied',
          entityType: 'user_trip',
          entityId: created.id,
          summary: `Copied ${template.title}`,
          metadata: {
            templateId: template.id,
            versionId: template.publishedVersion!.id,
            versionNumber: template.publishedVersion!.versionNumber,
          },
        },
      });

      return created;
    });

    const usageEvent = await prisma.usageEvent.findUnique({
      where: { tripId: trip.id },
      select: { id: true, status: true },
    });
    if (usageEvent?.status === 'PENDING') {
      try {
        await decideUsageEvent(usageEvent.id);
      } catch {
        // The copy is committed; the engine can retry the pending event later.
      }
    }

    return { trip, created: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const raced = await prisma.userTrip.findFirst({
        where: { ownerId: input.actor.id, copyKey: key },
      });
      if (raced) return { trip: raced, created: false };
    }
    throw error;
  }
}

export async function duplicateTrip(tripId: string, ownerId: string) {
  const trip = await getTripForOwner(tripId, ownerId);
  if (!trip) throw new ApiError({ status: 404, code: 'not_found', message: 'Trip not found.' });

  return getPrisma().userTrip.create({
    data: {
      ownerId,
      title: `${trip.title} (copy)`.slice(0, 160),
      status: 'DRAFT',
      timezone: trip.timezone,
      notes: trip.notes,
      sourceTemplateId: trip.sourceTemplateId,
      sourceTemplateVersionId: trip.sourceTemplateVersionId,
      sourceTemplateTitle: trip.sourceTemplateTitle,
      sourceVersionNumber: trip.sourceVersionNumber,
      copiedAt: trip.copiedAt,
      days: {
        create: trip.days.map((day) => ({
          dayNumber: day.dayNumber,
          date: day.date,
          title: day.title,
          summary: day.summary,
          items: {
            create: day.items.map((item) => ({
              destinationId: item.destinationId,
              title: item.title,
              type: item.type,
              description: item.description,
              practicalTips: item.practicalTips,
              notes: item.notes,
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
      checklist: {
        create: trip.checklist.map((item) => ({
          label: item.label,
          done: item.done,
          sortOrder: item.sortOrder,
        })),
      },
    },
  });
}

export async function getTripForOwner(tripId: string, ownerId: string) {
  return getPrisma().userTrip.findFirst({
    where: { id: tripId, ownerId },
    include: {
      sourceTemplate: { select: { id: true, slug: true, title: true, status: true, creatorId: true } },
      sourceTemplateVersion: { select: { id: true, versionNumber: true } },
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
      checklist: { orderBy: { sortOrder: 'asc' } },
      usageEvent: { select: { id: true, status: true, createdAt: true } },
      review: true,
    },
  });
}

export type TripDetail = NonNullable<Awaited<ReturnType<typeof getTripForOwner>>>;

export interface TripListParams {
  filter?: 'all' | TripPhase;
  page?: number;
  pageSize?: number;
}

export async function listTripsForOwner(ownerId: string, params: TripListParams = {}) {
  const prisma = getPrisma();
  const pageSize = Math.min(Math.max(params.pageSize ?? 8, 1), 24);
  const requestedPage = Math.max(params.page ?? 1, 1);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const filter = params.filter ?? 'all';

  const where: Prisma.UserTripWhereInput = { ownerId };

  if (filter === 'archived') where.status = 'ARCHIVED';
  else if (filter === 'draft') where.status = 'DRAFT';
  else if (filter === 'upcoming') {
    where.status = 'PLANNED';
    where.startDate = { gt: today };
  } else if (filter === 'past') {
    where.OR = [
      { status: 'COMPLETED' },
      { status: { not: 'ARCHIVED' }, endDate: { lt: today } },
    ];
  } else if (filter === 'current') {
    where.status = 'PLANNED';
    where.startDate = { lte: today };
    where.OR = [{ endDate: null }, { endDate: { gte: today } }];
  } else {
    where.status = { not: 'ARCHIVED' };
  }

  const [total, rows] = await Promise.all([
    prisma.userTrip.count({ where }),
    prisma.userTrip.findMany({
      where,
      orderBy: [{ startDate: 'asc' }, { updatedAt: 'desc' }],
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
      include: {
        sourceTemplate: { select: { slug: true, title: true, status: true } },
        sourceTemplateVersion: { select: { versionNumber: true } },
        _count: { select: { days: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  return { trips: rows, total, page, pageSize, totalPages };
}

export async function updateTripMetadata(
  tripId: string,
  ownerId: string,
  input: {
    title?: string;
    notes?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    status?: TripStatus;
  },
) {
  const trip = await getTripForOwner(tripId, ownerId);
  if (!trip) throw new ApiError({ status: 404, code: 'not_found', message: 'Trip not found.' });

  const startDate = input.startDate !== undefined ? parseDate(input.startDate) : trip.startDate;
  const endDate = input.endDate !== undefined ? parseDate(input.endDate) : trip.endDate;
  validateDateRange(startDate, endDate);

  return getPrisma().userTrip.update({
    where: { id: tripId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim().slice(0, 160) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(input.startDate !== undefined ? { startDate } : {}),
      ...(input.endDate !== undefined ? { endDate } : {}),
      ...(startDate && trip.status === 'DRAFT' && input.status === undefined
        ? { status: 'PLANNED' }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
}

export async function archiveTrip(tripId: string, ownerId: string) {
  const trip = await getTripForOwner(tripId, ownerId);
  if (!trip) throw new ApiError({ status: 404, code: 'not_found', message: 'Trip not found.' });
  return getPrisma().userTrip.update({ where: { id: tripId }, data: { status: 'ARCHIVED' } });
}

export async function deleteTrip(tripId: string, ownerId: string) {
  const trip = await getTripForOwner(tripId, ownerId);
  if (!trip) throw new ApiError({ status: 404, code: 'not_found', message: 'Trip not found.' });
  await getPrisma().userTrip.delete({ where: { id: tripId } });
}

export async function completeTrip(tripId: string, ownerId: string) {
  const trip = await getTripForOwner(tripId, ownerId);
  if (!trip) throw new ApiError({ status: 404, code: 'not_found', message: 'Trip not found.' });
  return getPrisma().userTrip.update({ where: { id: tripId }, data: { status: 'COMPLETED' } });
}

async function requireOwnedTrip(tripId: string, ownerId: string) {
  const trip = await getTripForOwner(tripId, ownerId);
  if (!trip) throw new ApiError({ status: 404, code: 'not_found', message: 'Trip not found.' });
  return trip;
}

async function renumberDays(tripId: string) {
  const prisma = getPrisma();
  const days = await prisma.userTripDay.findMany({
    where: { tripId },
    orderBy: { dayNumber: 'asc' },
    select: { id: true },
  });
  for (const [index, day] of days.entries()) {
    await prisma.userTripDay.update({ where: { id: day.id }, data: { dayNumber: index + 1000 } });
  }
  for (const [index, day] of days.entries()) {
    await prisma.userTripDay.update({ where: { id: day.id }, data: { dayNumber: index + 1 } });
  }
}

async function renumberItems(dayId: string) {
  const prisma = getPrisma();
  const items = await prisma.userTripItem.findMany({
    where: { dayId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });
  for (const [index, item] of items.entries()) {
    await prisma.userTripItem.update({ where: { id: item.id }, data: { sortOrder: index + 1000 } });
  }
  for (const [index, item] of items.entries()) {
    await prisma.userTripItem.update({ where: { id: item.id }, data: { sortOrder: index } });
  }
}

export async function addTripDay(tripId: string, ownerId: string) {
  const trip = await requireOwnedTrip(tripId, ownerId);
  const next = trip.days.length ? Math.max(...trip.days.map((day) => day.dayNumber)) + 1 : 1;
  return getPrisma().userTripDay.create({
    data: { tripId, dayNumber: next, title: `Day ${next}` },
  });
}

export async function updateTripDay(
  tripId: string,
  ownerId: string,
  dayId: string,
  input: { title?: string; summary?: string | null; date?: string | null },
) {
  const trip = await requireOwnedTrip(tripId, ownerId);
  if (!trip.days.some((day) => day.id === dayId)) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Day not found.' });
  }
  return getPrisma().userTripDay.update({
    where: { id: dayId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary || null } : {}),
      ...(input.date !== undefined ? { date: parseDate(input.date) } : {}),
    },
  });
}

export async function moveTripDay(
  tripId: string,
  ownerId: string,
  dayId: string,
  direction: 'up' | 'down',
) {
  const trip = await requireOwnedTrip(tripId, ownerId);
  const index = trip.days.findIndex((day) => day.id === dayId);
  if (index === -1) throw new ApiError({ status: 404, code: 'not_found', message: 'Day not found.' });
  const swap = direction === 'up' ? index - 1 : index + 1;
  if (swap < 0 || swap >= trip.days.length) return;

  const reordered = [...trip.days];
  [reordered[index], reordered[swap]] = [reordered[swap], reordered[index]];
  await getPrisma().$transaction(async (tx) => {
    for (const [position, day] of reordered.entries()) {
      await tx.userTripDay.update({ where: { id: day.id }, data: { dayNumber: position + 1000 } });
    }
    for (const [position, day] of reordered.entries()) {
      await tx.userTripDay.update({ where: { id: day.id }, data: { dayNumber: position + 1 } });
    }
  });
}

export async function duplicateTripDay(tripId: string, ownerId: string, dayId: string) {
  const trip = await requireOwnedTrip(tripId, ownerId);
  const source = trip.days.find((day) => day.id === dayId);
  if (!source) throw new ApiError({ status: 404, code: 'not_found', message: 'Day not found.' });

  const copy = await getPrisma().userTripDay.create({
    data: {
      tripId,
      dayNumber: source.dayNumber + 1000,
      date: source.date,
      title: source.title ? `${source.title} (copy)` : `Day ${source.dayNumber} (copy)`,
      summary: source.summary,
      items: {
        create: source.items.map((item) => ({
          destinationId: item.destinationId,
          title: item.title,
          type: item.type,
          description: item.description,
          practicalTips: item.practicalTips,
          notes: item.notes,
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
  await renumberDays(tripId);
  return copy;
}

export async function removeTripDay(tripId: string, ownerId: string, dayId: string) {
  const trip = await requireOwnedTrip(tripId, ownerId);
  if (!trip.days.some((day) => day.id === dayId)) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Day not found.' });
  }
  await getPrisma().userTripDay.delete({ where: { id: dayId } });
  await renumberDays(tripId);
}

export interface TripItemInput {
  title?: string;
  type?: TemplateItemType;
  destinationId?: string | null;
  description?: string | null;
  practicalTips?: string | null;
  notes?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  estimatedCostCents?: number | null;
  photoUrl?: string | null;
}

export async function addTripItem(tripId: string, ownerId: string, dayId: string) {
  const trip = await requireOwnedTrip(tripId, ownerId);
  const day = trip.days.find((entry) => entry.id === dayId);
  if (!day) throw new ApiError({ status: 404, code: 'not_found', message: 'Day not found.' });
  return getPrisma().userTripItem.create({
    data: { dayId, title: 'New stop', type: 'ATTRACTION', sortOrder: day.items.length },
  });
}

export async function updateTripItem(
  tripId: string,
  ownerId: string,
  dayId: string,
  itemId: string,
  input: TripItemInput,
) {
  const trip = await requireOwnedTrip(tripId, ownerId);
  const day = trip.days.find((entry) => entry.id === dayId);
  if (!day?.items.some((item) => item.id === itemId)) {
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
  return getPrisma().userTripItem.update({ where: { id: itemId }, data: input });
}

export async function moveTripItem(
  tripId: string,
  ownerId: string,
  dayId: string,
  itemId: string,
  direction: 'up' | 'down',
) {
  const trip = await requireOwnedTrip(tripId, ownerId);
  const day = trip.days.find((entry) => entry.id === dayId);
  if (!day) throw new ApiError({ status: 404, code: 'not_found', message: 'Day not found.' });
  const index = day.items.findIndex((item) => item.id === itemId);
  if (index === -1) throw new ApiError({ status: 404, code: 'not_found', message: 'Item not found.' });
  const swap = direction === 'up' ? index - 1 : index + 1;
  if (swap < 0 || swap >= day.items.length) return;

  const reordered = [...day.items];
  [reordered[index], reordered[swap]] = [reordered[swap], reordered[index]];
  await getPrisma().$transaction(async (tx) => {
    for (const [position, item] of reordered.entries()) {
      await tx.userTripItem.update({ where: { id: item.id }, data: { sortOrder: position + 1000 } });
    }
    for (const [position, item] of reordered.entries()) {
      await tx.userTripItem.update({ where: { id: item.id }, data: { sortOrder: position } });
    }
  });
}

export async function duplicateTripItem(
  tripId: string,
  ownerId: string,
  dayId: string,
  itemId: string,
) {
  const trip = await requireOwnedTrip(tripId, ownerId);
  const day = trip.days.find((entry) => entry.id === dayId);
  const item = day?.items.find((entry) => entry.id === itemId);
  if (!day || !item) throw new ApiError({ status: 404, code: 'not_found', message: 'Item not found.' });
  const copy = await getPrisma().userTripItem.create({
    data: {
      dayId,
      destinationId: item.destinationId,
      title: `${item.title} (copy)`,
      type: item.type,
      description: item.description,
      practicalTips: item.practicalTips,
      notes: item.notes,
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

export async function removeTripItem(
  tripId: string,
  ownerId: string,
  dayId: string,
  itemId: string,
) {
  const trip = await requireOwnedTrip(tripId, ownerId);
  const day = trip.days.find((entry) => entry.id === dayId);
  if (!day?.items.some((item) => item.id === itemId)) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Item not found.' });
  }
  await getPrisma().userTripItem.delete({ where: { id: itemId } });
  await renumberItems(dayId);
}

export async function addChecklistItem(tripId: string, ownerId: string, label: string) {
  const trip = await requireOwnedTrip(tripId, ownerId);
  const trimmed = label.trim().slice(0, 160);
  if (!trimmed) {
    throw new ApiError({ status: 422, code: 'validation_error', message: 'Enter a checklist item.' });
  }
  return getPrisma().userTripChecklistItem.create({
    data: {
      tripId,
      label: trimmed,
      sortOrder: trip.checklist.length,
    },
  });
}

export async function toggleChecklistItem(
  tripId: string,
  ownerId: string,
  itemId: string,
  done: boolean,
) {
  const trip = await requireOwnedTrip(tripId, ownerId);
  if (!trip.checklist.some((item) => item.id === itemId)) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Checklist item not found.' });
  }
  return getPrisma().userTripChecklistItem.update({ where: { id: itemId }, data: { done } });
}

export async function removeChecklistItem(tripId: string, ownerId: string, itemId: string) {
  const trip = await requireOwnedTrip(tripId, ownerId);
  if (!trip.checklist.some((item) => item.id === itemId)) {
    throw new ApiError({ status: 404, code: 'not_found', message: 'Checklist item not found.' });
  }
  await getPrisma().userTripChecklistItem.delete({ where: { id: itemId } });
  const remaining = await getPrisma().userTripChecklistItem.findMany({
    where: { tripId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });
  for (const [index, item] of remaining.entries()) {
    await getPrisma().userTripChecklistItem.update({
      where: { id: item.id },
      data: { sortOrder: index + 1000 },
    });
  }
  for (const [index, item] of remaining.entries()) {
    await getPrisma().userTripChecklistItem.update({
      where: { id: item.id },
      data: { sortOrder: index },
    });
  }
}

export function tripWarnings(trip: TripDetail): string[] {
  const warnings: string[] = [];

  if (trip.days.length === 0) warnings.push('Add at least one day to the trip.');

  if (trip.startDate && trip.endDate) {
    const days =
      Math.floor(
        (trip.endDate.getTime() - trip.startDate.getTime()) / (24 * 60 * 60 * 1000),
      ) + 1;
    if (trip.days.length !== days) {
      warnings.push(`The dates cover ${days} days but the itinerary has ${trip.days.length}.`);
    }
  }

  for (const day of trip.days) {
    if (day.date && trip.startDate && day.date < trip.startDate) {
      warnings.push(`Day ${day.dayNumber} is before the trip start date.`);
    }
    if (day.date && trip.endDate && day.date > trip.endDate) {
      warnings.push(`Day ${day.dayNumber} is after the trip end date.`);
    }
    const conflicts = findScheduleConflicts(day.items);
    for (const conflict of conflicts) {
      warnings.push(
        `Day ${day.dayNumber}: “${conflict.first}” and “${conflict.second}” overlap.`,
      );
    }
  }

  return warnings;
}

export function dateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '';
}
