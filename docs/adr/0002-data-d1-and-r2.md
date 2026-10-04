# ADR 0002 — Data: Cloudflare D1 for content, R2 for photos

- **Status:** Proposed (confirm with Sam / Tristan 2026-10-04)
- **Date:** 2026-10-04

## Context

The original brief suggested JSON on Vercel Blob or KV. Vercel is out (ADR 0001). The data is
tiny and single-tenant: editable text and prices, testimonials, gallery metadata, admin
sessions.

## Decision

- **D1 (SQLite)** for everything relational: `content_overrides`, `testimonials`,
  `gallery_items`, `sessions`, `audit_log`. Free tier is ample; no second vendor.
- **Overrides-only content** (LesK pattern): the default wording and prices live in code;
  a row exists only where Sam changed something. Reverting is a `DELETE`.
- **R2** for photos: content-hash keys, `Cache-Control: immutable`, custom domain
  (`img.comptoncleaning.co.uk`) for free egress. **Resize on upload** (client-side canvas to
  ~1600px JPEG/WebP before sending) because a phone camera photo is 5-10 MB and
  HairByRachel's review flagged the absence of this as its biggest cost risk.
- Money is **integer pence**; times stored UTC, shown Europe/London.

## Alternatives

- **Neon Postgres** (Wayfinder): more power than a brochure site needs, adds a vendor and a
  connection-role story. Revisit only if multi-tenancy or heavy relational queries appear.
- **KV/JSON blob:** no transactions, awkward audit trail; rejected.

## Consequences

- One platform and one bill. D1 backups via scheduled `wrangler d1 export` to R2 (add to
  roadmap before go-live).
- D1 does not give Postgres RLS; with a single tenant and server-only access this is fine.
