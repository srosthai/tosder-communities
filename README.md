# Tosder Communities

Cambodia travel community platform — discover destinations, create reusable itineraries, and share travel templates.

## Status

Backend foundation in progress. The product flow is documented in [`cambodia_travel_platform_flow.pdf`](./cambodia_travel_platform_flow.pdf), and the MVP work is tracked in [Issues](https://github.com/srosthai/tosder-communities/issues) and [Milestones](https://github.com/srosthai/tosder-communities/milestones).

## Stack

- Astro + TypeScript
- Astro server API routes
- Neon Postgres
- Prisma ORM
- Leaflet + PostGIS (planned)

## Development

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) in `.env.local` to your Neon connection strings.

The Neon project is linked in `.neon`.

### Admin UI

- `/admin` — dashboard, content, templates, users, moderation, competitions, rewards, and audit
- `/admin/content` — searchable, filterable, paginated data table
- `/design` — design tokens and component reference

The admin shell supports dark and light themes; the choice is stored locally.

### API checks

- `GET /api/health` — app, Neon, and Prisma status
- `GET /api/todos` — temporary connectivity check

The `todos` table is a smoke test, not part of the final domain model.

## Documentation

- [Product flow](./cambodia_travel_platform_flow.pdf)
- [Issues](https://github.com/srosthai/tosder-communities/issues)
- [Milestones](https://github.com/srosthai/tosder-communities/milestones)
