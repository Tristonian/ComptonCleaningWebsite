# Architecture Decision Records (ADRs)

Short records of significant technical decisions: what we chose, why, what we traded away.
Read the relevant one before changing a load-bearing part of the system. One decision per
file; status is `Accepted` unless superseded.

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-hosting-cloudflare-workers.md) | Hosting: Cloudflare Workers via OpenNext | Accepted |
| [0002](0002-data-d1-and-r2.md) | Data: D1 for content, R2 for photos | D1 part superseded by 0005; R2 stands |
| [0003](0003-admin-auth-google-oauth-allowlist.md) | Admin auth: Google OAuth + allow-list, own sessions | Accepted |
| [0004](0004-edit-anywhere-pencil-and-welsh.md) | Edit-anywhere pencil (`<Ed>`) and English/Welsh content | Accepted |

| [0005](0005-data-neon-postgres.md) | Data: Neon Postgres replaces D1 (R2 stays) | Accepted |

To add one: copy an existing file, take the next number, add a row above.
| [0006](0006-page-blocks-photos-and-text.md) | Page blocks: photos and text Sam can place and arrange | Accepted |
| [0007](0007-rich-text-and-wayfinder-boundary.md) | Rich text for body copy (blank lines kept); WindowsWayfinder paragraph superseded by 0008 | Accepted |
| [0008](0008-work-tracker-in-this-repo.md) | The work tracker (customers, rounds, jobs) is built in this repo, for Sam first | Accepted |
| [0009](0009-weather-and-visit-photos.md) | Weather from Open-Meteo (server-side, cached, fail soft); visit photos share R2 with page photos | Accepted |
