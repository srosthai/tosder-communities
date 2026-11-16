import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const image = '/image/placeholder-destination.svg';

const provinces = [
  { name: 'Siem Reap', slug: 'siem-reap', summary: 'Temples, rice fields, and the Tonle Sap.' },
  { name: 'Kampot', slug: 'kampot', summary: 'A slow river town between the mountains and the sea.' },
  { name: 'Preah Sihanouk', slug: 'preah-sihanouk', summary: 'Islands, beaches, and the Gulf of Thailand.' },
  { name: 'Phnom Penh', slug: 'phnom-penh', summary: 'The capital, the river, and the country’s recent history.' },
  { name: 'Kep', slug: 'kep', summary: 'Crab, pepper, and a quiet coastal road.' },
  { name: 'Kratie', slug: 'kratie', summary: 'The Mekong, river dolphins, and slow afternoons.' },
  { name: 'Preah Vihear', slug: 'preah-vihear', summary: 'A cliff-top temple on the northern border.' },
];

const categories = [
  { name: 'Temple', slug: 'temple', sortOrder: 1 },
  { name: 'Nature', slug: 'nature', sortOrder: 2 },
  { name: 'Food', slug: 'food', sortOrder: 3 },
  { name: 'Island', slug: 'island', sortOrder: 4 },
  { name: 'Culture', slug: 'culture', sortOrder: 5 },
  { name: 'Beach', slug: 'beach', sortOrder: 6 },
  { name: 'Wildlife', slug: 'wildlife', sortOrder: 7 },
];

const tags = [
  { name: 'Sunrise', slug: 'sunrise' },
  { name: 'Slow travel', slug: 'slow-travel' },
  { name: 'Family friendly', slug: 'family-friendly' },
  { name: 'Budget', slug: 'budget' },
  { name: 'Photography', slug: 'photography' },
  { name: 'Coast', slug: 'coast' },
];

const destinations = [
  {
    name: 'Angkor Wat',
    slug: 'angkor-wat',
    province: 'siem-reap',
    summary: 'The largest religious monument in the world, best at first light.',
    description:
      'A vast temple complex and the reason many travelers come to Cambodia. Start before sunrise, walk the outer galleries, and leave the middle of the day for the quieter temples.',
    practicalTips: 'Buy the pass in advance. Dress respectfully. Bring water and a torch for the early start.',
    latitude: 13.4125,
    longitude: 103.867,
    categories: ['temple', 'culture'],
    tags: ['sunrise', 'photography'],
  },
  {
    name: 'Ta Prohm',
    slug: 'ta-prohm',
    province: 'siem-reap',
    summary: 'A temple held by the roots of giant trees.',
    description:
      'Ta Prohm is the most atmospheric stop in the Angkor area. The trees and stone are the draw; go early or late to avoid the largest groups.',
    practicalTips: 'Combine with Angkor Wat in one day. The paths are uneven and not fully shaded.',
    latitude: 13.435,
    longitude: 103.889,
    categories: ['temple'],
    tags: ['photography', 'sunrise'],
  },
  {
    name: 'Kampot riverside',
    slug: 'kampot-riverside',
    province: 'kampot',
    summary: 'A slow riverfront town with pepper farms and mountain views.',
    description:
      'Kampot is a base for pepper farms, the Bokor road, and long dinners by the river. The town itself is best explored on foot or by bicycle.',
    practicalTips: 'Rent a scooter or join a pepper-farm tour. The riverside is quietest before sunset.',
    latitude: 10.61,
    longitude: 104.181,
    categories: ['food', 'nature'],
    tags: ['slow-travel', 'budget'],
  },
  {
    name: 'Bokor Mountain',
    slug: 'bokor-mountain',
    province: 'kampot',
    summary: 'A misty plateau with old buildings and wide coastal views.',
    description:
      'The road up to Bokor is an attraction in itself. The old hill station, the cliffs, and the forest make a half-day loop from Kampot.',
    practicalTips: 'Bring a jacket; the top can be much cooler and wetter than town. Fuel up before the climb.',
    latitude: 10.627,
    longitude: 104.028,
    categories: ['nature'],
    tags: ['photography'],
  },
  {
    name: 'Koh Rong',
    slug: 'koh-rong',
    province: 'preah-sihanouk',
    summary: 'A long boat ride to clear water and slow beach days.',
    description:
      'Koh Rong is the main island escape from Sihanoukville. The beaches are the point; keep plans flexible around the boat schedule.',
    practicalTips: 'Book the return boat before you go. Cash is useful on the island and the ATM can be unreliable.',
    latitude: 10.72,
    longitude: 103.83,
    categories: ['island', 'beach'],
    tags: ['coast', 'slow-travel'],
  },
  {
    name: 'Kep crab market',
    slug: 'kep-crab-market',
    province: 'kep',
    summary: 'Crab, pepper, and a waterfront lunch that runs long.',
    description:
      'The crab market is a practical and delicious stop on the coastal road. Pick a spot by the water, order crab with Kampot pepper, and walk the seafront afterwards.',
    practicalTips: 'Ask the price before ordering. The market is busiest at lunch and on weekends.',
    latitude: 10.482,
    longitude: 104.316,
    categories: ['food'],
    tags: ['budget', 'coast'],
  },
  {
    name: 'Phnom Penh Royal Palace',
    slug: 'phnom-penh-royal-palace',
    province: 'phnom-penh',
    summary: 'The silver pagoda, the palace grounds, and the riverfront.',
    description:
      'A compact introduction to the capital’s royal history, best paired with a walk along the Mekong and a stop at the National Museum.',
    practicalTips: 'Check the opening hours and dress code. Allow two hours and bring water.',
    latitude: 11.564,
    longitude: 104.931,
    categories: ['culture'],
    tags: ['family-friendly'],
  },
  {
    name: 'Kratie river dolphins',
    slug: 'kratie-river-dolphins',
    province: 'kratie',
    summary: 'A Mekong crossing, a quiet riverbank, and the chance of dolphins.',
    description:
      'The Irrawaddy dolphins are the reason to slow down in Kratie. Go with a local boat operator and keep expectations gentle; the river sets the schedule.',
    practicalTips: 'Mornings are usually better. Protect from the sun and keep a quiet distance from the animals.',
    latitude: 12.488,
    longitude: 105.997,
    categories: ['wildlife', 'nature'],
    tags: ['slow-travel', 'family-friendly'],
  },
  {
    name: 'Otres Beach',
    slug: 'otres-beach',
    province: 'preah-sihanouk',
    summary: 'A low-key stretch of sand south of Sihanoukville.',
    description:
      'Otres is a slower alternative to the main beaches, with guesthouses and small restaurants behind the sand. Good for a night or two before the islands.',
    practicalTips: 'The area changes quickly; confirm your booking and transport before arriving.',
    latitude: 10.57,
    longitude: 103.52,
    categories: ['beach'],
    tags: ['coast', 'budget'],
  },
  {
    name: 'Preah Vihear temple',
    slug: 'preah-vihear-temple',
    province: 'preah-vihear',
    summary: 'A cliff-top temple with a long view over the plains.',
    description:
      'Preah Vihear sits on the border ridge and rewards the journey with a dramatic setting. It is a long day from Siem Reap; plan transport carefully.',
    practicalTips: 'Check access and security conditions before traveling. Bring water; shade is limited on the ridge.',
    latitude: 14.39,
    longitude: 104.68,
    categories: ['temple', 'culture'],
    tags: ['sunrise', 'photography'],
  },
];

async function main() {
  const provinceIds = new Map();
  for (const province of provinces) {
    const record = await prisma.province.upsert({
      where: { slug: province.slug },
      update: { ...province, status: 'PUBLISHED', sortOrder: provinces.indexOf(province) },
      create: { ...province, status: 'PUBLISHED', sortOrder: provinces.indexOf(province) },
    });
    provinceIds.set(province.slug, record.id);
  }

  const categoryIds = new Map();
  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
    categoryIds.set(category.slug, record.id);
  }

  const tagIds = new Map();
  for (const tag of tags) {
    const record = await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: tag,
      create: tag,
    });
    tagIds.set(tag.slug, record.id);
  }

  const destinationIds = new Map();
  for (const [index, destination] of destinations.entries()) {
    const record = await prisma.destination.upsert({
      where: { slug: destination.slug },
      update: {
        name: destination.name,
        summary: destination.summary,
        description: destination.description,
        practicalTips: destination.practicalTips,
        latitude: destination.latitude,
        longitude: destination.longitude,
        status: 'PUBLISHED',
        coverPhotoUrl: image,
        sortOrder: index,
        provinceId: provinceIds.get(destination.province),
      },
      create: {
        name: destination.name,
        slug: destination.slug,
        summary: destination.summary,
        description: destination.description,
        practicalTips: destination.practicalTips,
        latitude: destination.latitude,
        longitude: destination.longitude,
        status: 'PUBLISHED',
        coverPhotoUrl: image,
        sortOrder: index,
        provinceId: provinceIds.get(destination.province),
      },
    });

    destinationIds.set(destination.slug, record.id);

    await prisma.destinationCategory.deleteMany({ where: { destinationId: record.id } });
    await prisma.destinationCategory.createMany({
      data: destination.categories.map((slug) => ({
        destinationId: record.id,
        categoryId: categoryIds.get(slug),
      })),
      skipDuplicates: true,
    });

    await prisma.destinationTag.deleteMany({ where: { destinationId: record.id } });
    await prisma.destinationTag.createMany({
      data: destination.tags.map((slug) => ({
        destinationId: record.id,
        tagId: tagIds.get(slug),
      })),
      skipDuplicates: true,
    });

    await prisma.destinationPhoto.deleteMany({ where: { destinationId: record.id } });
    await prisma.destinationPhoto.create({
      data: {
        destinationId: record.id,
        url: image,
        alt: `${destination.name} landscape placeholder`,
        credit: 'Tosder editorial placeholder',
        sortOrder: 0,
      },
    });
  }

  const collections = [
    {
      title: 'Temples and quiet roads',
      slug: 'temples-and-quiet-roads',
      description: 'A first route through Angkor and the countryside around Siem Reap.',
      destinations: ['angkor-wat', 'ta-prohm', 'kampot-riverside'],
    },
    {
      title: 'Coast and islands',
      slug: 'coast-and-islands',
      description: 'Beach days, seafood, and the slow boat out to Koh Rong.',
      destinations: ['koh-rong', 'kep-crab-market', 'otres-beach'],
    },
  ];

  for (const [index, collection] of collections.entries()) {
    const record = await prisma.featuredCollection.upsert({
      where: { slug: collection.slug },
      update: {
        title: collection.title,
        description: collection.description,
        status: 'PUBLISHED',
        sortOrder: index,
      },
      create: {
        title: collection.title,
        slug: collection.slug,
        description: collection.description,
        status: 'PUBLISHED',
        sortOrder: index,
      },
    });

    await prisma.featuredCollectionItem.deleteMany({ where: { collectionId: record.id } });
    await prisma.featuredCollectionItem.createMany({
      data: collection.destinations.map((slug, itemIndex) => ({
        collectionId: record.id,
        destinationId: destinationIds.get(slug),
        sortOrder: itemIndex,
      })),
      skipDuplicates: true,
    });
  }

  const [provinceCount, destinationCount, photoCount, collectionCount] = await Promise.all([
    prisma.province.count(),
    prisma.destination.count(),
    prisma.destinationPhoto.count(),
    prisma.featuredCollection.count(),
  ]);

  const located = await prisma.$queryRaw`
    SELECT count(*)::int AS count
    FROM destinations
    WHERE location IS NOT NULL
  `;

  console.log('Geography seed complete');
  console.log({ provinceCount, destinationCount, photoCount, collectionCount, located: located[0]?.count });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
