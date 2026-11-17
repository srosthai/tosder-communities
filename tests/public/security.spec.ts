import { expect, test } from '@playwright/test';

test.describe('security', () => {
  test('sets baseline security headers', async ({ request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-request-id']).toMatch(/^req_/);
  });

  test('blocks cross-site mutations but allows same-origin API calls', async ({ request }) => {
    const blocked = await request.post('/api/todos', {
      headers: { origin: 'https://evil.example' },
      data: { name: 'Cross-site' },
    });
    expect(blocked.status()).toBe(403);

    const sameOrigin = await request.post('/api/todos', {
      headers: { origin: 'http://127.0.0.1:4323' },
      data: {},
    });
    expect(sameOrigin.status()).not.toBe(403);
  });
});
