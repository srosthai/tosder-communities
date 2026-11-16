import { expect, test } from '@playwright/test';

test.describe.serial('mutation idempotency', () => {
  test('replays the original result for the same idempotency key', async ({ request }) => {
    const key = `test-${crypto.randomUUID()}`;
    const name = `Idempotent todo ${Date.now()}`;

    const first = await request.post('/api/todos', {
      headers: { 'idempotency-key': key },
      data: { name },
    });
    expect(first.status()).toBe(201);
    const firstBody = await first.json();

    const second = await request.post('/api/todos', {
      headers: { 'idempotency-key': key },
      data: { name },
    });
    expect(second.status()).toBe(201);
    expect(second.headers()['idempotent-replayed']).toBe('true');
    const secondBody = await second.json();

    expect(secondBody.data.id).toBe(firstBody.data.id);
    expect(secondBody.data.name).toBe(name);
  });

  test('requires an idempotency key', async ({ request }) => {
    const response = await request.post('/api/todos', {
      data: { name: 'No key' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('idempotency_key_required');
  });

  test('validates the mutation body', async ({ request }) => {
    const response = await request.post('/api/todos', {
      headers: { 'idempotency-key': `invalid-${crypto.randomUUID()}` },
      data: { name: '' },
    });
    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.details[0].path).toBe('name');
  });
});
