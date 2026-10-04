# 0009: Weather from Open-Meteo, and visit photos shared with page photos

Status: Accepted (2026-10-04, session 5)

## Weather

Open-Meteo (free, no key, no account) is called **server-side only** from `src/lib/weather.ts`, never from
the browser, so no key or visitor IP is involved and the admin works with strict browser rules. The answer is
cached in the Workers Cache API per ~1 km area per London day (at most an hour old), and every failure
returns `null` so the tile is simply left out: a weather outage must never break the admin home.
The verdict (good / fine with care / poor / ladder warning) comes from named thresholds in `weather.ts`
(rain 35%/60%, gusts 25/35 mph, overnight low 2/0 °C). They are Tristan's starting guesses, not Sam's rules;
change the constants, the tests follow them.

## Visit photos

Bytes go to R2 as `photo/<sha256>` through the same path as page photos (ADR 0002/0006), resized in the
browser first. `job_photos` rows only say which visit a hash belongs to. Because the key is a content hash,
the **same object can be a page block, a visit photo, or on several visits**, so an R2 object is deleted
only when `unreferenced()` says neither `job_photos` nor `page_blocks` still points at it. Delete paths
(photo, visit, customer, page block) collect hashes first and remove from R2 after the database delete.

**Decision Tristan may want to revisit:** visit photos are served by the public `/img/<hash>` route like page
photos. The 64-character hash cannot be guessed, but anyone sent the link can open it, and a photo of a
customer's house is more private than a marketing photo. Making them admin-only would need a second route that
checks the session (and no long public cache). Not done because Sam shares photos with customers, and nothing
lists the hashes publicly.
