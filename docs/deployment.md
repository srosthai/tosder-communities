# Deployment

## Vercel

Vercel needs the Vercel adapter, not the Node standalone adapter used locally.

`astro.config.mjs` selects the adapter at build time:

- `VERCEL` set → `@astrojs/vercel`
- otherwise → `@astrojs/node` standalone for local production, Playwright, and CI

The Vercel build emits `.vercel/output` (Build Output API). Do not set the
project output directory to `dist/` and do not use a static-only framework
preset. In the Vercel project:

1. Framework Preset: **Astro**
2. Root Directory: repository root
3. Build Command: `npm run vercel-build` (generates Prisma, checks, and builds)
4. Install Command: `npm install`
5. Node.js: 24.x or newer

If the project previously built as a static site, redeploy after this adapter
change. A Vercel-branded `404 NOT_FOUND` with a request id means Vercel has no
route for the request; it is not an Astro 404. The adapter output fixes that.

### Environment variables

Set these in Vercel for Production and Preview:

```text
DATABASE_URL            Neon pooled connection string
NEON_AUTH_BASE_URL      Neon Auth base URL
NEON_AUTH_COOKIE_SECRET 32+ character cookie secret
CONTENT_ADMIN_EMAILS    Bootstrap comma-separated admin emails
```

`DIRECT_URL` is used by release migration commands, not by the Vercel build. If it is omitted, the Prisma config falls back to `DATABASE_URL`; a direct URL is preferred for migrations.
`E2E_TEST_*` variables are for local authenticated tests and must not be added to
Vercel.

### Database

Run migrations against the Neon database before releasing the app. Builds do not
migrate, so a database incident cannot block a deploy.

Local:

```bash
npm run db:deploy
npm run db:seed
```

Production uses a separate connection string that is never added to Vercel:

```bash
PRODUCTION_DATABASE_URL="postgresql://..." \
PRODUCTION_DIRECT_URL="postgresql://..." \
npm run db:production:migrate

PRODUCTION_DATABASE_URL="postgresql://..." \
PRODUCTION_DIRECT_URL="postgresql://..." \
npm run db:production:seed
```

The script prints only the target host and database, never credentials. Seeding
is idempotent and should be run once for a new environment. See
`docs/backup.md` for the snapshot and rollback procedure.

### Vercel build verification

```bash
VERCEL=1 npm run build
test -f .vercel/output/config.json
```

Local tests and Lighthouse still use the Node adapter:

```bash
npx playwright test
npx lhci autorun
```

## Node standalone

For a VPS or container:

```bash
npm run build
npm start
```

`npm start` loads `.env.local` when present and serves `dist/server/entry.mjs` on
port 4321 by default.

## Secrets

Never commit `.env.local`, connection strings, auth secrets, or test passwords.
Authenticated Playwright tests read `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` from
`.env.local`; the repository only contains placeholders.

### Recovering a detached Vercel domain

A Vercel-branded `404 DEPLOYMENT_NOT_FOUND` means the hostname is not assigned to
a deployment; it is not an Astro 404. In the Vercel project:

1. Open **Settings → Domains**.
2. Add `tosder-communities.vercel.app` if it is missing and assign it to the
   production deployment. If Vercel says the domain is already in use, remove it
   from the old project/team first.
3. Open **Settings → Deployment Protection**. For a public site, do not protect
   production with Vercel Authentication. Preview protection is fine.
4. Open **Settings → Environment Variables** and confirm `DATABASE_URL`,
   `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, and
   `CONTENT_ADMIN_EMAILS` exist for Production.
5. Redeploy the latest `main` commit.
6. Apply migrations to the production connection string if health reports
   `schema: partial`:

   ```bash
   PRODUCTION_DATABASE_URL="postgresql://..." \
   PRODUCTION_DIRECT_URL="postgresql://..." \
   npm run db:production:migrate
   ```

7. Verify:

   ```bash
   npm run prod:check
   ```

   `/api/health` must report `checks.schema: "ready"`. If it reports `partial`,
   the production `DATABASE_URL` points at a different database than the one
   that received migrations.
