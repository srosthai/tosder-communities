# Production accounts and access

## Superadmin

- Email: `srosthai00@gmail.com`
- Sign-in: **Continue with Google**
- App role: `ADMINISTRATOR`
- Profile: `thai-jing`
- Can manage content, templates, users, moderation, competitions, rewards, audit, and usage overrides.

No app password is stored for this account. It uses the Google identity linked to
the Neon Auth user. Add another superadmin with:

```bash
SUPERADMIN_EMAIL="person@example.com" npm run provision:superadmin
```

The person must sign in with Google once so the Neon Auth user exists, then run
the command.

## Seeder

- Email: `seed@tosder.com` (override with `SEED_ADMIN_EMAIL`)
- Sign-in: email and password
- App role: `ADMINISTRATOR`
- Profile: `tosder-seed`
- Used for content seeding, taxonomy, destination publishing, and template
  ownership.

Provision it against a running deployment:

```bash
PROVISION_BASE_URL="https://your-production-url" npm run provision:seed
```

The generated password and the superadmin note are written to
`.secrets/production-accounts.txt`, which is gitignored and mode `0600`. Move
that file to the team password manager and change the seeder password after the
first sign-in.

These accounts were created against the Neon Auth branch and the current
`DATABASE_URL`. If the production Vercel project still points at a different
database, apply the migrations and run `SUPERADMIN_EMAIL=... npm run provision:superadmin`
with the production `DATABASE_URL` exported. The auth user
already exists, so only the profile/role needs to be created there.

## Google sign-in

Neon Auth has the shared Google provider enabled. The sign-in and sign-up pages
post to the social endpoint and redirect through Neon Auth to Google. The
production origin `https://tosder-communities.vercel.app` is in the trusted
domains list.

If Google fails, check:

1. Neon Auth → OAuth providers → Google is enabled.
2. The current origin is in trusted domains.
3. The `form-action` CSP includes the Neon Auth origin and
   `https://accounts.google.com` (handled in `src/middleware.ts`).
4. The OAuth callback returns to `/account`.

## Role changes

Role changes are made at `/admin/users` by an administrator, require a reason,
and write an audit entry. The scripts above are bootstrap tools; use the admin
UI for ongoing changes.
