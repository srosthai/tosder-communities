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
  { name: 'Battambang', slug: 'battambang', summary: 'Rice fields, colonial streets, and the Sangker River.' },
  { name: 'Mondulkiri', slug: 'mondulkiri', summary: 'Rolling hills, pine forest, and Bunong communities.' },
  { name: 'Ratanakiri', slug: 'ratanakiri', summary: 'Crater lakes, red earth, and the highlands near Vietnam.' },
  { name: 'Kampong Thom', slug: 'kampong-thom', summary: 'Pre-Angkor temples and the quiet Stung Sen river.' },
  { name: 'Kampong Cham', slug: 'kampong-cham', summary: 'Mekong towns, old temples, and river crossings.' },
  { name: 'Koh Kong', slug: 'koh-kong', summary: 'Mangroves, rainforest, and the Gulf of Thailand.' },
];

const categories = [
  { name: 'Temple', slug: 'temple', sortOrder: 1 },
  { name: 'Nature', slug: 'nature', sortOrder: 2 },
  { name: 'Food', slug: 'food', sortOrder: 3 },
  { name: 'Island', slug: 'island', sortOrder: 4 },
  { name: 'Culture', slug: 'culture', sortOrder: 5 },
  { name: 'Beach', slug: 'beach', sortOrder: 6 },
  { name: 'Wildlife', slug: 'wildlife', sortOrder: 7 },
  { name: 'History', slug: 'history', sortOrder: 8 },
  { name: 'Adventure', slug: 'adventure', sortOrder: 9 },
  { name: 'Market', slug: 'market', sortOrder: 10 },
  { name: 'Town', slug: 'town', sortOrder: 11 },
];

const tags = [
  { name: 'Sunrise', slug: 'sunrise' },
  { name: 'Slow travel', slug: 'slow-travel' },
  { name: 'Family friendly', slug: 'family-friendly' },
  { name: 'Budget', slug: 'budget' },
  { name: 'Photography', slug: 'photography' },
  { name: 'Coast', slug: 'coast' },
  { name: 'Sunset', slug: 'sunset' },
  { name: 'Waterfall', slug: 'waterfall' },
  { name: 'River', slug: 'river' },
  { name: 'Trekking', slug: 'trekking' },
  { name: 'Responsible travel', slug: 'responsible-travel' },
  { name: 'Street food', slug: 'street-food' },
  { name: 'Island escape', slug: 'island-escape' },
  { name: 'UNESCO', slug: 'unesco' },
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
  {
    name: 'Battambang bamboo train',
    slug: 'battambang-bamboo-train',
    province: 'battambang',
    summary: 'A short ride on a makeshift rail line through the rice fields.',
    description:
      'The bamboo train is a simple, improvised ride on a narrow-gauge line outside town. It is as much a social ritual as a transport story; expect a bumpy, brief trip and a stop to let another cart pass.',
    practicalTips: 'Agree the price and duration before boarding. Combine with nearby countryside stops.',
    latitude: 13.0965,
    longitude: 103.203,
    categories: ['culture', 'adventure'],
    tags: ['family-friendly', 'photography'],
  },
  {
    name: 'Phnom Sampeau',
    slug: 'phnom-sampeau',
    province: 'battambang',
    summary: 'A hilltop temple, cave shrines, and a bat cave at dusk.',
    description:
      'Phnom Sampeau rises above the plains west of Battambang. The summit has temple buildings and long views; the caves below hold memorials and a nightly bat emergence.',
    practicalTips: 'The climb is steep and hot. Go late in the day and keep a quiet, respectful manner at the memorial sites.',
    latitude: 13.087,
    longitude: 103.104,
    categories: ['temple', 'nature'],
    tags: ['sunset', 'photography'],
  },
  {
    name: 'Wat Banan',
    slug: 'wat-banan',
    province: 'battambang',
    summary: 'A hilltop temple with a wide staircase and rice-field views.',
    description:
      'Wat Banan is a compact temple on a steep hill, reached by a long stairway. The setting is the draw: dry-season rice fields, sugar palms, and a quiet rural landscape.',
    practicalTips: 'Start early for shade and cooler air. The steps are uneven; wear shoes with grip.',
    latitude: 13.073,
    longitude: 103.086,
    categories: ['temple'],
    tags: ['sunrise', 'photography'],
  },
  {
    name: 'Phare Ponleu Selpak',
    slug: 'phare-ponleu-selpak',
    province: 'battambang',
    summary: 'A circus and arts school supporting young Cambodian performers.',
    description:
      'Phare is a community arts organization with a circus school and regular performances. It is a good evening stop in Battambang and a way to support local training.',
    practicalTips: 'Check the performance schedule and book ahead in high season. Arrive early for the courtyard.',
    latitude: 13.095,
    longitude: 103.209,
    categories: ['culture'],
    tags: ['family-friendly', 'responsible-travel'],
  },
  {
    name: 'Bou Sra waterfall',
    slug: 'bou-sra-waterfall',
    province: 'mondulkiri',
    summary: 'A two-tier waterfall in the Mondulkiri hills.',
    description:
      'Bou Sra is one of the best-known waterfalls in the highlands. The upper and lower falls are connected by a steep path and are most dramatic after the rainy season.',
    practicalTips: 'Paths can be slippery. Check local conditions and use a guide for the lower falls.',
    latitude: 12.566,
    longitude: 107.417,
    categories: ['nature'],
    tags: ['waterfall', 'photography'],
  },
  {
    name: 'Sen Monorom',
    slug: 'sen-monorom',
    province: 'mondulkiri',
    summary: 'The small highland capital of Mondulkiri.',
    description:
      'Sen Monorom is a base for waterfalls, trekking, and Bunong community visits. The town is spread out and cool at night, with a relaxed pace around the market.',
    practicalTips: 'Bring layers for cool evenings. Arrange transport before heading to remote villages or falls.',
    latitude: 12.455,
    longitude: 107.188,
    categories: ['town', 'nature'],
    tags: ['slow-travel', 'budget'],
  },
  {
    name: 'Elephant Valley Project',
    slug: 'elephant-valley-project',
    province: 'mondulkiri',
    summary: 'A sanctuary focused on rescuing and caring for working elephants.',
    description:
      'The project offers visits that prioritize observation and elephant welfare rather than riding. Groups are small and the day is structured around the animals’ routines.',
    practicalTips: 'Book ahead and read the welfare policy. Do not expect elephant rides or close handling.',
    latitude: 12.435,
    longitude: 107.253,
    categories: ['wildlife'],
    tags: ['responsible-travel', 'family-friendly'],
  },
  {
    name: 'Yeak Laom crater lake',
    slug: 'yeak-laom-crater-lake',
    province: 'ratanakiri',
    summary: 'A clear crater lake ringed by forest near Banlung.',
    description:
      'Yeak Laom is a volcanic lake with a walking path around the rim and swimming areas. It is a calm half-day trip and an important site for local communities.',
    practicalTips: 'Swim only in the marked area. Combine with nearby waterfalls and a community guide.',
    latitude: 13.735,
    longitude: 106.995,
    categories: ['nature', 'adventure'],
    tags: ['family-friendly', 'photography'],
  },
  {
    name: 'Banlung',
    slug: 'banlung',
    province: 'ratanakiri',
    summary: 'The red-earth capital of Ratanakiri.',
    description:
      'Banlung is the practical base for the highlands, with a market, guesthouses, and access to crater lakes and national parks. The surrounding landscape is the real attraction.',
    practicalTips: 'Dust and mud are part of the season. Rent a reliable vehicle with a local driver for longer trips.',
    latitude: 13.739,
    longitude: 106.987,
    categories: ['town', 'market'],
    tags: ['budget', 'street-food'],
  },
  {
    name: 'Virachey National Park',
    slug: 'virachey-national-park',
    province: 'ratanakiri',
    summary: 'A vast protected forest with remote trekking routes.',
    description:
      'Virachey is one of Cambodia’s largest protected areas, covering forested hills near the Laos and Vietnam borders. Visits require planning, permits, and local guides.',
    practicalTips: 'Arrange permits and guides in advance. Do not trek alone; conditions change with the season.',
    latitude: 13.95,
    longitude: 106.9,
    categories: ['nature', 'adventure'],
    tags: ['trekking', 'responsible-travel'],
  },
  {
    name: 'Sambor Prei Kuk',
    slug: 'sambor-prei-kuk',
    province: 'kampong-thom',
    summary: 'Early Khmer brick temples in a shaded forest.',
    description:
      'Sambor Prei Kuk is an early Khmer temple complex with brick towers and laterite walls spread through the trees. It is quieter than the Siem Reap temples and rewarding to explore slowly.',
    practicalTips: 'Bring insect repellent and water. The site is spread out; allow at least half a day.',
    latitude: 12.867,
    longitude: 105.043,
    categories: ['temple', 'history'],
    tags: ['unesco', 'photography'],
  },
  {
    name: 'Phnom Santuk',
    slug: 'phnom-santuk',
    province: 'kampong-thom',
    summary: 'A pilgrimage hill with a long staircase and small shrines.',
    description:
      'Phnom Santuk is a local pilgrimage site with a covered stairway, Buddha statues, and views over the countryside. Monkeys and vendors line the route.',
    practicalTips: 'Cover shoulders and knees. Keep food out of sight around the monkeys.',
    latitude: 12.753,
    longitude: 104.95,
    categories: ['temple', 'nature'],
    tags: ['sunrise'],
  },
  {
    name: 'Wat Nokor Bachey',
    slug: 'wat-nokor-bachey',
    province: 'kampong-cham',
    summary: 'An old temple wrapped in a later Buddhist pagoda.',
    description:
      'Wat Nokor is a rare layered site: an ancient temple structure sits inside a modern pagoda complex. The mix of stone, brick, and painted surfaces is unusual and photogenic.',
    practicalTips: 'It is an active religious site; dress respectfully and avoid ceremonies.',
    latitude: 11.992,
    longitude: 105.463,
    categories: ['temple', 'history'],
    tags: ['photography'],
  },
  {
    name: 'Koh Paen',
    slug: 'koh-paen',
    province: 'kampong-cham',
    summary: 'A river island connected by a seasonal bamboo bridge.',
    description:
      'Koh Paen sits in the Mekong near Kampong Cham. In the dry season a bamboo bridge links it to town; the island is quiet, agricultural, and good for a slow bicycle loop.',
    practicalTips: 'Check whether the bridge is up; in the wet season use the ferry. Carry water and sun protection.',
    latitude: 11.98,
    longitude: 105.478,
    categories: ['island', 'culture'],
    tags: ['river', 'slow-travel'],
  },
  {
    name: 'Tatai waterfall',
    slug: 'tatai-waterfall',
    province: 'koh-kong',
    summary: 'A wide jungle waterfall in the Cardamom foothills.',
    description:
      'Tatai is reached by boat or a forest walk and is a good base for kayaking and exploring the surrounding rivers. The falls are broad rather than tall and are dramatic in the wet season.',
    practicalTips: 'Use a local operator for boat transport. Bring dry bags and check river levels.',
    latitude: 11.58,
    longitude: 103.1,
    categories: ['nature', 'adventure'],
    tags: ['waterfall', 'trekking'],
  },
  {
    name: 'Cardamom Mountains',
    slug: 'cardamom-mountains',
    province: 'koh-kong',
    summary: 'Rainforested mountains with rivers, trails, and remote villages.',
    description:
      'The Cardamoms form a large forested range in southwest Cambodia. Access is through gateway towns and guided trips; wildlife is shy, but the rivers and forest scenery are the reward.',
    practicalTips: 'Choose a licensed guide and avoid wildlife tours that promise close encounters. Expect leeches in the wet season.',
    latitude: 12.0,
    longitude: 103.2,
    categories: ['nature', 'adventure'],
    tags: ['trekking', 'responsible-travel'],
  },
  {
    name: 'Koh Ker',
    slug: 'koh-ker',
    province: 'preah-vihear',
    summary: 'A remote temple complex with a seven-tiered pyramid.',
    description:
      'Koh Ker was briefly a royal capital and is now a scattered archaeological site. The main pyramid is the signature image, but the surrounding shrines are worth the extra time.',
    practicalTips: 'The site is exposed; bring water and a hat. Combine with Beng Mealea if you have a full day.',
    latitude: 13.783,
    longitude: 104.537,
    categories: ['temple', 'history'],
    tags: ['unesco', 'photography'],
  },
  {
    name: 'Banteay Srei',
    slug: 'banteay-srei',
    province: 'siem-reap',
    summary: 'A small temple known for its intricate carvings.',
    description:
      'Banteay Srei is built from pink sandstone and covered in fine reliefs. It is smaller than the main temples and best visited early, before the tour groups arrive.',
    practicalTips: 'Go at opening time. The inner sanctuaries are roped off; respect the barriers.',
    latitude: 13.598,
    longitude: 103.963,
    categories: ['temple', 'history'],
    tags: ['unesco', 'photography'],
  },
  {
    name: 'Tonle Sap floating villages',
    slug: 'tonle-sap-floating-villages',
    province: 'siem-reap',
    summary: 'Lake communities that move with the water.',
    description:
      'The floating villages on Tonle Sap rise and fall with the lake. A boat trip shows how homes, schools, and markets adapt to the seasonal flood.',
    practicalTips: 'Choose a community-based operator and avoid trips that treat villages as a spectacle. Ask before photographing people.',
    latitude: 13.2,
    longitude: 103.9,
    categories: ['culture', 'nature'],
    tags: ['river', 'family-friendly'],
  },
  {
    name: 'Phnom Kulen',
    slug: 'phnom-kulen',
    province: 'siem-reap',
    summary: 'A sacred plateau with waterfalls and river carvings.',
    description:
      'Phnom Kulen is a pilgrimage site and the source of the Siem Reap River. The plateau has a large reclining Buddha, riverbed carvings, and a waterfall that is popular with local families.',
    practicalTips: 'Access is usually by a steep road; check conditions. Wear quick-dry clothes for the waterfall.',
    latitude: 13.58,
    longitude: 104.1,
    categories: ['nature', 'temple'],
    tags: ['waterfall', 'trekking'],
  },
  {
    name: 'Siem Reap old market',
    slug: 'siem-reap-old-market',
    province: 'siem-reap',
    summary: 'A dense market for produce, textiles, and souvenirs.',
    description:
      'The old market is the everyday heart of central Siem Reap. Food stalls, spices, textiles, and repair shops sit side by side; it is best explored without a fixed route.',
    practicalTips: 'Agree prices before buying. Keep an eye on bags in the busiest aisles.',
    latitude: 13.354,
    longitude: 103.856,
    categories: ['market', 'food'],
    tags: ['street-food', 'budget'],
  },
  {
    name: 'Beng Mealea',
    slug: 'beng-mealea',
    province: 'siem-reap',
    summary: 'A sprawling temple left largely unrestored.',
    description:
      'Beng Mealea is a large, collapsed temple with trees growing through the stone. Walkways cross the ruins, giving a sense of discovery without scrambling over unstable blocks.',
    practicalTips: 'It is a long drive from Siem Reap; combine with Koh Ker. Bring water and sun protection.',
    latitude: 13.47,
    longitude: 104.23,
    categories: ['temple', 'history'],
    tags: ['photography'],
  },
  {
    name: 'Ream National Park',
    slug: 'ream-national-park',
    province: 'preah-sihanouk',
    summary: 'Coastal forest, mangroves, and quiet beaches near Sihanoukville.',
    description:
      'Ream protects mangrove creeks, forest, and a stretch of coast. Boat trips and short walks are the main ways to explore; the park is a calm counterpoint to the city beaches.',
    practicalTips: 'Arrange a ranger or licensed guide. Bring insect repellent and check tide times.',
    latitude: 10.6,
    longitude: 103.6,
    categories: ['nature', 'wildlife'],
    tags: ['coast', 'family-friendly'],
  },
  {
    name: 'La Plantation pepper farm',
    slug: 'la-plantation-pepper-farm',
    province: 'kampot',
    summary: 'A working Kampot pepper farm with tours and tastings.',
    description:
      'La Plantation grows Kampot pepper and welcomes visitors for guided walks through the fields. The visit explains the crop’s protected status and the difference between pepper varieties.',
    practicalTips: 'Book a tour in advance in high season. The farm is a good stop between Kampot and Kep.',
    latitude: 10.64,
    longitude: 104.15,
    categories: ['food', 'nature'],
    tags: ['responsible-travel', 'photography'],
  },
  {
    name: 'Phnom Chhnork',
    slug: 'phnom-chhnork',
    province: 'kampot',
    summary: 'A cave temple with ancient brickwork inside.',
    description:
      'Phnom Chhnork is a small cave temple reached by a short climb. The brick shrine inside is weathered and atmospheric, with rice fields and limestone hills around.',
    practicalTips: 'The path is uneven and can be slippery. Bring a torch and respect the shrine.',
    latitude: 10.6,
    longitude: 104.13,
    categories: ['temple', 'nature'],
    tags: ['photography'],
  },
  {
    name: 'Tuol Sleng Genocide Museum',
    slug: 'tuol-sleng-genocide-museum',
    province: 'phnom-penh',
    summary: 'A former prison that documents a painful chapter of Cambodian history.',
    description:
      'Tuol Sleng was a security prison during the Khmer Rouge period and is now a museum. The exhibits are direct and emotionally difficult; allow time and visit with a guide if possible.',
    practicalTips: 'Content is distressing. Consider an audio guide and take breaks; be respectful of other visitors.',
    latitude: 11.549,
    longitude: 104.917,
    categories: ['history', 'culture'],
    tags: ['responsible-travel'],
  },
  {
    name: 'Choeung Ek',
    slug: 'choeung-ek',
    province: 'phnom-penh',
    summary: 'A memorial site at the former killing fields.',
    description:
      'Choeung Ek is a memorial and burial site outside Phnom Penh. The audio guide explains the history and the memorial stupa holds remains; the site is quiet and sobering.',
    practicalTips: 'Combine with Tuol Sleng for context. Dress respectfully and avoid loud conversation.',
    latitude: 11.484,
    longitude: 104.902,
    categories: ['history'],
    tags: ['responsible-travel'],
  },
  {
    name: 'Phnom Penh Central Market',
    slug: 'phnom-penh-central-market',
    province: 'phnom-penh',
    summary: 'A landmark market under a large art-deco dome.',
    description:
      'Central Market is a Phnom Penh institution, with jewelry, electronics, food, and household goods arranged under a cross-shaped dome. It is busy, hot, and full of everyday commerce.',
    practicalTips: 'Watch your belongings and agree prices. The food stalls around the edges are a good lunch stop.',
    latitude: 11.569,
    longitude: 104.921,
    categories: ['market', 'food'],
    tags: ['street-food', 'budget'],
  },
  {
    name: 'Wat Phnom',
    slug: 'wat-phnom',
    province: 'phnom-penh',
    summary: 'A hilltop pagoda and the symbolic center of Phnom Penh.',
    description:
      'Wat Phnom sits on the city’s namesake hill, surrounded by gardens and a busy roundabout. The pagoda is an active place of worship and a good introduction to the capital’s history.',
    practicalTips: 'Dress modestly and remove shoes where required. Visit early to avoid the heat.',
    latitude: 11.576,
    longitude: 104.923,
    categories: ['temple', 'culture'],
    tags: ['sunrise'],
  },
  {
    name: 'Koh Trong',
    slug: 'koh-trong',
    province: 'kratie',
    summary: 'A slow river island across from Kratie.',
    description:
      'Koh Trong is a small island in the Mekong, reached by ferry from Kratie. A flat loop road passes orchards, rice fields, and small homestays; bicycles are the best way to explore.',
    practicalTips: 'Take the ferry and arrange a bicycle on the island. Carry water; services are limited.',
    latitude: 12.5,
    longitude: 106.0,
    categories: ['island', 'culture'],
    tags: ['island-escape', 'slow-travel'],
  },
  {
    name: 'Kampi dolphin pool',
    slug: 'kampi-dolphin-pool',
    province: 'kratie',
    summary: 'A quiet stretch of the Mekong known for Irrawaddy dolphins.',
    description:
      'Kampi is one of the best places to look for Irrawaddy dolphins in the Kratie area. Small boats wait at the riverbank and take visitors to the deeper pools where the animals surface.',
    practicalTips: 'Choose a licensed boat and keep a respectful distance. Mornings are usually calmer.',
    latitude: 12.35,
    longitude: 105.95,
    categories: ['wildlife', 'nature'],
    tags: ['river', 'family-friendly'],
  },
  {
    name: 'Koh Tonsay',
    slug: 'koh-tonsay',
    province: 'kep',
    summary: 'A small island of sand and simple bungalows off Kep.',
    description:
      'Koh Tonsay, also called Rabbit Island, is a short boat ride from Kep. The beach is modest but relaxed, with a few places to eat and stay; it is best as a day trip or a quiet overnight.',
    practicalTips: 'Bring cash and sun protection; ATMs are not available. Confirm the return boat time.',
    latitude: 10.45,
    longitude: 104.3,
    categories: ['island', 'beach'],
    tags: ['island-escape', 'budget'],
  },
  {
    name: 'Kep National Park',
    slug: 'kep-national-park',
    province: 'kep',
    summary: 'A green ridge of forest trails above Kep.',
    description:
      'Kep National Park covers the hill behind the town, with walking and cycling trails, viewpoints, and small pagodas. It is a good early-morning escape from the coast road.',
    practicalTips: 'Start early, carry water, and use the marked trails. Some paths are steep and loose.',
    latitude: 10.48,
    longitude: 104.3,
    categories: ['nature', 'wildlife'],
    tags: ['trekking', 'coast'],
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
