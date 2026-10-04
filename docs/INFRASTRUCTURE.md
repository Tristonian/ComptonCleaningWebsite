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
- [ ] Review DNS records (is there email/MX on the domain? where does the apex point now?).
- [ ] Enable R2 (currently error 10042 "enable R2 through the dashboard"; needs a card on
      Sam's account, stays free within the allowance).
- [ ] Create API token (Workers Scripts:Edit, D1:Edit, R2:Edit, DNS:Edit on the zone).
      Store in GitHub secrets as `CLOUDFLARE_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID`.
- [ ] Create resources, prod and staging: Worker, D1 database, R2 images bucket, R2 cache bucket.

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
- [ ] Set Worker secrets per environment (`wrangler secret put`, then confirm each is
      non-empty): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_ALLOWED_EMAILS`
      (Sam's Gmail, Tristan's), `SESSION_SECRET`.

## 3. Email (Resend), later

Only needed for review/notification emails, not login. Needs SPF, DKIM, DMARC on the domain,
so Cloudflare DNS access comes first.

## 4. Business facts to collect from Sam

Prices (4-weekly, 8-weekly, one-off), postcode coverage list, insurer and cover amount (do not
show badges until verified), Google Business Profile review URL, WhatsApp number, photo consent.
