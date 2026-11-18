# Legal, privacy, and competition compliance

Public pages:

- `/legal/privacy` — data collected, use, sharing, retention, cookies, rights.
- `/legal/terms` — accounts, content licence, acceptable use, competitions,
  moderation, disclaimers, termination.
- `/legal/community-guidelines` — respect, accuracy, photo rights, anti-manipulation,
  reporting and appeals.
- `/competitions/[slug]` — generated rules, dates, timezone, prizes, eligibility.
- `/leaderboard` — provisional/final status, tie explanation, past winners.

## Compliance checklist

- [x] Data inventory documented (account, profile, content, usage, audit, cookies)
- [x] Retention policy documented (account, usage, 7-year privileged audit)
- [x] Cookie inventory documented (auth session, visitor dedupe, theme local storage)
- [x] Creator content licence and immutable-version behaviour described
- [x] Competition rules published from configuration before start
- [x] Prize funding and manual payout gating described
- [x] Moderation decisions and appeals described
- [x] No automatic money movement
- [x] Public pages avoid traveler identity exposure
- [x] Self-service JSON export is available at `/api/account/export`
- [x] Self-service account deletion is available on `/account` with typed confirmation
- [x] Deleted profiles are anonymized; templates are archived; private trips/saves/likes/reviews/notifications are removed
- [ ] Legal counsel review and final entity/contact details
- [ ] Cambodia-specific tax and payout advice for rewards
- [ ] Final privacy contact and data-request process assigned

The remaining items require external legal review and launch-owner sign-off.
