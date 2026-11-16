# Tosder Communities

Cambodia travel community platform — discover destinations, create reusable itineraries, and share travel templates.

## Status

Backend foundation in progress. The product flow is documented in [`cambodia_travel_platform_flow.pdf`](./cambodia_travel_platform_flow.pdf), and the MVP work is tracked in [Issues](https://github.com/srosthai/tosder/issues) and [Milestones](https://github.com/srosthai/tosder/milestones).

## Stack

- Astro + TypeScript
- Nitro API
- Supabase (PostgreSQL, Auth, Storage)
- Prisma ORM
- Leaflet + PostGIS

## Development

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Fill `.env.local` with the Supabase project URL, publishable key, and database password before running the database commands.

### API checks

- `GET /api/health` — app, Supabase, and database status
- `GET /api/todos` — temporary connectivity check

The `todos` table is a smoke test, not part of the final domain model.

## Documentation

- [Product flow](./cambodia_travel_platform_flow.pdf)
- [Issues](https://github.com/srosthai/tosder/issues)
- [Milestones](https://github.com/srosthai/tosder/milestones)
