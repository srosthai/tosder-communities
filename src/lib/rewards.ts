import { getPrisma } from '../db/prisma';
import { ApiError } from './api';

export const rewardStatusLabel = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  PAYABLE: 'Payable',
  PAID: 'Paid',
  VOID: 'Void',
} as const;

interface LeaderboardEntry {
  rank: number;
  creatorId: string;
  displayName: string;
  qualifiedUses: number;
}

async function audit(
  actor: { id: string; email: string },
  action: string,
  rewardId: string,
  summary: string,
  metadata: Record<string, unknown>,
) {
  await getPrisma().auditEvent.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      entityType: 'reward',
      entityId: rewardId,
      summary,
      metadata: metadata as never,
    },
  });
}

export async function createRewardsFromFinal(competitionId: string, actor: { id: string; email: string }) {
  const competition = await getPrisma().competition.findUnique({
    where: { id: competitionId },
    include: {
      prizes: { orderBy: { rank: 'asc' } },
      snapshots: { where: { status: 'FINAL' }, orderBy: { versionNumber: 'desc' }, take: 1 },
    },
  });
  if (!competition) throw new ApiError({ status: 404, code: 'not_found', message: 'Competition not found.' });
  if (competition.status !== 'FINALIZED') {
    throw new ApiError({
      status: 409,
      code: 'invalid_transition',
      message: 'Rewards require a finalized competition result.',
    });
  }
  const entries = (competition.snapshots[0]?.entries as unknown as LeaderboardEntry[] | undefined) ?? [];
  if (entries.length === 0) {
    throw new ApiError({ status: 409, code: 'missing_results', message: 'No final results to reward.' });
  }

  const created = [];
  for (const prize of competition.prizes) {
    const entry = entries.find((row) => row.rank === prize.rank);
    if (!entry) continue;
    const existing = await getPrisma().reward.findUnique({
      where: { competitionId_rank: { competitionId, rank: prize.rank } },
    });
    if (existing) continue;

    const reward = await getPrisma().reward.create({
      data: {
        competitionId,
        rank: prize.rank,
        recipientId: entry.creatorId,
        amountCents: prize.amountCents,
        currency: competition.currency,
      },
    });
    created.push(reward);
    await audit(actor, 'reward.created', reward.id, `Created reward for rank ${prize.rank}`, {
      competitionId,
      recipientId: entry.creatorId,
      amountCents: prize.amountCents,
    });
  }

  return { created, total: created.reduce((sum, reward) => sum + reward.amountCents, 0) };
}

export async function approveReward(
  actor: { id: string; email: string },
  rewardId: string,
  reason: string,
) {
  if (reason.trim().length < 3) {
    throw new ApiError({ status: 422, code: 'validation_error', message: 'Add a reason for approval.' });
  }
  const reward = await getPrisma().reward.findUnique({ where: { id: rewardId } });
  if (!reward) throw new ApiError({ status: 404, code: 'not_found', message: 'Reward not found.' });
  if (reward.status !== 'PENDING') {
    throw new ApiError({ status: 409, code: 'invalid_transition', message: 'Only a pending reward can be approved.' });
  }

  const approved = await getPrisma().reward.update({
    where: { id: rewardId },
    data: {
      status: 'APPROVED',
      approvedById: actor.id,
      approvedAt: new Date(),
      reason: reason.trim(),
    },
  });
  await audit(actor, 'reward.approved', rewardId, `Approved reward ${reward.id}`, {
    reason: reason.trim(),
    amountCents: reward.amountCents,
  });
  return approved;
}

export async function markRewardPaid(
  actor: { id: string; email: string },
  rewardId: string,
  input: { reference: string; method: string; proofUrl?: string | null },
) {
  const reference = input.reference.trim();
  if (reference.length < 3) {
    throw new ApiError({ status: 422, code: 'validation_error', message: 'Add a payout reference.' });
  }
  const reward = await getPrisma().reward.findUnique({ where: { id: rewardId } });
  if (!reward) throw new ApiError({ status: 404, code: 'not_found', message: 'Reward not found.' });
  if (reward.status !== 'APPROVED' && reward.status !== 'PAYABLE') {
    throw new ApiError({
      status: 409,
      code: 'invalid_transition',
      message: 'Only an approved or payable reward can be paid.',
    });
  }
  if (reward.payoutReference) {
    throw new ApiError({ status: 409, code: 'already_paid', message: 'This reward already has a payout.' });
  }

  try {
    const paid = await getPrisma().reward.update({
      where: { id: rewardId },
      data: {
        status: 'PAID',
        payoutReference: reference,
        payoutMethod: input.method.trim() || 'manual',
        proofUrl: input.proofUrl?.trim() || null,
        paidAt: new Date(),
      },
    });
    await audit(actor, 'reward.paid', rewardId, `Recorded payout for reward ${reward.id}`, {
      reference,
      method: paid.payoutMethod,
      amountCents: reward.amountCents,
    });
    return paid;
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') {
      throw new ApiError({
        status: 409,
        code: 'duplicate_reference',
        message: 'That payout reference was already used.',
      });
    }
    throw error;
  }
}

export async function voidReward(
  actor: { id: string; email: string },
  rewardId: string,
  reason: string,
) {
  if (reason.trim().length < 3) {
    throw new ApiError({ status: 422, code: 'validation_error', message: 'Add a reason for voiding.' });
  }
  const reward = await getPrisma().reward.findUnique({ where: { id: rewardId } });
  if (!reward) throw new ApiError({ status: 404, code: 'not_found', message: 'Reward not found.' });
  if (reward.status === 'PAID') {
    throw new ApiError({ status: 409, code: 'invalid_transition', message: 'Paid rewards cannot be voided.' });
  }

  const voided = await getPrisma().reward.update({
    where: { id: rewardId },
    data: { status: 'VOID', voidReason: reason.trim() },
  });
  await audit(actor, 'reward.voided', rewardId, `Voided reward ${reward.id}`, {
    reason: reason.trim(),
  });
  return voided;
}

export async function listRewards() {
  return getPrisma().reward.findMany({
    orderBy: [{ competitionId: 'asc' }, { rank: 'asc' }],
    include: {
      competition: { select: { title: true, slug: true, status: true, prizePoolCents: true, currency: true } },
      recipient: { select: { username: true, displayName: true } },
    },
  });
}

export async function rewardReconciliation(competitionId: string) {
  const competition = await getPrisma().competition.findUnique({
    where: { id: competitionId },
    include: { prizes: true, rewards: true },
  });
  if (!competition) throw new ApiError({ status: 404, code: 'not_found', message: 'Competition not found.' });
  const prizeTotal = competition.prizes.reduce((sum, prize) => sum + prize.amountCents, 0);
  const rewardTotal = competition.rewards.reduce((sum, reward) => sum + reward.amountCents, 0);
  return { prizeTotal, rewardTotal, matches: prizeTotal === rewardTotal };
}
