# Creator Studio

Creator Studio is the signed-in workspace for travel templates.

## Routes

| Route | Purpose |
| --- | --- |
| `/creator` | Template list, search, status filter, onboarding, lifecycle actions. |
| `/creator/templates/[id]` | Six-step template builder. See `docs/template-builder.md`. |
| `POST /api/creator/templates` | Create a draft. Returns `201` with the template id, slug, and status. |
| `POST /api/creator/templates/[id]/submit-review` | Move a draft or rejected template to pending review. |
| `POST /api/creator/templates/[id]/duplicate` | Create an independent draft with copied days and items. |
| `POST /api/creator/templates/[id]/archive` | Hide the template while preserving version attribution. |
| `POST /api/creator/templates/[id]/restore` | Return an archived template to draft. |

All creator queries include `creatorId = session user id`. A template owned by
another member returns `404`, not `403`, to avoid leaking existence.

## Lifecycle

```text
DRAFT -> PENDING_REVIEW -> PUBLISHED -> UNLISTED / ARCHIVED
                    \-> REJECTED -> PENDING_REVIEW
```

- Creating a template always produces an independent draft.
- Duplicating copies metadata, days, and items into a new draft; the original is
  untouched.
- Archiving requires confirmation and does not delete versions or attribution.
- Submitting is allowed only from draft or rejected states.
- Restoring is allowed only from archived and returns the template to draft.

The public publish transition is handled by the moderation/publish flow (#28).

## Profile

The first visit creates a `MemberProfile` using the auth display name or email
prefix. Usernames are lowercase, URL-safe, and unique. The page shows the current
handle; profile editing and the public profile page arrive with #30.

## UI behavior

- Server-rendered forms work without JavaScript.
- Creator Studio uses soft navigation: lifecycle actions and search replace the
  studio content from the server response without a full page reload. The URL,
  browser history, and back/forward behavior stay correct.
- A confirmation is shown before archive, and submit buttons show a disabled
  “Working…” state.
- Errors are shown from a small allowlist of codes, not reflected raw text.
- Empty states distinguish “no templates yet” from “no filter matches”.
- Status chips use the same labels and explanations across the studio.

## Verification

Authenticated tests run with `AUTH_E2E=true`:

```bash
npm run test:auth
```

They cover create, rename, submit, duplicate, archive, restore, API lifecycle
errors, unauthenticated access, and cross-creator ownership.
