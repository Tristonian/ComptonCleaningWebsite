# Next steps — start-here backlog

The in-chat todo list doesn't survive a new session, so the live backlog lives here. Read
`ROADMAP.md` for direction, then pick up from this list. Keep it current.

_Last updated: **2026-10-04 (end of session 2)**. Staging is LIVE at https://staging.comptoncleaning.co.uk. Production is not deployed and the real domain still has no website DNS records. `main` and `staging` are pushed to GitHub (`origin`); no CI/deploy workflow exists yet, so a push deploys nothing._

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

### Location + map pin (session 2): built, tested locally, deployed to staging
- Contact form: **"Use my location"** (browser geolocation -> postcodes.io reverse lookup -> fills the
  postcode, and the street via Mapbox reverse geocoding), and a **draggable Mapbox pin** that appears once
  there is a location (typed postcode -> postcodes.io lookup, or detected). Tap the map or drag to confirm;
  the address/postcode follow the pin. Optional everywhere: the typed form still works if location is
  blocked, the lookup fails or WebGL/the token fails (`PinMap` -> `onFail`).
- Saved: `enquiries.lat/lng` (migration `0002_enquiry_location.sql`, applied to dev + staging). The
  enquiry email's Google Maps link points at the pin ("Pin confirmed by the customer") or falls back to an
  address search. Implausible coordinates (outside the UK/Ireland box) are dropped (`src/lib/geo.ts`).
- Mapbox token: `MAPBOX_TOKEN` (public `pk.`, read at request time in `HomePage`, passed to the form;
  Worker secret on staging; production still to set). **URL-restricted in the Mapbox dashboard (no
  wildcards): verified 403 for other referrers and for no referrer.** Old token was rotated.
  mapbox-gl is loaded on demand only when a pin first shows (`next/dynamic`, not on the first paint).
- `Permissions-Policy` now `geolocation=(self)` (was `()`).
- Verified locally on the dev branch: postcode -> map + pin, tapping the map moved the pin and filled
  "98 Park Road", and a full submit stored lat/lng (test row removed). **NOT verified: the "Use my
  location" button itself (needs a real browser permission prompt: try it on a phone), the map on a real
  phone, drag (vs tap) on a touchscreen, and the pin on staging.**
- Privacy: Mapbox and postcodes.io are called from the visitor's browser; the privacy policy (needed
  before the Google consent screen is published) must say so. Mapbox's free allowance is ~50k map loads
  and 100k geocoding requests a month (check current pricing); set a usage alert in the Mapbox account.

### Form checks, enquiry email, logo (session 2, later)
- **Phone and email are separate fields**, at least one required. Phone: UK numbers only, normalised to
  `+447...` (`normalisePhone`, rejects pagers/personal numbers/fake repeats). Email: format check
  (`normaliseEmail`) plus a **DNS check that the domain can receive mail** (Cloudflare DNS-over-HTTPS; a
  non-existent domain like `gmial.con` is refused). Postcode: shape check plus a **postcodes.io existence
  check**. All three give instant inline errors in the form and are re-checked on the server. The lookups
  **fail open** (`src/lib/verify.ts`): a lookup service being down never turns a customer away.
  DB: `enquiries.phone`, `.email` (migration 0003; `contact` is kept as a readable join), CHECK that one exists.
- **The pin must be confirmed:** when a map is showing, Send is blocked until the visitor taps the map or
  drags the pin (or uses "Use my location"); the form scrolls to the map and says why. Nothing is forced
  when the map cannot show (no token, no WebGL, blocked) or no pin exists yet (unknown postcode).
  The server cannot enforce this (it cannot know the map was available), so it is client-side by design.
- **Enquiry email to Sam:** attached Mapbox static map (fetched server side with our Referer), big "Open in
  Google Maps" and "Get directions" buttons, tap-to-call phone and mailto email, and an honest pin label
  (confirmed / approximate postcode centre / none). Needs checking in a real inbox (Gmail + phone) and in
  Outlook/Apple Mail.
- **"Use my location" only places the pin**: the visitor must still tap/drag it ("Location confirmed" only
  appears after they do). Whatever location or a moved pin filled in is shown in a small card, "We found
  this address. Is it right?" (street + postcode, Yes / No I'll fix it); Send is blocked until they answer or
  edit the fields. Phone placeholder is the generic `07xxx xxxxxx` (a real-looking example can read as a
  real person's number). Tested in a browser frame at 375px with a real tap; NOT tested with a real phone's
  geolocation prompt.
- Logo is white-on-transparent (`public/ccs-logo.png`, original in `docs/assets/`): no soft edge.
- Pushed to GitHub (`origin`): `main` and `staging`. No workflows exist yet, so pushing deploys nothing.

### Enquiry inbox in /admin (session 2): built; tested locally against a real database, NOT on a real device
- `/admin` is a dashboard: **Enquiries** (with an unread count), **See the site**, "Back to the website" bar on every
  admin page. `/admin/enquiries` lists them (filter chips by status with counts, unread dots, newest first).
  `/admin/enquiries/[id]` shows: Call / Text / WhatsApp / Email buttons, the job (service, where they heard of us,
  their notes), address with the **confirmed pin on a map** plus Open in Maps and Directions, a status selector
  (New / Contacted / Quoted / Booked / Lost), Sam's **private notes**, a **Reply** form (templates, sent as
  `hello@`, replies land back in his inbox; each is logged on the enquiry), and **Add as a customer**.
- Data: migration 0005 (`enquiries.status/admin_notes/read_at/customer_id`, `customers`, `enquiry_replies`, RLS on).
  Logic in `src/lib/enquiries-admin.ts` (unit tested on PGlite, which now returns bigint as strings like Neon);
  actions in `src/app/admin/enquiries/actions.ts` re-check `getAdmin()` every time.
- Verified in a browser at 375px with a minted dev session: list, filters, detail, status change, notes, add as
  customer (idempotent), phone-only enquiry (no reply form). **NOT verified: actually sending a reply** (it would
  email a real address; the send path is the same Resend call as the enquiry email), a real Google login, a phone.
- Reply templates are code (`src/lib/reply-templates.ts`): editing them in the admin is the "template emails" idea.

### Sam's tracker / planner: ideas from Tristan (not started; read before designing)
Tristan's goal: get this working **for Sam first**. WindowsWayfinder has stalled; much of its idea set
(rounds, planner, payments) now belongs here. ⚠️ CLAUDE.md and ADR 0005 still say "do not merge the two":
that rule needs an explicit decision and an ADR (supersede it) before building, then update CLAUDE.md.
- **Rounds and the week:** customers on rounds, "due this week" list, the round for the day.
- **Check-out / done view:** tap a job done; money owed (debts) and payments taken.
- **Work planner with a start/done timer** so Sam can see how long jobs really take (feeds pricing).
- **Cancellations:** record how often customers cancel, to estimate how many of a round might cancel and
  feed that into **estimated earnings** (expected vs booked).
- **Prices with a house animation** (Tristan): small / medium / large house; as you scroll the price counts up and the
  house animates, windows going from dull to sparkly. Respect `prefers-reduced-motion` (show the final state), keep
  it light (CSS/SVG, no big library), prices from `business.ts` / `<Ed>` so Sam can edit them, no sound.
- **Location ideas (Tristan) - read the privacy notes before building anything:**
  - "Track Sam all day to show which location he is near" (for him, in the admin): a website cannot track in the
    background reliably; it needs an installed app/PWA with Sam opting in, or he taps "I'm here". Only Sam sees it,
    shown as the nearest customer/round, short retention, and a switch to turn it off. UK GDPR applies if anyone
    other than Sam is ever tracked.
  - "Where has Sam been this week on the front page": **do not show a real location history on the public site.**
    It tells strangers when he is away and where, and can point at customers' homes. If wanted, show only a coarse,
    delayed, opt-in line such as "This week: BS16, BS5, Chepstow" built from completed jobs (postcode districts),
    never GPS points, never live, never a street.
- **Weather forecast in the planner/admin** (Tristan, 2026-10-04): rain, wind and frost for the week and
  per round/day, so Sam can move jobs (rain matters for windows, wind/ice for ladders and gutters).
  Likely free, key-less source to evaluate first: Open-Meteo (needs lat/lng, which the confirmed pin
  already gives us per customer); also consider the Met Office DataHub. Cache per area/day, call from the
  server, never from the browser.
- **Referrals and review promos (like HairByRachel):** (1) "Referred by" asks for the referrer's **full name**; when
  the new customer books/pays, both get a discount (record who referred whom; guard against self-referral
  and name typos: match on the existing customer, confirm in the admin before the discount applies). (2) A
  customer who leaves a Google review gets a small **promo code** (the review link is `REVIEW_URL`; Google
  gives no API to verify a review, so it is honour-based or Sam ticks "review seen" in the admin and the code
  is sent as a template email). Needs: customers table, referral link, promo codes (single-use, expiry), and
  Sam approving each one. Read HairByRachel's referral and promo code first and reuse the shape.
  The contact form's "Where did you hear about us" drop-down already records a `recommendation` source:
  a follow-up question "who recommended you?" can feed this later.
- **Template emails:** send and edit templated emails (confirmations, reminders, "we are on our way",
  review requests) from the admin. Reuse the Resend setup (`src/lib/mail.ts`, `hello@` for replies).
- **Crossover with the HairByRachel /admin:** look at how Rachel's admin does appointments, templates and
  reminders and reuse the patterns (house style = HairByRachel). Do that read first; do not copy GPL code.
- Data fits Postgres (ADR 0005): customers, properties (with the confirmed lat/lng), rounds, jobs, payments,
  cancellations, templates, all with RLS on and every route behind `getAdmin()`.

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

### Ideas from Tristan
- [x] **Detect my location** and **map pin** (Mapbox, decided 2026-10-04): built, see "Location + map pin" above.
  WindowsWayfinder still has no maps provider: reuse this Mapbox account/decision if it needs one.
- [ ] **Achievements** like HairByRachel (`src/lib/achievements*.ts` there): later.
- Database access control: RLS is on for every table (migration + `ensure_rls` trigger), the Neon Data
  API and Neon Auth are OFF, and the browser never talks to the database. Keep it that way: only server
  actions and admin routes (each re-checking `getAdmin()`) may read `enquiries`; never add a public read route.

### Next (in order)
- [ ] **Re-verify on staging after the Neon move and all the form changes** (nothing here has been done by a human
      on a real device): Google login, a pencil save, a contact-form submit (Sam gets the email: warn him or set
      `ENQUIRY_TO` to Tristan for the test), the email in Gmail on a phone, "Use my location" with a real
      permission prompt, pinch zoom and wheel zoom on the map (the test browser froze on wheel events, so wheel
      zoom is UNTESTED), the sent confirmation, the hamburger/sticky bar, the Welsh switch.
- [x] **Logo upload + colour picker** (built 2026-10-04, UNVERIFIED in a browser/phone): `/admin/appearance`
      (upload -> cropper adapted from HairByRachel -> PNG -> R2 `logo/<sha256>`, served by `/img/[hash]`;
      pick/delete logos; hero colour picker with contrast warning). Tables `site_images`, `site_settings`
      (migration 0006: run `npm run db:migrate` on each branch). Hero now collapses on scroll (`HeroHeader`):
      logo to 10%, thin pinned bar, nav sticks at `top-11`. The website line under the logo was removed.
- [x] **Free-placement photos + text blocks** (built 2026-10-04, UNVERIFIED on a phone; ADR 0006, migration 0007):
      pencil on -> each zone (under intro/Services/Prices/Reviews) shows Add photos (several at once, or drop files),
      Add text, drag to arrange, up/down buttons, edit caption/text per language, delete. Not done: two-up photo
      layouts, reordering the built-in sections, more zones, touch drag.
      Also built: add/edit/move/delete your own services (e.g. Pressure washing), two zones per service card
      (under title / under text; GIFs allowed, 1.5 MB), and hide/show sections (migration 0008). UNVERIFIED on a phone.
- [x] **Enquiry inbox in /admin**: built (see above). Still to add: mark-as-spam/archive, search, a customers list page,
      unread badge on the nav, reply templates editable in the admin.
- [ ] **Production go-live, nearly done** (see `docs/GO-LIVE.md` STATUS): DB migrated, Worker deployed, domains attached,
      Mapbox URLs added. **Remaining: run `bash scripts/set-prod-secrets.sh`**, verify (GO-LIVE step 5), Google OAuth redirect
      URI + Sam as test user, Sam reads `/privacy`, test enquiry from a phone. Still to do after: Neon history retention up,
      Mapbox usage alert, DMARC record, real reviews and Sam's real price before any marketing.
- [ ] Real reviews (none invented), Sam's real price, before/after slider, area/SEO pages.
- [ ] Decide the WindowsWayfinder boundary (CLAUDE.md says do not merge; Tristan says it stalled and wants the
      planner here for Sam first): write an ADR, then update CLAUDE.md.

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
