# Admin content management

The content workspace lives under `/admin/content`. It is intentionally dense:
a searchable destination table, a focused editor, and an activity trail.

## Access

Until role-based access control (#47) lands, content editing is limited to the
emails listed in `CONTENT_ADMIN_EMAILS`:

```dotenv
CONTENT_ADMIN_EMAILS="editor@example.com,admin@example.com"
```

- Signed-out visitors are redirected to `/sign-in`.
- Signed-in users outside the allowlist see a read-only notice and cannot
  submit mutations.
- The destination listing and public pages remain readable, but every editor
  route and mutation is guarded server-side.

## Destination workflow

1. **Create** a destination from `/admin/content/new`.
2. Fill basics, content, coordinates, classification, and photos.
3. Save as a **draft**, then use **Preview draft** to see the public layout.
4. Set status to **Published** and save. Publishing validates:
   - name and unique slug
   - province
   - summary, description, and coordinates
   - at least one photo with alt text and a rights note
5. **Archive** the destination to remove it from public queries without
   deleting its rows or references.

Photos are ordered by their position in the editor. The **Move up** and
**Move down** controls reorder the fieldsets, and the submitted order is
persisted as `sortOrder`.

## Audit trail

Every create, update, and status change writes an `audit_events` row in the same
database transaction as the destination mutation. The edit page shows the ten
most recent events with the actor email and timestamp.

Events use these actions:

- `destination.created`
- `destination.updated`
- `destination.status_changed`

## Validation rules

Validation lives in `src/lib/admin-content.ts` and runs again on the server for
every submission. Client-side constraints are only a convenience.

## Known gaps

- Photo fields currently accept URLs. Uploads, cropping, metadata stripping,
  and responsive variants require the object-storage pipeline.
- Province, category, tag, and featured-collection management still needs
  dedicated screens.
- The email allowlist is temporary; RBAC (#47) replaces it.
