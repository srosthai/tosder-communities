# Object storage and photo uploads

## Bucket

The Neon object-storage bucket is `tosder-media` with `public_read`. Public pages
may read objects; writes require S3 credentials that stay server-side.

## Upload flow

`POST /api/admin/media` is content-admin only and accepts multipart form data:

- `file` — JPEG, PNG, WebP, or AVIF, 8 MB maximum
- `alt` — required screen-reader description
- `credit` — optional photographer/licence/source note
- optional `cropLeft`, `cropTop`, `cropWidth`, `cropHeight`

The server:

1. validates the MIME type and size before reading the image
2. auto-orients and strips metadata with `sharp`
3. optionally crops using the supplied rectangle
4. writes 480, 960, and 1600 px WebP variants under
   `destinations/<year>/<uuid>-<width>.webp`
5. returns the public URL and variant map

The destination editor fills the first empty photo row from the response. The
editor still accepts external URLs for licensed photography that is already
hosted elsewhere.

## Environment

Set these in Vercel and in local `.env.local`:

```text
S3_ENDPOINT
S3_REGION
S3_BUCKET=tosder-media
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_PUBLIC_BASE_URL
```

If the storage variables are absent, uploads return `503` with
`storage_not_configured`; URL-based photography keeps working.

## Limits and safety

- no SVG or animated formats
- 8 MB request limit
- no service-role key in client code
- upload requires an authenticated content administrator
- every admin mutation is audited; uploads are attributed by request id and
  actor session

Create a scoped storage credential in Neon and store it only in the hosting
environment. Rotate it if it is ever exposed.
