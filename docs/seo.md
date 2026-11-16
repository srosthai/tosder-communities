# SEO and sharing

Public pages carry canonical URLs, Open Graph/Twitter metadata, robots rules, a
dynamic sitemap, and JSON-LD structure. Auth, account, admin, status, and
filtered search pages are intentionally excluded from indexing.

## Metadata

- `BaseLayout` owns the canonical, robots, Open Graph, Twitter, and JSON-LD
  output.
- Home is a `WebSite` with a `SearchAction` pointing at `/explore?q=`.
- Destination detail is a `TouristAttraction` with address, country, and geo
  coordinates.
- The default social image is `public/image/og-default.png` (1200×630). Replace
  it with a branded production image and destination-specific photos before
  launch.
- `noindex` is set for admin, auth, account, status, error, and filtered
  Explore pages.

## Sitemap and robots

- `/sitemap.xml` is generated from static public paths plus every published
  destination.
- `/robots.txt` allows public content and disallows admin, API, account, auth,
  and status routes.
- Both use the request origin, so preview and production origins produce
  correct absolute URLs.

## Localization

English is the launch language. The schema and copy keep the door open for
Khmer, but localized routing, hreflang, and translated metadata are evaluated
after launch. This matches decision D-012.

## Verification

`tests/public/seo.spec.ts` checks canonical URLs, robots directives, social
metadata, WebSite and TouristAttraction JSON-LD, sitemap inclusion/exclusion,
and the robots sitemap reference.
