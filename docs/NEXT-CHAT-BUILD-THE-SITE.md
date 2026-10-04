# The next chat: build the actual site

Written 2026-10-04 at the end of session 1. **Paste the block at the bottom as the first message
of the new chat.** Everything above it is context for whoever is reading this file directly.

## What exists

Foundations only, deliberately: hosting, data, the Google admin login, the pencil, the Welsh
switch, and the docs/ADRs. The public homepage is a placeholder ("Full site coming soon").
Staging is live at https://staging.comptoncleaning.co.uk. Read `CLAUDE.md`, then
`docs/NEXT_STEPS.md` (the "not verified" list matters), then ADRs 0003 and 0004.

## Things that will otherwise surprise you

- **Sam's Cloudflare account, not Tristan's.** `f63f844d...` is pinned in `wrangler.jsonc`;
  Tristan's own account is `33c912ad...`. Set `CLOUDFLARE_ACCOUNT_ID` on every wrangler command.
- **wrangler's login token cannot edit DNS or populate R2 caches.** Custom domains work through
  `routes` in `wrangler.jsonc`. CI will need a real API token.
- **No R2 incremental cache** (ADR 0001 note): every route is dynamic. The `-cache` buckets are unused.
- **`<Ed id>` ids must be string literals** and every one needs a Welsh entry in `src/content/cy.ts`
  (or `SAME_IN_BOTH`); `cy.test.ts` fails otherwise.
- **Next route files cannot export constants** (only handlers/config): shared values live in `src/lib`.
- **Secrets can exist empty.** After `wrangler secret put`, check through the live Worker.
- **Tailwind colours use `rgb(var(--x) / <alpha-value>)`**, never plain `var()`, or opacity
  modifiers silently render nothing (HairByRachel lost ~70 uses to this).
- The Google consent screen is in Testing, so first login shows "hasn't verified this app".
- The repo is **public**. `.env.local` is gitignored; never commit secrets.

## Not verified

Tristan has signed in with Google on staging (confirmed). Still unverified: Sam's own login, the
pencil in a browser, anything on a real phone, and the Welsh wording. Verify the pencil first; do
not build on top of an assumption.

## Update (end of session 2, 2026-10-04)

Built and deployed to staging (https://staging.comptoncleaning.co.uk), all committed and pushed to GitHub
(`main` and `staging`): the one-page site; the contact form (phone/email split with verifiers, service and
source drop-downs, location + draggable Mapbox pin that must be confirmed, "is this your address" card, sent
confirmation); the enquiry email to Sam (map picture, one-tap Maps and directions, tap-to-call); Resend for
`hello@` (send as + receive); the move from D1 to Neon Postgres (ADR 0005, `db/migrations` 0001-0005,
`npm run db:migrate`, RLS on); and the **/admin enquiry inbox** (dashboard, list with status filters, detail
with call/text/WhatsApp/email, pin map, status, private notes, reply from `hello@` with templates, add as
customer). Read `docs/NEXT_STEPS.md` ("Next" and the idea lists), `docs/INFRASTRUCTURE.md` (Resend, Neon,
Mapbox) and ADR 0005.

Not verified by a human on a real device: almost all of the above (see the first item under "Next"). In
particular: sending an actual reply from the admin, a real Google login, "Use my location", map wheel/pinch zoom.
Gotchas learned: `wrangler`/OpenNext deploy fails with EBUSY if `next dev` is still running (stop it first);
`.env.local` holds live Neon/Resend/Mapbox values (never commit); Mapbox URL restrictions take no wildcards;
the Chrome test tool froze on map wheel events and its clicks miss unless you read coordinates from a screenshot;
Neon returns bigint ids as strings (the PGlite test DB is set to match); Windows shell quoting breaks long
`node -e`/heredoc patches, so write patch scripts to a file; a minted dev session (insert a row into `sessions`
on the dev branch, set the `cc_session` cookie) is how to test /admin locally without Google.

## Update (end of session 3, 2026-10-04)

Built, deployed to staging and merged to `main` (all UNVERIFIED on a real phone): `/admin/appearance` and the pencil's
"Logo and colour" sheet (upload with drag and drop, cropper adapted from HairByRachel, R2 `logo/<hash>`, `/img/[hash]`,
colour picker with contrast warning); the hero collapses on scroll to a thin pinned bar (`HeroHeader`, logo to 10%,
click goes to top, nav sticks at `top-11`); the website line is gone; photo/GIF/text **blocks** in named zones
(`src/lib/blocks*.ts`, `BlockZone`, ADR 0006): add several photos, drag or up/down to arrange; **services Sam adds**
(`custom_services`, `ServiceTools`); two zones per service card (under title / under text, GIFs up to 1.5 MB untouched);
**hide/show** sections (`Hideable`, `site_settings.hidden_sections`; Contact is never hideable).

Migrations 0006 (appearance), 0007 (blocks), 0008 (custom services) are applied to dev and staging, NOT production.
Gotchas: a plain `npm run db:migrate` only hits the dev branch, use `-- --branch staging|production`. There is no CI
deploy: push does nothing, run `CLOUDFLARE_ACCOUNT_ID=f63f... npm run deploy:staging` (stop `next dev` first). The
Windows shell chokes on long heredocs with quotes: write patch scripts to a file. Next: Tristan tests on his phone
(blocks, ▲▼, GIF, hide, logo sheet), then production go-live (see NEXT_STEPS), then the parked ideas.

## Paste this

> Read CLAUDE.md, docs/NEXT_STEPS.md, docs/INFRASTRUCTURE.md, ADR 0005 and docs/NEXT-CHAT-BUILD-THE-SITE.md.
> Staging has the site, the contact form and the /admin enquiry inbox. First I'll test on my phone and tell
> you what I see (Google login, pencil, form, email, location, map zoom, sending a reply). Then build, in
> this order: the logo viewer/changer in /admin (file picker + cropper, R2, admin-only) with a colour picker
> for the hero background; then production go-live. Ideas parked in NEXT_STEPS: price/house animation,
> tracker/planner, weather, referrals and review promos, cancellations, template emails (editable), location
> ideas (read the privacy notes). Decide the WindowsWayfinder boundary with me before the planner.
