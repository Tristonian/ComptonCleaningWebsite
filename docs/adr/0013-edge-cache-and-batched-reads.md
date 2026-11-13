# ADR 0013: Edge cache and batched reads (Workers free plan, 10ms CPU)

Status: accepted (2026-11-13). Not yet deployed or measured; see NEXT_STEPS.

## Context
Sam's Cloudflare account is on the free Workers plan: 10ms of CPU per request. On 2026-11-13 Cloudflare
emailed "Workers CPU limit exceeded, 100+ times in 24 hours". Every public page view was a full server
render (about eight separate Neon HTTPS queries, then React), and every `/img/<hash>` request is its own
Worker invocation too. Search indexing (SEO commit, 20 Oct) brought crawler traffic.

## Decision
1. **Edge cache in front of the app** (`worker/index.mjs`, wrangler `main`): public pages cached 60s per
   data centre, `/img/*` for a year (content hashed), `robots.txt` and `sitemap.xml` for an hour.
   Pages are cached only for requests **without** the `cc_session` cookie, so Sam always gets a live render
   in pencil mode. A POST with a session cookie (an admin save) clears the page copies in that data centre.
   Only 200 responses without `Set-Cookie` are stored. Other data centres can show an edit up to 60s late.
2. **Batched reads** (`src/lib/query-batch.ts`, used by `getDb`): SELECTs issued in the same tick go to Neon as
   one non-interactive transaction (one HTTPS trip instead of about eight). Writes are never batched. If a
   batch fails, each query is retried alone.

## Consequences
- A deploy leaves up to 60s of cached HTML pointing at the previous build's chunks in each data centre.
- The call-hours switch on the public Call button can lag by up to 60s.
- `x-edge-cache: HIT|MISS` on responses shows what happened.
- Next.js 15.5.27 is now refused by the OpenNext build ("not supported by the Next.js team"). A build needs
  `--dangerouslyUseUnsupportedNextVersion` until Next is upgraded. Separate follow-up.
- If this is still not enough: Workers Paid ($5/month, 30s CPU) on Sam's account.
