#!/usr/bin/env bash
# Sets the PRODUCTION Worker secrets (Sam's account). Run by a human from the repo root in Git Bash:
#   bash scripts/set-prod-secrets.sh
# Values come from .env.local (never printed). Safe to re-run: `wrangler secret put` just replaces.
# Why a script: see docs/GO-LIVE.md step 3. SESSION_SECRET is generated fresh (never reuse dev/staging).
set -euo pipefail
export CLOUDFLARE_ACCOUNT_ID=f63f844d70738925fc7fb251893122cc

put_from_env() {
  local v
  v=$(grep -m1 "^$1=" .env.local | cut -d= -f2- | tr -d '"\r')
  [ -n "$v" ] || { echo "$1 is EMPTY in .env.local: stopping"; exit 1; }
  printf '%s' "$v" | npx wrangler secret put "$1" >/dev/null && echo "set $1"
}

for n in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET ADMIN_ALLOWED_EMAILS RESEND_API MAPBOX_TOKEN; do put_from_env "$n"; done

node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put SESSION_SECRET >/dev/null && echo "set SESSION_SECRET (new)"

# Where enquiry emails go. hello@ forwards to Sam's Gmail (Email Routing). Edit here if Sam prefers another address.
printf '%s' "hello@comptoncleaning.co.uk" | npx wrangler secret put ENQUIRY_TO >/dev/null && echo "set ENQUIRY_TO"

# The PRODUCTION Neon branch string (same neon call scripts/migrate.mjs uses).
set -a; . ./.env.local; set +a
url=$(NEON_API_KEY="$NEON_API" neon connection-string production --project-id "$NEON_PROJECT" \
  --role-name neondb_owner --database-name neondb --pooled | grep -o 'postgres[^ ]*' | head -1)
[ -n "$url" ] || { echo "could not get the production DATABASE_URL: stopping"; exit 1; }
printf '%s' "$url" | npx wrangler secret put DATABASE_URL >/dev/null && echo "set DATABASE_URL"

echo
echo "Done. Verify (an empty secret looks present, so test through the live site):"
echo "  curl -sI https://comptoncleaning.co.uk/admin | head -3      # should redirect to /admin/login"
echo "  then sign in as Sam on a phone, send ONE test enquiry (it emails ENQUIRY_TO), tap the pencil tools"
