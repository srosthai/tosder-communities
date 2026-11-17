import type { CompetitionStatus, Prisma } from '@prisma/client';
import { getPrisma } from '../db/prisma';
import { ApiError } from './api';
import { slugifyTemplate } from './template-slug';

export const leaderboardRuleVersion = 'v1';

export interface CompetitionInput {
  title: string;
  slug?: string;
  description?: string | null;
  rules?: string | null;
  rulesUrl?: string | null;
  timezone?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  prizePoolCents?: number | null;
  currency?: string;
  fundingSource?: string | null;
  prizes?: Array<{ rank: number; amountCents: number; label?: string | null }>;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError({ status: 422, code: 'validation_error', message: 'Use valid dates.' });
  }
  return date;
}

function validateCompetition(input: CompetitionInput) {
  if (!input.title?.trim()) {
    throw new ApiError({ status: 422, code: 'validation_error', message: 'Add a title.' });
  }
  const startsAt = parseDate(input.startsAt);
  const endsAt = parseDate(input.endsAt);
  if (!startsAt || !endsAt || endsAt <= startsAt) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'Add a start and end time with the end after the start.',
    });
  }
  return { startsAt, endsAt };
}

function prizesData(input: CompetitionInput) {
  return (input.prizes ?? [])
    .filter((prize) => prize.rank > 0 && prize.amountCents >= 0)
    .map((prize) => ({
      rank: prize.rank,
      amountCents: prize.amountCents,
      label: prize.label?.trim() || null,
    }));
}

async function audit(
  actor: { id: string; email: string },
  action: string,
  entityId: string,
  summary: string,
  metadata: Prisma.InputJsonValue,
) {
  await getPrisma().auditEvent.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      entityType: 'competition',
      entityId,
      summary,
      metadata,
    },
  });
}

export async function listCompetitions() {
  return getPrisma().competition.findMany({
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    include: { prizes: { orderBy: { rank: 'asc' } }, _count: { select: { snapshots: true } } },
  });
}

export async function getCompetitionById(id: string) {
  return getPrisma().competition.findUnique({
    where: { id },
    include: { prizes: { orderBy: { rank: 'asc' } }, snapshots: { orderBy: { versionNumber: 'desc' } } },
  });
}

export async function getCompetitionBySlug(slug: string) {
  return getPrisma().competition.findUnique({
    where: { slug },
    include: { prizes: { orderBy: { rank: 'asc' } } },
  });
}

export async function createCompetition(
  actor: { id: string; email: string },
  input: CompetitionInput,
) {
  const { startsAt, endsAt } = validateCompetition(input);
  const baseSlug = slugifyTemplate(input.slug || input.title);
  let slug = baseSlug || `competition-${Date.now()}`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const existing = await getPrisma().competition.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) break;
    slug = `${baseSlug}-${attempt + 2}`;
  }

  const competition = await getPrisma().competition.create({
    data: {
      title: input.title.trim(),
      slug,
      description: input.description?.trim() || null,
      rules: input.rules?.trim() || null,
      rulesUrl: input.rulesUrl?.trim() || null,
      timezone: input.timezone?.trim() || 'Asia/Phnom_Penh',
      startsAt,
      endsAt,
      prizePoolCents: input.prizePoolCents ?? null,
      currency: input.currency?.trim() || 'USD',
      fundingSource: input.fundingSource?.trim() || null,
      createdById: actor.id,
      prizes: { create: prizesData(input) },
    },
    include: { prizes: true },
  });

  await audit(actor, 'competition.created', competition.id, `Created ${competition.title}`, {
    slug: competition.slug,
  });
  return competition;
}

export async function updateCompetition(
  actor: { id: string; email: string },
  id: string,
  input: CompetitionInput,
  reason?: string,
) {
  const existing = await getPrisma().competition.findUnique({ where: { id } });
  if (!existing) throw new ApiError({ status: 404, code: 'not_found', message: 'Competition not found.' });
  if (existing.status === 'FINALIZED') {
    throw new ApiError({ status: 409, code: 'invalid_transition', message: 'Finalized competitions cannot change.' });
  }
  if (existing.status !== 'DRAFT' && (!reason || reason.trim().length < 3)) {
    throw new ApiError({
      status: 422,
      code: 'reason_required',
      message: 'Changes after start require a reason.',
    });
  }

  const { startsAt, endsAt } = validateCompetition(input);
  const updated = await getPrisma().$transaction(async (tx) => {
    const competition = await tx.competition.update({
      where: { id },
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        rules: input.rules?.trim() || null,
        rulesUrl: input.rulesUrl?.trim() || null,
        timezone: input.timezone?.trim() || existing.timezone,
        startsAt,
        endsAt,
        prizePoolCents: input.prizePoolCents ?? null,
        currency: input.currency?.trim() || 'USD',
        fundingSource: input.fundingSource?.trim() || null,
        changeReason: reason?.trim() || null,
        version: { increment: 1 },
        prizes: {
          deleteMany: {},
          create: prizesData(input),
        },
      },
      include: { prizes: true },
    });
    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'competition.updated',
        entityType: 'competition',
        entityId: id,
        summary: `Updated ${competition.title}`,
        reason: reason?.trim() || null,
        before: {
          title: existing.title,
          startsAt: existing.startsAt?.toISOString() ?? null,
          endsAt: existing.endsAt?.toISOString() ?? null,
          status: existing.status,
          version: existing.version,
        },
        after: {
          title: competition.title,
          startsAt: competition.startsAt?.toISOString() ?? null,
          endsAt: competition.endsAt?.toISOString() ?? null,
          status: competition.status,
          version: competition.version,
        },
      },
    });
    return competition;
  });

  return updated;
}

export async function publishCompetition(
  actor: { id: string; email: string },
  id: string,
) {
  const competition = await getPrisma().competition.findUnique({
    where: { id },
    include: { prizes: true },
  });
  if (!competition) throw new ApiError({ status: 404, code: 'not_found', message: 'Competition not found.' });
  if (competition.status !== 'DRAFT') {
    throw new ApiError({ status: 409, code: 'invalid_transition', message: 'Only a draft can be published.' });
  }

  const { startsAt, endsAt } = validateCompetition({
    title: competition.title,
    startsAt: competition.startsAt?.toISOString(),
    endsAt: competition.endsAt?.toISOString(),
  });
  if (!competition.rules?.trim() && !competition.rulesUrl?.trim()) {
    throw new ApiError({ status: 422, code: 'validation_error', message: 'Add competition rules.' });
  }
  if (!competition.fundingSource?.trim()) {
    throw new ApiError({ status: 422, code: 'validation_error', message: 'Record the prize funding source.' });
  }
  const totalPrizes = competition.prizes.reduce((total, prize) => total + prize.amountCents, 0);
  if (competition.prizes.length === 0 || totalPrizes <= 0) {
    throw new ApiError({ status: 422, code: 'validation_error', message: 'Add funded prizes.' });
  }
  if (competition.prizePoolCents != null && totalPrizes > competition.prizePoolCents) {
    throw new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'Prize amounts exceed the configured prize pool.',
    });
  }

  const overlap = await getPrisma().competition.findFirst({
    where: {
      id: { not: id },
      status: 'ACTIVE',
      startsAt: { lt: endsAt! },
      endsAt: { gt: startsAt! },
    },
    select: { id: true, title: true },
  });
  if (overlap) {
    throw new ApiError({
      status: 409,
      code: 'overlapping_competition',
      message: `An active competition already covers these dates: ${overlap.title}.`,
    });
  }

  const published = await getPrisma().competition.update({
    where: { id },
    data: { status: 'ACTIVE', publishedAt: new Date() },
  });
  await audit(actor, 'competition.published', id, `Started ${competition.title}`, {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    totalPrizes,
  });
  return published;
}

interface RawLeaderboardRow {
  creatorId: string;
  uses: number;
  tieBreakAt: Date | null;
}

export async function computeLeaderboard(competitionId: string) {
  const competition = await getPrisma().competition.findUnique({
    where: { id: competitionId },
    include: { prizes: { orderBy: { rank: 'asc' } } },
  });
  if (!competition?.startsAt || !competition.endsAt) {
    throw new ApiError({ status: 409, code: 'invalid_state', message: 'Competition dates are incomplete.' });
  }

  const rows = await getPrisma().$queryRaw<RawLeaderboardRow[]>`
    SELECT t.creator_id AS "creatorId", COUNT(*)::int AS uses, MAX(u.qualified_at) AS "tieBreakAt"
    FROM usage_events u
    JOIN travel_templates t ON t.id = u.template_id
    JOIN member_profiles p ON p.user_id = t.creator_id
    WHERE u.status = 'QUALIFIED'
      AND u.qualified_at >= ${competition.startsAt}
      AND u.qualified_at < ${competition.endsAt}
      AND p.suspended_at IS NULL
    GROUP BY t.creator_id
  `;

  const profiles = rows.length
    ? await getPrisma().memberProfile.findMany({
        where: { userId: { in: rows.map((row) => row.creatorId) } },
        select: { userId: true, username: true, displayName: true, avatarUrl: true },
      })
    : [];
  const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]));

  const sorted = rows
    .map((row) => ({
      creatorId: row.creatorId,
      uses: row.uses,
      tieBreakAt: row.tieBreakAt,
      profile: profileMap.get(row.creatorId) ?? null,
    }))
    .filter((row) => row.profile)
    .sort((a, b) => {
      if (b.uses !== a.uses) return b.uses - a.uses;
      const aTime = a.tieBreakAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.tieBreakAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return a.creatorId.localeCompare(b.creatorId);
    });

  let previousUses: number | null = null;
  let previousTie: number | null = null;
  return sorted.map((row, index) => {
    const tie = row.tieBreakAt?.getTime() ?? null;
    const tiedWithPrevious =
      previousUses === row.uses && previousTie !== null && previousTie === tie;
    previousUses = row.uses;
    previousTie = tie;
    return {
      rank: index + 1,
      creatorId: row.creatorId,
      username: row.profile!.username,
      displayName: row.profile!.displayName,
      avatarUrl: row.profile!.avatarUrl,
      qualifiedUses: row.uses,
      tieBreakAt: row.tieBreakAt?.toISOString() ?? null,
      tiedWithPrevious,
    };
  });
}

async function createSnapshot(
  competitionId: string,
  actorId: string,
  status: 'PROVISIONAL' | 'FINAL',
  entries: Awaited<ReturnType<typeof computeLeaderboard>>,
) {
  const latest = await getPrisma().leaderboardSnapshot.findFirst({
    where: { competitionId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  });
  return getPrisma().leaderboardSnapshot.create({
    data: {
      competitionId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      status,
      ruleVersion: leaderboardRuleVersion,
      entries,
      createdById: actorId,
    },
  });
}

export async function closeCompetition(
  actor: { id: string; email: string },
  id: string,
) {
  const competition = await getPrisma().competition.findUnique({ where: { id } });
  if (!competition) throw new ApiError({ status: 404, code: 'not_found', message: 'Competition not found.' });
  if (competition.status !== 'ACTIVE') {
    throw new ApiError({ status: 409, code: 'invalid_transition', message: 'Only an active competition can close.' });
  }

  const entries = await computeLeaderboard(id);
  const snapshot = await createSnapshot(id, actor.id, 'PROVISIONAL', entries);
  const closed = await getPrisma().competition.update({
    where: { id },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
  await audit(actor, 'competition.closed', id, `Closed ${competition.title}`, {
    snapshotVersion: snapshot.versionNumber,
    entries: entries.length,
  });
  return { competition: closed, snapshot, entries };
}

export async function finalizeCompetition(
  actor: { id: string; email: string },
  id: string,
) {
  const competition = await getPrisma().competition.findUnique({
    where: { id },
    include: { snapshots: { orderBy: { versionNumber: 'desc' }, take: 1 } },
  });
  if (!competition) throw new ApiError({ status: 404, code: 'not_found', message: 'Competition not found.' });
  if (competition.status !== 'CLOSED') {
    throw new ApiError({ status: 409, code: 'invalid_transition', message: 'Only a closed competition can be finalized.' });
  }
  const latest = competition.snapshots[0];
  if (!latest) {
    throw new ApiError({ status: 409, code: 'missing_snapshot', message: 'Close the competition first.' });
  }

  const finalSnapshot = await createSnapshot(
    id,
    actor.id,
    'FINAL',
    latest.entries as Awaited<ReturnType<typeof computeLeaderboard>>,
  );
  const finalized = await getPrisma().competition.update({
    where: { id },
    data: { status: 'FINALIZED', finalizedAt: new Date() },
  });
  await audit(actor, 'competition.finalized', id, `Finalized ${competition.title}`, {
    snapshotVersion: finalSnapshot.versionNumber,
  });
  return { competition: finalized, snapshot: finalSnapshot };
}

export async function recomputeLeaderboard(
  actor: { id: string; email: string },
  id: string,
  reason: string,
) {
  if (reason.trim().length < 3) {
    throw new ApiError({ status: 422, code: 'validation_error', message: 'Add a reason for the recompute.' });
  }
  const competition = await getPrisma().competition.findUnique({ where: { id } });
  if (!competition) throw new ApiError({ status: 404, code: 'not_found', message: 'Competition not found.' });
  if (competition.status === 'DRAFT') {
    throw new ApiError({ status: 409, code: 'invalid_transition', message: 'The competition has not started.' });
  }

  const entries = await computeLeaderboard(id);
  const snapshot = await createSnapshot(
    id,
    actor.id,
    competition.status === 'FINALIZED' ? 'FINAL' : 'PROVISIONAL',
    entries,
  );
  await audit(actor, 'competition.leaderboard_recomputed', id, `Recomputed ${competition.title}`, {
    snapshotVersion: snapshot.versionNumber,
    reason: reason.trim(),
  });
  return { snapshot, entries };
}

export async function getCurrentCompetition() {
  const active = await getPrisma().competition.findFirst({
    where: { status: { in: ['ACTIVE', 'CLOSED'] } },
    orderBy: [{ startsAt: 'desc' }],
    include: { prizes: { orderBy: { rank: 'asc' } } },
  });
  if (active) return active;
  return getPrisma().competition.findFirst({
    where: { status: 'FINALIZED' },
    orderBy: [{ endsAt: 'desc' }],
    include: { prizes: { orderBy: { rank: 'asc' } } },
  });
}

export async function getLeaderboardForCompetition(competitionId: string) {
  const competition = await getPrisma().competition.findUnique({
    where: { id: competitionId },
    include: {
      prizes: { orderBy: { rank: 'asc' } },
      snapshots: { orderBy: { versionNumber: 'desc' } },
    },
  });
  if (!competition) return null;

  const final = competition.snapshots.find((snapshot) => snapshot.status === 'FINAL');
  if (competition.status === 'FINALIZED' && final) {
    return {
      competition,
      entries: final.entries as Awaited<ReturnType<typeof computeLeaderboard>>,
      provisional: false,
      snapshot: final,
    };
  }

  const latest = competition.snapshots[0];
  if (latest) {
    return {
      competition,
      entries: latest.entries as Awaited<ReturnType<typeof computeLeaderboard>>,
      provisional: true,
      snapshot: latest,
    };
  }

  return {
    competition,
    entries: competition.status === 'DRAFT' ? [] : await computeLeaderboard(competition.id),
    provisional: competition.status !== 'FINALIZED',
    snapshot: null,
  };
}

export async function getPastCompetitions(limit = 6) {
  const competitions = await getPrisma().competition.findMany({
    where: { status: 'FINALIZED' },
    orderBy: { endsAt: 'desc' },
    take: limit,
    include: {
      prizes: { orderBy: { rank: 'asc' } },
      snapshots: { where: { status: 'FINAL' }, orderBy: { versionNumber: 'desc' }, take: 1 },
    },
  });
  return competitions.map((competition) => ({
    ...competition,
    entries: (competition.snapshots[0]?.entries as Awaited<ReturnType<typeof computeLeaderboard>>) ?? [],
  }));
}

export const competitionStatusLabel: Record<CompetitionStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  FINALIZED: 'Finalized',
};
