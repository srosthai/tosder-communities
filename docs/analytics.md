# Engagement, qualified usage, and creator analytics

## Engagement events

`engagement_events` stores `VIEW`, `LIKE`, `SAVE`, and `USE_STARTED` events with a
template, optional member, timestamp, optional dedupe key, and metadata.

- **Views** are deduplicated per anonymous visitor cookie, template, and UTC day.
  The cookie contains a random opaque id; only a SHA-256 hash is stored in the
  event. No raw IP is stored. `travel_templates.view_count` mirrors counted view
  events.
- **Likes** use one active `template_likes` row per member and template. PUT and
  DELETE are idempotent; repeated clicks do not double the count. Like events are
  recorded for analytics.
- **Saves** use one active save row per member and item. Save counts are changed
  only when a row is actually inserted or removed, and save events record the
  action.
- **Use started** is recorded when a signed-in member opens the trip-copy
  confirmation for a specific template version. It deduplicates by member,
  template, and version, and never increments qualified uses.

Public counts come from backend rows/events, never from client-submitted numbers.
Engagement endpoints are rate limited.

## Qualified-use rules (v1)

The engine consumes `PENDING` usage events created by the transactional copy.

A use qualifies when all are true:

1. The template still exists.
2. The copied trip still exists and belongs to the event actor.
3. The actor is not the template creator (self-use is excluded).
4. The trip's source template and version match the event.
5. The event has a competition period and occurred inside its UTC month.
6. It is the first qualifying candidate for that member + template + month.

Statuses: `PENDING`, `QUALIFIED`, `INVALID`, `UNDER_REVIEW`, `VOID` (legacy
`REJECTED` remains in the enum but is unused). Corrections create an audit entry;
the event row and template counters are recomputed from qualified events.

`npm run db:usage-recompute` rebuilds `travel_templates.qualified_use_count` from
the ledger. The admin override endpoint changes a status with a required reason
and writes an audit event.

## Creator analytics

`/creator/analytics` is private to the signed-in creator.

- date range filter (default: last 30 days, maximum 366 days)
- published templates, views, likes, saves, qualified uses, and conversion
- per-template performance table
- daily views chart
- recent visible review feedback
- competition rank placeholder until a period is active

Privacy rules:

- fewer than 5 engagement/use events display as `<5`
- views under 5 display as `<5`, otherwise round to the nearest 10
- conversion is hidden (`—`) when views are below 5
- only aggregates are shown; no traveler identities, trips, schedules, or
  contact data
- hidden/reported reviews are excluded

## Verification

`AUTH_E2E=true npm run test:auth` covers view dedupe, like idempotency, use-started
dedupe, one qualified use per member/template/month, self/duplicate exclusion,
admin override, and privacy-rounded dashboard output.
