import 'server-only';
import { getDb, type Db } from '@/lib/db';
import { SERVICES, SOURCES, type Option } from '@/lib/enquiry-options';

/**
 * The contact form's two editable drop-downs. No rows for a list = the defaults in code. Saving
 * replaces the whole list in one transaction (simple, and a half-saved list cannot exist).
 */

export type ListName = 'service' | 'source';
export type Result = { ok: true } | { ok: false; error: string };
export type OptionRow = { value?: string; en: string; cy: string };

export const MAX_OPTIONS = 30;
export const MAX_LABEL = 80;

const DEFAULTS: Record<ListName, readonly Option[]> = { service: SERVICES, source: SOURCES };
export const isListName = (v: unknown): v is ListName => v === 'service' || v === 'source';

/** `edited` is true once Sam has saved the list: enquiries then store a label snapshot. Failure = defaults. */
export async function getOptions(list: ListName, db: Db = getDb()): Promise<{ options: Option[]; edited: boolean }> {
  try {
    const rows = await db.query<{ value: string; label_en: string; label_cy: string }>(
      'SELECT value, label_en, label_cy FROM form_options WHERE list = $1 ORDER BY position, id',
      [list],
    );
    if (rows.length === 0) return { options: [...DEFAULTS[list]], edited: false };
    return { options: rows.map((r) => ({ value: r.value, en: r.label_en, cy: r.label_cy || r.label_en })), edited: true };
  } catch (err) {
    console.error('[form-options] getOptions failed, using the defaults:', err);
    return { options: [...DEFAULTS[list]], edited: false };
  }
}

/**
 * Replace a list. Rows with a `value` keep it if it exists now or is a built-in key for that list;
 * anything else (including a forged value) gets a fresh generated key. English labels are required;
 * Welsh may be empty (falls back to English). At least one option must remain.
 */
export async function replaceOptions(
  args: { list: unknown; rows: unknown; by: string },
  db: Db = getDb(),
): Promise<Result> {
  if (!isListName(args.list)) return { ok: false, error: 'Unknown list.' };
  if (!Array.isArray(args.rows)) return { ok: false, error: 'Bad request.' };
  if (args.rows.length === 0) return { ok: false, error: 'Keep at least one choice.' };
  if (args.rows.length > MAX_OPTIONS) return { ok: false, error: `No more than ${MAX_OPTIONS} choices.` };

  try {
    const known = new Set<string>([
      ...DEFAULTS[args.list].map((o) => o.value),
      ...(await db.query<{ value: string }>('SELECT value FROM form_options WHERE list = $1', [args.list])).map((r) => r.value),
    ]);
    const used = new Set<string>();
    const clean: { value: string; en: string; cy: string }[] = [];
    for (const raw of args.rows as OptionRow[]) {
      const en = typeof raw?.en === 'string' ? raw.en.trim().replace(/\s+/g, ' ') : '';
      const cy = typeof raw?.cy === 'string' ? raw.cy.trim().replace(/\s+/g, ' ') : '';
      if (!en) return { ok: false, error: 'Every choice needs a name.' };
      if (en.length > MAX_LABEL || cy.length > MAX_LABEL) return { ok: false, error: `Keep names under ${MAX_LABEL} characters.` };
      let value = typeof raw.value === 'string' && known.has(raw.value) && !used.has(raw.value) ? raw.value : '';
      while (!value || used.has(value)) value = `opt-${Math.random().toString(36).slice(2, 10)}`;
      used.add(value);
      clean.push({ value, en, cy });
    }

    await db.transaction([
      { text: 'DELETE FROM form_options WHERE list = $1', params: [args.list] },
      ...clean.map((o, i) => ({
        text: `INSERT INTO form_options (list, value, label_en, label_cy, position, updated_by) VALUES ($1, $2, $3, $4, $5, $6)`,
        params: [args.list, o.value, o.en, o.cy, i, args.by],
      })),
      {
        text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
        params: [args.by, 'options-save', JSON.stringify({ list: args.list, count: clean.length })],
      },
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[form-options] replaceOptions failed:', err);
    return { ok: false, error: 'Could not save that. Try again.' };
  }
}

/** Back to the defaults in code. */
export async function resetOptions(args: { list: unknown; by: string }, db: Db = getDb()): Promise<Result> {
  if (!isListName(args.list)) return { ok: false, error: 'Unknown list.' };
  try {
    await db.transaction([
      { text: 'DELETE FROM form_options WHERE list = $1', params: [args.list] },
      {
        text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
        params: [args.by, 'options-reset', JSON.stringify({ list: args.list })],
      },
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[form-options] resetOptions failed:', err);
    return { ok: false, error: 'Could not reset that. Try again.' };
  }
}
