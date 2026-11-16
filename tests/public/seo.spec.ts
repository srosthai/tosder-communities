import { expect, test } from '@playwright/test';

test.describe('seo', () => {
  test('home exposes canonical, social metadata, and WebSite JSON-LD', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://127.0.0.1:4321/',
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      /Tosder Communities/,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /\/image\/og-default\.png$/,
    );

    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').first().textContent()) ?? '{}',
    );
    expect(jsonLd['@type']).toBe('WebSite');
    expect(jsonLd.name).toBe('Tosder Communities');
    expect(jsonLd.potentialAction.target).toContain('/explore?q=');
  });

  test('destination detail exposes article and TouristAttraction metadata', async ({ page }) => {
    await page.goto('/destinations/angkor-wat');

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://127.0.0.1:4321/destinations/angkor-wat',
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      /Angkor Wat/,
    );

    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').first().textContent()) ?? '{}',
    );
    expect(jsonLd['@type']).toBe('TouristAttraction');
    expect(jsonLd.name).toBe('Angkor Wat');
    expect(jsonLd.address.addressCountry).toBe('KH');
    expect(jsonLd.geo.latitude).toBeCloseTo(13.4125, 3);
  });

  test('filtered explore pages are noindexed with a clean canonical', async ({ page }) => {
    await page.goto('/explore?q=Angkor&province=siem-reap');

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://127.0.0.1:4321/explore',
    );
  });

  test('sitemap and robots expose only public content', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain('/destinations/angkor-wat');
    expect(xml).toContain('/explore');
    expect(xml).not.toContain('/admin');

    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    const text = await robots.text();
    expect(text).toContain('Disallow: /admin');
    expect(text).toContain('Sitemap: http://127.0.0.1:4321/sitemap.xml');
  });
});
