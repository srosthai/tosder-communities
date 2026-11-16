import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const [provinces, destinations, published, photos, collections] = await Promise.all([
    prisma.province.count(),
    prisma.destination.count(),
    prisma.destination.count({ where: { status: 'PUBLISHED' } }),
    prisma.destinationPhoto.count(),
    prisma.featuredCollection.count(),
  ]);

  const located = await prisma.$queryRaw`
    SELECT count(*)::int AS count
    FROM destinations
    WHERE location IS NOT NULL
  `;

  const nearby = await prisma.$queryRaw`
    SELECT
      name,
      slug,
      ROUND(ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(104.181, 10.61), 4326)::geography
      ))::int AS distance_m
    FROM destinations
    WHERE status = 'PUBLISHED'
      AND location IS NOT NULL
      AND ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(104.181, 10.61), 4326)::geography,
        50000
      )
    ORDER BY distance_m ASC
    LIMIT 5
  `;

  const byCategory = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      name: true,
      slug: true,
      _count: { select: { destinations: true } },
    },
  });

  const missingAlt = await prisma.destinationPhoto.count({ where: { alt: '' } });

  console.log('Geography check');
  console.log({
    provinces,
    destinations,
    published,
    photos,
    collections,
    located: located[0]?.count ?? 0,
    missingAlt,
  });
  console.log('Nearby Kampot:', nearby);
  console.log(
    'Categories:',
    byCategory.map((category) => `${category.name} (${category._count.destinations})`).join(', '),
  );

  const failures = [];
  if (provinces === 0) failures.push('no provinces');
  if (published === 0) failures.push('no published destinations');
  if ((located[0]?.count ?? 0) === 0) failures.push('no PostGIS locations');
  if (nearby.length === 0) failures.push('nearby query returned no destinations');
  if (missingAlt > 0) failures.push('photos missing alt text');

  if (failures.length > 0) {
    console.error('Geography check failed:', failures.join('; '));
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
