import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const MIN_PROVINCES = 8;
const MIN_DESTINATIONS = 40;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const cambodiaBounds = { minLat: 9.5, maxLat: 15.0, minLon: 102.0, maxLon: 108.0 };

const provinces = await prisma.province.findMany({
  where: { status: 'PUBLISHED' },
  select: { name: true },
});

const destinations = await prisma.destination.findMany({
  where: { status: 'PUBLISHED' },
  select: {
    name: true,
    slug: true,
    summary: true,
    description: true,
    practicalTips: true,
    latitude: true,
    longitude: true,
    province: { select: { name: true } },
    photos: { select: { url: true, alt: true, credit: true } },
  },
});

const problems = [];

if (provinces.length < MIN_PROVINCES) {
  problems.push(`Only ${provinces.length} published provinces; need at least ${MIN_PROVINCES}.`);
}

if (destinations.length < MIN_DESTINATIONS) {
  problems.push(
    `Only ${destinations.length} published destinations; need at least ${MIN_DESTINATIONS}.`,
  );
}

for (const destination of destinations) {
  const label = destination.slug || destination.name;

  if (!slugPattern.test(destination.slug)) problems.push(`${label}: slug is not URL-safe.`);
  if (!destination.province?.name) problems.push(`${label}: province is missing.`);
  if (!destination.summary?.trim()) problems.push(`${label}: summary is missing.`);
  if (!destination.description?.trim()) problems.push(`${label}: description is missing.`);
  if (!destination.practicalTips?.trim()) problems.push(`${label}: practical tips are missing.`);
  if (destination.latitude == null || destination.longitude == null) {
    problems.push(`${label}: coordinates are missing.`);
  } else if (
    destination.latitude < cambodiaBounds.minLat ||
    destination.latitude > cambodiaBounds.maxLat ||
    destination.longitude < cambodiaBounds.minLon ||
    destination.longitude > cambodiaBounds.maxLon
  ) {
    problems.push(
      `${label}: coordinates (${destination.latitude}, ${destination.longitude}) fall outside Cambodia.`,
    );
  }
  if (destination.photos.length === 0) {
    problems.push(`${label}: at least one photo is required.`);
  }
  for (const [index, photo] of destination.photos.entries()) {
    if (!photo.url?.trim()) problems.push(`${label}: photo ${index + 1} has no URL.`);
    if (!photo.alt?.trim()) problems.push(`${label}: photo ${index + 1} has no alt text.`);
    if (!photo.credit?.trim()) problems.push(`${label}: photo ${index + 1} has no rights note.`);
  }
}

if (problems.length > 0) {
  console.error('Content checks failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log('Content checks passed');
}

const placeholderPhotos = destinations.reduce(
  (total, destination) =>
    total + destination.photos.filter((photo) => photo.url.includes('placeholder')).length,
  0,
);
const byProvince = destinations.reduce((counts, destination) => {
  counts[destination.province.name] = (counts[destination.province.name] ?? 0) + 1;
  return counts;
}, {});

console.log({
  provinces: provinces.length,
  destinations: destinations.length,
  withCoordinates: destinations.filter(
    (destination) => destination.latitude != null && destination.longitude != null,
  ).length,
  photos: destinations.reduce((total, destination) => total + destination.photos.length, 0),
  placeholderPhotos,
  byProvince,
});

if (placeholderPhotos > 0) {
  console.warn(
    `${placeholderPhotos} photo placeholders remain. Replace them with licensed photography before public launch.`,
  );
}

await prisma.$disconnect();
