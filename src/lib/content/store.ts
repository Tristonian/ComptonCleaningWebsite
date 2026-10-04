import 'server-only';
import { getDb } from '@/lib/db';
import { checkValue, isLocale, isValidNodeKey, type Locale } from './shared';

/**
 * Overrides-only content (ADR 0002/0004). A row exists only where Sam changed the default;
 * reverting is a DELETE. Every change writes an audit row in the SAME batch, so the log
 * cannot disagree with the data.
 *
 * The database is passed in explicitly so the same code runs against D1 in the Worker and
 * against a SQLite-backed fake in tests.
 */

export type Overrides = Record<string, string>;
export type SaveResult = { ok: true } | { ok: false; error: string };

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * Every override for one language, as one map. One query per request: the table only ever
 * holds the handful of things that were changed. Any failure renders the site as shipped,
 * because a brochure site must never show an error page because a database hiccuped.
 */
export async function getOverrides(locale: Locale, db: D1Database = getDb()): Promise<Overrides> {
  try {
    const { results } = await db
      .prepare('SELECT key, value FROM content_overrides WHERE locale = ? AND value IS NOT NULL')
      .bind(locale)
      .all<{ key: string; value: string }>();
    const out: Overrides = {};
    for (const row of results) if (isValidNodeKey(row.key)) out[row.key] = row.value;
    return out;
  } catch (err) {
    console.error('[content] getOverrides failed, rendering defaults:', err);
    return {};
  }
}

export async function saveNode(
  args: { locale: unknown; key: unknown; value: unknown; by: string },
  db: D1Database = getDb(),
): Promise<SaveResult> {
  if (!isLocale(args.locale)) return { ok: false, error: 'Unknown language.' };
  if (!isValidNodeKey(args.key)) return { ok: false, error: 'That is not a valid field.' };
  const checked = checkValue(args.value);
  if (!checked.ok) return checked;

  try {
    const previous = await db
      .prepare('SELECT value FROM content_overrides WHERE locale = ? AND key = ?')
      .bind(args.locale, args.key)
      .first<{ value: string | null }>();
    const now = nowSeconds();
    await db.batch([
      db
        .prepare('INSERT INTO audit_log (at, email, action, detail) VALUES (?, ?, ?, ?)')
        .bind(
          now,
          args.by,
          'edit',
          JSON.stringify({ locale: args.locale, key: args.key, previous: previous?.value ?? null, next: checked.value }),
        ),
      db
        .prepare(
          `INSERT INTO content_overrides (locale, key, value, needs_review, updated_by, updated_at)
           VALUES (?, ?, ?, 0, ?, ?)
           ON CONFLICT (locale, key) DO UPDATE SET
             value = excluded.value, needs_review = 0,
             updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        )
        .bind(args.locale, args.key, checked.value, args.by, now),
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[content] saveNode failed:', err);
    return { ok: false, error: 'Could not save that. Try again.' };
  }
}

export async function resetNode(
  args: { locale: unknown; key: unknown; by: string },
  db: D1Database = getDb(),
): Promise<SaveResult> {
  if (!isLocale(args.locale)) return { ok: false, error: 'Unknown language.' };
  if (!isValidNodeKey(args.key)) return { ok: false, error: 'That is not a valid field.' };

  try {
    const previous = await db
      .prepare('SELECT value FROM content_overrides WHERE locale = ? AND key = ?')
      .bind(args.locale, args.key)
      .first<{ value: string | null }>();
    await db.batch([
      db
        .prepare('INSERT INTO audit_log (at, email, action, detail) VALUES (?, ?, ?, ?)')
        .bind(
          nowSeconds(),
          args.by,
          'revert',
          JSON.stringify({ locale: args.locale, key: args.key, previous: previous?.value ?? null }),
        ),
      db.prepare('DELETE FROM content_overrides WHERE locale = ? AND key = ?').bind(args.locale, args.key),
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[content] resetNode failed:', err);
    return { ok: false, error: 'Could not revert that.' };
  }
}
