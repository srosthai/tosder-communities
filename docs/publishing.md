# Publishing, moderation, and public templates

## Creator publishing

- **Untrusted creators** submit a complete draft for review. The server validates
  basics, trip details, days, items, coordinates, budget ordering, and times.
- **Trusted creators** can publish immediately from the builder. Trust is stored
  on `MemberProfile.trusted_creator` and is assigned by an administrator until
  the role model (#47) lands.
- **Email verification** is required. Until SMTP delivery is available (#63),
  content-admin emails can publish as a temporary operational bypass.
- **Visibility** is public or unlisted. Unlisted templates keep a private version
  but are excluded from public queries and the sitemap.

## Versions

Publishing builds a canonical JSON snapshot of the live template:

```json
{
  "template": { "title": "...", "slug": "...", "province": { "name": "...", "slug": "..." } },
  "days": [{ "dayNumber": 1, "items": [{ "title": "...", "destinationSlug": "..." }] }]
}
```

- The hash of the canonical snapshot is stored on `template_versions`.
- Repeating a publish with the same content reuses the existing version; no
  duplicate version is created.
- Editing the draft and publishing again creates a new version and points the
  template at it.
- A database trigger rejects updates to version rows.
- Draft changes do not change the public page until a new version is published.

## Moderation

The admin queue lives at `/admin/moderation` and is limited to
`CONTENT_ADMIN_EMAILS` until RBAC. It lists `PENDING_REVIEW` templates and links
to a full preview.

- **Approve** creates or reuses the immutable version and publishes the template
  as public or unlisted.
- **Request changes** stores the reason, marks the template `REJECTED`, and shows
  the reason in the builder with a path to revise and resubmit.
- Every decision writes an audit event.

## Public surfaces

| Route | Behavior |
| --- | --- |
| `/templates` | Published, public templates with search and pagination. |
| `/templates/[slug]` | Live version snapshot, schedule, map, creator card, counts, Use Template. |
| `/templates/[slug]/use` | Signed-out visitors go through sign-in and return here; signed-in visitors continue to trip copying. |
| `/creators/[username]` | Public profile with published templates only. |
| `/sitemap.xml` | Published templates and their creators. |

Only `PUBLISHED` templates with a `published_version_id` are public. Drafts,
rejected, archived, unlisted, and pending templates return `404`.

## Current limitations

- Public like/save actions wait for the engagement milestone (#38).
- Notifications are in-app status changes and audit events; email delivery needs
  SMTP (#63).
- Revision publishing for untrusted creators is handled by moderation.
