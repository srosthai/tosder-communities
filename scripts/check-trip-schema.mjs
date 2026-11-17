import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const stamp = Date.now();
const userId = `trip-schema-user-${stamp}`;
const username = `trip-schema-${stamp}`;
const slug = `trip-schema-${stamp}`;
const problems = [];

async function expectFailure(label, operation) {
  try {
    await operation();
    problems.push(`${label}: expected the database to reject this operation.`);
  } catch {
    // Expected.
  }
}

let templateId;
let versionId;
let tripId;

try {
  await prisma.memberProfile.create({
    data: { userId, username, displayName: 'Trip Schema Check', trustedCreator: true },
  });

  const template = await prisma.travelTemplate.create({
    data: {
      creatorId: userId,
      title: 'Trip schema template',
      slug,
      summary: 'Fixture',
      durationDays: 1,
      status: 'DRAFT',
    },
  });
  templateId = template.id;

  const version = await prisma.templateVersion.create({
    data: {
      templateId,
      versionNumber: 1,
      createdById: userId,
      snapshot: { template: { title: template.title }, days: [] },
      contentHash: `trip-schema-${stamp}`,
    },
  });
  versionId = version.id;

  const trip = await prisma.userTrip.create({
    data: {
      ownerId: userId,
      title: 'Trip schema check',
      status: 'PLANNED',
      startDate: new Date('2026-12-01T00:00:00.000Z'),
      endDate: new Date('2026-12-03T00:00:00.000Z'),
      sourceTemplateId: templateId,
      sourceTemplateVersionId: versionId,
      copyKey: `trip-schema-key-${stamp}`,
    },
  });
  tripId = trip.id;

  const day = await prisma.userTripDay.create({
    data: { tripId, dayNumber: 1, title: 'Day 1' },
  });

  await prisma.userTripItem.create({
    data: {
      dayId: day.id,
      title: 'Morning',
      startTime: '09:00',
      endTime: '10:00',
      sortOrder: 0,
    },
  });

  await expectFailure('duplicate day number', () =>
    prisma.userTripDay.create({ data: { tripId, dayNumber: 1 } }),
  );

  await expectFailure('duplicate item order', () =>
    prisma.userTripItem.create({ data: { dayId: day.id, title: 'Duplicate', sortOrder: 0 } }),
  );

  await expectFailure('end time before start', () =>
    prisma.userTripItem.create({
      data: {
        dayId: day.id,
        title: 'Bad time',
        startTime: '12:00',
        endTime: '09:00',
        sortOrder: 1,
      },
    }),
  );

  await expectFailure('end date before start date', () =>
    prisma.userTrip.create({
      data: {
        ownerId: userId,
        title: 'Bad dates',
        startDate: new Date('2026-12-05T00:00:00.000Z'),
        endDate: new Date('2026-12-01T00:00:00.000Z'),
      },
    }),
  );

  await expectFailure('owner reassignment', () =>
    prisma.userTrip.update({ where: { id: tripId }, data: { ownerId: 'someone-else' } }),
  );

  await expectFailure('source version mutation', () =>
    prisma.userTrip.update({ where: { id: tripId }, data: { sourceTemplateVersionId: null } }),
  );

  await expectFailure('delete template with attributed trip', () =>
    prisma.travelTemplate.delete({ where: { id: templateId } }),
  );

  await prisma.userTrip.create({
    data: {
      ownerId: userId,
      title: 'Trip without source',
      status: 'DRAFT',
    },
  });

  await expectFailure('duplicate copy key for one owner', () =>
    prisma.userTrip.create({
      data: {
        ownerId: userId,
        title: 'Duplicate key',
        copyKey: `trip-schema-key-${stamp}`,
      },
    }),
  );
} finally {
  if (tripId) await prisma.userTrip.delete({ where: { id: tripId } });
  if (templateId) {
    await prisma.travelTemplate.update({
      where: { id: templateId },
      data: { publishedVersionId: null },
    });
    await prisma.travelTemplate.delete({ where: { id: templateId } });
  }
  await prisma.memberProfile.deleteMany({ where: { userId } });
  await prisma.$disconnect();
}

if (problems.length > 0) {
  console.error('Trip schema checks failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log('Trip schema checks passed');
}
