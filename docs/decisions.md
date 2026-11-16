# Product decision log

This log records the launch-blocking product, policy, and trust decisions that
shape the implementation. Each entry has an owner, status, rationale, and the
issues it affects.

Statuses:

- **Accepted** — the current build follows this rule.
- **Proposed** — a recommended rule that still needs approval or legal review.
- **Superseded** — replaced by a later entry; the replacement is linked.

Revisit this log at each milestone exit. If a rule changes, record the new
decision and update the affected issues rather than editing history silently.

## D-001 — Who can create a template

- **Status:** Accepted
- **Owner:** Product
- **Affected:** #9, #24, #25, #28
- **Decision:** Any registered member can create a private draft. First-time
  publishers enter moderation; trusted creators can use a streamlined review
  path after earning the role.
- **Rationale:** Lowering the barrier to drafting grows supply without exposing
  the public library to unreviewed content.

## D-002 — Who can publish

- **Status:** Accepted
- **Owner:** Product / Trust
- **Affected:** #5, #28, #46, #47
- **Decision:** Publishing requires a verified email or phone, a complete
  template that passes required-field checks, and acceptance of the community
  guidelines. Accounts under moderation restrictions cannot publish.
- **Rationale:** Publishing is the trust boundary between private drafts and
  public travel advice.

## D-003 — What counts as a qualified use

- **Status:** Accepted
- **Owner:** Product / Analytics
- **Affected:** #32, #33, #39, #40, #44
- **Decision:** A qualified use is a personal trip copy successfully saved from
  a published template. Button clicks, views, saves, and failed copies do not
  count. The source template and exact version are recorded.
- **Rationale:** The competition must reward plans people actually use, not
  signals that are easy to inflate.

## D-004 — Self-use and duplicate usage

- **Status:** Accepted
- **Owner:** Product / Analytics
- **Affected:** #33, #40, #44
- **Decision:** A creator may copy their own template for personal use, but it is
  excluded from competition totals. A traveler can generate at most one
  qualified use per source template per competition month.
- **Rationale:** Prevents self-farming while allowing creators to test their own
  itineraries.

## D-005 — When template edits can change a copied trip

- **Status:** Accepted
- **Owner:** Engineering / Product
- **Affected:** #24, #28, #33, #35
- **Decision:** Published templates are versioned. Editing a template creates a
  new revision; existing trip copies keep the source version they were created
  from. The original template is never mutated by a traveler.
- **Rationale:** A traveler's plan must be stable, and attribution must remain
  auditable.

## D-006 — Competition period and timezone

- **Status:** Accepted
- **Owner:** Product / Operations
- **Affected:** #41, #42, #43, #44
- **Decision:** Each competition has explicit start and end timestamps in
  `Asia/Phnom_Penh`. Rankings count qualified uses whose committed event falls
  inside that interval. A frozen snapshot is taken at close.
- **Rationale:** A single published timezone prevents boundary disputes.

## D-007 — Ranking, ties, and late events

- **Status:** Accepted
- **Owner:** Product / Operations
- **Affected:** #43, #44, #48, #49
- **Decision:** Rank by qualified uses in the period. Ties break by the earlier
  achievement of the final total, then by documented admin review. Late events
  do not change a finalized leaderboard without an explicit correction entry.
- **Rationale:** Deterministic rules make results explainable and auditable.

## D-008 — Prize funding and payout method

- **Status:** Proposed — pending funding and legal review
- **Owner:** Product / Finance / Legal
- **Affected:** #48, #53
- **Decision:** Prizes are announced only after the pool is funded. Payouts are
  manual, admin-approved, and recorded with a reference. No automatic cash
  movement in the MVP. Currency, tax handling, and payout provider are confirmed
  with legal counsel before launch.
- **Rationale:** The product must not promise rewards it cannot pay or legally
  operate.

## D-009 — Fraud, invalid usage, and appeals

- **Status:** Accepted
- **Owner:** Trust / Operations
- **Affected:** #40, #46, #48
- **Decision:** Usage events can be flagged, investigated, and marked invalid
  with a reason. Invalid events remain in the ledger but are excluded from
  rankings. Affected creators can appeal through support; an administrator
  records the outcome.
- **Rationale:** Corrections must be visible and reversible without deleting the
  audit trail.

## D-010 — Content ownership and license

- **Status:** Proposed — legal review
- **Owner:** Legal / Product
- **Affected:** #28, #53
- **Decision:** Creators retain ownership of their text and photos and grant the
  platform a non-exclusive license to display, distribute, and promote public
  templates. Private trips remain private. Takedown and content-reporting paths
  are published.
- **Rationale:** The platform needs distribution rights without claiming
  ownership of community work.

## D-011 — Account deletion and data retention

- **Status:** Accepted
- **Owner:** Engineering / Privacy
- **Affected:** #5, #52, #53
- **Decision:** Account deletion removes or anonymizes personal profile data and
  private trips. Aggregated usage and competition records are retained in an
  anonymized form where needed for audit and reward integrity. Deletion timing
  and export options are documented in the privacy policy.
- **Rationale:** Privacy rights and competition auditability both need a defined
  boundary.

## D-012 — Language strategy

- **Status:** Proposed
- **Owner:** Product / Content
- **Affected:** #21, #24, #26, #53
- **Decision:** English is the launch language. The data model records a
  template and destination language from day one, and the UI copy is prepared
  for Khmer translation. Khmer authoring and localized routing are evaluated
  after the first content launch.
- **Rationale:** Launching in one language keeps editorial review tractable
  while avoiding a schema that blocks localization.

## D-013 — Age and eligibility for prizes

- **Status:** Proposed — legal review
- **Owner:** Legal / Operations
- **Affected:** #48, #53
- **Decision:** Prize recipients must meet the published age and jurisdiction
  requirements. The rule is confirmed with Cambodian counsel and payment-provider
  requirements before the first funded competition.
- **Rationale:** Prize competitions can trigger age, tax, and payment rules.

## D-014 — Admin actions require an audit record

- **Status:** Accepted
- **Owner:** Engineering / Trust
- **Affected:** #1, #6, #46, #47, #48, #49
- **Decision:** Moderation, competition changes, ranking adjustments, role
  changes, and reward approvals write an append-only audit entry with actor,
  action, entity, reason, and request ID. Audit entries are not editable through
  the application.
- **Rationale:** Disputes and insider-abuse investigations need a durable record.

## Open decisions

- Final production host and observability vendor.
- Production map tile provider and usage plan.
- Neon Auth and object-storage plan limits before those features exit M0/M2.
- Exact legal terms for the first funded competition.
- Whether public creator following launches after the MVP.

## Change process

1. Open an issue or add an entry to this log.
2. Name the owner and the affected issues.
3. Record the status and rationale.
4. If a decision changes, supersede the old entry rather than editing it.
5. Update the public rules page before a competition starts.
