# Next steps — start-here backlog

The in-chat todo list doesn't survive a new session, so the live backlog lives here. Read
`ROADMAP.md` for direction, then pick up from this list. Keep it current.

_Last updated: **2026-10-04** — scaffold + Google admin login built and smoke-tested locally.
**Nothing is committed, deployed, or tested on a real phone.** No remote resources exist yet._

## Done this session
- Cloudflare: Tristan is a member of Sam's account; `comptoncleaning.co.uk` is an active zone
  with **no DNS records** (clean slate, no email); R2 enabled. See `INFRASTRUCTURE.md`.
- Google Cloud project `comptoncleaning` (owned by Sam's Google account), consent screen in
  **Testing** with Sam + Tristan as test users, OAuth Web client created, secrets in `.env.local`.
- Scaffold: Next 15 + Tailwind 3 + OpenNext, D1 migration `0001`, `src/lib/auth/*`, routes
  `/api/auth/google`, `/api/auth/google/callback`, `/api/auth/logout`, pages `/`, `/admin`,
  `/admin/login`. 24 unit tests (allow-list, signed cookie, ID-token verification incl.
  forged signature / alg confusion / wrong aud / nonce / unverified email). `tsc` clean.
- Smoke-tested with curl: `/admin` redirects to login, `/api/auth/google` redirects to Google
  with PKCE + state + nonce, callback with no cookie is refused.

## Next, in order
- [ ] **Tristan: click through a real login** at http://localhost:3000/admin/login (`npm run dev`;
      local D1 already migrated with `npm run db:migrate:local`). Expect Google's "hasn't verified
      this app" screen: Advanced -> Continue. Then `/admin` should say "Signed in as ...".
      ⚠️ Not yet verified end-to-end: only the pre-Google half and the refusal paths were driven.
- [ ] First commit; create `staging` branch; push (repo is public: check nothing sensitive,
      `.env.local` is ignored and verified).
- [ ] Create remote resources on Sam's account (`CLOUDFLARE_ACCOUNT_ID` pinned in
      `wrangler.jsonc`): D1 `compton-cleaning` + `-staging`, R2 `compton-cleaning-cache`,
      `-images` and the `-staging` pair. Put real `database_id`s in `wrangler.jsonc`.
- [ ] Deploy staging Worker, then set its real URL in `env.staging.vars.SITE_URL` and add
      `<staging url>/api/auth/google/callback` to the Google OAuth client's redirect URIs.
- [ ] `wrangler secret put` GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / ADMIN_ALLOWED_EMAILS /
      SESSION_SECRET for staging (new SESSION_SECRET per environment), then verify non-empty.
- [ ] CI (`typecheck`, `test`, `audit`) and `deploy.yml`; Cloudflare API token in GitHub secrets.
- [ ] Add Tristan as Owner on the Google Cloud project (IAM) if not already done.
- [ ] Publish the Google consent screen once the site has a homepage + privacy policy URL.

## Then (Phase 1/2, see ROADMAP)
- [ ] `<Ed id>` pencil + inspector + `saveNode` server action (ADR 0004), English first.
- [ ] Welsh: `/cy` routes, language switch, `src/content/cy.ts`, hreflang; **a fluent speaker must
      review the wording before launch**.
- [ ] Public pages, pricing, postcode checker, before/after slider, photo uploader (resize before
      upload), WhatsApp review link.
- [ ] Business facts from Sam: prices, postcodes, WhatsApp number, insurer + cover amount, Google
      review URL, photo consent. Sam would like an `@comptoncleaning.co.uk` address: Cloudflare
      Email Routing can forward it to his Gmail for free.
