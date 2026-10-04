import 'server-only';
import { getDb, type Db } from '@/lib/db';

/**
 * Sections Sam has hidden (and can show again). Stored as one JSON array in `site_settings`
 * ('hidden_sections'); no row means everything is shown. Contact is deliberately not hideable: it is
 * how customers reach the business. A custom service hides as `svc-<id>`.
 */

export const HIDEABLE = ['about', 'services', 'service-windows', 'service-gutters', 'service-other', 'prices', 'reviews'] as const;
export const isHideable = (v: unknown): v is string =>
  typeof v === 'string' && ((HIDEABLE as readonly string[]).includes(v) || /^svc-\d+$/.test(v));

export type Result = { ok: true } | { ok: false; error: string };

function parse(raw: string | undefined): string[] {
  try {
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter(isHideable) : [];
  } catch {
    return [];
  }
}

/** A failure shows everything: hiding is never worth an error page. */
export async function getHiddenSections(db: Db = getDb()): Promise<string[]> {
  try {
    const rows = await db.query<{ value: string }>("SELECT value FROM site_settings WHERE key = 'hidden_sections'");
    return parse(rows[0]?.value);
  } catch (err) {
    console.error('[sections] getHiddenSections failed, showing everything:', err);
    return [];
  }
}

export async function setSectionHidden(args: { id: unknown; hidden: unknown; by: string }, db: Db = getDb()): Promise<Result> {
  if (!isHideable(args.id)) return { ok: false, error: 'That section cannot be hidden.' };
  if (typeof args.hidden !== 'boolean') return { ok: false, error: 'Bad request.' };
  try {
    const current = await getHiddenSectionsStrict(db);
    const next = args.hidden ? [...new Set([...current, args.id])] : current.filter((x) => x !== args.id);
    await db.transaction([
      {
        text: `INSERT INTO site_settings (key, value, updated_by, updated_at) VALUES ('hidden_sections', $1, $2, now())
               ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
        params: [JSON.stringify(next), args.by],
      },
      {
        text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
        params: [args.by, args.hidden ? 'section-hide' : 'section-show', JSON.stringify({ id: args.id })],
      },
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[sections] setSectionHidden failed:', err);
    return { ok: false, error: 'Could not change that. Try again.' };
  }
}

async function getHiddenSectionsStrict(db: Db): Promise<string[]> {
  const rows = await db.query<{ value: string }>("SELECT value FROM site_settings WHERE key = 'hidden_sections'");
  return parse(rows[0]?.value);
}
