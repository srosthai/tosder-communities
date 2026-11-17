# Tosder Communities

Cambodia travel community platform — discover destinations, create reusable itineraries, and share travel templates.

## Status

Backend foundation in progress. The product flow is documented in [`cambodia_travel_platform_flow.pdf`](./cambodia_travel_platform_flow.pdf), and the MVP work is tracked in [Issues](https://github.com/srosthai/tosder-communities/issues) and [Milestones](https://github.com/srosthai/tosder-communities/milestones).

## Stack

- Astro + TypeScript
- Astro server API routes
- Neon Postgres
- Neon Auth (Managed Better Auth)
- Prisma ORM
- Leaflet + PostGIS (planned)

## Development

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Set `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `NEON_AUTH_BASE_URL`, and
`NEON_AUTH_COOKIE_SECRET` in `.env.local`. See [Authentication](./docs/auth.md).

The Neon project is linked in `.neon`.

### Admin UI

- `/admin` — dashboard, content, templates, users, moderation, competitions, rewards, and audit
- `/admin/content` — searchable, filterable, paginated data table
- `/design` — design tokens and component reference

The admin shell supports dark and light themes; the choice is stored locally.

### Quality checks

```bash
npm test          # interaction, accessibility, and visual tests
npm run test:auth # authenticated flow against the real Neon Auth branch
npm run test:a11y # axe scans only
npm run lighthouse
```

- [Quality budgets](./docs/quality-budgets.md)
- [Keyboard and screen-reader checklist](./docs/qa/keyboard-screenreader-checklist.md)

### API checks

- `GET /api/health` — app, Neon, and Prisma status
- `GET /api/todos` — temporary connectivity check

The `todos` table is a smoke test, not part of the final domain model.

## Documentation

- [Product flow](./cambodia_travel_platform_flow.pdf)
- [Product decisions](./docs/decisions.md)
- [Authentication](./docs/auth.md)
- [API conventions](./docs/api.md)
- [Data model](./docs/data-model.md)
- [Maps](./docs/maps.md)
- [SEO and sharing](./docs/seo.md)
- [Observability](./docs/observability.md)
- [Admin content management](./docs/admin-content.md)
- [Quality budgets](./docs/quality-budgets.md)
- [Issues](https://github.com/srosthai/tosder-communities/issues)
- [Milestones](https://github.com/srosthai/tosder-communities/milestones)
