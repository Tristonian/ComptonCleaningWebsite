# ADR 0005 — Data: Neon Postgres replaces D1 (R2 stays)

- **Status:** Accepted (Tristan, 2026-10-04). Supersedes the D1 part of [ADR 0002](0002-data-d1-and-r2.md); the R2
  photo decisions in 0002 stand.
- **Date:** 2026-10-04

## Context

ADR 0002 chose D1 for a brochure site and listed Neon as the alternative to revisit "only if
multi-tenancy or heavy relational queries appear". That has now happened in intent: Sam wants an
`/admin` that grows into a working tool: enquiries and customers, a calendar, slotting people in,
notes. That is relational data (customers, properties, jobs, slots, notes, history) with
constraints and joins, and it holds personal data (names, addresses, phone numbers).

A Neon project already exists on Sam's Neon account (`Compton Cleaning`, `blue-cake-35536529`,
aws-eu-west-2, London), next to the sibling WindowsWayfinder product, which already uses Neon.
The Worker runs in the same part of the world.

At the time of the decision the D1 holds almost nothing (staging: 1 content override, 1 session,
4 audit rows, 4 test enquiries) and production is not deployed, so this is the cheapest moment to move.

## Decision

- **Neon Postgres is the system of record** for everything D1 held: `content_overrides`,
  `sessions`, `audit_log`, `enquiries`, and what comes next (customers, jobs, calendar, notes).
- **Driver:** `@neondatabase/serverless` over HTTP (`neon()`), with `sql.transaction([...])` for the
  atomic batches the app already relies on (content change + audit row, session create + cleanup).
  No TCP from the Worker. Hyperdrive is not used until measurements say a query path is slow.
- **Branches, not shared databases:** `production` (live), `staging` (the staging Worker), `dev`
  (local `npm run dev`). Local work never points at production. Connection strings are Worker
  secrets (`DATABASE_URL`), never committed.
- **Migrations:** plain SQL files in `db/migrations`, applied by `scripts/migrate.mjs`, tracked in a
  `schema_migrations` table. Times are `timestamptz` (UTC); money stays integer pence.
- **Row-level security is on for every table in `public`.** A Postgres event trigger
  (`guard.rls_auto_enable`, installed 2026-10-04) enables RLS on every table created there, so a
  forgotten `ENABLE ROW LEVEL SECURITY` cannot happen. The Worker connects as the database owner
  (bypasses RLS); any other role (such as a future Data API user) is default-deny until a policy
  is written.
- **Neon Auth and the Neon Data API stay off.** Admin identity is Google OAuth plus the allow-list
  with our own sessions (ADR 0003); the browser never talks to the database. Both were switched
  off on 2026-10-04.
- **Tests run against real Postgres:** PGlite (in-process Postgres) applies the real migrations,
  replacing the `node:sqlite` D1 fake, so constraints and SQL are tested as they will run.
- **One place reaches the database:** `src/lib/db.ts` exposes `query` and `transaction`; store
  and session code take it as a parameter (as they did with D1) so tests can inject PGlite.

## Alternatives

- **Stay on D1 and add tables as needed.** Cheapest today, and fine for content. Rejected because the
  calendar/CRM direction wants real relational features (constraints, ranges, exclusion
  constraints against double-booking), and Wayfinder already runs on Postgres.
- **Keep both (D1 for content, Neon for the admin tool).** Two databases, two migration systems,
  two backup stories for a one-person business. Rejected.
- **Supabase:** brings its own auth and a public data API we deliberately do not use.

## Consequences

- **Good:** one relational store for the whole product; proper constraints; branching for safe
  experiments; point-in-time restore (Neon history retention is currently 6 hours: raise it
  before go-live).
- **Cost:** a second vendor and bill next to Cloudflare, one network hop per query from the Worker
  (London to London), and a free-tier compute that scales to zero (first query after idle is slower).
  Mitigated by one connection string, caching nothing yet, and a brochure site that must still
  render defaults if the database fails (already how `getOverrides` behaves).
- **Rotate secrets** after setup: the Neon API key was used from an AI session on 2026-10-04.
- **Scope boundary:** Sam's round planner/route optimisation stays in WindowsWayfinder (CLAUDE.md:
  do not merge the two). The `/admin` here covers his enquiries, customers and calendar; where
  the two overlap (jobs on a round) is a decision to make when that work starts, not before.
- **Backups:** Neon branches/history plus a scheduled export before go-live; D1 export is no
  longer needed once D1 is removed.
