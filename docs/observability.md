# Observability

The baseline is designed for a single Node process and a clean migration to a
hosted error tracker later.

## Structured logs

`src/lib/logger.ts` emits one JSON object per line:

```json
{
  "timestamp": "2026-11-17T00:00:00.000Z",
  "level": "info",
  "message": "request",
  "service": "tosder-communities",
  "release": "production",
  "requestId": "req_...",
  "method": "GET",
  "path": "/explore",
  "status": 200,
  "durationMs": 42
}
```

- `LOG_LEVEL` controls the threshold (`debug`, `info`, `warn`, `error`).
- `RELEASE` tags deployments.
- Request IDs are returned as `X-Request-Id` and included in API error bodies.
- Do not log passwords, tokens, cookies, full request bodies, or personal data.

## Health

`GET /api/health` reports application, database, and schema status. It returns
`200` when the app and database are healthy and `503` when a configured
dependency fails.

## Error tracking seam

`captureException` in `src/lib/logger.ts` currently writes a structured error
log. When a provider is selected, implement the capture call there and pass the
release/environment tags. Feature code does not import a vendor directly.

## Alerts and rollback

- Alert on health `503`, elevated 5xx rate, and a sustained p95 latency breach.
- Route alerts to the on-call owner in the deployment platform.
- Keep the last known-good container image and database backup reference.
- Roll back the application first; reverse a migration only with a reviewed
  down-migration or restore plan.
- Record incidents and follow-ups in the issue tracker.

## CI

`.github/workflows/ci.yml` runs type checks, build, 60+ Playwright tests, and
Lighthouse budgets on every PR to `dev` and `main`. PostGIS migrations, seed,
and spatial checks run against a real PostGIS service before the test suite.
