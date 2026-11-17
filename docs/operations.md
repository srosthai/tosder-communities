# Competition operations, moderation, rewards, and audit

## Roles and permissions

Roles live on `member_profiles.role`:

| Role | Key permissions |
| --- | --- |
| Member | Plan trips, save items, review completed trips. |
| Trusted creator | Member permissions plus direct publishing. |
| Moderator | Review templates, reports, and reviews. Cannot manage competitions, roles, rewards, or audit. |
| Administrator | All operations, including competitions, rewards, roles, and the audit log. |

`src/lib/permissions.ts` is the single server-side matrix. The
`CONTENT_ADMIN_EMAILS` allowlist is a bootstrap administrator path until role
assignment is complete; it is not used in the browser. Role changes are made at
`/admin/users`, require a reason, and write an audit entry.

### Row-level security

Postgres RLS policies cover trips, trip days/items, checklists, saves, likes,
reviews, and notifications. They use `current_setting('app.user_id', true)` and
the non-login `tosder_app` role. The app owner bypasses RLS, so application
checks remain the primary enforcement; RLS is defense-in-depth for any future
non-owner connection. `npm run db:rls-check` verifies cross-user reads and writes.

## Competition lifecycle

`/admin/competitions` manages periods.

1. **Draft** — configure title, slug, dates, timezone, rules, funding source,
   prize pool, and rank prizes.
2. **Active** — requires rules, dates, funded prizes, and no overlapping active
   period. Changes after start require a reason and write before/after audit data.
3. **Closed** — freezes a provisional leaderboard snapshot.
4. **Finalized** — administrator approves the final snapshot. Late events do not
   change the public result.

The public rules page is `/competitions/[slug]`; the public leaderboard is
`/leaderboard`. Finalized periods appear under past winners and in the sitemap.

## Leaderboard

`computeLeaderboard` aggregates qualified usage events in SQL:

- only `QUALIFIED` events inside the configured period
- suspended creators excluded
- one qualified use per traveler/template/month is already enforced upstream
- sort by qualified uses, then earlier completion of the total, then stable
  creator id
- ties are labeled in the UI

Snapshots are stored in `leaderboard_snapshots` with a rule version. Snapshot
rows cannot be updated; corrections create a new version and are audited.

## Reports and moderation

`/admin/reports` is available to moderators and administrators.

- Report targets: templates, reviews, users (comments are reserved until the
  feature exists).
- Reporters are visible only to moderators; public pages never expose them.
- Reason codes map to priority.
- Actions: hide template, hide review, warn user, suspend user, escalate, dismiss.
- Hiding/suspending removes content from public queries immediately.
- Each action writes actor, action, reason, target, and timestamp to the audit
  log and creates an in-app notification for the affected member.
- Repeating an already resolved report returns the existing decision.

## Rewards

`/admin/rewards` is administrator-only.

- Rewards can only be created from a `FINALIZED` competition and its final
  snapshot.
- Statuses: pending, approved, payable, paid, void.
- Approval requires a reason; payout requires a unique reference and method.
- A payout reference cannot be recorded twice.
- Voided rewards keep their history and reason.
- Reconciliation compares configured prizes with ledger amounts.
- No automatic money movement occurs. Payout activation is gated by legal and
  compliance sign-off.

## Audit log

`/admin/audit` is administrator-only.

- Append-only `audit_events` rows; updates are blocked by a database trigger.
- Fields: actor, action, entity, summary, reason, before/after, request id,
  timestamp.
- Filters: actor email, action, entity, date range; paginated at 25.
- CSV export for administrators.
- Retention policy: privileged events retained for 7 years; no secrets or
  unnecessary personal data.
