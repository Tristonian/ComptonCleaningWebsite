# ADR 0004 — Edit-anywhere pencil, and English/Welsh content

- **Status:** Accepted (approach); Welsh wording is machine-drafted until a fluent speaker reviews it
- **Date:** 2026-10-04
- **Context:** Tristan wants the "edit anywhere" pencil from the LesK demo (`<Ed id>` plus a docked
  inspector) and wants to offer Welsh as a selling point.

## Decision

### Editing
- Port LesK's pattern: `<Ed id="home.hero.title">English default</Ed>`. The default wording is the
  children, so making any text editable costs one line and no registration. When edit mode is
  off it renders exactly what the public sees (no wrapper, no extra attributes).
- A docked inspector edits the selected node: wording first; typography (size, weight, colour) is
  optional and can wait for a later phase. Edits preview locally and commit explicitly.
- Overrides-only storage (ADR 0002): `content_overrides` has a row only where Sam changed
  something. Revert = delete the row.
- Admin mode is UI only. Every save goes through a server action that re-checks the session
  and allow-list (ADR 0003), writes an `audit_log` row, and sanitises the value (plain text
  only; no HTML from the editor).

### Welsh
- URL prefix: English at `/`, Welsh at `/cy/...`. A visible language switch, `<html lang>`
  set per locale, `hreflang` alternates and a sitemap entry for each.
- Welsh defaults live in code in `src/content/cy.ts`, keyed by the same node ids as the English
  children. If a key is missing, the page falls back to English rather than showing a hole.
- Overrides are keyed `(locale, key)`, so the pencil edits whichever language the page is in.
- Machine-drafted Welsh is flagged `needs_review` and must be read by a fluent speaker before
  launch. Poor Welsh is worse than none; do not market "bilingual" until it has been checked.
- Numbers, prices and postcodes are never translated, only formatted (`£`, integer pence).

## Consequences

- Every new piece of copy needs a Welsh entry (or knowingly falls back). A test lists node ids
  with no Welsh default so gaps are visible, not silent.
- Slightly larger bundle and a second set of routes; acceptable for a small site.
- SEO gain for Welsh-language search; Google Business Profile wording is a separate manual job.
