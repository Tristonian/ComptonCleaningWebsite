# ADR 0001 — Hosting: Cloudflare Workers via OpenNext

- **Status:** Accepted
- **Date:** 2026-10-04
- **Context:** Same decision as HairByRachel ADR 0008 and WindowsWayfinder ADR-001, reused
  on purpose so the operational knowledge transfers.

## Decision

Next.js 15 (App Router) deployed to **Cloudflare Workers** with `@opennextjs/cloudflare`, Node
runtime under `nodejs_compat`. Two environments: `main` -> production Worker, `staging` ->
staging Worker, each with its own bindings.

Not Vercel: Hobby tier prohibits commercial use and Pro is per-seat pricing, which is wrong for
a one-man window-cleaning site. Not Pages: no Cron Triggers, older adapter.

## Carry-overs that bit the siblings (do not relearn)

- `env.staging` in `wrangler.jsonc` does **not** inherit arrays such as `r2_buckets` and
  `d1_databases`; re-declare them or staging silently writes to production.
- Static assets bypass `next.config` `headers()`; use `public/_headers`.
- No `VERCEL_ENV`; use an explicit `APP_ENV` var per Worker.
- A Worker secret can exist with an **empty value** and `wrangler secret list` will not say
  so (LesK incident). Check values when a binding "looks missing".
- On-demand revalidation needs an R2 incremental cache bucket per environment.

## Consequences

- Cheap, no commercial-use restriction, one platform for hosting, images (R2), database (D1)
  and cron.
- Deploys go through `wrangler`/GitHub Actions with `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`.
