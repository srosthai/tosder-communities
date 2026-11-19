# Authentication

The member workspace uses **Neon Auth (Managed Better Auth)** on the `main`
branch. Users and sessions live in the `neon_auth` schema and branch with the
database.

## Configuration

```bash
NEON_AUTH_BASE_URL="https://<endpoint>.neonauth.<region>.aws.neon.tech/neondb/auth"
NEON_AUTH_COOKIE_SECRET="<32+ character secret>"
```

Generate the cookie secret with:

```bash
openssl rand -base64 32
```

Both values are server-only. They are declared with `astro:env/server` in
`astro.config.mjs`, so they are read at runtime and are not bundled into client
code. The auth base URL is public to browsers, but the cookie secret is not.

Trusted domains:

- `http://localhost:4321`
- `http://127.0.0.1:4321`
- `http://localhost:4323`
- `http://127.0.0.1:4323`
- `https://tosder-communities.vercel.app` (production)

Register any additional preview origin before using OAuth there.

## Server adapter

`src/lib/auth-server.ts` wraps `createAuthServer` from `@neon/auth/server` with an
Astro request context:

- forwards request cookies upstream
- writes refreshed cookies through `Astro.cookies`
- uses the request origin for CORS and trusted-domain checks
- identifies the adapter as `astro`

All auth calls happen on the server. The browser never receives the cookie
secret.

## Routes

| Route | Purpose |
| --- | --- |
| `/sign-up` | Create an email/password account or continue with Google. One account is traveler and creator. |
| `/sign-in` | Sign in with email/password or Google. Supports a safe internal `redirectTo`. |
| `/account` | Protected profile page; redirects signed-out visitors to sign-in. |
| `/forgot-password` | Request a reset link. Always returns a generic response. |
| `/reset-password` | Set a new password from the reset token. |
| `/verify-email` | Send and enter an email verification OTP. |
| `POST /api/auth/sign-out` | End the session and return home. |

The public header reads the session when a cookie is present and shows the
member's account instead of sign-in actions.

## Google sign-in

The Neon Auth shared Google provider is enabled. Both auth pages post
`intent=google` to the same route; the server calls `startSocialSignIn` in
`src/lib/auth-server.ts`, which resolves the Neon Auth social URL and redirects
the browser. The callback returns to the safe internal `redirectTo` target
(default `/account`).

The CSP `form-action` must include the Neon Auth origin and
`https://accounts.google.com`; `src/middleware.ts` derives the auth origin from
`NEON_AUTH_BASE_URL`.

## Production accounts

See `docs/accounts.md` for the superadmin and seeder provisioning scripts. The
superadmin uses Google sign-in; the seeder uses email/password and its generated
credentials are stored only in `.secrets/`, which is gitignored.

## Email verification

The branch uses OTP verification and does not require verification to browse or
save. The account page shows the verification state. Publishing requires a
verified email or phone, enforced when the publishing workflow lands.

Managed Auth sends verification codes through shared SMTP while developing.
Production needs a custom SMTP provider; verification links and branded email
delivery require that configuration. See
https://neon.com/docs/auth/production-checklist.md.

## Admin protection

The admin preview is intentionally reachable without a session while the RBAC
milestone is open. `/account` is the current protected route. Admin and API
authorization will be enforced server-side with the role model in issue #47; a
page redirect alone is not treated as authorization.

## Verification

`npm run test:auth` runs the authenticated suite against the real Neon Auth
branch. The default `npm test` skips it so CI can run without auth secrets.

`tests/auth/auth.spec.ts` covers:

- sign-up, redirect to the protected account page, and auth-aware header
- session restoration after reload
- wrong-password feedback
- signed-out redirect from `/account`
- password reset, missing-token, and email verification pages

The full password-reset completion and OTP verification require reading the
delivered email; those remain manual checks until custom SMTP is configured.
