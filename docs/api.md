# API conventions

Nitro-style server endpoints live under `src/pages/api`. They are server-only,
validate every input, and return a consistent JSON envelope.

## Success

```json
{
  "data": {},
  "meta": {},
  "requestId": "req_..."
}
```

`meta` is present on paginated collections. Every response includes an
`X-Request-Id` header that also appears in server logs.

## Errors

```json
{
  "error": {
    "code": "validation_error",
    "message": "One or more query parameters are invalid.",
    "requestId": "req_...",
    "details": [{ "path": "sort", "message": "Invalid option" }]
  }
}
```

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_json`, `invalid_slug` | Malformed input |
| 401 | `unauthorized` | Session required |
| 403 | `forbidden` | Authenticated but not permitted |
| 404 | `not_found` | Resource absent or unpublished |
| 409 | `conflict` | Duplicate or state conflict |
| 422 | `validation_error` | Zod validation failure |
| 429 | `rate_limited` | Limit exceeded; obey `Retry-After` |
| 500 | `internal_error` | Unexpected server failure; request ID is the support handle |

## Validation

`parseQuery` and `parseJson` in `src/lib/api.ts` run a Zod schema and convert
issues into field-level details. Never trust a client-submitted user, role,
usage status, or count.

## Rate limits

`apiRoute` accepts a `rateLimit` option. The current implementation is an
in-memory fixed window per path and client address, suitable for a single
long-lived Node process. Before horizontal scaling, move the counter to a shared
store and keep the same headers.
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` on 429

## Idempotency

Mutating endpoints require an `Idempotency-Key` header. Replaying the same key
returns the original status and body with `Idempotent-Replayed: true`, so a
retry cannot create a duplicate trip or reward. The current demo store is
in-memory and per-process; the first critical mutation (Use Template) must add a
database-backed idempotency constraint.

## Endpoints

| Endpoint | Notes |
| --- | --- |
| `GET /api/destinations` | Paginated, filtered, rate-limited public list |
| `GET /api/destinations/:slug` | Published destination detail or 404 |
| `GET /api/todos` | Temporary connectivity check |
| `POST /api/todos` | Idempotent mutation demonstration |
| `GET /api/health` | Dependency status |

## Security

- Validate ownership and roles on every mutation, not just in the UI.
- Keep service credentials server-only.
- Do not return stack traces, database errors, or personal data in an envelope.
- Use idempotency keys for copy/use/reward mutations as those land.
