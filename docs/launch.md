# Launch checklist and runbook

## Release path

1. Merge the issue branch to `dev`; wait for CI (checks, PostGIS, seed, Playwright, Lighthouse).
2. Deploy `dev` to a Vercel preview.
3. Smoke-test the preview with the checklist below.
4. Merge `dev` to `main`; Vercel promotes the production deployment.
5. Run migrations and seed against the production Neon branch once.
6. Record the deployment URL, image/commit, migration list, and operator in the launch issue.

## Environment

Production and preview environments need:

- `DATABASE_URL` (Neon pooled)
- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET` (32+ characters)
- `CONTENT_ADMIN_EMAILS` bootstrap administrators
- SMTP variables when the email provider is switched to standard SMTP

Never set `E2E_TEST_*` in Vercel. `DIRECT_URL` is only for migration commands.

## Pre-launch checklist

### Data

- [ ] `npm run db:deploy` applied every migration
- [ ] `npm run db:seed` completed idempotently
- [ ] `npm run db:content-check` passes (13 provinces / 43 destinations)
- [ ] `npm run db:trip-check`, `db:template-check`, `db:rls-check` pass
- [ ] Point-in-time restore / backup reference recorded

### Auth and access

- [ ] Admin account can sign in on the production domain
- [ ] Trusted domain includes the production origin
- [ ] Administrator role assigned; bootstrap allowlist reviewed
- [ ] Content admin, moderator, and trusted creator roles verified
- [ ] Email verification and password reset delivery verified

### Product

- [ ] Home, Explore, destination detail, templates, and leaderboard render on mobile and desktop
- [ ] A public template can be copied into a trip
- [ ] Trip editing, checklist, saves, likes, and review submission work
- [ ] Draft, unlisted, archived, and suspended content return 404 publicly
- [ ] Report submission and moderator actions work
- [ ] Competition draft → active → closed → finalized works
- [ ] Reward approval and manual payout recording work
- [ ] Audit log filters and CSV export work
- [ ] Member can download a JSON account export and delete their account from `/account`
- [ ] Health endpoint returns 200 and reports database status

### Quality and security

- [ ] `npm run check` — 0 errors/warnings
- [ ] `npx playwright test` and `npm run test:auth` pass
- [ ] Lighthouse budgets pass on five URLs
- [ ] `npm audit --omit=dev` reviewed; no unexplained advisories (the transitive `picomatch` advisory is documented in `docs/quality-exceptions.md`)
- [ ] Security headers and cross-site mutation block verified
- [ ] No secrets in tracked files
- [ ] Legal pages and competition rules reviewed by counsel

### Operations

- [ ] Error tracking provider configured through `captureException`
- [ ] Alerts: health 503, 5xx rate, p95 latency, auth failures
- [ ] On-call owner and escalation path recorded
- [ ] Status page and support inbox monitored
- [ ] Rollback image/commit recorded

## Smoke test (production)

```bash
curl -fsS https://<domain>/api/health
curl -fsS https://<domain>/sitemap.xml | head
curl -fsS https://<domain>/robots.txt
```

Then manually:

1. Sign in with a member account.
2. Copy a published template.
3. Edit the trip title and add one checklist item.
4. Mark the trip complete and publish a review.
5. Confirm the review appears on the template page.
6. Sign in as an administrator and open `/admin/audit`.
7. Submit and resolve a test report.

## Runbook

### Health check fails

1. Check `/api/health` for `database` and `schema` fields.
2. Confirm Neon compute state, connection limits, and recent migrations.
3. Check Vercel function logs for the request id.
4. If the database is reachable but a migration is missing, stop writes and deploy the migration.
5. Roll back the application to the last known-good deployment if errors are request-path specific.

### Elevated 5xx

1. Identify the first failing path and request id in logs.
2. Check recent deploys, migrations, and Neon incidents.
3. Reproduce on a preview with the same commit.
4. Roll back the deployment if the error rate does not fall; do not reverse a migration without a reviewed plan.

### Auth outage

1. Check Neon Auth status and trusted-domain configuration.
2. Verify `NEON_AUTH_BASE_URL` and cookie secret in the deployment.
3. Keep public read-only pages available; do not bypass authorization.

### Competition or payout incident

1. Freeze the competition or stop payout recording.
2. Export the audit log and usage ledger.
3. Recompute the provisional leaderboard only with a reason; never edit a final snapshot in place.
4. Escalate to an administrator and record the correction.

### Data deletion request

Members can self-serve from `/account`: download the JSON export, then type
`DELETE` under **Privacy and account data**. The app anonymizes the profile,
archives authored templates, deletes private trips/saves/likes/reviews/
notifications, and signs the member out.

For an assisted request:

1. Verify the account owner before making changes.
2. Confirm the member has used the self-service flow where possible.
3. Preserve usage, reward, and audit records required for competition, legal,
   or financial obligations without retaining the member's name or contact data.
4. Record the request and scope without storing extra personal data.

## Content launch sign-off

- [ ] Seed dataset reviewed province by province (#22)
- [ ] Licensed destination photography replaces placeholders
- [ ] Legal, privacy, and competition pages reviewed (#53)
- [ ] SMTP delivery verified (#63)
- [ ] External security review completed (#52)
