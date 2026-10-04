# Roadmap

Direction, not a task list (that's `NEXT_STEPS.md`). Update when scope or decisions change.

## Phase 0 — Foundations
Cloudflare access via Sam, repo scaffold, CI, staging and production Workers, domain.
Docs in place (this folder). Exit: "hello" deploys to staging from `git push`.

## Phase 1 — Public site
Mobile-first pages, sticky Call/WhatsApp bar, pricing (4-weekly, 8-weekly, one-off), postcode
coverage checker, trust section (only verified claims), testimonials, glass UI, squeegee scroll
bar, before/after slider (touch, keyboard accessible, reduced-motion safe). SEO basics and
local-business structured data. Exit: Lighthouse sane on a mid-range phone, Sam signs off.

## Phase 2 — Admin
Google sign-in (ADR 0003), sessions, allow-list. Admin mode with inline editing of text,
prices, testimonials (overrides-only in Postgres, audit log). One-tap photo uploader with client-side
resize to R2. WhatsApp review-request link generator. Exit: Sam changes a price on his phone.

The inline editing is the LesK-style pencil (`<Ed id>` + docked inspector, ADR 0004), not a form
in a separate dashboard. **Welsh** (`/cy`, same node ids, per-language overrides, reviewed by a
fluent speaker) ships with Phase 2 so the pencil edits either language from day one.

## Phase 3 — Hardening and go-live
database backups (Neon history retention + scheduled export), security headers/CSP, rate limiting on auth routes, accessibility
pass, DNS cutover, Google Business Profile and Search Console. Exit: live on the real domain.

## Later / maybe
Resend notification emails, quote-request form, gallery page, link-out to Wayfinder for
existing customers.

## Open questions
- Which Google account owns the Cloud project (Tristan's now, transfer later, or Sam's)?
- ~~D1 vs Neon~~ Decided: Neon Postgres (ADR 0005).
- Domain registrar and current DNS; is the site on Cloudflare already?
- Real prices, postcodes, insurance proof, review URL, photo consent.
