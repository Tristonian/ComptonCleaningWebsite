# Infrastructure and hand steps

Things that cannot be done from code. Tick them off; record real values (never secrets) here.

## 1. Cloudflare (needs Sam)

- [x] Tristan is a member of Sam's account (invited to `tristan.d.pointer@googlemail.com`,
      verified 2026-10-04: `wrangler whoami` lists both accounts).
- Sam's account ID: `f63f844d70738925fc7fb251893122cc` (not a secret). Tristan's own account
  is `33c912ad…`; **always set `CLOUDFLARE_ACCOUNT_ID` explicitly** so nothing deploys to the
  wrong one.
- [x] `comptoncleaning.co.uk` is already a zone on Sam's account: status **active**, Free
      plan, zone id `5994f113498e31993641a84555d8ff66`. No nameserver change needed.
- [x] DNS reviewed: zero records. No email on the domain, nothing live.
- [x] R2 enabled.
- [ ] Create API token (Workers Scripts:Edit, R2:Edit, DNS:Edit on the zone).
      Store in GitHub secrets as `CLOUDFLARE_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID`.
- [x] Created 2026-10-04 (weur): D1 `compton-cleaning` and `compton-cleaning-staging` (**DELETED 2026-10-04 after the move to Neon, ADR 0005; a final staging export was taken to the temp dir, 4 KB of test data:
      not kept**); R2 `compton-cleaning-images`, `-images-staging` (+ unused `-cache`, `-cache-staging`).
- [x] workers.dev subdomain registered: `comptoncleaning`.
- [x] **Staging Worker deployed**: https://compton-cleaning-staging.comptoncleaning.workers.dev
      Migration 0001 applied; four secrets set (values verified non-empty through the live Worker).
- [x] Custom domain `staging.comptoncleaning.co.uk` attached via `routes` in wrangler.jsonc (workers.dev is
      now OFF for staging). Verified 200, EN + CY, Secure cookie. Original dashboard instructions:
      Attach custom domain `staging.comptoncleaning.co.uk` to the staging Worker (dashboard:
      Workers & Pages -> compton-cleaning-staging -> Settings -> Domains & Routes -> Add -> Custom
      domain). wrangler's login token cannot edit DNS, so this is a dashboard step.
- [ ] Production: migrate `compton-cleaning`, set the same four secrets (NEW SESSION_SECRET),
      deploy, attach `comptoncleaning.co.uk` + `www` (redirect www to apex).

## 2. Google sign-in (admin login, ADR 0003)

Done in Google Cloud Console (console.cloud.google.com). Which Google account owns the
project is a decision to make (see ROADMAP open questions).

- [ ] Create project "Compton Cleaning".
- [ ] OAuth consent screen: External, app name "Compton Cleaning Admin", support email,
      scopes `openid`, `email`, `profile` only. Then **Publish app** (In production).
- [ ] Credentials -> Create OAuth client ID -> Web application. Authorised redirect URIs:
  - `https://comptoncleaning.co.uk/api/auth/google/callback`
  - `https://<staging-worker>.workers.dev/api/auth/google/callback`
  - `http://localhost:3000/api/auth/google/callback`
- [x] Staging secrets set. [ ] Production secrets still to set. Per environment (`wrangler secret put`, then confirm each is
      non-empty): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_ALLOWED_EMAILS`
      (Sam's Gmail, Tristan's), `SESSION_SECRET`.

## 3. Email (Resend + Cloudflare Email Routing)

Sending is Resend, receiving is Cloudflare Email Routing (Resend only sends). Done 2026-10-04.

- [x] Resend domain `comptoncleaning.co.uk` (eu-west-1), **Verified**: DKIM/SPF/MX on `send.` records
      added to Sam's Cloudflare zone via Resend's auto-configure.
- [x] Email Routing: `hello@comptoncleaning.co.uk` -> Sam's Gmail (destination verified). Tested: Forwarded.
- [x] Gmail "send as" `hello@` (SMTP `smtp.resend.com`, 465 SSL, user `resend`, password = a Resend
      sending-access key). Works for Tristan and Sam. Use one key per person so one can be revoked.
- [x] Staging Worker secrets set: `RESEND_API`, `ENQUIRY_TO` (Sam only). **Production: not yet set.**
- [ ] DMARC TXT (`_dmarc`: `v=DMARC1; p=none; rua=mailto:hello@comptoncleaning.co.uk`): confirm it exists.
- [ ] Sam: Gmail filter for `from:enquiry@comptoncleaning.co.uk` -> never send to spam.

Gotchas:
- **Website notifications are sent from `enquiry@`, not `hello@`.** Sam's Gmail has `hello@` as a
  send-as address, and a message from it to his own inbox did not arrive (Resend said Delivered).
- The `RESEND_API` key in use is sending-only: it cannot list emails. Delivery status is in the Resend
  dashboard under **Emails** (not Logs).
- Free plan: 3,000/month, 100/day. The form is rate limited (see NEXT_STEPS) well inside that.
- `ENQUIRY_TO` accepts a comma-separated list.

## 3b. Neon Postgres (the database, ADR 0005)

Live since 2026-10-04. Project `Compton Cleaning` (`blue-cake-35536529`) on **Sam's** Neon account,
aws-eu-west-2 (London), database `neondb`, role `neondb_owner`. Three branches, never shared:

| Branch | Used by | Connection string lives in |
|---|---|---|
| `production` | the production Worker (not deployed yet) | Worker secret `DATABASE_URL` (to set) |
| `staging` | the staging Worker | Worker secret `DATABASE_URL` (set, verified) |
| `dev` | local `npm run dev` | `.env.local` `DATABASE_URL` |

- **Migrations:** `db/migrations/*.sql`, applied by `npm run db:migrate` (dev) or
  `npm run db:migrate -- --branch staging|production` (fetches the string with the neon CLI; needs
  `NEON_API` + `NEON_PROJECT` in `.env.local`). Idempotent, tracked in `schema_migrations`.
- **Driver:** `@neondatabase/serverless` over HTTP from the Worker (`src/lib/db.ts`); transactions are
  atomic (verified on the dev branch, including rollback). Tests use PGlite (real Postgres, in-process).
- **Row-level security:** every table in `public` has it enabled, in the migration and via the
  `ensure_rls` event trigger (`guard.rls_auto_enable()`, applied 2026-10-04) for any future table. The app
  connects as the owner (bypasses RLS); other roles are default-deny without a policy.
- **Switched OFF on purpose (2026-10-04):** the Neon **Data API** (deleted) and **Neon Auth** (disabled;
  its empty `neon_auth` tables remain). Admin login is Google OAuth (ADR 0003). The roles `authenticator`,
  `anonymous`, `authenticated` still exist from the Data API; they have no access.
- **Secrets:** `NEON_API` was rotated by Tristan on 2026-10-04 after being used from an AI session.
  `.env.local` also holds the pulled `NEON_*` URLs (Data API/Auth: now dead). Never commit it.
- **Before go-live:** raise history retention (currently 6 hours), set production `DATABASE_URL`, run
  `db:migrate -- --branch production`.
- `neon.ts` is the empty config; `.neon` (gitignored) links this folder to the project. `neon config init`
  added `@neon/config`; npm reports audit warnings: review before CI/go-live.

## 4. Business facts to collect from Sam

Prices (4-weekly, 8-weekly, one-off), postcode coverage list, insurer and cover amount (do not
show badges until verified), Google Business Profile review URL, WhatsApp number, photo consent.
