import 'server-only';
import { getDb, type Db } from '@/lib/db';
import { deleteBlock } from '@/lib/blocks';

/**
 * Services Sam adds himself (e.g. Pressure washing): a card with a title and description per
 * language (Welsh falls back to English while empty) plus two block zones for photos, GIFs and text:
 * `svc-<id>-top` (between title and text) and `svc-<id>` (after the text) (ADR 0006). Audit rows are written in the same statement/transaction as the change.
 */

export type CustomService = { id: string; titleEn: string; titleCy: string; bodyEn: string; bodyCy: string };
export type Result = { ok: true } | { ok: false; error: string };

export const MAX_TITLE = 120;
export const MAX_BODY = 2000;

export const serviceText = (s: CustomService, field: 'title' | 'body', locale: 'en' | 'cy') => {
  const en = field === 'title' ? s.titleEn : s.bodyEn;
  const cy = field === 'title' ? s.titleCy : s.bodyCy;
  return locale === 'cy' && cy ? cy : en;
};

type Row = { id: string; title_en: string; title_cy: string; body_en: string; body_cy: string };

export async function listServices(db: Db = getDb()): Promise<CustomService[]> {
  try {
    const rows = await db.query<Row>(
      'SELECT id, title_en, title_cy, body_en, body_cy FROM custom_services ORDER BY position, id',
    );
    return rows.map((r) => ({
      id: String(r.id),
      titleEn: r.title_en,
      titleCy: r.title_cy,
      bodyEn: r.body_en,
      bodyCy: r.body_cy,
    }));
  } catch (err) {
    console.error('[services] listServices failed, rendering without custom services:', err);
    return [];
  }
}

const audit = (by: string, action: string, detail: unknown) => ({
  text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
  params: [by, action, JSON.stringify(detail)],
});

export async function addService(args: { by: string }, db: Db = getDb()): Promise<Result> {
  try {
    await db.query(
      `WITH ins AS (
         INSERT INTO custom_services (position, title_en, body_en, created_by)
         VALUES ((SELECT COALESCE(MAX(position), 0) + 1 FROM custom_services), 'New service', 'Describe this service.', $1)
         RETURNING id)
       INSERT INTO audit_log (email, action, detail) SELECT $1, 'service-add', json_build_object('id', id)::text FROM ins`,
      [args.by],
    );
    return { ok: true };
  } catch (err) {
    console.error('[services] addService failed:', err);
    return { ok: false, error: 'Could not add that service. Try again.' };
  }
}

export async function updateService(
  args: { id: unknown; locale: unknown; title: unknown; body: unknown; by: string },
  db: Db = getDb(),
): Promise<Result> {
  if (args.locale !== 'en' && args.locale !== 'cy') return { ok: false, error: 'Unknown language.' };
  if (!/^\d+$/.test(String(args.id))) return { ok: false, error: 'Unknown service.' };
  if (typeof args.title !== 'string' || typeof args.body !== 'string') return { ok: false, error: 'Bad text.' };
  const title = args.title.trim();
  const body = args.body.trim();
  if (title.length > MAX_TITLE || body.length > MAX_BODY) return { ok: false, error: 'That text is too long.' };
  if (args.locale === 'en' && !title) return { ok: false, error: 'A service needs a title.' };
  const [t, b] = args.locale === 'cy' ? ['title_cy', 'body_cy'] : ['title_en', 'body_en'];
  try {
    const found = await db.query(`UPDATE custom_services SET ${t} = $1, ${b} = $2 WHERE id = $3 RETURNING id`, [
      title,
      body,
      args.id,
    ]);
    if (found.length === 0) return { ok: false, error: 'That service no longer exists.' };
    const a = audit(args.by, 'service-edit', { id: String(args.id), locale: args.locale });
    await db.query(a.text, a.params);
    return { ok: true };
  } catch (err) {
    console.error('[services] updateService failed:', err);
    return { ok: false, error: 'Could not save that. Try again.' };
  }
}

/** Swap with the neighbour. At either end this is a no-op that still succeeds. */
export async function moveService(args: { id: unknown; dir: unknown; by: string }, db: Db = getDb()): Promise<Result> {
  if (!/^\d+$/.test(String(args.id))) return { ok: false, error: 'Unknown service.' };
  if (args.dir !== -1 && args.dir !== 1) return { ok: false, error: 'Bad direction.' };
  const id = String(args.id);
  try {
    const ids = (await db.query<{ id: string }>('SELECT id FROM custom_services ORDER BY position, id')).map((r) => String(r.id));
    const i = ids.indexOf(id);
    if (i === -1) return { ok: false, error: 'That service no longer exists.' };
    const j = i + args.dir;
    if (j < 0 || j >= ids.length) return { ok: true };
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await db.transaction([
      ...ids.map((sid, n) => ({ text: 'UPDATE custom_services SET position = $1 WHERE id = $2', params: [n, sid] })),
      audit(args.by, 'service-move', { id, dir: args.dir }),
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[services] moveService failed:', err);
    return { ok: false, error: 'Could not move that. Try again.' };
  }
}

/** Deletes the service and everything in its zone. `orphanHashes` are photos now unused (caller removes them from R2). */
export async function deleteService(
  args: { id: unknown; by: string },
  db: Db = getDb(),
): Promise<{ ok: true; orphanHashes: string[] } | { ok: false; error: string }> {
  if (!/^\d+$/.test(String(args.id))) return { ok: false, error: 'Unknown service.' };
  const id = String(args.id);
  try {
    const exists = await db.query('SELECT 1 FROM custom_services WHERE id = $1', [id]);
    if (exists.length === 0) return { ok: false, error: 'That service no longer exists.' };
    const orphanHashes: string[] = [];
    const inside = await db.query<{ id: string }>('SELECT id FROM page_blocks WHERE zone IN ($1, $2)', [`svc-${id}`, `svc-${id}-top`]);
    for (const b of inside) {
      const r = await deleteBlock({ id: b.id, by: args.by }, db);
      if (r.ok && r.orphanHash) orphanHashes.push(r.orphanHash);
    }
    await db.transaction([
      { text: 'DELETE FROM custom_services WHERE id = $1', params: [id] },
      audit(args.by, 'service-delete', { id }),
    ]);
    return { ok: true, orphanHashes };
  } catch (err) {
    console.error('[services] deleteService failed:', err);
    return { ok: false, error: 'Could not delete that service.' };
  }
}
