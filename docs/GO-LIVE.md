# Go-live runbook (comptoncleaning.co.uk)

Why the domain is dead today: the **production Worker `compton-cleaning` has never been deployed**, so there is no
Worker, no domain route and no DNS record for the apex. Everything the code needs is prepared (routes for the apex and
`www` in `wrangler.jsonc`, `www` -> apex redirect in `src/middleware.ts`, `/privacy` page). The steps below touch the real
production database, Worker secrets and domain, so a human runs them (or says "go" to a session that has permission).

All commands from the repo root, in Git Bash. **Stop `next dev` first** (EBUSY on deploy).

```sh
export CLOUDFLARE_ACCOUNT_ID=f63f844d70738925fc7fb251893122cc   # Sam's account, never Tristan's
```

## 1. Production database
```sh
npm run db:migrate -- --branch production      # applies 0001-0009; prints "applied ..." for each
```

## 2. Deploy the Worker (creates it, attaches comptoncleaning.co.uk and www, issues the certificate)
```sh
npm run deploy
```
The site will not work until step 3 (no secrets yet). That is expected.

## 3. Worker secrets (production, so no `--env`)
Values come from `.env.local` (Google, Resend, Mapbox, allow-list). `DATABASE_URL` is the PRODUCTION Neon branch, not dev.
```sh
put() { grep -m1 "^$1=" .env.local | cut -d= -f2- | tr -d '"\r' | npx wrangler secret put "$1"; }
for n in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET ADMIN_ALLOWED_EMAILS RESEND_API MAPBOX_TOKEN; do put $n; done

# A NEW session secret for production (never reuse dev/staging)
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put SESSION_SECRET

# Where enquiry emails go. hello@ forwards to Sam's Gmail (Email Routing, tested). Change if Sam prefers another.
echo "hello@comptoncleaning.co.uk" | npx wrangler secret put ENQUIRY_TO

# Production database string (same neon invocation scripts/migrate.mjs uses; needs NEON_API and NEON_PROJECT from .env.local)
set -a; . ./.env.local; set +a
NEON_API_KEY="$NEON_API" neon connection-string production --project-id "$NEON_PROJECT" \
  --role-name neondb_owner --database-name neondb --pooled | grep -o 'postgres[^ ]*' | npx wrangler secret put DATABASE_URL
```
`wrangler secret put` creates a new version automatically. **Check none is empty** (an empty secret looks present):
`npx wrangler secret list` shows names only, so prove them through the live site (step 5).

## 4. Hand steps (cannot be done from here)
- **Mapbox:** add `https://comptoncleaning.co.uk/*` to the public token's allowed URLs (no wildcards in the host).
  Without it the map shows an error on the live site.
- **Google OAuth:** the redirect URI `https://comptoncleaning.co.uk/api/auth/google/callback` must be registered on the
  client (INFRASTRUCTURE.md lists it). While the consent screen is in Testing, Sam must be a listed test user.
- **Sam:** read `/privacy` and confirm the contact details and how long enquiries are kept.

## 5. Verify on the wire
```sh
curl -sI https://comptoncleaning.co.uk | head -3            # 200
curl -sI https://www.comptoncleaning.co.uk | head -3         # 301 -> https://comptoncleaning.co.uk/
curl -sI https://comptoncleaning.co.uk/privacy | head -1     # 200
curl -sI https://comptoncleaning.co.uk/admin | head -2       # redirects to the login page (secrets work)
```
Then on a phone: sign in as Sam, send one test enquiry (it will email `ENQUIRY_TO`: warn Sam first), tap through the
pencil tools. Production is "done" when Sam can change something from his phone.

## Before real marketing (not blockers for being reachable)
- Real reviews and Sam's real first-clean price (the page still shows placeholders: see NEXT_STEPS).
- SEO pass: ROADMAP.md "SEO: do it properly".
- Neon history retention up, Mapbox usage alert, DMARC record.
