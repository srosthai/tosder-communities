import type { Prisma, ReportPriority, ReportStatus, ReportTargetType } from '@prisma/client';
import { getPrisma } from '../db/prisma';
import { ApiError } from './api';

export const reasonCodes = {
  harassment: { label: 'Harassment or bullying', priority: 'HIGH' },
  hate: { label: 'Hate or discrimination', priority: 'HIGH' },
  violence: { label: 'Violence or threats', priority: 'HIGH' },
  illegal: { label: 'Illegal activity', priority: 'HIGH' },
  privacy: { label: 'Private information exposed', priority: 'HIGH' },
  spam: { label: 'Spam or manipulation', priority: 'MEDIUM' },
  misleading: { label: 'Misleading or unsafe advice', priority: 'MEDIUM' },
  unlicensed_photo: { label: 'Unlicensed photo', priority: 'MEDIUM' },
  review_report: { label: 'Reported review', priority: 'HIGH' },
  other: { label: 'Other', priority: 'LOW' },
} as const;

export type ReasonCode = keyof typeof reasonCodes;

const targetLabels: Record<ReportTargetType, string> = {
  TEMPLATE: 'Template',
  REVIEW: 'Review',
  USER: 'Member',
  COMMENT: 'Comment',
};

export async function createReport(input: {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reasonCode: string;
  details?: string | null;
}) {
  const reason = reasonCodes[input.reasonCode as ReasonCode] ?? reasonCodes.other;
  const details = input.details?.trim().slice(0, 2000) || null;

  let ownerUserId: string | null = null;
  let targetLabel = `${targetLabels[input.targetType]} ${input.targetId.slice(0, 8)}`;
  let ownerLink: string | null = null;

  if (input.targetType === 'TEMPLATE') {
    const template = await getPrisma().travelTemplate.findUnique({
      where: { id: input.targetId },
      select: { id: true, title: true, creatorId: true, slug: true, status: true },
    });
    if (!template || template.status !== 'PUBLISHED') {
      throw new ApiError({ status: 404, code: 'not_found', message: 'Template not found.' });
    }
    if (template.creatorId === input.reporterId) {
      throw new ApiError({ status: 409, code: 'invalid_report', message: 'You cannot report your own template.' });
    }
    ownerUserId = template.creatorId;
    targetLabel = template.title;
    ownerLink = `/templates/${template.slug}`;
  } else if (input.targetType === 'REVIEW') {
    const review = await getPrisma().tripReview.findUnique({
      where: { id: input.targetId },
      select: { id: true, reviewerId: true, status: true, template: { select: { title: true, slug: true } } },
    });
    if (!review || review.status === 'HIDDEN') {
      throw new ApiError({ status: 404, code: 'not_found', message: 'Review not found.' });
    }
    if (review.reviewerId === input.reporterId) {
      throw new ApiError({ status: 409, code: 'invalid_report', message: 'You cannot report your own review.' });
    }
    ownerUserId = review.reviewerId;
    targetLabel = `Review on ${review.template.title}`;
    ownerLink = `/templates/${review.template.slug}`;
  } else if (input.targetType === 'USER') {
    const profile = await getPrisma().memberProfile.findUnique({
      where: { userId: input.targetId },
      select: { userId: true, username: true, displayName: true },
    });
    if (!profile) throw new ApiError({ status: 404, code: 'not_found', message: 'Member not found.' });
    if (profile.userId === input.reporterId) {
      throw new ApiError({ status: 409, code: 'invalid_report', message: 'You cannot report yourself.' });
    }
    ownerUserId = profile.userId;
    targetLabel = profile.displayName;
    ownerLink = `/creators/${profile.username}`;
  } else if (input.targetType === 'COMMENT') {
    throw new ApiError({
      status: 422,
      code: 'unsupported_target',
      message: 'Comments are not available yet.',
    });
  }

  const existing = await getPrisma().report.findUnique({
    where: {
      reporterId_targetType_targetId: {
        reporterId: input.reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    },
  });
  if (existing) return existing;

  const report = await getPrisma().report.create({
    data: {
      reporterId: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reasonCode: input.reasonCode,
      details,
      priority: reason.priority as ReportPriority,
    },
  });

  await getPrisma().auditEvent.create({
    data: {
      actorId: input.reporterId,
      actorEmail: 'member',
      action: 'report.created',
      entityType: 'report',
      entityId: report.id,
      summary: `Reported ${targetLabels[input.targetType]}: ${targetLabel}`,
      reason: details,
      metadata: {
        targetType: input.targetType,
        targetId: input.targetId,
        reasonCode: input.reasonCode,
        priority: reason.priority,
        targetOwnerId: ownerUserId,
        targetLink: ownerLink,
      },
    },
  });

  return report;
}

export async function listReports(filters: {
  status?: ReportStatus | 'ALL';
  priority?: ReportPriority | 'ALL';
  targetType?: ReportTargetType | 'ALL';
  page?: number;
  pageSize?: number;
}) {
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);
  const where: Prisma.ReportWhereInput = {};
  if (filters.status && filters.status !== 'ALL') where.status = filters.status;
  if (filters.priority && filters.priority !== 'ALL') where.priority = filters.priority;
  if (filters.targetType && filters.targetType !== 'ALL') where.targetType = filters.targetType;

  const [total, reports] = await Promise.all([
    getPrisma().report.count({ where }),
    getPrisma().report.findMany({
      where,
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { reporter: { select: { username: true } } },
    }),
  ]);

  const templateIds = reports.filter((r) => r.targetType === 'TEMPLATE').map((r) => r.targetId);
  const reviewIds = reports.filter((r) => r.targetType === 'REVIEW').map((r) => r.targetId);
  const userIds = reports.filter((r) => r.targetType === 'USER').map((r) => r.targetId);

  const [templates, reviews, users] = await Promise.all([
    templateIds.length
      ? getPrisma().travelTemplate.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, title: true, slug: true, status: true, creatorId: true },
        })
      : [],
    reviewIds.length
      ? getPrisma().tripReview.findMany({
          where: { id: { in: reviewIds } },
          select: {
            id: true,
            status: true,
            body: true,
            reviewerId: true,
            template: { select: { title: true, slug: true } },
          },
        })
      : [],
    userIds.length
      ? getPrisma().memberProfile.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, username: true, displayName: true, suspendedAt: true },
        })
      : [],
  ]);

  const templateMap = new Map(templates.map((t) => [t.id, t]));
  const reviewMap = new Map(reviews.map((r) => [r.id, r]));
  const userMap = new Map(users.map((u) => [u.userId, u]));

  return {
    reports: reports.map((report) => {
      let targetLabel = report.targetId.slice(0, 12);
      let targetHref: string | null = null;
      let targetOwnerId: string | null = null;
      let targetStatus: string | null = null;
      let targetText: string | null = null;

      if (report.targetType === 'TEMPLATE') {
        const template = templateMap.get(report.targetId);
        targetLabel = template?.title ?? targetLabel;
        targetHref = template ? `/templates/${template.slug}` : null;
        targetOwnerId = template?.creatorId ?? null;
        targetStatus = template?.status ?? null;
      } else if (report.targetType === 'REVIEW') {
        const review = reviewMap.get(report.targetId);
        targetLabel = review ? `Review on ${review.template.title}` : targetLabel;
        targetHref = review ? `/templates/${review.template.slug}` : null;
        targetOwnerId = review?.reviewerId ?? null;
        targetStatus = review?.status ?? null;
        targetText = review?.body ?? null;
      } else if (report.targetType === 'USER') {
        const user = userMap.get(report.targetId);
        targetLabel = user?.displayName ?? targetLabel;
        targetHref = user ? `/creators/${user.username}` : null;
        targetOwnerId = user?.userId ?? null;
        targetStatus = user?.suspendedAt ? 'SUSPENDED' : 'ACTIVE';
      }

      return { ...report, targetLabel, targetHref, targetOwnerId, targetStatus, targetText };
    }),
    total,
    page: Math.min(page, Math.max(1, Math.ceil(total / pageSize))),
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    pageSize,
  };
}

async function notify(userId: string, title: string, body: string, link: string | null) {
  await getPrisma().memberNotification.create({
    data: { userId, title, body, link },
  });
}

export async function resolveReport(
  actor: { id: string; email: string },
  reportId: string,
  action: 'dismiss' | 'hide-template' | 'hide-review' | 'warn-user' | 'suspend-user' | 'escalate',
  note: string,
) {
  const report = await getPrisma().report.findUnique({ where: { id: reportId } });
  if (!report) throw new ApiError({ status: 404, code: 'not_found', message: 'Report not found.' });
  if (report.status === 'RESOLVED' || report.status === 'DISMISSED') return report;

  const trimmed = note.trim().slice(0, 1000);
  let targetOwnerId: string | null = null;
  let targetLink: string | null = null;
  let notificationTitle = 'A moderation decision was made';
  let notificationBody = trimmed || 'A moderator reviewed a report connected to your account.';
  let status: ReportStatus = 'RESOLVED';

  if (report.targetType === 'TEMPLATE') {
    const template = await getPrisma().travelTemplate.findUnique({
      where: { id: report.targetId },
      select: { id: true, title: true, slug: true, creatorId: true },
    });
    targetOwnerId = template?.creatorId ?? null;
    targetLink = template ? `/templates/${template.slug}` : null;
    if (action === 'hide-template' && template) {
      await getPrisma().travelTemplate.update({
        where: { id: template.id },
        data: { status: 'UNLISTED' },
      });
      notificationTitle = 'Your template was hidden';
      notificationBody = `“${template.title}” is no longer public. ${trimmed}`.trim();
    }
  } else if (report.targetType === 'REVIEW') {
    const review = await getPrisma().tripReview.findUnique({
      where: { id: report.targetId },
      select: {
        id: true,
        reviewerId: true,
        status: true,
        template: { select: { title: true, slug: true } },
      },
    });
    targetOwnerId = review?.reviewerId ?? null;
    targetLink = review ? `/templates/${review.template.slug}` : null;
    if (action === 'hide-review' && review) {
      await getPrisma().tripReview.update({
        where: { id: review.id },
        data: { status: 'HIDDEN' },
      });
      notificationTitle = 'Your review was hidden';
      notificationBody = `A review on “${review.template.title}” was hidden. ${trimmed}`.trim();
    }
  } else if (report.targetType === 'USER') {
    const profile = await getPrisma().memberProfile.findUnique({
      where: { userId: report.targetId },
      select: { userId: true, username: true, displayName: true },
    });
    targetOwnerId = profile?.userId ?? null;
    targetLink = profile ? `/creators/${profile.username}` : null;
    if (action === 'suspend-user') {
      await getPrisma().memberProfile.update({
        where: { userId: report.targetId },
        data: { suspendedAt: new Date() },
      });
      notificationTitle = 'Your account was suspended';
      notificationBody = trimmed || 'Your public profile and templates are hidden while the decision is reviewed.';
    } else if (action === 'warn-user') {
      notificationTitle = 'A warning from moderation';
      notificationBody = trimmed || 'Please review the community guidelines.';
    }
  }

  if (action === 'escalate') status = 'ESCALATED';
  if (action === 'dismiss') status = 'DISMISSED';

  const updated = await getPrisma().report.update({
    where: { id: reportId },
    data: {
      status,
      internalNote: trimmed,
      resolutionAction: action,
      resolvedAt: status === 'RESOLVED' || status === 'DISMISSED' ? new Date() : null,
    },
  });

  await getPrisma().auditEvent.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action: `report.${action}`,
      entityType: 'report',
      entityId: reportId,
      summary: `Moderation action: ${action}`,
      reason: trimmed,
      metadata: {
        targetType: report.targetType,
        targetId: report.targetId,
        status,
      },
    },
  });

  if (targetOwnerId && action !== 'dismiss' && action !== 'escalate') {
    await notify(targetOwnerId, notificationTitle, notificationBody, targetLink);
  }

  return updated;
}

export async function getMemberNotifications(userId: string) {
  return getPrisma().memberNotification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
}
