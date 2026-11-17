import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const stamp = Date.now();
const username = `schema-check-${stamp}`;
const userId = `schema-check-user-${stamp}`;
const slug = `schema-check-${stamp}`;
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

try {
  await prisma.memberProfile.create({
    data: {
      userId,
      username,
      displayName: 'Schema Check',
    },
  });

  const template = await prisma.travelTemplate.create({
    data: {
      creatorId: userId,
      title: 'Schema check template',
      slug,
      summary: 'Constraint fixture',
      durationDays: 1,
      status: 'DRAFT',
    },
  });
  templateId = template.id;

  const day = await prisma.templateDay.create({
    data: { templateId: template.id, dayNumber: 1, title: 'Arrival' },
  });

  await prisma.templateItem.create({
    data: {
      dayId: day.id,
      title: 'Check in',
      type: 'ACCOMMODATION',
      startTime: '14:00',
      endTime: '15:00',
      sortOrder: 0,
    },
  });

  await expectFailure('duplicate day number', () =>
    prisma.templateDay.create({
      data: { templateId: template.id, dayNumber: 1, title: 'Duplicate day' },
    }),
  );

  await expectFailure('duplicate item order', () =>
    prisma.templateItem.create({
      data: { dayId: day.id, title: 'Duplicate item', sortOrder: 0 },
    }),
  );

  await expectFailure('end time before start time', () =>
    prisma.templateItem.create({
      data: {
        dayId: day.id,
        title: 'Bad time',
        startTime: '18:00',
        endTime: '09:00',
        sortOrder: 1,
      },
    }),
  );

  const version = await prisma.templateVersion.create({
    data: {
      templateId: template.id,
      versionNumber: 1,
      createdById: userId,
      snapshot: {
        title: template.title,
        durationDays: 1,
        days: [{ dayNumber: 1, items: [{ title: 'Check in' }] }],
      },
      validation: { blocking: [], warnings: [] },
    },
  });

  await prisma.travelTemplate.update({
    where: { id: template.id },
    data: {
      status: 'PUBLISHED',
      publishedVersionId: version.id,
      publishedAt: new Date(),
    },
  });

  await expectFailure('immutable published version', () =>
    prisma.templateVersion.update({
      where: { id: version.id },
      data: { changeNote: 'mutated' },
    }),
  );

  await expectFailure('unique template slug', () =>
    prisma.travelTemplate.create({
      data: {
        creatorId: userId,
        title: 'Duplicate slug',
        slug,
        durationDays: 1,
      },
    }),
  );

  await expectFailure('unique username', () =>
    prisma.memberProfile.create({
      data: {
        userId: `${userId}-2`,
        username,
        displayName: 'Duplicate username',
      },
    }),
  );

  const publicRows = await prisma.travelTemplate.findMany({
    where: { status: 'PUBLISHED', publishedVersionId: { not: null } },
    select: { slug: true },
  });

  if (!publicRows.some((row) => row.slug === slug)) {
    problems.push('published template query did not return the fixture.');
  }
} finally {
  if (templateId) {
    await prisma.travelTemplate.update({
      where: { id: templateId },
      data: { publishedVersionId: null },
    });
    await prisma.travelTemplate.delete({ where: { id: templateId } });
  }
  await prisma.memberProfile.deleteMany({ where: { userId: { startsWith: userId } } });
  await prisma.$disconnect();
}

if (problems.length > 0) {
  console.error('Template schema checks failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log('Template schema checks passed');
}
