# Tosder

**Cambodia travel, planned by people who have been there.**

Tosder is a community-driven travel platform for discovering Cambodia, turning great itineraries into reusable templates, and rewarding creators when travelers genuinely use their plans.

> **Status:** Pre-implementation. The product flow is defined in [`cambodia_travel_platform_flow.pdf`](./cambodia_travel_platform_flow.pdf). The MVP backlog is tracked in [Issues](https://github.com/srosthai/tosder/issues) and [Milestones](https://github.com/srosthai/tosder/milestones).

## The product

A visitor can browse public travel content. A signed-in member can plan trips and publish templates. Administrators manage content quality, competitions, and rewards.

| Surface | Who it serves | What it does |
| --- | --- | --- |
| Public discovery | Visitors and members | Browse provinces, destinations, templates, maps, leaderboards, and creator profiles. |
| Member workspace | Travelers and creators | Save places, copy templates into personal trips, customize itineraries, publish templates, view analytics. |
| Admin workspace | Moderators and administrators | Moderate content, manage users, configure competitions, review rankings, approve payouts. |

**Core principle:** one account is both traveler and creator. Registration never forces a permanent account type.

## The core loop

1. **Discover** a province, destination, or itinerary.
2. **Create** a reusable travel template in Creator Studio.
3. **Use** someone's template to create a private, editable trip copy.
4. **Compete** through genuine usage — only a successfully saved trip copy counts as a qualified use.

The original creator's template is never edited by a traveler. Every copied trip keeps its source template and version so attribution is auditable.

## MVP roadmap

| Milestone | Outcome |
| --- | --- |
| M0 — Foundation & Design | App scaffold, data platform, auth, API conventions, CI, and the dual-surface design system. |
| M1 — Travel Content | Reviewed destination data and public discovery: home, explore, destination detail, maps, SEO. |
| M2 — Template Creator | Guided six-step builder, draft management, validation, publishing lifecycle, and template pages. |
| M3 — Traveler Workflow | Transactional `Use Template` copy, My Trips, personal editor, saved items, and reviews. |
| M4 — Tracking & Analytics | Deduplicated engagement events, qualified-use ledger, and privacy-safe creator analytics. |
| M5 — Competition & Rewards | Monthly Top 5 configuration, rankings, public leaderboard, moderation, RBAC, payouts, and audit log. |
| M6 — Launch Readiness | End-to-end coverage, security hardening, legal/privacy compliance, performance validation, and runbook. |

## Stack

- **Astro + TypeScript** — public pages, member workspace, SEO-friendly server rendering, interactive islands.
- **Nitro** — application APIs, business rules, authorization, and background jobs.
- **Supabase PostgreSQL** — application data.
- **Prisma ORM** — typed queries, transactions, and migrations.
- **Supabase Auth** — a single identity provider.
- **Supabase Storage** — destination photos, template covers, and avatars.
- **MapLibre + PostGIS** — geospatial search, nearby places, and map display.
- **Zod** — request validation at the API boundary.

## Design direction

The product has two deliberately different surfaces:

**Public frontend — Vercel-minimal.** Near-monochrome, high contrast, generous whitespace, a strong grid, restrained motion, and content-first imagery. Destination photography supplies the color; the interface stays quiet.

**Admin dashboard — Linear-dense.** Dark-first, compact, keyboard-first. Persistent sidebar, command palette (`⌘K`), dense tables, subtle one-pixel borders, precise typography, and inline actions. Information density over decoration.

Shared principles: accessibility to WCAG 2.2 AA, no layout shift, no ornamental animation, and performance treated as a feature.

## Proposed repository layout

```text
apps/web          Astro public site and member workspace
apps/api          Nitro API (if separated — see ADR-0001)
packages/db       Prisma schema, migrations, and seeds
packages/ui       Design tokens and shared components
packages/config   Shared TypeScript, lint, and environment config
docs/             Product notes, ADRs, and runbooks
```

The final layout is decided in the application-topology ADR before scaffolding.

## Local development

Not scaffolded yet. Setup instructions will be added with the foundation milestone. Planned prerequisites: Node.js LTS, pnpm, Docker (for local Supabase), and the Supabase CLI.

## Documentation

- [`cambodia_travel_platform_flow.pdf`](./cambodia_travel_platform_flow.pdf) — product flow, user journeys, business rules, data model, API map, and MVP boundaries.
- [Issues](https://github.com/srosthai/tosder/issues) — scoped work with acceptance criteria.
- [Milestones](https://github.com/srosthai/tosder/milestones) — phase-level outcomes.

## Legal and trust note

Cash or cash-equivalent prizes require published competition terms, a funded prize pool, and a review of applicable Cambodian law, tax obligations, age requirements, and payment-provider rules. Rewards must not be promised before the pool is funded and the rules are approved. See the legal and compliance issue in M6.
