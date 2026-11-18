# Editorial review and sign-off

This checklist is the launch gate for #22. The seed is technically complete, but
the public catalog must not be advertised as reviewed until a human reviewer
signs each province.

## Current state

- 13 published provinces, 43 published destinations.
- Coordinates, summaries, descriptions, practical tips, categories, and tags
  are present.
- Every destination has at least one photo record with alt text and a rights
  note.
- All 43 photo records currently point at the placeholder illustration. Replace
  them with licensed photography and update `docs/content-rights.csv` before
  sign-off.

Run `npm run db:content-check` after edits. It fails on missing fields, unsafe
slugs, missing coordinates, coordinates outside Cambodia, missing photos, or
missing alt/rights text, and reports placeholder photo count.

## Province review

| Province | Destinations | Coordinates | Descriptions | Practical tips | Photos + rights | Reviewer | Date |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Battambang | 4 | [ ] | [ ] | [ ] | [ ] | | |
| Kampong Cham | 2 | [ ] | [ ] | [ ] | [ ] | | |
| Kampong Thom | 2 | [ ] | [ ] | [ ] | [ ] | | |
| Kampot | 4 | [ ] | [ ] | [ ] | [ ] | | |
| Kep | 3 | [ ] | [ ] | [ ] | [ ] | | |
| Koh Kong | 2 | [ ] | [ ] | [ ] | [ ] | | |
| Kratie | 3 | [ ] | [ ] | [ ] | [ ] | | |
| Mondulkiri | 3 | [ ] | [ ] | [ ] | [ ] | | |
| Phnom Penh | 5 | [ ] | [ ] | [ ] | [ ] | | |
| Preah Sihanouk | 3 | [ ] | [ ] | [ ] | [ ] | | |
| Preah Vihear | 2 | [ ] | [ ] | [ ] | [ ] | | |
| Ratanakiri | 3 | [ ] | [ ] | [ ] | [ ] | | |
| Siem Reap | 7 | [ ] | [ ] | [ ] | [ ] | | |

## Photo rights

For each replacement photo:

1. Record the asset URL/path, source, licence, credit line, and any restrictions
   in `docs/content-rights.csv`.
2. Confirm the licence permits commercial display and derivative resizing.
3. Upload through the admin media tool or use a stable external URL.
4. Set meaningful alt text and a rights note on the photo record.
5. Do not use a photo that shows identifiable people without permission.

## Accuracy checks

- Opening hours, prices, and transport are framed as guidance, not guarantees.
- Temple dress codes, protected-area rules, and safety notes are current.
- Place names match the province/category taxonomy.
- No copied descriptions from another site.
- No destination is presented as accessible when access is seasonal or closed.

## Sign-off

- [ ] All 13 province rows reviewed and checked.
- [ ] All placeholder photos replaced or explicitly approved for launch.
- [ ] `docs/content-rights.csv` covers every published photo.
- [ ] `npm run db:content-check` passes with `placeholderPhotos: 0`.
- [ ] Reviewer name, date, and any exceptions recorded here.

Reviewer: ____________________  Date: __________

Exceptions / follow-ups:

- 
