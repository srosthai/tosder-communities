# Quality budgets

These are the release gates for the public site and the admin workspace. They
are enforced by Playwright and Lighthouse CI in `.github/workflows/ci.yml`.

## Performance

| Metric | Budget | Measurement |
| --- | --- | --- |
| LCP | ≤ 2.5s | Lighthouse CI lab, p75 field when available |
| INP | ≤ 200ms | Field p75; TBT ≤ 200ms as the lab proxy |
| CLS | ≤ 0.1 | Lighthouse CI lab and field |
| Lighthouse performance | ≥ 90 | CI, representative pages |
| Lighthouse accessibility | ≥ 90, with zero critical/serious axe findings | CI |
| TTFB | < 800ms | Server timing on representative pages |

Measure on a mid-tier mobile profile over a throttled 4G connection, with a cold
cache. Do not use a developer laptop as the reference device.

## Resource budgets

| Resource | Budget |
| --- | --- |
| Initial JavaScript | ≤ 300 KB compressed |
| CSS | ≤ 100 KB compressed |
| Fonts | ≤ 100 KB total |
| Above-the-fold images | ≤ 500 KB |
| Total page weight | ≤ 1.5 MB |
| Third-party scripts | ≤ 200 KB |

Prefer self-hosted Geist, responsive AVIF/WebP images with explicit dimensions,
and server-rendered pages. Hydrate only interactive islands.

## Accessibility

- WCAG 2.2 AA for public and admin surfaces.
- Zero critical or serious axe violations in CI.
- Visible focus on every interactive element.
- Keyboard-only access to navigation, command palette, dialogs, searchable
  selects, table pagination, sidebar collapse, and the mobile drawer.
- Admin small text has a 12px floor.
- Reduced-motion preferences collapse non-essential transitions.

## Admin density

- Controls: 28–36px tall.
- Table rows: 36–60px depending on whether the row carries a two-line identity.
- Borders: 1px separators, no decorative shadows.
- One restrained accent, with lime reserved for active state and charts.

## CI gates

```bash
npm run check
npm run build
npx playwright test
npx lhci autorun
```

The Playwright suite covers interaction behavior, axe scans in both themes, and
visual regression snapshots. Lighthouse CI checks the design reference and the
admin dashboard.

## Exceptions

Any budget exception must be recorded in
[`quality-exceptions.md`](./quality-exceptions.md) with an owner, reason, and
expiry date. An expired exception fails review.
