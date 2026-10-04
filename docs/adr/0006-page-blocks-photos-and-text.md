# ADR 0006 — Page blocks: photos and text Sam can place and arrange

- **Status:** Accepted
- **Date:** 2026-10-04

## Context

Sam wants to add photos (guttering, windows, pressure washing) wherever he likes, several at a time, and
move blocks of text and photos around, from his phone, with no fixed photo slots. CLAUDE.md says "not a CMS",
so this must stay small.

## Decision

- **Blocks in named zones**, not a free-form page builder. A zone is a labelled place in code
  (`src/lib/blocks-shared.ts` `ZONES`, one `<BlockZone>` in `HomePage`): under the intro, Services, Prices,
  Reviews. Adding a place = one array entry + one component line. The built-in sections themselves stay fixed.
- A block is a **photo** (with optional caption) or a **text** paragraph, stored in `page_blocks` (migration
  0007) with a zone and an order position. Text and captions are stored per language; Welsh falls back to English.
- **Photos** share `site_images` and R2 with the logos (`photo/<sha256>`; ADR 0002 rules: resized in the browser,
  content-hash keys, immutable caching). The server re-checks size and sniffs the real bytes (PNG/JPEG/WebP only,
  never SVG); width/height come from the browser and only drive layout. Served by `/img/[hash]`.
- **Arranging:** drag (mouse) and drop, plus ▲ ▼ buttons because touch screens have no HTML drag and Sam is on a
  phone. Both call one server action, `placeBlock`, which renumbers the target zone. Overrides-only: no blocks, no change.
- Every mutation is a server action that re-checks the admin session (ADR 0003) and writes an audit row.

## Trade-offs

- Not pixel-free: blocks sit in fixed zones, in a single column. Cheaper, mobile-safe and cannot produce a broken
  layout; revisit (more zones, two-up photos, reordering whole sections) only if Sam hits the wall.
- Native HTML drag is mouse-only; touch uses the buttons. A pointer-events drag can replace it later.
