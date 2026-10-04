import 'server-only';
import { getDb, type Db } from '@/lib/db';
import { isImageHash } from '@/lib/appearance-shared';
import type { Result } from '@/lib/customers';

/**
 * Photos of a clean (ADR 0008). The bytes live in R2 under `photo/<sha256>` like page photos; this table
 * only says which visit a hash belongs to. The same hash can sit under several visits or on a page block,
 * so an R2 object may only be removed once NOTHING references it (`unreferenced`).
 */

export const MAX_JOB_PHOTOS = 8;

export type JobPhoto = { id: string; hash: string; width: number | null; height: number | null };

const audit = (by: string, action: string, detail: object) => ({
  text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
  params: [by, action, JSON.stringify(detail)],
});

/** Of these hashes, the ones no visit photo and no page block still uses: safe to delete from R2. */
export async function unreferenced(hashes: string[], db: Db = getDb()): Promise<string[]> {
  const unique = [...new Set(hashes.filter(isImageHash))];
  if (unique.length === 0) return [];
  const used = await db.query<{ hash: string }>(
    `SELECT hash FROM job_photos WHERE hash = ANY($1::text[])
     UNION SELECT image_hash AS hash FROM page_blocks WHERE image_hash = ANY($1::text[])`,
    [unique],
  );
  const keep = new Set(used.map((r) => r.hash));
  return unique.filter((h) => !keep.has(h));
}

export async function addJobPhoto(
  args: { jobId: unknown; hash: string; width: number; height: number; by: string },
  db: Db = getDb(),
): Promise<Result> {
  if (!/^\d+$/.test(String(args.jobId))) return { ok: false, error: 'Unknown visit.' };
  if (!isImageHash(args.hash)) return { ok: false, error: 'That is not a valid image.' };
  try {
    const job = await db.query('SELECT 1 FROM jobs WHERE id = $1', [args.jobId]);
    if (job.length === 0) return { ok: false, error: 'That visit no longer exists.' };
    const n = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM job_photos WHERE job_id = $1', [args.jobId]);
    if (Number(n[0].n) >= MAX_JOB_PHOTOS) return { ok: false, error: `A visit can have up to ${MAX_JOB_PHOTOS} photos.` };
    await db.transaction([
      {
        text: `INSERT INTO job_photos (job_id, hash, width, height, position)
               VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(position), 0) + 1 FROM job_photos WHERE job_id = $1))`,
        params: [args.jobId, args.hash, args.width, args.height],
      },
      audit(args.by, 'job_photo_added', { job: String(args.jobId) }),
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[job-photos] addJobPhoto failed:', err);
    return { ok: false, error: 'Could not save that photo. Try again.' };
  }
}

/** Removes one photo row. `orphans` are the hashes now unused anywhere (the caller deletes them from R2). */
export async function deleteJobPhoto(
  photoId: unknown,
  by: string,
  db: Db = getDb(),
): Promise<{ ok: true; orphans: string[] } | { ok: false; error: string }> {
  if (!/^\d+$/.test(String(photoId))) return { ok: false, error: 'Unknown photo.' };
  try {
    const rows = await db.query<{ hash: string }>('DELETE FROM job_photos WHERE id = $1 RETURNING hash', [photoId]);
    if (rows.length === 0) return { ok: false, error: 'That photo no longer exists.' };
    const a = audit(by, 'job_photo_deleted', { id: String(photoId) });
    await db.query(a.text, a.params);
    return { ok: true, orphans: await unreferenced([rows[0].hash], db) };
  } catch (err) {
    console.error('[job-photos] deleteJobPhoto failed:', err);
    return { ok: false, error: 'Could not remove that photo. Try again.' };
  }
}

/** Hashes of every photo on a customer's visits (collect BEFORE deleting the customer or a visit). */
export async function hashesForCustomer(customerId: unknown, db: Db = getDb()): Promise<string[]> {
  if (!/^\d+$/.test(String(customerId))) return [];
  const rows = await db.query<{ hash: string }>(
    'SELECT p.hash FROM job_photos p JOIN jobs j ON j.id = p.job_id WHERE j.customer_id = $1',
    [customerId],
  );
  return rows.map((r) => r.hash);
}

export async function hashesForJob(jobId: unknown, db: Db = getDb()): Promise<string[]> {
  if (!/^\d+$/.test(String(jobId))) return [];
  return (await db.query<{ hash: string }>('SELECT hash FROM job_photos WHERE job_id = $1', [jobId])).map((r) => r.hash);
}

export async function photosByJob(jobIds: string[], db: Db = getDb()): Promise<Map<string, JobPhoto[]>> {
  const out = new Map<string, JobPhoto[]>();
  const ids = jobIds.filter((i) => /^\d+$/.test(i));
  if (ids.length === 0) return out;
  const rows = await db.query<{ id: string; job_id: string; hash: string; width: number | null; height: number | null }>(
    `SELECT id::text AS id, job_id::text AS job_id, hash, width, height FROM job_photos
      WHERE job_id = ANY($1::bigint[]) ORDER BY position, id`,
    [ids],
  );
  for (const r of rows) {
    const list = out.get(String(r.job_id)) ?? [];
    list.push({ id: String(r.id), hash: r.hash, width: r.width, height: r.height });
    out.set(String(r.job_id), list);
  }
  return out;
}
