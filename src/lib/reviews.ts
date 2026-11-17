import { getPrisma } from '../db/prisma';
import { ApiError } from './api';
import { createReport } from './reports';

const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function todayUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export interface ReviewEligibility {
  eligible: boolean;
  reason?: string;
}

export function canReviewTrip(
  trip: {
    ownerId: string;
    status: string;
    endDate: Date | null;
    sourceTemplateId: string | null;
    sourceTemplateVersionId: string | null;
    sourceTemplate: { creatorId: string } | null;
    review: { id: string } | null;
  },
  userId: string,
  now = new Date(),
): ReviewEligibility {
  if (trip.ownerId !== userId) return { eligible: false, reason: 'This is not your trip.' };
  if (trip.status === 'ARCHIVED') return { eligible: false, reason: 'Archived trips cannot be reviewed.' };
  if (trip.review) return { eligible: false, reason: 'You already reviewed this trip.' };
  if (!trip.sourceTemplateId || !trip.sourceTemplateVersionId || !trip.sourceTemplate) {
    return { eligible: false, reason: 'Only trips copied from a template can be reviewed.' };
  }
  if (trip.sourceTemplate.creatorId === userId) {
    return { eligible: false, reason: 'You cannot review your own template.' };
  }
  const completed = trip.status === 'COMPLETED' || (trip.endDate != null && trip.endDate < todayUtc(now));
  if (!completed) {
    return { eligible: false, reason: 'Reviews open after the trip ends or is marked complete.' };
  }
  return { eligible: true };
}

function normalizeRating(value: unknown): number {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'Choose a rating from 1 to 5.',
    });
  }
  return rating;
}

function normalizeBody(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 4000);
  return trimmed || null;
}

export async function createReview(input: {
  userId: string;
  tripId: string;
  rating: number;
  body?: string | null;
}) {
  const trip = await getPrisma().userTrip.findFirst({
    where: { id: input.tripId, ownerId: input.userId },
    include: {
      review: { select: { id: true } },
      sourceTemplate: { select: { id: true, creatorId: true, title: true } },
    },
  });
  if (!trip) throw new ApiError({ status: 404, code: 'not_found', message: 'Trip not found.' });
  if (trip.review) {
    throw new ApiError({
      status: 409,
      code: 'duplicate_review',
      message: 'This trip has already been reviewed.',
    });
  }

  const eligibility = canReviewTrip(trip, input.userId);
  if (!eligibility.eligible) {
    throw new ApiError({
      status: 409,
      code: 'not_eligible',
      message: eligibility.reason ?? 'This trip cannot be reviewed yet.',
    });
  }

  const rating = normalizeRating(input.rating);
  const body = normalizeBody(input.body);

  try {
    const review = await getPrisma().$transaction(async (tx) => {
      const created = await tx.tripReview.create({
        data: {
          tripId: trip.id,
          templateId: trip.sourceTemplateId!,
          templateVersionId: trip.sourceTemplateVersionId,
          reviewerId: input.userId,
          rating,
          body,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: input.userId,
          actorEmail: 'member',
          action: 'review.created',
          entityType: 'trip_review',
          entityId: created.id,
          summary: `Reviewed ${trip.sourceTemplate?.title ?? 'a template'}`,
          metadata: { rating, tripId: trip.id },
        },
      });

      return created;
    });

    return review;
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') {
      throw new ApiError({
        status: 409,
        code: 'duplicate_review',
        message: 'This trip has already been reviewed.',
      });
    }
    throw error;
  }
}

export async function updateReview(
  userId: string,
  reviewId: string,
  input: { rating: number; body?: string | null },
) {
  const review = await getPrisma().tripReview.findFirst({
    where: { id: reviewId, reviewerId: userId },
  });
  if (!review) throw new ApiError({ status: 404, code: 'not_found', message: 'Review not found.' });
  if (review.status === 'HIDDEN') {
    throw new ApiError({ status: 409, code: 'invalid_state', message: 'This review is hidden.' });
  }
  if (Date.now() - review.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw new ApiError({
      status: 409,
      code: 'edit_window_closed',
      message: 'Reviews can only be edited within 7 days.',
    });
  }

  return getPrisma().tripReview.update({
    where: { id: reviewId },
    data: {
      rating: normalizeRating(input.rating),
      body: normalizeBody(input.body),
      editedAt: new Date(),
    },
  });
}

export async function deleteReview(userId: string, reviewId: string) {
  const review = await getPrisma().tripReview.findFirst({
    where: { id: reviewId, reviewerId: userId },
  });
  if (!review) throw new ApiError({ status: 404, code: 'not_found', message: 'Review not found.' });
  await getPrisma().tripReview.delete({ where: { id: reviewId } });
}

export async function reportReview(
  userId: string,
  reviewId: string,
  reason: string,
) {
  const trimmed = reason.trim().slice(0, 500);
  if (trimmed.length < 3) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'Add a short reason for the report.',
    });
  }
  const review = await getPrisma().tripReview.findUnique({ where: { id: reviewId } });
  if (!review) throw new ApiError({ status: 404, code: 'not_found', message: 'Review not found.' });
  if (review.reviewerId === userId) {
    throw new ApiError({
      status: 409,
      code: 'invalid_report',
      message: 'You cannot report your own review.',
    });
  }

  const reported = await getPrisma().tripReview.update({
    where: { id: reviewId },
    data: { status: 'REPORTED', reportReason: trimmed },
  });

  await createReport({
    reporterId: userId,
    targetType: 'REVIEW',
    targetId: reviewId,
    reasonCode: 'review_report',
    details: trimmed,
  });

  await getPrisma().auditEvent.create({
    data: {
      actorId: userId,
      actorEmail: 'member',
      action: 'review.reported',
      entityType: 'trip_review',
      entityId: reviewId,
      summary: 'Reported a review',
      metadata: { reason: trimmed },
    },
  });

  return reported;
}

export async function hideReview(
  actor: { id: string; email: string },
  reviewId: string,
) {
  const review = await getPrisma().tripReview.findUnique({ where: { id: reviewId } });
  if (!review) throw new ApiError({ status: 404, code: 'not_found', message: 'Review not found.' });

  const hidden = await getPrisma().tripReview.update({
    where: { id: reviewId },
    data: { status: 'HIDDEN' },
  });

  await getPrisma().auditEvent.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'review.hidden',
      entityType: 'trip_review',
      entityId: reviewId,
      summary: 'Hid a review',
    },
  });

  return hidden;
}

export async function getTemplateReviewSummary(templateId: string) {
  const prisma = getPrisma();
  const [aggregate, reviews] = await Promise.all([
    prisma.tripReview.aggregate({
      where: { templateId, status: 'VISIBLE' },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.tripReview.findMany({
      where: { templateId, status: 'VISIBLE' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        reviewer: { select: { username: true, displayName: true, avatarUrl: true } },
      },
    }),
  ]);

  return {
    average: aggregate._avg.rating ?? 0,
    count: aggregate._count._all,
    reviews,
  };
}

export async function listReviewsForAdmin() {
  return getPrisma().tripReview.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      reviewer: { select: { username: true, displayName: true } },
      template: { select: { slug: true, title: true } },
      trip: { select: { id: true, title: true } },
    },
  });
}
