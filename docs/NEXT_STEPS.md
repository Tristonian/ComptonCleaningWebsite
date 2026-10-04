# Next steps — start-here backlog

The in-chat todo list doesn't survive a new session, so the live backlog lives here. Read
`ROADMAP.md` for direction, then pick up from this list. Keep it current.

_Last updated: **2026-10-04 (end of session 1)**. Staging is LIVE at
https://staging.comptoncleaning.co.uk. Production is not deployed and the real domain still has
no DNS records. Commits are local on `main` (a local `staging` branch exists); **nothing has been
pushed to GitHub**._

## State of play

| | |
|---|---|
| Staging | https://staging.comptoncleaning.co.uk (custom domain via `routes`; workers.dev is OFF) |
| Production | Not deployed. `comptoncleaning.co.uk` has 0 DNS records. |
| Cloudflare | Sam's account `f63f844d70738925fc7fb251893122cc`, Tristan is a member. Always pin `CLOUDFLARE_ACCOUNT_ID`. |
| Data | **Neon Postgres** (ADR 0005, Sam's Neon account): branches `production` / `staging` / `dev`; `db/migrations/0001_init.sql` applied to `staging` + `dev`, NOT yet to `production`. R2 `compton-cleaning-images(-staging)`. D1 was deleted 2026-10-04. |
| Auth | Google OAuth (ADR 0003). Consent screen in **Testing**; test users: Sam + Tristan. |
| Local | `npm run dev` -> http://localhost:3000, against the Neon `dev` branch (`DATABASE_URL` in `.env.local`; migrate with `npm run db:migrate`). 66 tests (PGlite = real Postgres), `tsc` and `next build` clean. |

## ⚠️ Not verified (be honest about these)

- ✅ **Google login confirmed working on staging** (Tristan, end of session 1, after saving the
  staging redirect URI in the Google client). Still unchecked: Sam's own login, and login on a phone.
- **The pencil has never been used in a browser**: tap text, type, Save, Revert, reload.
- **Nothing has been seen on a real phone.**
- **Welsh is machine-drafted** (`src/content/cy.ts`). A fluent speaker must review it before launch.

## Do first next session

- [x] Google redirect URI saved; Tristan signed in on staging. [ ] Sam to sign in once (expect the
      "hasn't verified this app" screen: Advanced -> Continue).
- [ ] Use the pencil on staging: change the heading in English and in Welsh, Save, reload, Revert.
- [ ] Push `main` + `staging` to GitHub (repo is public: `.env.local` ignored and verified, re-check).
- [ ] CI (`typecheck`, `test`, `audit`) and `deploy.yml`; needs a Cloudflare API token with Workers,
      R2 and **DNS** edit (wrangler's own login token cannot edit DNS) in GitHub secrets.
- [ ] Add Tristan as Owner on the Google Cloud project (IAM).

## Built 2026-10-04 (session 2): deployed to staging, NOT yet seen on a real phone

- One-page site from Sam's sketch: hero (CCS card style, hamburger), About (no heading), Services,
  Prices, Contact, Reviews (with Sam's Google review link, `REVIEW_URL` in `src/lib/business.ts`);
  sticky anchor bar. All text is `<Ed>` with draft Welsh. Hero is a CSS approximation of the card.
- Contact form (name, address, postcode, contact, optional notes): stored in Postgres `enquiries` first
  (`src/lib/enquiries-store.ts`), then emailed through **Resend** (`src/lib/mail.ts`,
  plain fetch) from `enquiry@comptoncleaning.co.uk` to `ENQUIRY_TO` (Sam only on staging).
  **Verified end to end on staging** (enquiry arrived in an inbox). Abuse controls: honeypot, field
  limits, rate limit 3/hour per sender (salted IP hash) and 40/day site-wide (`RATE_LIMIT` in
  `src/lib/enquiry.ts`). The rate limit and the notes field were deployed but **not yet exercised**.
- Sending as / receiving at `hello@` works (see `INFRASTRUCTURE.md` section 3).
- Enquiries are only in the database and email: there is **no admin view of them yet**.
  Query: `neon psql staging` (or the Neon console SQL editor) then `SELECT * FROM enquiries ORDER BY id DESC;`.

### Moved D1 -> Neon Postgres (session 2, ADR 0005): verified on staging, not yet in production
- Code: `src/lib/db.ts` (`Db` = `query` + `transaction`, Neon HTTP driver), store/session/enquiries
  rewritten for Postgres, tests on PGlite. Old D1 migrations and the SQLite fake were deleted.
- Staging Worker reads from the Neon `staging` branch (the migrated £35 price override shows on the page);
  real-driver transactions, rollback and `RETURNING` were checked on the `dev` branch.
- NOT exercised on the wire after the move: Google login (session create/resolve), a pencil save, and a
  contact-form submit on staging. Do these first (Sam's inbox gets the email: warn him, or set
  `ENQUIRY_TO` to Tristan for the test).
- Sam's future `/admin` (calendar, slotting people in, enquiries, notes) is the reason for Postgres. Keep
  the round-planner/route work in WindowsWayfinder (CLAUDE.md); decide the overlap when starting it.

### Added later in session 2 (all on staging)
- Logo: the card artwork (`public/ccs-logo.png`) replaces the CSS wordmark; its edges are feathered
  into the hero gradient (`.hero`, `.logo-feather` in `globals.css`). Low-res: ask Sam for the vector/original.
- **Welsh switch bug fixed**: `LangSwitch` was a `next/link`; soft navigation kept the layout's old
  language. It is now a plain `<a>` (full load). Do not turn it back into a `Link`.
- Hamburger is a fixed bubble (follows the scroll); the pencil's Edit button moved to bottom-right.
- Contact shortcuts: Call, Text (sms:), WhatsApp (`WHATSAPP_URL`, assumes the number is on WhatsApp:
  confirm with Sam), Email (`mailto:hello@`).
- Form: separate **postcode** (validated UK shape, stored normalised; migration 0004), notes, and a
  Google Maps search link in the enquiry email (no API key).
- **Tested at 375px (local dev frame) and via the form**: layout, bubble, no horizontal scroll; 3
  enquiries accepted, the 4th rate-limited with the on-page message. Still not tested on a real phone.
  Dev only: `next.config.mjs` omits `X-Frame-Options` in development so the site can be framed at
  phone width; production still sends DENY (verified on staging).

### Ideas from Tristan, not built
- [ ] **Detect my location** as an alternative to typing: a "Use my location" button ->
      `navigator.geolocation` -> reverse-geocode to a postcode (free, key-less: postcodes.io) -> fills
      postcode/address. Needs `geolocation=(self)` in the `Permissions-Policy` header (currently `()`),
      and a graceful fallback when permission is denied. A postcode centroid is not a house, so Sam
      still gets the typed address.
- **Decision (Tristan, 2026-10-04): Mapbox** for the map pin (about 50k map loads and 100k geocoding
  requests free a month, no Google billing; verify current limits). Needs a Mapbox account and a
  URL-restricted public token (Sam's account, or shared with WindowsWayfinder: decide once).
  postcodes.io for "use my location" -> postcode. The options below are kept for the record.
- [ ] **Map pin to confirm** the location, included in the enquiry email. Options: Google Maps JS +
      Geocoding (best UK address accuracy; needs a Google Cloud billing account and a referrer-restricted
      key; there is a monthly free allowance per product, check current pricing) vs key-less
      OpenStreetMap/Leaflet tiles + postcodes.io (free, postcode-level). WindowsWayfinder has NOT chosen
      a maps provider (its NEXT_STEPS lists Google vs Mapbox as an open question): decide once, together.
      Loading Google scripts also affects the privacy/cookie wording.
- [ ] **Achievements** like HairByRachel (`src/lib/achievements*.ts` there): later.
- Database access control: RLS is on for every table (migration + `ensure_rls` trigger), the Neon Data
  API and Neon Auth are OFF, and the browser never talks to the database. Keep it that way: only server
  actions and admin routes (each re-checking `getAdmin()`) may read `enquiries`; never add a public read route.

### Next (in order)
- [ ] Look at staging on a real phone: hero, hamburger, sticky bar, form, then exercise the rate limit.
- [ ] Inline photo upload/replace/zoom (R2, resize before upload, content-hash keys; ADR 0002);
      add photo slots to Services and the hero. Decide the canonical logo (card teal vs Maps navy).
- [ ] Admin list of enquiries for Sam (the pencil's admin area), with a place for his own notes.
- [ ] Real reviews (none invented), Sam's real price, postcode checker, before/after slider.
- [ ] Production: migrate 0001-0003, set secrets (incl. `RESEND_API`, `ENQUIRY_TO`), DNS, push to GitHub.

## SEO (replaces Sam's ~£100/month agency; no ranking guarantees)

- [ ] Ask Sam what the agency actually provides (invoice/contract), who owns the domain, any
      existing site and the Google Business Profile, and any minimum term. Do not cancel until the
      new site is live and indexed. Does the domain currently point at anything?
- [ ] LocalBusiness JSON-LD (name, phone, areas served, services).
- [ ] Area pages (Lyde Green, BS16, BS5, Chepstow, Caldicot, Newport), editable with the pencil.
- [ ] Sitemap, hreflang for `/cy`, robots, titles/descriptions per page; Search Console set up.
- [ ] Sam: add `comptoncleaning.co.uk` to the Business Profile ("Add website"), keep photos and
      service areas current, ask every happy customer for a review (link: `REVIEW_URL` in
      `src/lib/business.ts`). Keep name/address/phone identical everywhere.
- [ ] Decide which logo is canonical: the Maps listing (navy, sparkles) vs the card (teal).

## Production (when the pages are worth showing)

- [ ] `npm run db:migrate:production`; set the four secrets on the production Worker with a NEW
      `SESSION_SECRET` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_ALLOWED_EMAILS`,
      `SESSION_SECRET`); verify each is non-empty through the live Worker.
- [ ] Add `https://comptoncleaning.co.uk/api/auth/google/callback` to the Google client.
- [ ] Add `routes` custom domain for the apex (+ `www` redirect) in `wrangler.jsonc`, deploy.
- [ ] Publish the Google consent screen once there is a homepage + privacy policy URL.

## The fun part (Phase 1/2, see ROADMAP)

- [ ] Public pages with `<Ed>` on every string: hero, pricing (4-weekly / 8-weekly / one-off),
      postcode checker, trust section (only verified claims), testimonials, sticky Call/WhatsApp bar.
- [ ] Glass UI, squeegee scroll bar, before/after slider (touch, keyboard, reduced-motion safe).
- [ ] One-tap photo uploader (resize in the browser before upload; R2 content-hash keys).
- [ ] WhatsApp review-link generator for Sam.
- [ ] Welsh: hreflang alternates + sitemap entries; get the wording reviewed.
- [ ] Pencil v2 if wanted: typography + site theme (LesK has `style.ts` and the Inspector tabs).
- [ ] Security hardening before go-live: CSP, rate limit on `/api/auth/*`, database backups (Neon history retention up from 6h + scheduled export).
- [ ] Layout is dynamic (cookie + Neon per request); add tag caching only if measurably slow.

## Business facts still needed from Sam

Prices, postcodes covered, WhatsApp/phone number, insurer + cover amount (no badges until proven),
Google Business Profile review URL, photo consent, whether he wants an `@comptoncleaning.co.uk`
address (Cloudflare Email Routing can forward it to his Gmail for free).
