# 0012: The route planner is built in this repo

Status: Accepted (2026-10-04, session 7; supersedes the "route planner stays a separate product" line of ADR 0008)

## Decision

Tristan wanted route planning in the next deployment, not as a separate WindowsWayfinder product. It lives in
`/admin/rounds`: choose a round, tap **Best order** (whole round, or those due this week), see the proposed order with
the drive time for each leg and the total against the current order, then **Use this order** to save it. The Work screen
lists a selected round in that saved order, and Google Maps links (nine stops a link, each starting where the last ended)
hand the day to turn-by-turn navigation.

## How the order is chosen

- **Travel time, not distance.** The user's requirement was "how long travel is, accounting for faster roads". Drive
  times come from the Mapbox **Matrix API** (`driving` profile), which knows road class and one-way streets.
  `driving-traffic` is not used: it allows only 10 coordinates and live traffic is meaningless for a plan made days ahead.
- **Chunked.** Matrix takes 25 coordinates a request, so stops are split in chunks of 12 and each pair of chunks is one
  request. One plan covers up to 36 stops (16 requests, inside Mapbox's 60 a minute); more are left out and the page says so.
- **Solver** (`src/lib/route.ts`, pure): exact (Held-Karp) up to 12 stops; beyond that nearest-neighbour then 2-opt and
  single-stop relocation until nothing improves. Durations may be asymmetric, so each candidate is costed in full.
  Tested against brute force.
- **Start and finish.** The preview starts from Sam's base (`BASE` in `weather.ts`, Lyde Green). A small "Start from: Home / Where I am" toggle (`StartFromHere`) switches it to the phone's position, so the first stop is the nearest to where he really is (fixed 2026-10-05 after Tristan found the plan always began at the base). The position is kept in an httpOnly cookie for two hours (`plan-start.ts`), never in a URL; the Maps links start from it too. By default the drive back to the start is counted, with a switch to plan a day that ends at the last stop.
- **Needs a pin.** Customers with no location cannot be placed; they are listed under the plan and left where they are.

## The Mapbox token

The token in use for the map is a public token restricted to our website addresses. Mapbox checks that restriction in
the `Referer` header, which a server-side call does not have, so the server states the site as its referer
(`SITE_URL`). Checked with curl on 2026-10-04: with no referer the Matrix API answers 403, with the staging or production site as referer it answers 200. If Mapbox ever refuses, or the network fails, the page **falls back to straight-line estimates**
(1.35 detour factor, 32 km/h) and says "estimated" so Sam is never shown a precise-looking number that is a guess.
A secret `MAPBOX_SERVER_TOKEN` (a token without URL restriction, Matrix scope) takes precedence if one is ever set; that is
the robust fix and is a hand step for Tristan (`wrangler secret put MAPBOX_SERVER_TOKEN`, then check it is non-empty).

## Building a round on the fly

From the Rounds screen (or the admin Home card) Sam can tick customers who are due this week, name a round and build it; it opens on its best-order preview. It is an ordinary round: customers keep any other rounds, and it can be deleted afterwards (customers are untouched), so one-off rounds do not pile up forever.

## Not done

No road-following line on the admin map; Mapbox Optimization API (it caps at 12 stops, our own solver does more);
live traffic; per-customer time windows or service durations.
