import 'server-only';
import { getDb, type Db } from '@/lib/db';
import { isImageHash } from '@/lib/appearance-shared';
import { MAX_BLOCK_TEXT, isZone, type Block, type ZoneId } from '@/lib/blocks-shared';

/**
 * Photo and text blocks Sam arranges on the page. DB passed in so tests run on PGlite. Every change
 * writes an audit row in the same transaction. A failure to READ renders the page without blocks:
 * a brochure site never errors because of a database hiccup.
 */

export type Result = { ok: true } | { ok: false; error: string };

type Row = {
  id: string;
  zone: ZoneId;
  kind: 'image' | 'text';
  image_hash: string | null;
  width: number | null;
  height: number | null;
  text_en: string;
  text_cy: string;
};

export async function listBlocks(db: Db = getDb()): Promise<Block[]> {
  try {
    const rows = await db.query<Row>(
      `SELECT b.id, b.zone, b.kind, b.image_hash, i.width, i.height, b.text_en, b.text_cy
         FROM page_blocks b LEFT JOIN site_images i ON i.hash = b.image_hash
        ORDER BY b.zone, b.position, b.id`,
    );
    return rows
      .filter((r) => isZone(r.zone))
      .map((r) => ({
        id: String(r.id),
        zone: r.zone,
        kind: r.kind,
        hash: r.image_hash,
        width: r.width,
        height: r.height,
        textEn: r.text_en,
        textCy: r.text_cy,
      }));
  } catch (err) {
    console.error('[blocks] listBlocks failed, rendering without blocks:', err);
    return [];
  }
}

const audit = (by: string, action: string, detail: unknown) => ({
  text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
  params: [by, action, JSON.stringify(detail)],
});

const nextPosition = '(SELECT COALESCE(MAX(position), 0) + 1 FROM page_blocks WHERE zone = $1)';

export async function addTextBlock(args: { zone: unknown; text?: string; by: string }, db: Db = getDb()): Promise<Result> {
  if (!isZone(args.zone)) return { ok: false, error: 'Unknown place on the page.' };
  try {
    await db.transaction([
      {
        text: `INSERT INTO page_blocks (zone, position, kind, text_en, created_by) VALUES ($1, ${nextPosition}, 'text', $2, $3)`,
        params: [args.zone, (args.text ?? 'New text').slice(0, MAX_BLOCK_TEXT), args.by],
      },
      audit(args.by, 'block-add', { zone: args.zone, kind: 'text' }),
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[blocks] addTextBlock failed:', err);
    return { ok: false, error: 'Could not add that. Try again.' };
  }
}

export async function addImageBlock(
  args: { zone: unknown; hash: string; width: number; height: number; contentType: string; by: string },
  db: Db = getDb(),
): Promise<Result> {
  if (!isZone(args.zone)) return { ok: false, error: 'Unknown place on the page.' };
  if (!isImageHash(args.hash)) return { ok: false, error: 'That is not a valid image.' };
  try {
    await db.transaction([
      {
        text: `INSERT INTO site_images (hash, content_type, width, height, kind, uploaded_by)
               VALUES ($1, $2, $3, $4, 'photo', $5) ON CONFLICT (hash) DO NOTHING`,
        params: [args.hash, args.contentType, args.width, args.height, args.by],
      },
      {
        text: `INSERT INTO page_blocks (zone, position, kind, image_hash, created_by) VALUES ($1, ${nextPosition}, 'image', $2, $3)`,
        params: [args.zone, args.hash, args.by],
      },
      audit(args.by, 'block-add', { zone: args.zone, kind: 'image', hash: args.hash }),
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[blocks] addImageBlock failed:', err);
    return { ok: false, error: 'Could not add that photo. Try again.' };
  }
}

/** Caption (images) or body (text) for one language. */
export async function updateBlockText(
  args: { id: unknown; locale: unknown; text: unknown; by: string },
  db: Db = getDb(),
): Promise<Result> {
  if (args.locale !== 'en' && args.locale !== 'cy') return { ok: false, error: 'Unknown language.' };
  if (typeof args.text !== 'string' || args.text.length > MAX_BLOCK_TEXT) return { ok: false, error: 'That text is too long.' };
  if (!/^\d+$/.test(String(args.id))) return { ok: false, error: 'Unknown block.' };
  const column = args.locale === 'cy' ? 'text_cy' : 'text_en';
  try {
    const found = await db.query(`UPDATE page_blocks SET ${column} = $1 WHERE id = $2 RETURNING id`, [args.text.trim(), args.id]);
    if (found.length === 0) return { ok: false, error: 'That block no longer exists.' };
    await db.query('INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)', [
      args.by,
      'block-text',
      JSON.stringify({ id: String(args.id), locale: args.locale }),
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[blocks] updateBlockText failed:', err);
    return { ok: false, error: 'Could not save that. Try again.' };
  }
}

/**
 * Move a block to `index` in `zone`. `index` is a position in the zone's list AS IT IS NOW (the
 * block still in it when it is the same zone): "insert before the item currently at index". It is
 * clamped, so a huge number means "the end". Positions in the target zone are renumbered 0..n.
 */
export async function placeBlock(
  args: { id: unknown; zone: unknown; index: unknown; by: string },
  db: Db = getDb(),
): Promise<Result> {
  if (!isZone(args.zone)) return { ok: false, error: 'Unknown place on the page.' };
  if (!/^\d+$/.test(String(args.id))) return { ok: false, error: 'Unknown block.' };
  const id = String(args.id);
  const want = Number(args.index);
  if (!Number.isFinite(want)) return { ok: false, error: 'Bad position.' };
  try {
    const known = await db.query<{ zone: string }>('SELECT zone FROM page_blocks WHERE id = $1', [id]);
    if (known.length === 0) return { ok: false, error: 'That block no longer exists.' };
    const ids = (
      await db.query<{ id: string }>('SELECT id FROM page_blocks WHERE zone = $1 ORDER BY position, id', [args.zone])
    ).map((r) => String(r.id));

    let index = Math.max(0, Math.min(Math.floor(want), ids.length));
    const from = ids.indexOf(id);
    if (from !== -1 && from < index) index -= 1; // removing it first shifts later slots up by one
    const without = ids.filter((x) => x !== id);
    without.splice(index, 0, id);

    await db.transaction([
      ...without.map((bid, i) => ({
        text: 'UPDATE page_blocks SET zone = $1, position = $2 WHERE id = $3',
        params: [args.zone, i, bid],
      })),
      audit(args.by, 'block-move', { id, zone: args.zone, index }),
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[blocks] placeBlock failed:', err);
    return { ok: false, error: 'Could not move that. Try again.' };
  }
}

/** Deletes the block. `orphanHash` is set when its photo is now unused (caller removes the R2 object). */
export async function deleteBlock(
  args: { id: unknown; by: string },
  db: Db = getDb(),
): Promise<{ ok: true; orphanHash: string | null } | { ok: false; error: string }> {
  if (!/^\d+$/.test(String(args.id))) return { ok: false, error: 'Unknown block.' };
  try {
    const found = await db.query<{ image_hash: string | null }>('SELECT image_hash FROM page_blocks WHERE id = $1', [args.id]);
    if (found.length === 0) return { ok: false, error: 'That block no longer exists.' };
    const hash = found[0].image_hash;
    await db.transaction([
      { text: 'DELETE FROM page_blocks WHERE id = $1', params: [args.id] },
      audit(args.by, 'block-delete', { id: String(args.id), hash }),
    ]);
    if (!hash) return { ok: true, orphanHash: null };
    const left = await db.query('SELECT 1 FROM page_blocks WHERE image_hash = $1 LIMIT 1', [hash]);
    if (left.length > 0) return { ok: true, orphanHash: null };
    await db.query("DELETE FROM site_images WHERE hash = $1 AND kind = 'photo'", [hash]);
    return { ok: true, orphanHash: hash };
  } catch (err) {
    console.error('[blocks] deleteBlock failed:', err);
    return { ok: false, error: 'Could not delete that.' };
  }
}
