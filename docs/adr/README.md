# Architecture Decision Records (ADRs)

Short records of significant technical decisions: what we chose, why, what we traded away.
Read the relevant one before changing a load-bearing part of the system. One decision per
file; status is `Accepted` unless superseded.

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-hosting-cloudflare-workers.md) | Hosting: Cloudflare Workers via OpenNext | Accepted |
| [0002](0002-data-d1-and-r2.md) | Data: D1 for content, R2 for photos | Proposed |
| [0003](0003-admin-auth-google-oauth-allowlist.md) | Admin auth: Google OAuth + allow-list, own sessions | Accepted |
| [0004](0004-edit-anywhere-pencil-and-welsh.md) | Edit-anywhere pencil (`<Ed>`) and English/Welsh content | Accepted |

To add one: copy an existing file, take the next number, add a row above.
