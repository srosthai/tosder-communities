import type { APIRoute } from 'astro';
import { getPrisma } from '../db/prisma';
import { requestOrigin } from '../lib/request-origin';

const staticPaths = ['/', '/explore', '/templates', '/leaderboard'];

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });

export const GET: APIRoute = async (context) => {
  const origin = requestOrigin(context);
  const urls: Array<{ loc: string; lastmod?: string; priority: string }> = staticPaths.map(
    (path) => ({
      loc: new URL(path, origin).toString(),
      priority: path === '/' ? '1.0' : '0.8',
    }),
  );

  try {
    const destinations = await getPrisma().destination.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
      select: { slug: true, updatedAt: true },
    });

    destinations.forEach((destination) => {
      urls.push({
        loc: new URL(`/destinations/${destination.slug}`, origin).toString(),
        lastmod: destination.updatedAt.toISOString(),
        priority: '0.7',
      });
    });

    const templates = await getPrisma().travelTemplate.findMany({
      where: { status: 'PUBLISHED', publishedVersionId: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: {
        slug: true,
        updatedAt: true,
        creator: { select: { username: true } },
      },
    });

    const creators = new Set<string>();
    templates.forEach((template) => {
      urls.push({
        loc: new URL(`/templates/${template.slug}`, origin).toString(),
        lastmod: template.updatedAt.toISOString(),
        priority: '0.8',
      });
      creators.add(template.creator.username);
    });

    creators.forEach((username) => {
      urls.push({
        loc: new URL(`/creators/${username}`, origin).toString(),
        priority: '0.6',
      });
    });

    const competitions = await getPrisma().competition.findMany({
      where: { status: { in: ['ACTIVE', 'CLOSED', 'FINALIZED'] } },
      orderBy: { startsAt: 'desc' },
      select: { slug: true, updatedAt: true },
    });
    competitions.forEach((competition) => {
      urls.push({
        loc: new URL(`/competitions/${competition.slug}`, origin).toString(),
        lastmod: competition.updatedAt.toISOString(),
        priority: '0.6',
      });
    });
  } catch {
    // Keep the static sitemap available even if the content query fails.
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry) =>
      `  <url><loc>${escapeXml(entry.loc)}</loc>${
        entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ''
      }<changefreq>weekly</changefreq><priority>${entry.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
