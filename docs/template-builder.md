# Template builder

The builder lives at `/creator/templates/[id]` and is scoped to the signed-in
creator.

## Steps

1. **Basics** — title, editable slug, summary, description, cover image URL,
   province, language, and the derived duration.
2. **Trip details** — style, best season, USD budget range, transport, and
   audience.
3. **Daily plan** — ordered days and items with times, type, destination link or
   custom activity, duration, cost, description, tips, and photo URL.
4. **Map & logistics** — ordered stops, linked destinations on a Leaflet map,
   and free-form travel notes.
5. **Preview** — the itinerary rendered in a traveler-facing layout.
6. **Publish** — blocking issues, warnings, guidelines acknowledgement, and the
   handoff to moderation.

Creators can jump between steps at any time. Completion state is derived from
the draft, not stored separately. Step changes and plan actions use server-backed
soft navigation, so the page updates in place without a full reload.

## Saving

- Metadata forms and day/item forms autosave 900ms after the last edit.
- The header shows `Unsaved changes`, `Saving…`, `Saved`, or the error.
- In-flight saves are versioned; an older response cannot mark a newer edit as
  saved.
- Step links flush pending saves before navigating.
- `beforeunload` warns when changes are still unsaved.
- Item forms also have an explicit **Save item** button for keyboard and
  no-JavaScript fallback.
- All step and plan actions are submitted with `fetch`, and only the builder
  region is replaced. Browser history and back/forward navigation still work.

Server validation runs again on every save. Explicit submissions use
POST/Redirect/GET, so refreshing after a validation error does not resubmit the
old form.

## Daily plan rules

- `(template_id, day_number)` and `(day_id, sort_order)` are unique.
- Move up/down uses a transaction with temporary offsets, so unique constraints
  never collide mid-reorder.
- Duplicating a day or item creates independent rows.
- Removing a day or item renumbers the remaining order.
- End time cannot precede start time.
- Overlapping timed items produce a warning, not a hard block.
- Linked destinations must be published; otherwise creators use a custom
  activity.

## Validation

- Basics: title, URL slug, summary, and province.
- Trip details: style, season, transport, audience, and budget ordering.
- Daily plan: at least one day, one item per day, item titles, and valid times.
- Publish: all of the above plus verified email; warnings cover missing cover,
  description, logistics notes, custom-only days, and schedule overlaps.

Publishing a full immutable version is completed by the moderation milestone
(#28). The builder currently hands off to the existing review transition.

## Verification

`AUTH_E2E=true npm run test:auth` covers:

- step validation
- autosave across reloads
- item reordering by keyboard
- duplicate and remove
- schedule conflict warnings
- map notes and preview
- mobile layout and horizontal-scroll budget
- owner-only access
