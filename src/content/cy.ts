/**
 * Welsh defaults, keyed by the same node ids as the English `<Ed id>` children (ADR 0004).
 *
 * ⚠️ MACHINE-DRAFTED. Every string here must be read by a fluent Welsh speaker before launch.
 * The pencil shows "draft Welsh, not yet reviewed" for any node still using one of these, and
 * saving over it in the admin clears that. A missing key falls back to English, never a hole.
 *
 * `src/content/cy.test.ts` fails if an `<Ed id>` in the source has no entry here (and isn't
 * listed in SAME_IN_BOTH), so gaps are visible rather than silent.
 */
export const cy: Record<string, string> = {
  'home.hero.title': 'Glanhau ffenestri o safon',
  'home.hero.body': 'Gwefan lawn yn dod yn fuan.',
  'nav.call': 'Ffoniwch',
  'lang.switch': 'English',
};

/** Ids whose wording is deliberately identical in both languages (names, brands). */
export const SAME_IN_BOTH = new Set<string>(['brand.name', 'nav.whatsapp']);
