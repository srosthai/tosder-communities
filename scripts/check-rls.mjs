import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const stamp = Date.now();
const userA = `rls-user-a-${stamp}`;
const userB = `rls-user-b-${stamp}`;
const problems = [];

try {
  await prisma.memberProfile.create({
    data: { userId: userA, username: `rls-a-${stamp}`, displayName: 'RLS A' },
  });
  await prisma.memberProfile.create({
    data: { userId: userB, username: `rls-b-${stamp}`, displayName: 'RLS B' },
  });

  const tripA = await prisma.userTrip.create({
    data: { ownerId: userA, title: 'RLS trip A' },
  });
  await prisma.userTrip.create({
    data: { ownerId: userB, title: 'RLS trip B' },
  });
  const dayA = await prisma.userTripDay.create({
    data: { tripId: tripA.id, dayNumber: 1, title: 'Day A' },
  });
  await prisma.userTripItem.create({
    data: { dayId: dayA.id, title: 'Item A', sortOrder: 0 },
  });

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE tosder_app');
    await tx.$queryRawUnsafe("SELECT set_config('app.user_id', $1, true)", userA);

    const trips = await tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM user_trips');
    if (trips[0]?.count !== 1) problems.push(`Expected 1 visible trip, got ${trips[0]?.count}.`);

    const otherTrips = await tx.$queryRawUnsafe(
      'SELECT count(*)::int AS count FROM user_trips WHERE owner_id = $1',
      userB,
    );
    if (otherTrips[0]?.count !== 0) problems.push('Cross-user trip visible through RLS role.');

    const days = await tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM user_trip_days');
    if (days[0]?.count !== 1) problems.push(`Expected 1 visible day, got ${days[0]?.count}.`);

    const items = await tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM user_trip_items');
    if (items[0]?.count !== 1) problems.push(`Expected 1 visible item, got ${items[0]?.count}.`);

    try {
      await tx.$executeRawUnsafe(
        "INSERT INTO user_trips (owner_id, title, updated_at) VALUES ($1, 'RLS bad insert', now())",
        userB,
      );
      problems.push('Cross-user trip insert was not blocked by RLS.');
    } catch {
      // Expected.
    }
  });
} finally {
  await prisma.userTrip.deleteMany({ where: { ownerId: { in: [userA, userB] } } });
  await prisma.memberProfile.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.$disconnect();
}

if (problems.length > 0) {
  console.error('RLS checks failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log('RLS checks passed');
}
