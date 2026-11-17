import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const templates = await prisma.travelTemplate.findMany({
  select: { id: true, title: true },
  orderBy: { id: 'asc' },
});

let updated = 0;
for (const template of templates) {
  const qualified = await prisma.usageEvent.count({
    where: { templateId: template.id, status: 'QUALIFIED' },
  });
  await prisma.travelTemplate.update({
    where: { id: template.id },
    data: { qualifiedUseCount: qualified },
  });
  updated += 1;
}

console.log(`Recomputed qualified-use counters for ${updated} templates.`);
await prisma.$disconnect();
