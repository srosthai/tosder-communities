import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { getPrisma } from '../db/prisma';

function deletedUsername(userId: string): string {
  const hash = createHash('sha256').update(userId).digest('hex').slice(0, 12);
  return `deleted-${hash}`;
}

export async function exportAccountData(userId: string) {
  const prisma = getPrisma();
  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: {
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      socialLinks: true,
      role: true,
      trustedCreator: true,
      createdAt: true,
      updatedAt: true,
      templates: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          status: true,
          durationDays: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      trips: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          status: true,
          startDate: true,
          endDate: true,
          timezone: true,
          notes: true,
          sourceTemplateTitle: true,
          sourceVersionNumber: true,
          copiedAt: true,
          createdAt: true,
          updatedAt: true,
          days: {
            orderBy: { dayNumber: 'asc' },
            select: {
              dayNumber: true,
              date: true,
              title: true,
              summary: true,
              items: {
                orderBy: { sortOrder: 'asc' },
                select: {
                  title: true,
                  notes: true,
                  startTime: true,
                  endTime: true,
                  durationMinutes: true,
                  sortOrder: true,
                },
              },
            },
          },
          checklist: {
            orderBy: { sortOrder: 'asc' },
            select: { label: true, done: true, sortOrder: true },
          },
        },
      },
      savedTemplates: {
        orderBy: { createdAt: 'asc' },
        select: {
          createdAt: true,
          template: { select: { title: true, slug: true } },
        },
      },
      savedDestinations: {
        orderBy: { createdAt: 'asc' },
        select: {
          createdAt: true,
          destination: { select: { name: true, slug: true } },
        },
      },
      likes: {
        orderBy: { createdAt: 'asc' },
        select: {
          createdAt: true,
          template: { select: { title: true, slug: true } },
        },
      },
      reviews: {
        orderBy: { createdAt: 'asc' },
        select: {
          rating: true,
          body: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          template: { select: { title: true, slug: true } },
        },
      },
      notifications: {
        orderBy: { createdAt: 'asc' },
        select: { title: true, body: true, link: true, readAt: true, createdAt: true },
      },
      usageEvents: {
        orderBy: { createdAt: 'asc' },
        select: {
          status: true,
          periodKey: true,
          qualifiedAt: true,
          decisionReason: true,
          createdAt: true,
          template: { select: { title: true, slug: true } },
        },
      },
      rewards: {
        orderBy: { createdAt: 'asc' },
        select: {
          rank: true,
          amountCents: true,
          currency: true,
          status: true,
          payoutReference: true,
          paidAt: true,
          createdAt: true,
          competition: { select: { title: true, slug: true } },
        },
      },
    },
  });

  if (!profile) return null;

  return {
    exportedAt: new Date().toISOString(),
    account: {
      userId,
      ...profile,
    },
  };
}

export async function deleteAccount(userId: string) {
  const prisma = getPrisma();
  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { username: true, deletedAt: true },
  });
  if (!profile || profile.deletedAt) return { deleted: false };

  const username = deletedUsername(userId);
  const taken = await prisma.memberProfile.findUnique({ where: { username } });

  return prisma.$transaction(async (tx) => {
    const templates = await tx.travelTemplate.updateMany({
      where: { creatorId: userId },
      data: { status: 'ARCHIVED' },
    });
    const trips = await tx.userTrip.deleteMany({ where: { ownerId: userId } });

    await tx.tripReview.deleteMany({ where: { reviewerId: userId } });
    await tx.savedTemplate.deleteMany({ where: { userId } });
    await tx.savedDestination.deleteMany({ where: { userId } });
    await tx.templateLike.deleteMany({ where: { userId } });
    await tx.memberNotification.deleteMany({ where: { userId } });
    await tx.report.deleteMany({ where: { reporterId: userId } });

    await tx.memberProfile.update({
      where: { userId },
      data: {
        username: taken && taken.userId !== userId ? `${username}-${randomUUID().slice(0, 4)}` : username,
        displayName: 'Deleted member',
        bio: null,
        avatarUrl: null,
        socialLinks: Prisma.DbNull,
        trustedCreator: false,
        role: 'MEMBER',
        suspendedAt: new Date(),
        deletedAt: new Date(),
      },
    });

    await tx.auditEvent.create({
      data: {
        actorId: userId,
        actorEmail: 'deleted-account',
        action: 'account.deleted',
        entityType: 'member',
        entityId: userId,
        summary: `Deleted account @${profile.username}`,
        metadata: {
          templatesArchived: templates.count,
          tripsDeleted: trips.count,
          retained: ['usage ledger', 'rewards', 'audit events'],
        },
      },
    });

    return { deleted: true };
  });
}
