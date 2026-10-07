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

## Phase 4 — Work tracker for Sam (ADR 0008; started 2026-10-04)
Sam moves off Squeegee onto this site's /admin: customers (import, add on the doorstep with a location, filters, call/text/WhatsApp), rounds, a Work screen (due this week, DONE/MISSED with extras and payment, debts, payments), visit history, a colour-keyed map. ⚠️ Built and unit-tested, on staging only; nobody has used it on a phone. Session 5 added weather on the admin home and per round (open-meteo, ADR 0009) and photos on a visit (Take photo / From gallery); ⚠️ weather seen on a phone by Tristan, photos: Take photo confirmed working, the rest unchecked. Session 6 added Templates (`/admin/templates`: on/off + editable texts and emails, ADR 0010; ⚠️ Tristan saw "Coming tomorrow" switch off on his phone, the rest unchecked) and put the tracker on production (⚠️ nobody has signed in there yet). Session 7 (overnight, staging only; ⚠️ nothing seen on a phone, production not migrated or deployed) added: a **Settings hub**; payment methods Sam can add/rename/remove; **rounds** with names, days and a drag-to-order (and arrows) stop order that the Work screen follows; **rounds built on the fly from who's due that are temporary for 48 hours and can be saved** (ADR 0012, migration 0014); a Home "Rounds and best order" card; a planner start-point toggle (Home / Where I am); "Set up several" bulk setup and a last-cleaned correction for imported customers; "Add photos" after DONE and photo counts; a **Calendar** like Rachel's (day, week, month; rounds and call hours) and **call hours that switch the public Call button off** with an away message (ADR 0011); an **Earnings** page with CSV (ADR 0011, migration 0013); and the **route planner** built here, best order from Mapbox drive times (ADR 0012, which supersedes ADR 0008's "separate product" line). Next: take session 7 to production (migrate 0012-0014 first), real-phone checks, SMSWorks behind the templates. Later: invoices, cancellations and estimated earnings, a job timer, a road-following route line on the map.

## SEO: do it properly (Tristan 2026-10-04: "SEO the heck out of this")
A first-class goal, not a Phase 1 footnote. Local search is how Sam gets customers. To do, roughly in order:
- **Basics that ship with go-live:** unique `<title>` and meta description per page (and per language), canonical URLs,
  `hreflang` between `/` and `/cy`, `robots.txt`, `sitemap.xml`, Open Graph/Twitter cards with the logo, `lang` on `<html>` (done).
- **Local-business structured data:** JSON-LD `LocalBusiness`/`HomeAndConstructionBusiness` with name, phone, area served,
  opening hours, services (generated from the live services, including ones Sam adds), sameAs links, and real reviews only
  once there are some (never invented).
- **Area/service pages:** one real page per town (Bristol, Chepstow, Caldicot, Newport; BS16, BS5) and per service with
  genuine local content and photos; internal links from the home page. The services Sam adds should be able to get their own page.
- **Images:** real `alt` text from the captions Sam writes, width/height set (done for blocks), lazy loading (done), modern
  formats (done), descriptive file/route names.
- **Performance and Core Web Vitals:** mobile Lighthouse in the green; the dynamic render means caching (tags) is worth
  doing before launch (see NEXT_STEPS). Check the collapsing hero for layout shift (CLS).
- **Off-page:** Google Business Profile (the Maps listing; resolve which logo is canonical), Search Console and Bing
  Webmaster verification, citations (Yell, Checkatrade-style directories, Facebook), a Google review link and review requests.
- **Measure:** privacy-friendly analytics (cookie-free) and Search Console queries to guide what to write next.

## Later / maybe
Resend notification emails, quote-request form, gallery page, link-out to Wayfinder for
existing customers.

## Open questions
- Which Google account owns the Cloud project (Tristan's now, transfer later, or Sam's)?
- ~~D1 vs Neon~~ Decided: Neon Postgres (ADR 0005).
- Domain registrar and current DNS; is the site on Cloudflare already?
- Real prices, postcodes, insurance proof, review URL, photo consent.
