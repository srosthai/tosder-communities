import { expect, test } from '@playwright/test';

test.describe.serial('destinations API', () => {
  test('returns a paginated destination list with request metadata', async ({ request }) => {
    const response = await request.get('/api/destinations');
    expect(response.status()).toBe(200);
    expect(response.headers()['x-request-id']).toMatch(/^req_/);
    expect(response.headers()['x-ratelimit-limit']).toBe('120');
    expect(Number(response.headers()['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);

    const body = await response.json();
    expect(body.meta).toMatchObject({
      total: 10,
      page: 1,
      pageSize: 6,
      totalPages: 2,
    });
    expect(body.data).toHaveLength(6);
    expect(body.data[0]).toMatchObject({
      name: 'Angkor Wat',
      province: 'Siem Reap',
      latitude: 13.4125,
      longitude: 103.867,
    });
  });

  test('validates filters and returns a structured error', async ({ request }) => {
    const response = await request.get('/api/destinations?sort=not-a-sort&page=0');
    expect(response.status()).toBe(422);

    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.requestId).toMatch(/^req_/);
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'sort' }),
        expect.objectContaining({ path: 'page' }),
      ]),
    );
  });

  test('filters by query and province', async ({ request }) => {
    const search = await request.get('/api/destinations?q=Angkor');
    expect(search.status()).toBe(200);
    expect((await search.json()).meta.total).toBe(2);

    const province = await request.get('/api/destinations?province=kampot');
    expect(province.status()).toBe(200);
    expect((await province.json()).meta.total).toBe(2);
  });

  test('returns a destination detail or a clean 404', async ({ request }) => {
    const detail = await request.get('/api/destinations/angkor-wat');
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.data.name).toBe('Angkor Wat');
    expect(body.data.tags).toContain('Sunrise');

    const missing = await request.get('/api/destinations/not-a-real-place');
    expect(missing.status()).toBe(404);
    const missingBody = await missing.json();
    expect(missingBody.error.code).toBe('not_found');
    expect(missingBody.error.requestId).toMatch(/^req_/);
  });

  test('rate limits repeated requests with a retry header', async ({ request }) => {
    const headers = { 'x-forwarded-for': '203.0.113.250' };
    const first = await request.get('/api/destinations', { headers });
    const remaining = Number(first.headers()['x-ratelimit-remaining']);

    const responses = await Promise.all(
      Array.from({ length: remaining + 1 }, () =>
        request.get('/api/destinations', { headers }),
      ),
    );
    const limitedResponse = responses.find((response) => response.status() === 429) ?? null;

    expect(limitedResponse).not.toBeNull();
    expect(limitedResponse?.headers()['retry-after']).toMatch(/^\d+$/);

    const body = await limitedResponse!.json();
    expect(body.error.code).toBe('rate_limited');
    expect(body.error.requestId).toMatch(/^req_/);
  });
});
