# Next steps — start-here backlog

The in-chat todo list doesn't survive a new session, so the live backlog lives here. This file describes the
world **as it is now**; it is rewritten, not appended, at each `/wrapup` (git history has the old ones).
Read `CLAUDE.md`, then this, then `ROADMAP.md`. Start a fresh session with `/nextsteps`.

_Last revised: **2026-10-04, end of session 7** (built overnight, unattended; staging only)._

## State, verified at the end of session 7

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm test` | **275 / 275** (35 files). The database tests boot an in-process Postgres each and take about a minute; hook timeout is 60 s. |
| `npx next build` | clean |
| Git | `main` = `staging` = `origin` after the wrap-up push. A push deploys nothing: there is no deploy workflow. The repo is **public**. |
| Staging | https://staging.comptoncleaning.co.uk, Worker `6135f1df`, deployed this session. Neon `staging` migrated through **0013**; 16 demo customers + 3 "Demo" rounds. Wire-checked: `/` and `/cy` 200, the new admin routes 307 to login, `/api/admin/earnings/export` 401 when signed out, and the away message replaces the Call button when hours are set (probe hours removed again: `call_hours` is empty on staging). |
| Production | https://comptoncleaning.co.uk, Worker `c157c645` = **session 6 code**. Neon `production` is through **0011 only**: **0012 and 0013 are not applied there**. Deploying session 7 code without migrating first would 500 the public page (it reads `call_hours`; it fails open on a read error, so the public page survives, but the admin Calendar, Settings and Earnings would not). Order: migrate 0012-0013, then deploy. |
| Neon `dev` branch | only through 0009 (run `npm run db:migrate` for local dev). `next build` prints a Postgres error trace while prerendering because of this; the build still succeeds. |
| Local DNS | this machine once cached "no such domain" for the apex; `curl --doh-url https://cloudflare-dns.com/dns-query https://comptoncleaning.co.uk/` proves it is up. |

## ⚠️ Needs a human (probed, not assumed)

- ✅ `npx wrangler whoami` logged in with access to Sam's account `f63f844d…`; ✅ `gh auth status`: Tristonian (re-probed this session).
- ⚠️ **Production secrets are present but nobody has verified each is non-empty through the live Worker** (CLAUDE.md rule), and **nobody has signed in to production `/admin`**. Do that with Tristan first; then `docs/GO-LIVE.md` step 5. Also: Google OAuth redirect URI `https://comptoncleaning.co.uk/api/auth/google/callback` + Sam as test user; Sam reads `/privacy`.
- **The assistant cannot migrate or deploy production** (blocked even with an explicit instruction in session 6), so Tristan runs them (PowerShell: `$env:CLOUDFLARE_ACCOUNT_ID = "f63f844d70738925fc7fb251893122cc"`, then `npm run db:migrate -- --branch production`, then `npm run deploy`). Production now needs **0012 and 0013** before the session 7 deploy.
- **Optional hardening:** `wrangler secret put MAPBOX_SERVER_TOKEN` (a Mapbox token with no URL restriction) on staging and production, then confirm it is non-empty. Without it the planner sends the site as its Referer to the restricted public token, which works (curl: 403 without, 200 with).
- **Real-device checks:** Tristan confirmed on a phone: sessions 2-3 "all good", the weather tile, Take photo, and "Coming tomorrow" switching off in Templates. **Everything else from sessions 4-7 is unchecked on a device.**
- Sam's Gmail "send as" `hello@` with his own Resend key: done. Sam's own Google login: still untested.
- Sam's `Customers.csv` (the Squeegee export) is in Tristan's Downloads, never in the repo: 20 people. Not yet imported anywhere real.
- Welsh is machine-drafted (`src/content/cy.ts`, including the new away message); a fluent speaker must review before launch.
- Business facts still needed from Sam: see the bottom of this file.
- **Decisions Tristan owes:** (1) are visit photos allowed to stay on the public `/img/<hash>` route (ADR 0009 open question); (2) the weather and call-hour defaults are guesses (Sam's call hours are unset on both environments, so the Call button always shows until he sets them).

## ❓ Untested, honestly

**Session 7 (all unit-tested only; seen by nobody on a phone):** the Settings screen (hours per weekday, add/rename/remove ways of paying); Rounds (rename, day, drag the ☰ handle to reorder, arrows as backup: dragging on a touch screen is the riskiest new control); Best order, including the Home / Where I am start toggle (location via cookie; check the first stop really is the nearest to where you stand) (against real Mapbox through the Worker: only the same request by curl and fakes in tests have run; check "estimated" does not appear when it should be real); the Calendar, rebuilt later on 2026-10-05 as a Rachel-style time grid (day/week/month, call-hour bands over a hatch, coloured round blocks, all-day strip, now line, tap an empty slot / a block / a day heading to act, usual hours per weekday from a day's panel): **its layout has never been seen in a browser** (the Chrome extension was not connected; only the server-rendered HTML of a preview was checked for the expected labels), so look at it first on a phone: column widths at 7 days, block text, the tap targets, the panels; "Today:" line on Work; Earnings page, bars, presets, CSV opened in a spreadsheet; "Set up several" and the "To set up" filter; last-cleaned date on a customer; "Add photos" link after DONE; the six-tab bar with the new labels; the away message and Welsh; the labelled Call / out-of-hours pair in pencil mode (both should show, one marked "showing now").

**Sessions 4-6:** the rich text editor in a browser; the work tracker on a phone (Add customer with Grab location, import, filters, Work screen, DONE panel, visit edit/delete, the map); the admin map has never loaded on staging (token is URL-restricted; the contact form's map works there); `sms:` prefill on iOS and Android; gallery upload and photo cleanup on a device; Templates beyond the one switch.

## Built, do not redo

**Session 7 (2026-10-04, overnight; staging; ADRs 0011, 0012):**
- **Call hours and calendar** (migration 0012): `call_hours` (usual week), `schedule_entries` (round / extra callable window / not_callable day). Pure rules in `schedule-shared.ts`; store in `schedule.ts` (`isTakingCalls` fails open). `HomePage.tsx` swaps the hero phone link and the contact Call button for `<Ed id="hero.away">` / `<Ed id="contact.away">`. Screens: `/admin/calendar` (week list + month grid), `/admin/settings`.
- **Earnings** (migration 0013 `jobs.paid_on`): `earnings.ts`, `/admin/earnings`, CSV at `/api/admin/earnings/export` (admin-checked, formula-safe). Reports read `coalesce(paid_on, done_on)`. `recordJob`/`updateJob`/`markPaid` set it.
- **Route planner**: `route.ts` (pure: Held-Karp to 12 stops, then nearest-neighbour + 2-opt + relocate), `travel.ts` (Mapbox Matrix in chunks of 12, 36 stops max, falls back to estimates), `round-plan.ts`, UI on `/admin/rounds` (Whole round / Due this week, home or not, Use this order, Google Maps links 9 stops each). The Work screen lists a selected round in saved order and links to the planner.
- **Tracker polish**: payment methods CRUD, rounds update/order (`moveInRound`, `setRoundOrder`), `bulkSetup`, `baseline_done_on` editable (`lastCleaned`), `unset` filter, "Set up several" mode on Customers, "Add photos" after DONE, photo counts on visit history.
- **Drag-to-order and pencil-mode call/away pair (session 7, later the same day):** `components/admin/RoundOrderList.tsx` (pointer events on a `touch-none` handle, window listeners so reordering the DOM cannot drop the drag; the row lifts, shrinks and follows the thumb as a floating copy over a dashed gap, siblings slide (small FLIP), release glides home; saves via `saveRoundOrderAction`; the plan start toggle `StartFromHere` keeps the phone location in an httpOnly cookie, `plan-start.ts`); `components/CallSwitch.tsx` (visitors see one of the call button / away message, pencil mode shows both labelled).
- **Navigation**: tabs are Home, Work, Calendar, Customers, Enquiries, Settings; Templates, Logo and colour and Rounds hang off Settings; Earnings hangs off Work and the Home screen.

**Session 6 (ADR 0010):** Templates (`/admin/templates`, `message-templates.ts`, `templates.ts`, migration 0011, overrides-only, NULL = default).

**Session 5 (ADR 0009, staging then production):** weather (Open-Meteo, server-side, cached, fails soft) and photos on a visit (Take photo / From gallery, R2 `photo/<hash>`, `unreferenced()` before any R2 delete).

**Session 4:** rich text (ADR 0007, tiptap, sanitised on save, lazy-loaded) and the work tracker (ADR 0008, migration 0010: customers, rounds, jobs, extras, Squeegee import, map with colour-keyed pins, due and owing computed never stored, `db:seed-demo` that refuses production).

**Sessions 1-3:** Cloudflare Workers (OpenNext), Neon + R2, Google OAuth + allow-list (ADR 0003), the pencil and `/cy` (ADR 0004), the one-page site, contact form, enquiry inbox, logo upload, hero, page blocks (ADR 0006), own services, hide/show sections, favicon, go-live prep.

## Next, in order

1. **Production check with Tristan, then take session 7 live:** sign in to `/admin` on production, verify each secret is non-empty through the live Worker, submit a test enquiry (GO-LIVE step 5). Then, **only when Tristan says so**, he runs migrate (0012, 0013) then deploy. Have Sam set his call hours in Settings straight after.
2. **Real-phone pass on staging** of everything in "Untested" above, Best order first (confirm it says real drive times, not "estimated"; try a round of 5-6 demo customers and a round with someone with no pin).
3. Fix what the phone pass finds. Likely candidates: a road-following route line on `/admin/customers/map` for the planned order; drag scrolling on small phones.
4. SMSWorks behind the same template keys (needs an account); rich/HTML emails only if Sam wants them (ADR 0010).
5. Weather follow-ups (tune thresholds with Sam; forecast for a round's actual day on the customer list).
6. Invoices (build on `jobs` + `job_extras`), cancellations and estimated earnings, the work timer, achievements like Rachel's (Earnings has none yet).
7. Referrals/promos, prices house animation, privacy notes on location tracking, SEO: see "Ideas" and the sections below.

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
- **Dates come back differently from Neon and PGlite** (string vs `Date`): cast `date` to text in SQL (`to_char(..., 'YYYY-MM-DD')`), `::text` for bigint ids, `::int` for sums. Bigint ids are strings. Same for `time` columns: `to_char(t, 'HH24:MI')`.
- **A `<p>` cannot nest in a `<p>`:** rich nodes always render in a `div` whatever `as` says (hydration errors otherwise).
- **An empty paragraph has no height:** render `<p></p>` as `<p><br></p>`, give it back empty to the editor. Don't "simplify" this away.
- **Heavy editor libraries must stay out of the public bundle:** `RichTextEditor` is a `next/dynamic` wrapper over `RichTextEditorImpl`.
- **tiptap v3's StarterKit already includes Link and Underline;** they are switched off in `configure` so ours aren't registered twice.
- **Database tests are slow, not broken:** each test boots PGlite and runs every migration (now 13); hook timeout is 60 s; if migrations keep growing, share one DB per file.
- **Deploy by hand:** `CLOUDFLARE_ACCOUNT_ID=f63f844d70738925fc7fb251893122cc npm run deploy:staging` / `npm run deploy` (the latter prints a "multiple environments" warning and deploys the top-level production Worker, which is what is meant). Always set the account id (Sam's account, not Tristan's).
- **Production secrets can look present when empty:** verify non-empty through the live Worker after setting.
- **`sanitize-html` styles:** only `font-size` (`NNpx`), `color` (hex) and `text-align` are allowed, with tight patterns. Widening them is a security decision.
- **A hash can be a page photo AND a visit photo:** never delete `photo/<hash>` from R2 without `unreferenced()`. Collect hashes before the database delete, remove after.
- **`<input capture>` is a separate input from the gallery picker:** one input with only `accept` does not offer the camera on many Android phones. Keep the two buttons.
- **Templates are overrides-only per field:** NULL subject/body means "still the default". Do not store the resolved text in a row.
- **Weather must never throw:** `getForecast` returns null on any failure and the pages hide the tile.
- **The public Call button must fail open:** `isTakingCalls` returns true if hours are unset or unreadable. Do not turn a database error into "no calls".
- **Money received is counted on `coalesce(paid_on, done_on)`:** a new code path that sets `paid = true` must set `paid_on` too (a CHECK was deliberately not added so the demo seed and old rows still work). Reports are by received date, not visit date.
- **Only a clean date range reaches the reports:** go through `cleanRange` (valid, ordered, at most 800 days). CSV cells go through `csvCell` (spreadsheet formula injection).
- **Mapbox from the server needs a Referer:** the public token is URL-restricted; no Referer = 403. `travelMatrix` falls back to estimates and says so; keep the "estimated" label, never show a guess as a measured time.
- **The Matrix API takes 25 coordinates:** chunks of 12 per pair; 36 stops max per plan. Raise `MAX_STOPS` only with the 60-requests-a-minute limit in mind.
- **Closed tours along one road tie:** out-and-back orders can cost the same, so tests of ordering use `returnHome: false` or points that are not collinear.
- **Shell and quoting on Windows:** Tristan uses PowerShell (`$env:VAR = "x"`, not `export`). In the assistant's bash tool, write scripts and files with the editor tools; heredocs containing quotes or backticks failed to parse several times (and `node -e` with backticks runs them). Python patch scripts go in `C:\Users\Trist\AppData\Local\Temp\` via the Write tool. `/tmp` in bash and node are different folders on Windows.
- **The permission check blocks production migrate/deploy** even after an explicit "yes": hand Tristan the commands. Staging migrate/deploy are fine when he has said so for that piece of work.
- **Edit the wrong environment by accident:** `db:migrate`/`db:seed-demo` take `--branch`; the seed refuses `production`; migrate does not, so type the branch carefully.

## Do first next session

1. `/nextsteps` re-verifies the state. Then item 1 above with Tristan (production sign-in, secrets, test enquiry); production needs 0012-0013 before the session 7 deploy.
2. Have Tristan open staging `/admin` on a phone and go through "Untested", Best order and the Calendar first.
3. Then fix what he finds.

## Prompt for the next chat

```text
Work in C:\Users\Trist\Documents\GitHub\ComptonCleaningWebsite (Next.js 15 + Tailwind on Cloudflare Workers via OpenNext, Neon Postgres, R2; Sam's window-cleaning site + work tracker). Start every message with "Tristan, ". Run /nextsteps (or read CLAUDE.md, docs/NEXT_STEPS.md, docs/ROADMAP.md, ADRs 0008, 0009, 0010, 0011 and 0012 in that order).

STATE (2026-10-04, end of session 7, verify first): typecheck clean; 275/275 tests (slow, ~1-2 min); build clean. main = staging = origin. Staging: Worker 6135f1df, Neon staging through 0013 (calendar, call hours, Earnings, route planner all live there), 16 "Demo:" customers. Production: Worker c157c645 = session 6 code; Neon production through 0011 ONLY (0012-0013 not applied); nobody has signed in to production /admin; 7 Worker secrets present, not verified non-empty. Repo is public. Tristan has seen on a phone only: weather tile, Take photo, Coming tomorrow switching off. Everything from sessions 4-7 is otherwise unchecked on a device.

TASKS, in order:
1. With Tristan: sign in to production /admin, verify each production secret is non-empty through the live Worker, submit a test enquiry, then docs/GO-LIVE.md step 5. Then, ONLY if Tristan says so, hand him the PowerShell commands to take session 7 live ($env:CLOUDFLARE_ACCOUNT_ID = "f63f844d70738925fc7fb251893122cc"; npm run db:migrate -- --branch production (applies 0012 and 0013); then npm run deploy). The assistant cannot run production migrate/deploy (permission check blocks it). Afterwards Sam sets his call hours in Settings.
2. Real-phone pass on staging with Tristan: Best order on a round (must say real drive times, not "estimated"), Calendar week/month and add forms, Settings (call hours, ways of paying), Rounds arrows, Earnings and CSV, "Set up several", last-cleaned, Add photos after DONE, the six-tab bar. Fix what he finds.
3. Likely follow-ups: a route line on the admin map, optional MAPBOX_SERVER_TOKEN secret (unrestricted Matrix token; verify non-empty).
4. Decisions Tristan owes: should visit photos stay on the public /img/<hash> route (ADR 0009)? Weather and call-hour defaults are guesses.
5. Later: SMSWorks behind the template keys, invoices, cancellations and estimated earnings, timer, achievements, SEO.

CONSTRAINTS: production is never migrated or deployed without Tristan saying so in that session, and he runs it himself. Staging deploy/migrate when he says so for that work. Always set CLOUDFLARE_ACCOUNT_ID=f63f844d70738925fc7fb251893122cc. Money is integer pence; times UTC shown Europe/London; due/owing computed never stored; money received counts on coalesce(paid_on, done_on), so anything that marks a visit paid must set paid_on; audit rows hold ids/keys only; the Squeegee CSV and any customer data never go in the repo; never name a competitor; no sound; mobile-first (flag anything not seen on a real phone); rich text only via RichText/toDisplayHtml and sanitised on save; keep RichTextEditor lazy; never delete an R2 photo without unreferenced(); templates overrides-only with NULL = default; the public Call button fails open; never present an estimated drive time as measured. Write files with the editor tools; no heredocs containing quotes/backticks, no node -e with backticks.

CANNOT DO WITHOUT TRISTAN/SAM: production migrate/deploy/secrets, Google OAuth redirect + Sam as test user, real-phone checks, Welsh review, Sam's business facts and call hours, SMSWorks account.

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
