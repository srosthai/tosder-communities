# ADR-0001: Application topology, deployment target, and environment strategy

- **Status:** Accepted
- **Date:** 2026-11-16
- **Owners:** Platform engineering
- **Related:** #1, #2, #4, #7, #9, #11

## Context

The product flow recommends Astro for rendered pages and Nitro for application
APIs, with Prisma over PostgreSQL. The project has since standardized on Neon
Postgres instead of Supabase. Before scaffolding more of the platform, we need
one deployable shape, one environment model, and clear boundaries between
browser code, server code, database access, and scheduled work.

The main open questions are:

1. One Astro application with server routes, or separate web and API deployables?
2. Where does the application run, and how do preview, staging, and production differ?
3. How do background jobs run without blocking request handlers?
4. Which auth and object-storage providers replace the Supabase services?
5. Which map tile provider can support Leaflet without unbounded usage costs?

## Decision

### One deployable Astro application

Use a single Astro application with:

- Server-rendered pages under `src/pages/`
- Server API endpoints under `src/pages/api/`
- Shared server-only modules under `src/db/` and `src/lib/`
- The `@astrojs/node` adapter in `standalone` mode

The browser talks to the same origin. There is no separate API service for the
MVP. Astro server endpoints are the Nitro-style boundary described by the
product flow; if the API later needs an independent runtime, the endpoints can
move behind a versioned prefix without changing domain modules.

Do not import Prisma, Neon credentials, or any server-only module into client
islands. All database access is server-side.

### Neon Postgres and Prisma

- Use one Neon project with branches for environments.
- Runtime uses the **pooled** connection (`DATABASE_URL`, PgBouncer).
- Prisma migrations use the **direct** connection (`DIRECT_URL`).
- Prisma 7 with the `@prisma/adapter-pg` adapter is the data-access layer.
- Store timestamps in UTC. Use raw SQL only for PostGIS-specific operations.
- Prefer Neon branches over separate projects for preview and staging.

Connection strings are secrets. They belong in the host secret manager in
staging and production, and in the git-ignored `.env.local` locally.

### Deployment target

Deploy the standalone Node server as a containerized workload on a Node host
(Docker image, Node 24 LTS). The start command is:

```bash
node dist/server/entry.mjs
```

Preview deployments are created per pull request once the CI/CD issue lands.
Staging and production run the same image with different environment variables
and Neon branches. A serverless adapter (for example Vercel) is a future option,
not the MVP default, because Prisma migrations, long-running jobs, and pooled
connections are simpler on a long-lived Node process.

### Background jobs

Scheduled work (competition close, ranking recalculation, cleanup) runs as a
GitHub Actions scheduled workflow that calls an authenticated internal job
endpoint. Job endpoints must be idempotent and must not be publicly callable
without a server-side secret. If volume or latency outgrows this, move jobs to a
dedicated worker and queue without changing the domain rules.

### Auth and object storage

- **Auth:** Neon Auth (Managed Better Auth) is the default provider. It supports
  email/password, verification, password reset, and OAuth. The auth issue must
  confirm plan limits and map the provider user ID to the application profile.
- **Object storage:** Neon Object Storage (S3-compatible) is the default for
  destination photos, template covers, and avatars. If its limits are unsuitable
  before launch, use an S3-compatible provider behind the same storage interface.
- Do not expose database or storage credentials to the browser. Uploads use
  short-lived signed URLs issued by the server.

### Maps

Leaflet is the renderer. Use OpenStreetMap standard tiles for local development
only, with visible attribution. Production must use a tile provider whose usage
policy and limits fit expected traffic; do not rely on public OSM tiles for
launch traffic. The provider decision is recorded before the map issue exits.

### Environments

| Environment | App | Database | Purpose |
| --- | --- | --- | --- |
| Local | `npm run dev` | Neon branch or local Postgres | Feature work |
| Preview | Per-PR Node container | Neon preview branch | Review and E2E |
| Staging | Node container | Neon staging branch | Release rehearsal |
| Production | Node container | Neon `main` branch | Public traffic |

### Environment matrix

| Variable | Scope | Owner | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Server | Platform | Pooled Neon connection |
| `DIRECT_URL` | Server / CI | Platform | Direct Neon connection for migrations |
| `AUTH_SECRET` | Server | Platform | Added with the auth provider |
| `JOB_SECRET` | Server / CI | Platform | Authenticates scheduled job calls |
| Storage credentials | Server | Platform | Added with the storage provider |
| `PUBLIC_*` variables | Browser | Feature owner | Never contain secrets |

## Consequences

- One deployable keeps local development, preview, and production behavior close.
- Neon branching gives isolated preview databases without duplicating projects.
- Server-only data access keeps qualified-use and reward logic authoritative.
- A long-lived Node process simplifies Prisma and background-job behavior.
- The MVP is not serverless-first; adopting an edge adapter later requires a
  deliberate migration and connection-pool review.
- Scheduled GitHub Actions are adequate for monthly competition jobs but not for
  high-frequency queues.

## Rejected alternatives

- **Separate web and API deployables:** unnecessary operational overhead for the
  MVP; the API boundary is preserved in code instead.
- **Supabase as the backend platform:** replaced by Neon Postgres; auth and
  storage move to Neon services.
- **Client-side database access:** incompatible with server-authoritative usage,
  ranking, and reward rules.
- **Serverless-only deployment now:** complicates migrations, pooling, and
  long-running jobs before scale requires it.

## Follow-ups

- Add CI/CD, preview deployments, and secret management (#7).
- Provision Neon branches and seed workflow (#4).
- Confirm Neon Auth and object-storage plan limits before those features.
- Record the production map tile provider before the map issue exits.
