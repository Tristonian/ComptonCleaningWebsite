import 'server-only';
import type { Db } from '@/lib/db';
import { RATE_LIMIT, formatPhone, type EnquiryInput } from '@/lib/enquiry';

export type StoreResult = { ok: true; id: string } | { ok: false; reason: 'rate' };

/**
 * Rate-check and insert one enquiry. `ipHash` is a salted hash, never a raw IP. Limits: per
 * sender per hour and site-wide per day (see RATE_LIMIT). Counted in SQL so it holds across Worker
 * instances. Throws on a database error: the caller decides what the visitor sees.
 */
export async function storeEnquiry(
  db: Db,
  input: EnquiryInput,
  meta: { ipHash: string; locale: string },
): Promise<StoreResult> {
  const [counts] = await db.query<{ sender: string | number; site: string | number }>(
    `SELECT
       COUNT(*) FILTER (WHERE ip_hash = $1 AND created_at > now() - interval '1 hour') AS sender,
       COUNT(*) AS site
     FROM enquiries WHERE created_at > now() - interval '1 day'`,
    [meta.ipHash],
  );
  if (Number(counts?.sender ?? 0) >= RATE_LIMIT.perSenderPerHour || Number(counts?.site ?? 0) >= RATE_LIMIT.perSiteDay) {
    console.warn('[contact] rate limited', { sender: counts?.sender, site: counts?.site });
    return { ok: false, reason: 'rate' };
  }

  const [row] = await db.query<{ id: string }>(
    `INSERT INTO enquiries (name, address, postcode, contact, phone, email, service, source, notes, locale, ip_hash, lat, lng)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [
      input.name,
      input.address,
      input.postcode,
      [input.phone ? formatPhone(input.phone) : '', input.email].filter(Boolean).join(' / '),
      input.phone,
      input.email,
      input.service,
      input.source,
      input.notes,
      meta.locale,
      meta.ipHash,
      input.point?.lat ?? null,
      input.point?.lng ?? null,
    ],
  );
  return { ok: true, id: String(row.id) };
}

export async function markEmailed(db: Db, id: string): Promise<void> {
  await db.query('UPDATE enquiries SET emailed_at = now() WHERE id = $1', [id]);
}
