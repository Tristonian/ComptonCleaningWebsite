import 'server-only';
import { getDb, type Db } from '@/lib/db';
import { checkValue, isLocale, isValidNodeKey, type Locale } from './shared';
import { looksLikeHtml } from '@/lib/rich';
import { checkRichValue } from '@/lib/rich-sanitize';

/**
 * Overrides-only content (ADR 0002/0004, Postgres since ADR 0005). A row exists only where Sam
 * changed the default; reverting is a DELETE. Every change writes an audit row in the SAME
 * transaction, so the log cannot disagree with the data.
 *
 * The database is passed in explicitly so the same code runs against Neon in the Worker and
 * against in-process Postgres (PGlite) in tests.
 */

export type Overrides = Record<string, string>;
export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Every override for one language, as one map. One query per request: the table only ever
 * holds the handful of things that were changed. Any failure renders the site as shipped,
 * because a brochure site must never show an error page because a database hiccuped.
 */
export async function getOverrides(locale: Locale, db: Db = getDb()): Promise<Overrides> {
  try {
    const rows = await db.query<{ key: string; value: string }>(
      'SELECT key, value FROM content_overrides WHERE locale = $1 AND value IS NOT NULL',
      [locale],
    );
    const out: Overrides = {};
    for (const row of rows) if (isValidNodeKey(row.key)) out[row.key] = row.value;
    return out;
  } catch (err) {
    console.error('[content] getOverrides failed, rendering defaults:', err);
    return {};
  }
}

async function previousValue(db: Db, locale: string, key: string): Promise<string | null> {
  const rows = await db.query<{ value: string | null }>(
    'SELECT value FROM content_overrides WHERE locale = $1 AND key = $2',
    [locale, key],
  );
  return rows[0]?.value ?? null;
}

export async function saveNode(
  args: { locale: unknown; key: unknown; value: unknown; rich?: boolean; by: string },
  db: Db = getDb(),
): Promise<SaveResult> {
  if (!isLocale(args.locale)) return { ok: false, error: 'Unknown language.' };
  if (!isValidNodeKey(args.key)) return { ok: false, error: 'That is not a valid field.' };
  // Anything shaped like rich text is sanitised whatever the caller says, so a client that lies
  // about `rich` still cannot store raw markup (ADR 0007).
  const asRich = args.rich === true || (typeof args.value === 'string' && looksLikeHtml(args.value));
  const checked = asRich ? checkRichValue(args.value) : checkValue(args.value);
  if (!checked.ok) return checked;

  try {
    const previous = await previousValue(db, args.locale, args.key);
    await db.transaction([
      {
        text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
        params: [
          args.by,
          'edit',
          JSON.stringify({ locale: args.locale, key: args.key, previous, next: checked.value }),
        ],
      },
      {
        text: `INSERT INTO content_overrides (locale, key, value, needs_review, updated_by, updated_at)
               VALUES ($1, $2, $3, false, $4, now())
               ON CONFLICT (locale, key) DO UPDATE SET
                 value = excluded.value, needs_review = false,
                 updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        params: [args.locale, args.key, checked.value, args.by],
      },
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[content] saveNode failed:', err);
    return { ok: false, error: 'Could not save that. Try again.' };
  }
}

export async function resetNode(
  args: { locale: unknown; key: unknown; by: string },
  db: Db = getDb(),
): Promise<SaveResult> {
  if (!isLocale(args.locale)) return { ok: false, error: 'Unknown language.' };
  if (!isValidNodeKey(args.key)) return { ok: false, error: 'That is not a valid field.' };

  try {
    const previous = await previousValue(db, args.locale, args.key);
    await db.transaction([
      {
        text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
        params: [args.by, 'revert', JSON.stringify({ locale: args.locale, key: args.key, previous })],
      },
      { text: 'DELETE FROM content_overrides WHERE locale = $1 AND key = $2', params: [args.locale, args.key] },
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[content] resetNode failed:', err);
    return { ok: false, error: 'Could not revert that.' };
  }
}
