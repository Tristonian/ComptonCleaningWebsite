import 'server-only';
import { getDb, type Db } from '@/lib/db';
import { poundsToPence, todayLondon, type Result } from '@/lib/customers';
import { hashesForJob, photosByJob, unreferenced, type JobPhoto } from '@/lib/job-photos';

/**
 * Visits (ADR 0008): one `jobs` row per clean, marked Done or Missed, with extras and how it was paid.
 * Money is integer pence. The date can be today or earlier, never in the future. A done job that is
 * not paid is a debt; marking it paid later clears it.
 */

export const MAX_EXTRAS = 10;
export const MAX_JOB_NOTES = 1000;

export type JobInput = {
  /** 'done' | 'missed' */
  status: unknown;
  /** YYYY-MM-DD */
  doneOn: unknown;
  /** Pounds as typed. */
  price?: unknown;
  paymentMethod?: unknown;
  /** Only meaningful with a payment method; false = "no payment was made". */
  paid?: unknown;
  notes?: unknown;
  extras?: { label: unknown; price: unknown }[];
};

export type JobRow = {
  id: string;
  status: 'done' | 'missed';
  doneOn: string;
  pricePence: number;
  paymentMethod: string;
  paid: boolean;
  notes: string;
  extras: { id: string; label: string; pricePence: number }[];
  photos: JobPhoto[];
  totalPence: number;
};

type Clean = {
  status: 'done' | 'missed';
  doneOn: string;
  pricePence: number;
  paymentMethod: string;
  paid: boolean;
  notes: string;
  extras: { label: string; price: number }[];
};

const isoDate = (v: unknown) => {
  const s = String(v ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === s ? s : null;
};

export function cleanJob(input: JobInput, methods: Set<string>, today: string): { ok: true; value: Clean } | { ok: false; error: string } {
  const status = input.status === 'missed' ? 'missed' : input.status === 'done' ? 'done' : null;
  if (!status) return { ok: false, error: 'Mark the visit Done or Missed.' };
  const doneOn = isoDate(input.doneOn);
  if (!doneOn) return { ok: false, error: 'That date does not look right.' };
  if (doneOn > today) return { ok: false, error: 'A visit cannot be dated in the future.' };
  const notes = String(input.notes ?? '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_JOB_NOTES);
  if (status === 'missed') {
    return { ok: true, value: { status, doneOn, pricePence: 0, paymentMethod: '', paid: false, notes, extras: [] } };
  }
  const price = poundsToPence(input.price);
  if (price === undefined || (price !== null && price > 1_000_000)) return { ok: false, error: 'That price does not look right. Use pounds, like 15 or 15.50.' };
  const method = String(input.paymentMethod ?? '').trim();
  if (method && !methods.has(method)) return { ok: false, error: 'Unknown way of paying.' };
  const extras: { label: string; price: number }[] = [];
  for (const e of (input.extras ?? []).slice(0, MAX_EXTRAS)) {
    const label = String(e.label ?? '').trim().slice(0, 80);
    const raw = String(e.price ?? '').trim();
    if (!label && !raw) continue; // an empty row
    const p = poundsToPence(raw);
    if (!label || p === undefined || p === null || p > 1_000_000) return { ok: false, error: 'Each extra needs a name and a price.' };
    extras.push({ label, price: p });
  }
  // Paid needs a way of paying: "paid" with no method would be a payment nobody can trace.
  const paid = Boolean(method) && (input.paid === true || input.paid === 'on' || input.paid === 'true');
  return { ok: true, value: { status, doneOn, pricePence: price ?? 0, paymentMethod: method, paid, notes, extras } };
}

async function methodKeys(db: Db): Promise<Set<string>> {
  return new Set((await db.query<{ key: string }>('SELECT key FROM payment_methods')).map((r) => r.key));
}

const audit = (by: string, action: string, detail: object) => ({
  text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
  params: [by, action, JSON.stringify(detail)],
});

const EXTRAS_SQL = `INSERT INTO job_extras (job_id, label, price_pence)
                    SELECT j.id, x.label, x.price FROM j, json_to_recordset($9::json) AS x(label text, price int)`;

export async function recordJob(
  customerId: unknown,
  input: JobInput,
  by: string,
  db: Db = getDb(),
  today: string = todayLondon(),
): Promise<Result & { id?: string }> {
  if (!/^\d+$/.test(String(customerId))) return { ok: false, error: 'Unknown customer.' };
  const c = cleanJob(input, await methodKeys(db), today);
  if (!c.ok) return c;
  const v = c.value;
  try {
    const rows = await db.query<{ id: string }>(
      `WITH j AS (
         INSERT INTO jobs (customer_id, status, done_on, price_pence, payment_method, paid, paid_on, notes, created_by)
         SELECT id, $2, $3::date, $4, $5, $6::boolean, CASE WHEN $6::boolean THEN $3::date END, $7, $8 FROM customers WHERE id = $1
         RETURNING id
       ), e AS (${EXTRAS_SQL})
       SELECT id::text AS id FROM j`,
      [customerId, v.status, v.doneOn, v.pricePence, v.paymentMethod, v.paid, v.notes, by, JSON.stringify(v.extras)],
    );
    if (rows.length === 0) return { ok: false, error: 'That customer no longer exists.' };
    const a = audit(by, `job_${v.status}`, { id: rows[0].id, customer: String(customerId) });
    await db.query(a.text, a.params);
    return { ok: true, id: rows[0].id };
  } catch (err) {
    console.error('[jobs] recordJob failed:', err);
    return { ok: false, error: 'Could not save that visit. Try again.' };
  }
}

/** Edit a visit: date (not future), price, payment, extras, notes. Extras are replaced as a set. */
export async function updateJob(jobId: unknown, input: JobInput, by: string, db: Db = getDb(), today: string = todayLondon()): Promise<Result> {
  if (!/^\d+$/.test(String(jobId))) return { ok: false, error: 'Unknown visit.' };
  const c = cleanJob(input, await methodKeys(db), today);
  if (!c.ok) return c;
  const v = c.value;
  try {
    const rows = await db.query<{ id: string }>(
      `WITH j AS (
         UPDATE jobs SET status = $2, done_on = $3::date, price_pence = $4, payment_method = $5, paid = $6::boolean, notes = $7,
                paid_on = CASE WHEN $6::boolean THEN coalesce(paid_on, $3::date) END
          WHERE id = $1 RETURNING id
       ), d AS (DELETE FROM job_extras WHERE job_id IN (SELECT id FROM j)),
       e AS (INSERT INTO job_extras (job_id, label, price_pence)
             SELECT j.id, x.label, x.price FROM j, json_to_recordset($8::json) AS x(label text, price int))
       SELECT id::text AS id FROM j`,
      [jobId, v.status, v.doneOn, v.pricePence, v.paymentMethod, v.paid, v.notes, JSON.stringify(v.extras)],
    );
    if (rows.length === 0) return { ok: false, error: 'That visit no longer exists.' };
    const a = audit(by, 'job_edited', { id: String(jobId) });
    await db.query(a.text, a.params);
    return { ok: true };
  } catch (err) {
    console.error('[jobs] updateJob failed:', err);
    return { ok: false, error: 'Could not save that. Try again.' };
  }
}

/** Record that a debt was paid (or that a visit was paid after the event), and how. */
export async function markPaid(jobId: unknown, method: unknown, by: string, db: Db = getDb(), today: string = todayLondon()): Promise<Result> {
  if (!/^\d+$/.test(String(jobId))) return { ok: false, error: 'Unknown visit.' };
  const key = String(method ?? '').trim();
  if (!key || !(await methodKeys(db)).has(key)) return { ok: false, error: 'Choose how they paid.' };
  try {
    const rows = await db.query(`UPDATE jobs SET paid = true, paid_on = coalesce(paid_on, $3::date), payment_method = $2 WHERE id = $1 AND status = 'done' RETURNING id`, [jobId, key, today]);
    if (rows.length === 0) return { ok: false, error: 'That visit no longer exists.' };
    const a = audit(by, 'job_paid', { id: String(jobId) });
    await db.query(a.text, a.params);
    return { ok: true };
  } catch (err) {
    console.error('[jobs] markPaid failed:', err);
    return { ok: false, error: 'Could not save that. Try again.' };
  }
}

export async function deleteJob(
  jobId: unknown,
  by: string,
  db: Db = getDb(),
): Promise<{ ok: true; orphans: string[] } | { ok: false; error: string }> {
  if (!/^\d+$/.test(String(jobId))) return { ok: false, error: 'Unknown visit.' };
  try {
    const hashes = await hashesForJob(jobId, db);
    const rows = await db.query('DELETE FROM jobs WHERE id = $1 RETURNING id', [jobId]);
    if (rows.length === 0) return { ok: false, error: 'That visit no longer exists.' };
    const a = audit(by, 'job_deleted', { id: String(jobId) });
    await db.query(a.text, a.params);
    return { ok: true, orphans: await unreferenced(hashes, db) };
  } catch (err) {
    console.error('[jobs] deleteJob failed:', err);
    return { ok: false, error: 'Could not delete that. Try again.' };
  }
}

type RawJob = {
  id: string;
  status: 'done' | 'missed';
  done_on: string;
  price_pence: number;
  payment_method: string;
  paid: boolean;
  notes: string;
  extras: { id: string; label: string; price_pence: number }[] | null;
};

/** Newest first. */
export async function listJobs(customerId: unknown, db: Db = getDb(), limit = 100): Promise<JobRow[]> {
  if (!/^\d+$/.test(String(customerId))) return [];
  const rows = await db.query<RawJob>(
    `SELECT j.id::text AS id, j.status, to_char(j.done_on, 'YYYY-MM-DD') AS done_on, j.price_pence, j.payment_method, j.paid, j.notes,
            (SELECT coalesce(json_agg(json_build_object('id', e.id::text, 'label', e.label, 'price_pence', e.price_pence) ORDER BY e.id), '[]'::json)
               FROM job_extras e WHERE e.job_id = j.id) AS extras
       FROM jobs j WHERE j.customer_id = $1 ORDER BY j.done_on DESC, j.id DESC LIMIT $2`,
    [customerId, limit],
  );
  const photos = await photosByJob(rows.map((r) => String(r.id)), db);
  return rows.map((r) => {
    const extras = (r.extras ?? []).map((e) => ({ id: String(e.id), label: e.label, pricePence: Number(e.price_pence) }));
    return {
      id: String(r.id),
      status: r.status,
      doneOn: r.done_on,
      pricePence: Number(r.price_pence),
      paymentMethod: r.payment_method,
      paid: r.paid,
      notes: r.notes,
      extras,
      photos: photos.get(String(r.id)) ?? [],
      totalPence: Number(r.price_pence) + extras.reduce((s, e) => s + e.pricePence, 0),
    };
  });
}

export type MoneyRow = {
  jobId: string;
  customerId: string;
  customerName: string;
  doneOn: string;
  paymentMethod: string;
  totalPence: number;
};

const MONEY_SELECT = `
  SELECT j.id::text AS job_id, c.id::text AS customer_id, c.name AS customer_name, to_char(j.done_on, 'YYYY-MM-DD') AS done_on,
         j.payment_method, (j.price_pence + coalesce((SELECT sum(e.price_pence) FROM job_extras e WHERE e.job_id = j.id), 0))::int AS total
    FROM jobs j JOIN customers c ON c.id = j.customer_id`;

type RawMoney = { job_id: string; customer_id: string; customer_name: string; done_on: string; payment_method: string; total: number };
const toMoney = (r: RawMoney): MoneyRow => ({
  jobId: String(r.job_id),
  customerId: String(r.customer_id),
  customerName: r.customer_name,
  doneOn: r.done_on,
  paymentMethod: r.payment_method,
  totalPence: Number(r.total),
});

/** Done visits nobody has paid for yet, oldest first. */
export async function listDebts(db: Db = getDb()): Promise<MoneyRow[]> {
  return (await db.query<RawMoney>(`${MONEY_SELECT} WHERE j.status = 'done' AND NOT j.paid ORDER BY j.done_on, j.id`)).map(toMoney);
}

/** Money received, newest first. */
export async function listPayments(db: Db = getDb(), limit = 60): Promise<MoneyRow[]> {
  return (await db.query<RawMoney>(`${MONEY_SELECT} WHERE j.status = 'done' AND j.paid ORDER BY j.done_on DESC, j.id DESC LIMIT $1`, [limit])).map(toMoney);
}

/** The Sunday that ends the week containing `today` (weeks run Monday to Sunday). */
export function endOfWeek(today: string): string {
  const d = new Date(`${today}T12:00:00Z`);
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (7 - isoDay));
  return d.toISOString().slice(0, 10);
}
