import { getPrisma } from '../db/prisma';

export interface AnalyticsRange {
  from: Date;
  to: Date;
}

export function defaultAnalyticsRange(now = new Date()): AnalyticsRange {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 29);
  from.setUTCHours(0, 0, 0, 0);
  return { from, to };
}

export function parseAnalyticsRange(fromValue: string | null, toValue: string | null) {
  const fallback = defaultAnalyticsRange();
  const from = fromValue ? new Date(`${fromValue}T00:00:00.000Z`) : fallback.from;
  const to = toValue ? new Date(`${toValue}T23:59:59.999Z`) : fallback.to;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return fallback;
  }
  const maxDays = 366;
  if (to.getTime() - from.getTime() > maxDays * 24 * 60 * 60 * 1000) {
    return defaultAnalyticsRange();
  }
  return { from, to };
}

function privacyCount(value: number, kind: 'views' | 'engagement' | 'uses') {
  if (value <= 0) return 0;
  if (value < 5) return '<5';
  if (kind === 'views') return Math.round(value / 10) * 10;
  return Math.round(value / 5) * 5;
}

function privacyRate(numerator: number, denominator: number) {
  if (denominator < 5) return '—';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export async function getCreatorAnalytics(creatorId: string, range: AnalyticsRange) {
  const prisma = getPrisma();
  const templates = await prisma.travelTemplate.findMany({
    where: { creatorId },
    orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    include: {
      publishedVersion: { select: { versionNumber: true, snapshot: true } },
      reviews: {
        where: { status: 'VISIBLE' },
        select: { rating: true, body: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const templateIds = templates.map((template) => template.id);
  if (templateIds.length === 0) {
    return {
      range,
      totals: {
        published: 0,
        views: 0,
        likes: 0,
        saves: 0,
        qualifiedUses: 0,
        useStarted: 0,
        conversion: '—',
        rating: null,
        reviewCount: 0,
        viewsDisplay: 0,
        likesDisplay: 0,
        savesDisplay: 0,
        qualifiedUsesDisplay: 0,
        useStartedDisplay: 0,
      },
      templates: [],
      daily: [],
      recentReviews: [],
    };
  }

  const [events, usage, dailyRows] = await Promise.all([
    prisma.engagementEvent.groupBy({
      by: ['templateId', 'eventType'],
      where: {
        templateId: { in: templateIds },
        occurredAt: { gte: range.from, lte: range.to },
      },
      _count: { _all: true },
    }),
    prisma.usageEvent.groupBy({
      by: ['templateId', 'status'],
      where: {
        templateId: { in: templateIds },
        createdAt: { gte: range.from, lte: range.to },
      },
      _count: { _all: true },
    }),
    prisma.engagementEvent.findMany({
      where: {
        templateId: { in: templateIds },
        eventType: 'VIEW',
        occurredAt: { gte: range.from, lte: range.to },
      },
      select: { occurredAt: true },
    }),
  ]);

  const eventCounts = new Map<string, number>();
  for (const event of events) {
    eventCounts.set(`${event.templateId}:${event.eventType}`, event._count._all);
  }
  const usageCounts = new Map<string, number>();
  for (const event of usage) {
    if (event.status === 'QUALIFIED' && event.templateId) {
      usageCounts.set(event.templateId, event._count._all);
    }
  }

  const totals = {
    published: templates.filter((template) => template.status === 'PUBLISHED').length,
    views: 0,
    likes: 0,
    saves: 0,
    qualifiedUses: 0,
    useStarted: 0,
    conversion: '—',
    rating: null as number | null,
    reviewCount: 0,
  };
  let ratingSum = 0;
  let ratingCount = 0;

  const rows = templates.map((template) => {
    const views = eventCounts.get(`${template.id}:VIEW`) ?? 0;
    const likes = eventCounts.get(`${template.id}:LIKE`) ?? 0;
    const saves = eventCounts.get(`${template.id}:SAVE`) ?? 0;
    const useStarted = eventCounts.get(`${template.id}:USE_STARTED`) ?? 0;
    const qualifiedUses = usageCounts.get(template.id) ?? 0;
    const ratings = template.reviews.map((review) => review.rating);
    const rating = ratings.length
      ? ratings.reduce((total, value) => total + value, 0) / ratings.length
      : null;

    totals.views += views;
    totals.likes += likes;
    totals.saves += saves;
    totals.qualifiedUses += qualifiedUses;
    totals.useStarted += useStarted;
    totals.reviewCount += template.reviews.length;
    ratingSum += ratings.reduce((total, value) => total + value, 0);
    ratingCount += ratings.length;

    const snapshot = template.publishedVersion?.snapshot as
      | { template?: { title?: string } }
      | undefined;

    return {
      id: template.id,
      title: snapshot?.template?.title ?? template.title,
      status: template.status,
      versionNumber: template.publishedVersion?.versionNumber ?? null,
      views,
      likes,
      saves,
      qualifiedUses,
      useStarted,
      conversion: privacyRate(qualifiedUses, views),
      rating,
      reviewCount: template.reviews.length,
      publishedAt: template.publishedAt,
    };
  });

  totals.rating = ratingCount > 0 ? ratingSum / ratingCount : null;
  totals.conversion = privacyRate(totals.qualifiedUses, totals.views);

  const daily = new Map<string, number>();
  for (const row of dailyRows) {
    const key = row.occurredAt.toISOString().slice(0, 10);
    daily.set(key, (daily.get(key) ?? 0) + 1);
  }
  const days: Array<{ date: string; views: number }> = [];
  const cursor = new Date(range.from);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor <= range.to) {
    const key = cursor.toISOString().slice(0, 10);
    days.push({ date: key, views: daily.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const recentReviews = templates
    .flatMap((template) =>
      template.reviews.map((review) => ({
        templateTitle: template.title,
        rating: review.rating,
        body: review.body,
        createdAt: review.createdAt,
      })),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  return {
    range,
    totals: {
      ...totals,
      viewsDisplay: privacyCount(totals.views, 'views'),
      likesDisplay: privacyCount(totals.likes, 'engagement'),
      savesDisplay: privacyCount(totals.saves, 'engagement'),
      qualifiedUsesDisplay: privacyCount(totals.qualifiedUses, 'uses'),
      useStartedDisplay: privacyCount(totals.useStarted, 'uses'),
    },
    templates: rows.map((row) => ({
      ...row,
      viewsDisplay: privacyCount(row.views, 'views'),
      likesDisplay: privacyCount(row.likes, 'engagement'),
      savesDisplay: privacyCount(row.saves, 'engagement'),
      qualifiedUsesDisplay: privacyCount(row.qualifiedUses, 'uses'),
      useStartedDisplay: privacyCount(row.useStarted, 'uses'),
    })),
    daily: days,
    recentReviews,
  };
}
