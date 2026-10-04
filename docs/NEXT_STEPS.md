# Next steps — start-here backlog

The in-chat todo list doesn't survive a new session, so the live backlog lives here. This file describes the
world **as it is now**; it is rewritten, not appended, at each `/wrapup` (git history has the old ones).
Read `CLAUDE.md`, then this, then `ROADMAP.md`. Start a fresh session with `/nextsteps`.

_Last revised: **2026-10-04, end of session 4** (rich text editor, work tracker slices 1-2, map)._

## State, verified at the end of session 4

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm test` | **198 / 198** (26 files). The database tests boot an in-process Postgres each and take ~2 minutes in total; hook timeout is 60 s (`vitest.config.mts`). |
| `npx next build` | clean |
| Git | `main` = `staging` = `dbab6c4` plus the wrap-up commits, all pushed to `origin` (the repo is **public**). A push deploys nothing: there is no deploy workflow. |
| Staging | https://staging.comptoncleaning.co.uk, Worker version `7654cb14` (everything below). Neon `staging` branch migrated through **0010**, has 16 demo customers + 3 "Demo" rounds. |
| Production | https://comptoncleaning.co.uk (apex 200, `www` → apex 301), Worker version `b6aa3d91`: the site + the rich text editor, **not** the work tracker. Neon `production` migrated through **0009**; **0010 NOT applied**, so do not deploy the tracker there before migrating. |
| Neon `dev` branch | only through 0009 (run `npm run db:migrate` for local dev). |
| Local DNS | this machine cached "no such domain" for the apex earlier; `curl --doh-url https://cloudflare-dns.com/dns-query https://comptoncleaning.co.uk/` proves it is up. |

## ⚠️ Needs a human (probed, not assumed)

- ✅ `npx wrangler whoami`: logged in (OAuth) as tristan.d.pointer@googlemail.com, with access to Sam's account `f63f844d…`. ✅ `gh auth status`: Tristonian.
- ⚠️ **Production has NO Worker secrets** (`wrangler secret list` returns nothing). The public page renders defaults, **the contact form cannot store enquiries, and admin login does not work on production**, so the rich text editor and the tracker are unusable there. Fix: `bash scripts/set-prod-secrets.sh` (the assistant's secret writes were blocked by the permission check, so Tristan runs it), then verify each is non-empty through the live Worker (CLAUDE.md), then `docs/GO-LIVE.md` step 5. Also: Google OAuth redirect URI `https://comptoncleaning.co.uk/api/auth/google/callback` + Sam as test user; Sam reads `/privacy`.
- **Production must be migrated before the tracker is deployed there:** `npm run db:migrate -- --branch production` (applies 0010), only when Tristan says so.
- **Real-device checks:** Tristan reported sessions 2-3 "all good" on a phone (2026-10-04). **Nothing from session 4 has been seen on any device**, and nobody has used the editor, the work screen, the map or the demo data in a browser.
- Sam's Gmail "send as" `hello@` with his own Resend key: done (Tristan). Sam's own Google login: still untested.
- Sam's `Customers.csv` (the Squeegee export) is in Tristan's Downloads, never in the repo. It is 20 people with names, addresses and phones only (no price, frequency, postcode or last clean). Not yet imported anywhere real.
- Welsh is machine-drafted (`src/content/cy.ts`); a fluent speaker must review before launch.
- Business facts still needed from Sam: see the bottom of this file.

## ❓ Untested, honestly (all session 4, all built and unit-tested only)

- **The rich text editor in a browser**: toolbar, Enter twice then Save then reload shows the gap, size/colour/alignment, headings, links, Welsh, text blocks, service descriptions. The editor is lazy-loaded; the public page is ~126 kB first load.
- **Work tracker on a phone**: Add customer with 📍 Grab location, Squeegee import (preview then import), customer list filters and call/text/WhatsApp/"coming tomorrow" links, edit and delete a customer, Work screen (Due this week by round, DONE panel, one-tap MISSED, Debts, Payments), visit history edit/delete, the map (pins, key filter, popups, Grab location on an imported customer to give it a pin), the bottom tab bar, and the button grids evened up at the very end (the "wonky buttons" fix: not seen by either of us after the change).
- **Mapbox token on staging for the admin map**: it is URL-restricted; the contact form's map works on staging so the staging URL is allowed, but the admin map has not loaded once.
- `sms:` links with a prefilled body behave differently on iOS and Android (`?&body=` is used for both); check on both.

## Built, do not redo

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

1. **Weather on the admin home** (Tristan's pick for next): Open-Meteo (free, no key). Server-side fetch only, never from the browser; cache per area per day (Workers cache or a tiny table). Location: Sam's base (Lyde Green, BS16, about 51.50, -2.50) for the home tile; per-round and per-day forecasts can use the customers' pins. Show the week: rain chance, wind and frost, with a plain "good for windows / ladder warning" line (rain matters for windows, wind and ice for ladders and gutters). Must fail soft (a weather outage never breaks the admin home). Unit-test the parsing and the thresholds; handle London time.
2. **Photos on a visit** (tables exist): reuse the block-photo upload path (resize in the browser, R2 `photo/<sha256>`, `/img/[hash]`); delete the R2 object when no row references it (also on customer delete: collect hashes first, then remove after the transaction).
3. **Templates screen** (like Rachel's `emails` page): switch each text/email on or off and edit its content (rich editor for emails, plain for SMS), overrides-only; "coming tomorrow" (`src/lib/message-templates.ts`) and the reply templates (`src/lib/reply-templates.ts`) move in. SMSWorks wired in later behind the same templates. Add **Templates** to the tab bar then.
4. Payment methods UI (Sam adds methods as needed), drag-to-order customers within a round (position column exists), customer "last cleaned" correction for imported customers, a way to set price/frequency/round for many imported customers quickly.
5. Invoices (later; build on `jobs` + `job_extras`), cancellations/estimated earnings, the work timer.
6. Referrals/promos, achievements, prices house animation, privacy notes on location tracking: see "Ideas" below.

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
- **Production secrets can look present when empty** and are currently absent altogether: verify non-empty through the live Worker after setting.
- **`sanitize-html` styles:** only `font-size` (`NNpx`), `color` (hex) and `text-align` are allowed, with tight patterns. Widening them is a security decision.
- **Edit the wrong environment by accident:** `db:migrate`/`db:seed-demo` take `--branch`; the seed refuses `production`; migrate does not, so type the branch carefully.

## Do first next session

1. `/nextsteps` will re-verify the state. Then ask Tristan whether production secrets are set (or set them with him), because the live site's form is broken without them.
2. Have Tristan open staging `/admin` on a phone and report on the editor, Work screen, map and demo data (list under "Untested").
3. Weather (item 1 above).

## Prompt for the next chat

```text
Work in C:\Users\Trist\Documents\GitHub\ComptonCleaningWebsite (Next.js 15 + Tailwind on Cloudflare Workers via OpenNext, Neon Postgres, R2; Sam's window-cleaning site + work tracker). Start every message with "Tristan, ". Run /nextsteps (or read CLAUDE.md, docs/NEXT_STEPS.md, docs/ROADMAP.md, ADRs 0007 and 0008 in that order).

STATE (2026-10-04, verify first): typecheck clean; 198/198 tests (slow, ~2 min); build clean. main = staging pushed. Staging has everything (Worker 7654cb14, Neon staging migrated through 0010, 16 "Demo:" customers). Production has the site + rich text editor only (Worker b6aa3d91, Neon production through 0009, NO Worker secrets, so contact form and admin login do not work there). Repo is public.

TASKS, in order:
1. Weather on the admin home, Open-Meteo (free, no key), server-side only, cached per area/day, fail soft. Home tile for Sam's base (Lyde Green ~51.50,-2.50) with the week: rain chance, wind, frost, and a plain "good for windows / ladder warning" line; then per-round/day using customer pins. Unit-test parsing and thresholds, use Europe/London dates.
2. Photos on a visit (job_photos table exists): browser resize, R2 photo/<sha256>, /img/[hash]; remove the R2 object when nothing references it, including on customer delete.
3. Templates screen like HairByRachel's: on/off + editable content per text/email (rich editor for email, plain for SMS), overrides-only; move "coming tomorrow" and the reply templates in; add a Templates tab. SMSWorks later.
4. Payment methods UI, drag-to-order within a round, faster bulk setup of imported customers.

CONSTRAINTS: production is never migrated or deployed without Tristan saying so in that session (apply 0010 to production first: npm run db:migrate -- --branch production). Staging deploy/migrate when he says so for that work. Always set CLOUDFLARE_ACCOUNT_ID=f63f844d70738925fc7fb251893122cc. Money is integer pence; times UTC shown Europe/London; due/owing are computed never stored; audit rows hold ids only, never personal data; the Squeegee CSV and any customer data never go in the repo; never name a competitor; no sound; mobile-first (test at phone width, flag anything not seen on a real phone); rich text only via RichText/toDisplayHtml and sanitised on save; keep RichTextEditor lazy. Write files with the editor tools, not shell escapes.

CANNOT DO WITHOUT TRISTAN/SAM: production secrets (bash scripts/set-prod-secrets.sh), Google OAuth redirect + Sam as test user, real-phone checks, Welsh review, Sam's business facts, SMSWorks account.

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
