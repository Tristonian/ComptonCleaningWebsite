# CLAUDE.md — Compton Cleaning

Guidance for any AI/human session working in this repo. Read this first, then
`docs/ROADMAP.md` and `docs/NEXT_STEPS.md`.

## Canary check

Start every chat message to the user with `Tristan, ` (their name, comma, space). This is a
deliberate canary: if a message doesn't start this way, it's a signal that this file isn't
being fully read/applied and other guardrails below may also be silently skipped.

**If you notice the canary has dropped** (a recent message of yours didn't start with
`Tristan, `), treat this as a high-priority, non-optional signal: say, verbatim, on its own
line, before anything else in that reply: `Squawk Squawk Squawk the canary died this session is
getting too long!` Then resume starting every message with `Tristan, ` again.

## What this is

A fast, mobile-first marketing site and work tracker for Sam Compton's window-cleaning business
(comptoncleaning.co.uk) with a lightweight "edit anywhere" admin so Sam can change wording,
prices, testimonials and photos from his phone. Not a CMS, not a booking system. The route
planner is built here too (ADR 0012, which supersedes the "separate product" idea; WindowsWayfinder is only a reference). The work tracker (customers, rounds, jobs, payments) IS built here for Sam first (ADR 0008, which supersedes ADR 0007 on this).

## Sources of truth

0. `docs/NEXT-CHAT-BUILD-THE-SITE.md` — latest handover brief and gotchas.
1. `docs/ROADMAP.md` — direction and phases. Implement the current phase only.
2. `docs/adr/` — why load-bearing choices were made. Don't undo one without reading it.
3. `docs/NEXT_STEPS.md` — the live backlog (in-chat todos don't persist). Keep it current.
4. `docs/INFRASTRUCTURE.md` — hand steps (Cloudflare, Google OAuth, Resend) and their status.

## Architecture in one breath

Next.js 15 App Router + Tailwind on Cloudflare Workers (OpenNext), Neon Postgres for data (ADR 0005), R2 for
photos, Google OAuth + allow-list for admin (own sessions). `main` -> production, `staging` ->
staging. Sibling repos HairByRachel and WindowsWayfinder are the reference implementations.

## Conventions and guardrails

- **House style = HairByRachel.** When unsure how to do something, look there first.
- **Money is integer pence**; format to `£` only in the UI. Times stored UTC, shown Europe/London.
- **Content is overrides-only:** defaults in code, a database row only where Sam changed something.
- **Body copy is rich text, everything else plain** (ADR 0007): `<Ed rich>` nodes, text blocks and service
  descriptions store sanitised HTML (server-side, every save); blank lines are kept. Never render a stored
  value as HTML except through `RichText` / `toDisplayHtml`.
- **Admin is allow-listed:** a valid Google login is never enough on its own (ADR 0003).
  Every admin route and every mutation checks the session server-side.
- **Never trust the client for the admin flag.** "Admin mode" is UI only; the API enforces.
- **Images are resized before upload** and stored under content-hash keys (ADR 0002).
- Secrets are Worker secrets, never committed. After `wrangler secret put`, verify the value is
  non-empty (an empty secret looks present).
- Mobile-first: design and test at phone width first. No sound effects, ever.
- Respect `prefers-reduced-motion` for the squeegee bar, slider and glass effects.
- Don't claim trust badges (insured, cover amount) in copy until Sam supplies proof.
- Never name a competitor in code, docs or commits.
- Proprietary, all rights reserved; don't paste in GPL/AGPL code.
- Keep docs/ADRs current instead of explaining decisions in code comments.

## Delivery

Build on `staging`, verify on the wire, then fast-forward `main`. CI (`typecheck`, `test`,
`audit`) runs on push and PR; `deploy.yml` triggers on push only, never on `pull_request`.
Flag anything not yet checked on a real phone.

## Status

Foundations are built and **staging is live** (https://staging.comptoncleaning.co.uk): hosting, Neon Postgres,
Google admin login (confirmed working), the `<Ed>` pencil, the `/cy` Welsh switch, and the one-page
public site with a working contact form (Resend; `hello@` send/receive set up; location + Mapbox pin),
an `/admin` enquiry inbox (read, reply, notes, status, add as customer), and (session 3) logo upload with
cropper and a header colour picker, a collapsing hero bar, photo/GIF/text blocks Sam adds and arranges from the pencil
(ADR 0006), services he adds himself, hide/show for sections, editable contact-form drop-downs, a favicon and a
privacy page. **Production is deployed** to https://comptoncleaning.co.uk (Worker `c157c645`; Tristan ran the secrets script, migrations 0010-0011 and the deploy on 2026-10-04, seven secrets are present; the migrations and Google login on production are not independently verified, see `docs/NEXT_STEPS.md`). Session 4 added rich-text
body copy (ADR 0007) and the work tracker in /admin (customers, rounds, visits, debts, map; ADR 0008,
migration 0010). Session 5 added weather (Open-Meteo) on the admin home and per round, and photos on a visit (ADR 0009). Session 6 added the Templates screen (ADR 0010, migration 0011). Session 7 (overnight, **staging only**, Worker `6ccd3062`, Neon staging through 0013; production still has session 6 code and Neon through 0011, so migrate 0012-0013 before deploying it) added a Settings hub, Calendar and call hours that switch the public Call button off (ADR 0011, migration 0012), Earnings with CSV (`jobs.paid_on`, migration 0013), and the route planner (ADR 0012). Not yet done:
real reviews, SEO (see ROADMAP), SMSWorks. What is and is not verified
(almost nothing is checked on a real phone yet) is in `docs/NEXT_STEPS.md`; read it before building on
anything. Email setup and its gotchas: `docs/INFRASTRUCTURE.md` section 3.

**Sam's Cloudflare account, not Tristan's.** Account `f63f844d70738925fc7fb251893122cc` is pinned
in `wrangler.jsonc`; always set `CLOUDFLARE_ACCOUNT_ID`. Handover for the next build session:
`docs/NEXT-CHAT-BUILD-THE-SITE.md`.
