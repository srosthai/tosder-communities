# Starter destination dataset

`prisma/seed.mjs` is the idempotent import for the launch dataset. Re-running it
updates existing records by slug instead of creating duplicates.

## Coverage

- **13 provinces:** Siem Reap, Kampot, Preah Sihanouk, Phnom Penh, Kep, Kratie,
  Preah Vihear, Battambang, Mondulkiri, Ratanakiri, Kampong Thom, Kampong Cham,
  and Koh Kong.
- **43 published destinations** across coast, plains, highlands, and the Mekong.
- Every destination has a unique slug, province, summary, description, practical
  tips, coordinates, categories, tags, and at least one photo record with alt
  text and a rights note.

## Running the import

```bash
npm run db:seed
npm run db:content-check
```

`db:content-check` fails when the published dataset drops below 8 provinces or
40 destinations, or when a destination is missing required editorial fields,
coordinates, or photo rights.

## Photo rights

The launch seed uses the Tosder placeholder illustration until the licensed
photo pipeline is available. The asset and rights record are documented in
`docs/content-rights.csv`; the seed stores the same credit on every photo row.

Do not add an external photo without recording its source, license, and credit
in the CSV and the seed photo record.

## Editorial review checklist

Review each province before launch:

- [ ] Province name, slug, and summary are correct.
- [ ] Every destination is in the right province and has verified coordinates.
- [ ] Descriptions are original and do not copy another site.
- [ ] Practical tips avoid unverified prices and opening hours.
- [ ] Categories and tags match the place.
- [ ] Every photo has source, license, credit, and meaningful alt text.
- [ ] Slug is stable and human-readable.
- [ ] Reviewer name and date are recorded in the launch issue.

## Sign-off

Accuracy and photo licensing require a human reviewer. Record the reviewer,
date, province list, and any exceptions in issue #22 before closing it.
