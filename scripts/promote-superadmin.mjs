import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

const email = process.env.SUPERADMIN_EMAIL ?? 'srosthai00@gmail.com';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const users = await prisma.$queryRawUnsafe(
    'select id, email from neon_auth."user" where email = $1',
    email,
  );
  const user = users[0];
  if (!user) {
    console.error(`No Neon Auth user exists for ${email}. Sign in with Google first.`);
    process.exitCode = 1;
  } else {
    const profile = await prisma.memberProfile.upsert({
      where: { userId: user.id },
      update: {
        role: 'ADMINISTRATOR',
        trustedCreator: true,
        suspendedAt: null,
        deletedAt: null,
      },
      create: {
        userId: user.id,
        username: email.split('@')[0].replace(/[^a-z0-9-]/gi, '-').slice(0, 24) || 'superadmin',
        displayName: 'Tosder Admin',
        role: 'ADMINISTRATOR',
        trustedCreator: true,
      },
    });
    await prisma.auditEvent.create({
      data: {
        actorId: user.id,
        actorEmail: email,
        action: 'role.bootstrap',
        entityType: 'member',
        entityId: user.id,
        summary: 'Promoted the superadmin account',
        metadata: { role: 'ADMINISTRATOR', trustedCreator: true },
      },
    });
    console.log(`Superadmin: ${email} (${profile.username})`);
  }
} finally {
  await prisma.$disconnect();
}
