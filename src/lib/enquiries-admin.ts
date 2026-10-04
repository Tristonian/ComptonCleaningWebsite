import 'server-only';
import type { Db } from '@/lib/db';

/**
 * The admin side of enquiries (ADR 0005): list, read, status, Sam's notes, replies, and "add as
 * customer". Every function takes the database as a parameter (tests inject PGlite). Authorisation is
 * NOT here: callers (pages and server actions) must check `getAdmin()` first.
 */

export const STATUSES = ['new', 'contacted', 'quoted', 'booked', 'lost'] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  booked: 'Booked',
  lost: 'Lost',
};

export function isStatus(v: unknown): v is Status {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

/** Row ids are bigints: the driver gives them back as strings. Only digits are ever accepted. */
export function isId(v: unknown): v is string {
  return typeof v === 'string' && /^\d{1,15}$/.test(v);
}

type Ts = Date | string;

export interface EnquirySummary {
  id: string;
  created_at: Ts;
  name: string;
  service: string;
  source: string;
  postcode: string;
  phone: string;
  email: string;
  status: Status;
  read_at: Ts | null;
  customer_id: string | null;
}

export interface EnquiryDetail extends EnquirySummary {
  address: string;
  notes: string;
  admin_notes: string;
  lat: number | null;
  lng: number | null;
  locale: string;
}

export interface Reply {
  id: string;
  sent_at: Ts;
  sent_by: string;
  to_email: string;
  subject: string;
  body: string;
}

export const MAX_ADMIN_NOTES = 2000;
export const MAX_REPLY_BODY = 5000;

export async function listEnquiries(db: Db, status?: Status, limit = 100): Promise<EnquirySummary[]> {
  return db.query<EnquirySummary>(
    `SELECT id, created_at, name, service, source, postcode, phone, email, status, read_at, customer_id
       FROM enquiries
      WHERE ($1::text IS NULL OR status = $1)
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [status ?? null, limit],
  );
}

/** Counts per status plus how many have never been opened. */
export async function enquiryCounts(db: Db): Promise<{ byStatus: Record<Status, number>; unread: number; total: number }> {
  const rows = await db.query<{ status: Status; n: string; unread: string }>(
    `SELECT status, count(*) AS n, count(*) FILTER (WHERE read_at IS NULL) AS unread FROM enquiries GROUP BY status`,
  );
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  let unread = 0;
  let total = 0;
  for (const r of rows) {
    byStatus[r.status] = Number(r.n);
    unread += Number(r.unread);
    total += Number(r.n);
  }
  return { byStatus, unread, total };
}

export async function getEnquiry(db: Db, id: string): Promise<{ enquiry: EnquiryDetail; replies: Reply[] } | null> {
  if (!isId(id)) return null;
  const [enquiry] = await db.query<EnquiryDetail>(
    `SELECT id, created_at, name, service, source, postcode, phone, email, status, read_at, customer_id,
            address, notes, admin_notes, lat, lng, locale
       FROM enquiries WHERE id = $1`,
    [id],
  );
  if (!enquiry) return null;
  const replies = await db.query<Reply>(
    `SELECT id, sent_at, sent_by, to_email, subject, body FROM enquiry_replies WHERE enquiry_id = $1 ORDER BY sent_at, id`,
    [id],
  );
  return { enquiry, replies };
}

export async function markRead(db: Db, id: string): Promise<void> {
  if (!isId(id)) return;
  await db.query('UPDATE enquiries SET read_at = now() WHERE id = $1 AND read_at IS NULL', [id]);
}

export type AdminResult = { ok: true } | { ok: false; error: string };

export async function setStatus(db: Db, id: string, status: unknown, by: string): Promise<AdminResult> {
  if (!isId(id)) return { ok: false, error: 'Unknown enquiry.' };
  if (!isStatus(status)) return { ok: false, error: 'Unknown status.' };
  try {
    await db.transaction([
      {
        text: 'UPDATE enquiries SET status = $2, updated_at = now(), read_at = coalesce(read_at, now()) WHERE id = $1',
        params: [id, status],
      },
      {
        text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
        params: [by, 'enquiry_status', JSON.stringify({ id, status })],
      },
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[enquiries] setStatus failed:', err);
    return { ok: false, error: 'Could not change the status. Try again.' };
  }
}

export async function saveAdminNotes(db: Db, id: string, notes: unknown, by: string): Promise<AdminResult> {
  if (!isId(id)) return { ok: false, error: 'Unknown enquiry.' };
  if (typeof notes !== 'string') return { ok: false, error: 'That is not text.' };
  const clean = notes.replace(/\r\n?/g, '\n').trim();
  if (clean.length > MAX_ADMIN_NOTES) return { ok: false, error: `Notes can be up to ${MAX_ADMIN_NOTES} characters.` };
  try {
    await db.transaction([
      { text: 'UPDATE enquiries SET admin_notes = $2, updated_at = now() WHERE id = $1', params: [id, clean] },
      { text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)', params: [by, 'enquiry_notes', JSON.stringify({ id })] },
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[enquiries] saveAdminNotes failed:', err);
    return { ok: false, error: 'Could not save the notes. Try again.' };
  }
}

/**
 * Turn an enquiry into a customer, once. Doing it again returns the same customer instead of making a
 * duplicate. One SQL statement (a data-modifying CTE), so the customer and the link cannot disagree.
 */
export async function addAsCustomer(db: Db, id: string, by: string): Promise<AdminResult & { customerId?: string }> {
  if (!isId(id)) return { ok: false, error: 'Unknown enquiry.' };
  try {
    await db.query(
      `WITH c AS (
         INSERT INTO customers (name, phone, email, address, postcode, lat, lng, source, created_from_enquiry)
         SELECT name, phone, email, address, postcode, lat, lng, source, id
           FROM enquiries WHERE id = $1 AND customer_id IS NULL
         RETURNING id
       )
       UPDATE enquiries SET customer_id = (SELECT id FROM c), updated_at = now(), read_at = coalesce(read_at, now())
        WHERE id = $1 AND customer_id IS NULL AND EXISTS (SELECT 1 FROM c)`,
      [id],
    );
    const [row] = await db.query<{ customer_id: string | null }>('SELECT customer_id FROM enquiries WHERE id = $1', [id]);
    if (!row) return { ok: false, error: 'Unknown enquiry.' };
    if (!row.customer_id) return { ok: false, error: 'Could not add the customer. Try again.' };
    await db.query('INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)', [
      by,
      'customer_added',
      JSON.stringify({ enquiry: id, customer: row.customer_id }),
    ]);
    return { ok: true, customerId: String(row.customer_id) };
  } catch (err) {
    console.error('[enquiries] addAsCustomer failed:', err);
    return { ok: false, error: 'Could not add the customer. Try again.' };
  }
}

/** Log a reply that has already been handed to the mail service, and move a New enquiry to Contacted. */
export async function recordReply(
  db: Db,
  id: string,
  reply: { by: string; to: string; subject: string; body: string },
): Promise<AdminResult> {
  if (!isId(id)) return { ok: false, error: 'Unknown enquiry.' };
  try {
    await db.transaction([
      {
        text: 'INSERT INTO enquiry_replies (enquiry_id, sent_by, to_email, subject, body) VALUES ($1, $2, $3, $4, $5)',
        params: [id, reply.by, reply.to, reply.subject, reply.body],
      },
      {
        text: `UPDATE enquiries SET status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END,
                                   updated_at = now(), read_at = coalesce(read_at, now()) WHERE id = $1`,
        params: [id],
      },
      { text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)', params: [reply.by, 'enquiry_reply', JSON.stringify({ id })] },
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[enquiries] recordReply failed:', err);
    return { ok: false, error: 'The email was sent but could not be logged.' };
  }
}
