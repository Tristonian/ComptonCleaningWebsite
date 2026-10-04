# Next steps — start-here backlog

The in-chat todo list doesn't survive a new session, so the live backlog lives here. This file describes the
world **as it is now**; it is rewritten, not appended, at each `/wrapup` (git history has the old ones).
Read `CLAUDE.md`, then this, then `ROADMAP.md`. Start a fresh session with `/nextsteps`.

_Last revised: **2026-10-04, end of session 6** (Templates; the tracker reaches production)._

## State, verified at the end of session 6

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm test` | **223 / 223** (29 files). The database tests boot an in-process Postgres each and take about a minute (2 minutes under load); hook timeout is 60 s. |
| `npx next build` | clean |
| Git | `main` = `staging` = `origin`. A push deploys nothing: there is no deploy workflow. The repo is **public**. |
| Staging | https://staging.comptoncleaning.co.uk, Worker `debb7f44`. Neon `staging` migrated through **0011**; 16 demo customers + 3 "Demo" rounds. |
| Production | https://comptoncleaning.co.uk (apex 200), Worker `c157c645`, deployed by Tristan by hand. `wrangler secret list` shows 7 secrets (ADMIN_ALLOWED_EMAILS, ENQUIRY_TO, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MAPBOX_TOKEN, RESEND_API, SESSION_SECRET). `/admin/templates` answers 307 (login redirect), so the new routes are live. |
| Neon `production` | Tristan ran `npm run db:migrate -- --branch production` (0010, 0011) and said it was done. **Not independently probed** (running migrate is not a probe). If `/admin` pages 500 on production, check this first. |
| Neon `dev` branch | only through 0009 (run `npm run db:migrate` for local dev). |
| Local DNS | this machine once cached "no such domain" for the apex; `curl --doh-url https://cloudflare-dns.com/dns-query https://comptoncleaning.co.uk/` proves it is up. |

## ⚠️ Needs a human (probed, not assumed)

- ✅ `npx wrangler whoami` logged in with access to Sam's account `f63f844d…`; ✅ `gh auth status`: Tristonian.
- ⚠️ **Production secrets are present but nobody has verified each is non-empty through the live Worker** (CLAUDE.md rule), and **nobody has signed in to production `/admin`**. Do that with Tristan first; then `docs/GO-LIVE.md` step 5. Also: Google OAuth redirect URI `https://comptoncleaning.co.uk/api/auth/google/callback` + Sam as test user; Sam reads `/privacy`.
- **The assistant cannot migrate or deploy production**: the permission check blocks it even with an explicit instruction, so Tristan runs those commands (PowerShell: `$env:CLOUDFLARE_ACCOUNT_ID = "f63f844d70738925fc7fb251893122cc"`, then `npm run db:migrate -- --branch production`, `npm run deploy`).
- **Real-device checks:** Tristan confirmed on a phone: sessions 2-3 "all good", the weather tile, Take photo, and (session 6) switching "Coming tomorrow" off in Templates removes the button. **Everything else from sessions 4-6 is unchecked on a device.**
- Sam's Gmail "send as" `hello@` with his own Resend key: done (Tristan). Sam's own Google login: still untested.
- Sam's `Customers.csv` (the Squeegee export) is in Tristan's Downloads, never in the repo: 20 people, names, addresses and phones only. Not yet imported anywhere real.
- Welsh is machine-drafted (`src/content/cy.ts`); a fluent speaker must review before launch.
- Business facts still needed from Sam: see the bottom of this file.

## ❓ Untested, honestly (all session 4, all built and unit-tested only)

- **The rich text editor in a browser**: toolbar, Enter twice then Save then reload shows the gap, size/colour/alignment, headings, links, Welsh, text blocks, service descriptions. The editor is lazy-loaded; the public page is ~126 kB first load.
- **Work tracker on a phone**: Add customer with 📍 Grab location, Squeegee import (preview then import), customer list filters and call/text/WhatsApp/"coming tomorrow" links, edit and delete a customer, Work screen (Due this week by round, DONE panel, one-tap MISSED, Debts, Payments), visit history edit/delete, the map (pins, key filter, popups, Grab location on an imported customer to give it a pin), the bottom tab bar, and the button grids evened up at the very end (the "wonky buttons" fix: not seen by either of us after the change).
- **Mapbox token on staging for the admin map**: it is URL-restricted; the contact form's map works on staging so the staging URL is allowed, but the admin map has not loaded once.
- `sms:` links with a prefilled body behave differently on iOS and Android (`?&body=` is used for both); check on both.

## Built, do not redo

**Session 6 (2026-10-04), on staging and production (ADR 0010):**
- **Templates** (`/admin/templates`, ✉️ tab, six tabs now): registry in `src/lib/message-templates.ts` ("Coming tomorrow" text + the four reply emails), store in `src/lib/templates.ts` (migration 0011, overrides-only, NULL subject/body = still default, saving the default deletes the row), editor `components/admin/TemplateEditor.tsx`, actions re-check the admin. The customer list reads the text from the store (off = no button); the enquiry reply form is given the switched-on templates as props. Plain text for emails. `firstNameOf` now tidies ALL-CAPS names.

**Session 5 (2026-10-04), on staging only (ADR 0009):**
- **Weather** (`src/lib/weather.ts`, `components/admin/WeatherWeek.tsx`): Open-Meteo, server-side, Workers Cache API per ~1 km area per London day, fails soft. Admin home tile for Lyde Green; Work screen tile per selected round (centroid of its pins, round weekday outlined). Thresholds are named constants (rain 35/60%, gusts 25/35 mph, low 2/0 C) and are Tristan's guesses, not Sam's.
- **Photos on a visit** (`job-photos.ts`, `photo-store.ts`, `components/admin/VisitPhotos.tsx`, actions in `visit-actions.ts`): **Take photo** (rear camera, `capture`) and **From gallery** (several), resized in the browser, R2 `photo/<sha256>`, max 8 per visit, `/img/[hash]`. `deleteJob` / `deleteCustomer` / `deleteBlock` now return the hashes nothing references any more and the caller removes them from R2 (`removePhotoObjects`). Photos can only be added **after** a visit is saved (not in the DONE panel on the Work screen).

**Session 4 (2026-10-04), all committed; staging has it all, production has only the editor:**
- **Rich text** (ADR 0007): `<Ed rich>` nodes (intro, services, price factors, contact intro), text blocks and custom service descriptions use a tiptap editor adapted from HairByRachel, the full toolbar (size, colour, alignment, B/I/U, H2/H3, quote, divider, lists, links) minus inline images. Stored as sanitised HTML (`src/lib/rich.ts`, `rich-sanitize.ts`, sanitised server-side on every save, even if the client lies about `rich`); blank lines are kept (empty paragraphs render a line high). Old plain text is converted when read; nothing was migrated. Lazy-loaded via `next/dynamic`.
- **Work tracker** (ADR 0008, migration 0010): customers with price/frequency/preferred payment/last clean/Squeegee ref; **rounds** (a customer can be in several); `jobs` (done/missed, date never in the future, price, payment method, paid), `job_extras`, `job_photos` (table only, no UI yet), `payment_methods` (transfer/cash/card; Sam can add, no UI yet). **Due and owing are computed, never stored.** Debt = a done visit not marked paid. Screens: `/admin/customers` (search, Due/Owing/round filters, call/text/WhatsApp, "coming tomorrow" text), `/new` (Grab location), `/[id]` (edit, delete with typed confirmation, visit history with edit/delete/mark paid, log a visit), `/import`, `/map`, `/admin/work` (Due this week by round, Also in this round, Also due this week, Debts, Payments). Squeegee CSV import (`src/lib/customers-csv.ts`) skips references already imported, so re-imports never overwrite edits.
- **Map**: colour-keyed pins (red owes, orange overdue, yellow due this week, green up to date, grey no schedule, priority in that order, `src/lib/pin-status.ts`), key doubles as a filter, round chips, popups built from DOM nodes (never HTML strings).
- **Bottom tab bar** on every signed-in admin page (`AdminTabs`, copied from Rachel's pattern); padding via `body:has(.admin-tabs)` in `globals.css`.
- **Demo data**: `npm run db:seed-demo -- --branch staging` adds 16 invented Bristol customers (`demo-` refs, "Demo:" names, fake 07700 900xxx numbers, "Demo" rounds); `--remove` deletes them; it refuses production.
- Greetings tidy ALL-CAPS/lower-case first names (`tidyName`, "Hi TRISTAN" → "Hi Tristan"). Nothing in the code upper-cases names; it printed what was typed.
- Commands `/wrapup` and `/nextsteps` (`.claude/commands/`, adapted from VideoGameDiaries and ShoppingList).

**Sessions 1-3** (see ROADMAP/ADRs; do not redo): hosting on Cloudflare Workers (OpenNext), Neon Postgres (ADR 0005) + R2, Google OAuth + allow-list (ADR 0003), the pencil and `/cy` (ADR 0004), the one-page public site, contact form (honeypot, rate limit, UK phone/email/postcode checks that fail open, confirmed Mapbox pin, Resend email from `enquiry@`), enquiry inbox, logo upload/cropper + colour picker, collapsing hero, photo/GIF/text blocks (ADR 0006), own services, hide/show sections, editable form drop-downs, go-live prep (apex + www routes, `/privacy`), favicon from the CCS mark.

## Next, in order

1. **Production check with Tristan:** sign in to `/admin` on production, confirm it loads (proves migrations 0010-0011), verify each secret is non-empty through the live Worker, and submit a test enquiry. Then GO-LIVE step 5.
2. Payment methods UI (Sam adds methods as needed), drag-to-order customers within a round (position column exists), customer "last cleaned" correction for imported customers, a way to set price/frequency/round for many imported customers quickly.
3. Visit photo follow-ups: add photos from the DONE panel on the Work screen (needs the job id after save), a photo count on the visit list, and decide whether visit photos should be admin-only (ADR 0009 open question).
4. SMSWorks behind the same template keys (needs an account), rich/HTML emails only if Sam wants them (ADR 0010).
5. Weather follow-ups if Sam wants them: tune thresholds with him, forecast for a round's actual day on the customer list.
6. Invoices (later; build on `jobs` + `job_extras`), cancellations/estimated earnings, the work timer.
7. Referrals/promos, achievements, prices house animation, privacy notes on location tracking, SEO: see "Ideas" and the sections below.

## Requested by Tristan at the end of session 6 (not started, scope with him first)

- **Route planner in the next deployment.** ADR 0008 only says the route planner "stays a separate product that may come later" (WindowsWayfinder); Tristan now wants one built here. Needs a short ADR first, and questions: ordering a round's customers (drag-to-order, `position` column exists) vs automatic nearest-neighbour/optimised ordering; Mapbox Optimization/Directions (token is URL-restricted, the admin map has not loaded once on staging) vs pure maths; start point (Lyde Green base in `weather.ts` BASE); hand-off to Google/Apple Maps for turn-by-turn. Natural first slice: drag-to-order within a round (task 2), then "best order" for a day's due customers, then a map line.
- **Settings area for the "Call me" button** (public site): show it only at certain times of day, never at weekends, and only when Sam's Google Calendar says he wants calls. Needs: a Settings screen (new tab or under Site) with opening hours per weekday + a weekend switch, stored overrides-only like content (new migration); the public page is currently static/cached per `NEXT_STEPS`'s "layout is dynamic" note, so decide server-render per request vs a small client check against a cached JSON. Calendar link: Sam's Google account has no calendar scope on the OAuth client yet; options are read-only free/busy (needs `calendar.freebusy` scope and Sam re-consenting, and the Google consent screen is still in test mode) or a private ICal feed URL he pastes in (no OAuth, simpler). Decide which with Tristan. Fail open or closed when the calendar cannot be read: recommend showing the button (a missed call costs more than an unwanted one) unless outside set hours. Times are Europe/London. The "Call" text lives in `<Ed id="nav.call">` in `HomePage.tsx`; a WhatsApp/contact-form fallback should show when calls are off.

## Ideas from Tristan (not started)

- **Prices with a house animation:** small/medium/large house; the price counts up as you scroll, windows go dull to sparkly. `prefers-reduced-motion` shows the final state; CSS/SVG only; prices from `business.ts`/`<Ed>`; no sound.
- **Location ideas, read the privacy notes first:** "track Sam all day" for him only needs an installed app/PWA with opt-in or an "I'm here" tap (a website cannot track in the background); only Sam sees it, short retention, off switch; UK GDPR if anyone else is ever tracked. **Do not show real location history on the public site** (it says when he is away and points at customers' homes); at most a coarse, delayed, opt-in line such as "This week: BS16, BS5, Chepstow" from completed jobs.
- **Referrals and review promos (like HairByRachel):** "referred by" asks the referrer's full name, both get a discount once the new customer pays (guard self-referral and name typos; Sam confirms each in the admin); a Google review earns a small single-use promo code (Google has no API to verify a review, so honour-based or Sam ticks "review seen"). Read Rachel's referral/promo code and reuse the shape; the contact form's "Where did you hear about us" already records a `recommendation` source.
- **Achievements** like HairByRachel (`src/lib/achievements*.ts` there).
- **Cancellations** (record how often, estimate how many of a round might cancel, feed estimated earnings) and a **start/done timer** per job to see how long jobs really take (feeds pricing).
- Crossover with HairByRachel's `/admin` (appointments, templates, reminders): house style = HairByRachel, read it first, do not copy GPL code.

## Traps this codebase has walked into

- **Never overwrite a customer's data on a re-import:** `importCustomers` skips known `squeegee_ref`s. Keep it that way.
- **Audit rows never hold a name, phone or address** (customer delete must really delete). Log ids only.
- **Dates come back differently from Neon and PGlite** (string vs `Date`): cast `date` to text in SQL (`to_char(..., 'YYYY-MM-DD')`), `::text` for bigint ids, `::int` for sums. Bigint ids are strings.
- **A `<p>` cannot nest in a `<p>`:** rich nodes always render in a `div` whatever `as` says (hydration errors otherwise).
- **An empty paragraph has no height:** render `<p></p>` as `<p><br></p>`, give it back empty to the editor. Don't "simplify" this away.
- **Heavy editor libraries must stay out of the public bundle:** `RichTextEditor` is a `next/dynamic` wrapper over `RichTextEditorImpl`. Importing the Impl directly puts tiptap (~130 kB) on every visitor's first load.
- **tiptap v3's StarterKit already includes Link and Underline;** they are switched off in `configure` so ours aren't registered twice.
- **Shell quoting loses to nested heredocs on Windows Git Bash:** write files with the editor tools, not `node -e` with escapes (several silent no-ops this session). `/tmp` in bash and node are different folders on Windows.
- **Database tests are slow, not broken:** each test boots PGlite and runs every migration; under parallel load that exceeded the 10 s default hook timeout (43 false failures). It is 60 s now; if migrations keep growing, share one DB per file.
- **Deploy by hand:** `CLOUDFLARE_ACCOUNT_ID=f63f844d70738925fc7fb251893122cc npm run deploy:staging` / `npm run deploy` (the latter prints a "multiple environments" warning and deploys the top-level production Worker, which is what is meant). Always set the account id (Sam's account, not Tristan's).
- **Production secrets can look present when empty:** verify non-empty through the live Worker after setting (they are present now, not yet verified).
- **`sanitize-html` styles:** only `font-size` (`NNpx`), `color` (hex) and `text-align` are allowed, with tight patterns. Widening them is a security decision.
- **A hash can be a page photo AND a visit photo:** never delete `photo/<hash>` from R2 without `unreferenced()` (checks `job_photos` and `page_blocks`). Collect hashes before the database delete, remove after.
- **`<input capture>` is a separate input from the gallery picker:** one input with only `accept` does not offer the camera on many Android phones. Keep the two buttons.
- **Templates are overrides-only per field:** NULL subject/body means "still the default". Do not store the resolved text in a row, or later default improvements stop reaching Sam.
- **Weather must never throw:** `getForecast` returns null on any failure and the pages hide the tile. Do not turn that into an error path.
- **Shell quoting again:** `node -e "..."` in bash executes backticks inside double quotes and heredocs through the tool broke too. Write a script file with the editor tools and run it.
- **The shell matters:** Tristan uses PowerShell, where `export VAR=x` fails; give him `$env:VAR = "x"`. A bash heredoc piping python hung the tool for 2 minutes and another with backticks failed to parse; write a script with the editor tools and run it.
- **The permission check blocks production migrate/deploy** even after an explicit "yes": hand Tristan the commands.
- **Edit the wrong environment by accident:** `db:migrate`/`db:seed-demo` take `--branch`; the seed refuses `production`; migrate does not, so type the branch carefully.

## Do first next session

1. `/nextsteps` re-verifies the state. Then do item 1 above with Tristan (production sign-in, secrets, test enquiry).
2. Have Tristan open staging `/admin` on a phone and report on the editor, Work screen, map, demo data, per-round weather, gallery upload and the Templates screen (edit a reply template, see it on an enquiry's reply form; check the six-tab bar fits).
3. Then item 2.

## Prompt for the next chat

```text
Work in C:\Users\Trist\Documents\GitHub\ComptonCleaningWebsite (Next.js 15 + Tailwind on Cloudflare Workers via OpenNext, Neon Postgres, R2; Sam's window-cleaning site + work tracker). Start every message with "Tristan, ". Run /nextsteps (or read CLAUDE.md, docs/NEXT_STEPS.md, docs/ROADMAP.md, ADRs 0007, 0008, 0009 and 0010 in that order).

STATE (2026-10-04, verify first): typecheck clean; 223/223 tests (slow, ~1-2 min); build clean. main = staging = origin. Staging: Worker debb7f44, Neon staging through 0011, 16 "Demo:" customers. Production: Worker c157c645 deployed by Tristan, 7 Worker secrets present, Neon production migrated through 0010-0011 by Tristan but NOT independently probed; nobody has signed in to production /admin. Repo is public. Tristan has seen on a phone: weather tile, Take photo, Coming tomorrow switching off in Templates. Nothing else from sessions 4-6 is checked on a device.

TASKS, in order:
1. With Tristan: sign in to production /admin (proves migrations), verify each production secret is non-empty through the live Worker, submit a test enquiry, then docs/GO-LIVE.md step 5. The assistant cannot migrate or deploy production (the permission check blocks it): give Tristan PowerShell commands ($env:CLOUDFLARE_ACCOUNT_ID = "f63f844d70738925fc7fb251893122cc"; he uses PowerShell, not bash).
2. Payment methods UI, drag-to-order within a round (position column exists), faster bulk setup of imported customers (price/frequency/round for many at once), "last cleaned" correction.
3. Visit photo follow-ups (add from the DONE panel, count on the visit list) and the ADR 0009 question: should visit photos be admin-only?
4. Route planner (Tristan wants it in the next deployment): write an ADR first (ADR 0008 kept it separate), start with drag-to-order within a round, then best order for a day's due customers. See "Requested by Tristan at the end of session 6" in NEXT_STEPS.
5. Settings area for the public "Call me" button: hours by weekday, no weekends, optional link to Sam's Google Calendar (scope/consent decision needed). Same section.
6. Later: SMSWorks behind the template keys (ADR 0010), invoices, cancellations, timer, SEO.

CONSTRAINTS: production is never migrated or deployed without Tristan saying so in that session, and he runs it himself. Staging deploy/migrate when he says so for that work. Always set CLOUDFLARE_ACCOUNT_ID=f63f844d70738925fc7fb251893122cc. Money is integer pence; times UTC shown Europe/London; due/owing computed never stored; audit rows hold ids/keys only, never personal data or wording; the Squeegee CSV and any customer data never go in the repo; never name a competitor; no sound; mobile-first (flag anything not seen on a real phone); rich text only via RichText/toDisplayHtml and sanitised on save; keep RichTextEditor lazy; never delete an R2 photo without unreferenced(); templates are overrides-only with NULL = default. Write files with the editor tools; never node -e with backticks; do not pipe bash heredocs into python or node (they hung or failed to parse).

CANNOT DO WITHOUT TRISTAN/SAM: production migrate/deploy/secrets, Google OAuth redirect + Sam as test user, real-phone checks, Welsh review, Sam's business facts, SMSWorks account.

FINISH with /wrapup.
```

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
