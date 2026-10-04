# ADR 0007 — Rich text for body copy, and the WindowsWayfinder boundary

- **Status:** Accepted
- **Date:** 2026-10-04
- **Context:** Sam could not make paragraphs on the front page: the pencil edited plain text and the
  page rendered it as a React text node, so every newline collapsed into one run of words. Tristan asked
  for HairByRachel's rich text editor, and for blank lines to be respected so Sam can start new paragraphs.
  The same session settled whether the round planner joins this repo.

## Decision

### Rich text
- **Body copy is rich text; labels, headings and short strings stay plain.** An `<Ed rich>` node,
  a text block (ADR 0006) and a service description are edited in a tiptap box adapted from
  HairByRachel's `RichTextEditor`, the same toolbar minus inline images.
  Enter starts a new paragraph. It was first cut down to a handful of buttons; that was a mistake
  (Tristan, 2026-10-04) and the full set is back. Inline images are the only thing not brought over,
  because photos already have their own blocks (ADR 0006).
- **Storage is still one string per value.** Rich values are an HTML subset matching HairByRachel's editor minus images (`p h2 h3 blockquote hr br strong em u a ul ol li`, plus tightly-patterned size, colour and alignment styles).
  Plain values from before this change are unchanged and are converted when read (`toRichHtml`: a blank
  line becomes a new paragraph, a single newline a line break, markup is escaped). Nothing was migrated.
- **Sanitised on every save, on the server** (`sanitize-html`, `src/lib/rich-sanitize.ts`), so what reaches
  the database is safe for `dangerouslySetInnerHTML`. Anything shaped like rich text (opens with `<p`, `<ul`,
  `<ol`) is sanitised even if the client claims it is plain, so a lying client cannot store raw markup.
  This amends ADR 0004's "plain text only": plain text is still the rule for every node not marked `rich`.
- **Blank lines are kept, deliberately.** An empty paragraph has no height in a browser, which is how a
  typed blank line silently vanishes. The renderer turns `<p></p>` into `<p><br></p>` (one line high) and the
  editor gets it back empty. Blank paragraphs at the very start and end are trimmed on save as stray Enters.
- **The editor is lazy-loaded** (`next/dynamic`, no SSR) so visitors do not download it; the public page
  stayed at about 126 kB first load.
- Rich nodes render in a `div`, whatever `as` says, because paragraphs cannot nest in a `<p>`.

### WindowsWayfinder
- **Stays a separate product.** The round planner is not built into this repo. CLAUDE.md's
  "do not merge the two" stands. Tristan decided this 2026-10-04 after it had been left open as
  "the planner stalled and might come here for Sam first". If a link-out or shared data is ever wanted,
  write a new ADR; do not grow this site's admin into a planner.

## Consequences
- New body copy should be `<Ed rich>`; headings, buttons and form labels stay plain.
- A new rich writer must go through `sanitizeRichHtml` / `cleanRichField`; a new reader must use `RichText`
  or `toDisplayHtml`, never render a stored value as HTML directly.
- Bold, italic and links are now possible in Welsh and English copy; machine-drafted Welsh is still plain.
