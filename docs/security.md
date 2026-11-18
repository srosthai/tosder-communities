# Security hardening and threat review

## Threat model

Protected assets: account sessions, private trips, saved items, reviews, creator
templates, competition results, rewards, role assignments, and the audit trail.

Primary threats: cross-site request forgery, cross-user data access, privilege
escalation, forged qualified uses, payout tampering, content abuse, secret
leakage, and dependency compromise.

## Controls

- **Server-side authorization**: `src/lib/permissions.ts` is the single role
  matrix. Privileged API routes call `requirePermission` or a page guard before
  reading or mutating.
- **Ownership scoping**: trips, saves, likes, reviews, and notifications are
  queried by the authenticated user id. Cross-owner access returns 404.
- **RLS defense-in-depth**: Postgres policies cover user-owned tables for the
  `tosder_app` role. `tosder_runtime` is the DML-only application role; it
  bypasses RLS because the current app does not set a per-request user context,
  so server ownership checks remain primary. `npm run db:rls-check` verifies
  cross-user reads and writes, and `npm run db:runtime-role-check` verifies the
  runtime role cannot create schema objects.
- **CSRF**: mutating requests with a cross-site `Origin` or
  `Sec-Fetch-Site: cross-site` are rejected in middleware.
- **Headers**: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
  `Permissions-Policy`, a frame/base/form CSP, and HSTS on HTTPS.
- **Rate limits**: public APIs and creator/save actions are rate limited.
- **Secrets**: only `.env.example` placeholders are tracked. Authenticated test
  credentials live in `.env.local` through `E2E_TEST_*`.
- **Dependency hygiene**: `@astrojs/vercel` is build-only and kept in
  devDependencies. `npm audit --omit=dev` is reviewed; the only current
  advisory is a transitive `picomatch` ReDoS in Astro build tooling with no
  fixed release. See `docs/quality-exceptions.md`.
- **Append-only audit**: audit rows cannot be updated by the application; every
  privileged mutation writes an entry.
- **Payout safety**: no automatic money movement; payout references are unique
  and reward approval is administrator-only.

## Verification

```bash
npm run check
npm run db:rls-check
npm audit --omit=dev
npx playwright test tests/public/security.spec.ts
AUTH_E2E=true npm run test:auth
```

## Threat review checklist

- [x] Unauthenticated access to creator/admin routes rejected
- [x] Cross-user trip, save, review, and notification access blocked
- [x] Member self-escalation blocked
- [x] Moderator cannot configure competitions or approve rewards
- [x] Cross-site mutations blocked
- [x] Security headers set
- [x] Qualified-use client tampering prevented (server ledger)
- [x] Duplicate payout reference prevented
- [x] Secrets absent from tracked files
- [ ] External penetration test before public launch
- [ ] Production WAF/rate-limit review at the hosting edge

The remaining items require an external security reviewer and hosting access.
