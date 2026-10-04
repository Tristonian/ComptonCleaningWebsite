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
| Data | D1 `compton-cleaning` / `-staging` (migration 0001 applied to staging + local only). R2 `compton-cleaning-images(-staging)`. |
| Auth | Google OAuth (ADR 0003). Consent screen in **Testing**; test users: Sam + Tristan. |
| Local | `npm run dev` -> http://localhost:3000 (D1 migrated with `npm run db:migrate:local`). 45 tests, `tsc` and `next build` clean. |

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
      D1, R2 and **DNS** edit (wrangler's own login token cannot edit DNS) in GitHub secrets.
- [ ] Add Tristan as Owner on the Google Cloud project (IAM).

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
- [ ] Security hardening before go-live: CSP, rate limit on `/api/auth/*`, D1 export backups to R2.
- [ ] Layout is dynamic (cookie + D1 per request); add tag caching only if measurably slow.

## Business facts still needed from Sam

Prices, postcodes covered, WhatsApp/phone number, insurer + cover amount (no badges until proven),
Google Business Profile review URL, photo consent, whether he wants an `@comptoncleaning.co.uk`
address (Cloudflare Email Routing can forward it to his Gmail for free).
