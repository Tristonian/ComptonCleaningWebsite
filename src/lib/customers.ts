import 'server-only';
import { getDb, type Db } from '@/lib/db';
import { normalisePhone } from '@/lib/phone';
import type { ImportRow } from '@/lib/customers-csv';

/**
 * Sam's customers as a working list (ADR 0008): price, frequency, rounds, and what is due or owing.
 * The database is passed in so tests run on PGlite. Every change writes an audit row, but never a
 * name, phone or address: someone who asks to be deleted must really be gone, including from the log.
 */

export type Result = { ok: true } | { ok: false; error: string };
/** A create that succeeded always has an id; a failure may still carry one (the customer was added but a later step failed). */
export type Created = { ok: true; id: string } | { ok: false; error: string; id?: string };

export const MAX_PRICE_PENCE = 100_000;

/** Today's date in Sam's time zone, as YYYY-MM-DD. Times are stored UTC, shown Europe/London. */
export function todayLondon(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now);
}

export type CustomerRow = {
  id: string;
  name: string;
  address: string;
  postcode: string;
  phone: string;
  email: string;
  notes: string;
  lat: number | null;
  lng: number | null;
  pricePence: number | null;
  frequencyWeeks: number | null;
  preferredPayment: string;
  lastDone: string | null;
  nextDue: string | null;
  owingPence: number;
  rounds: { id: string; name: string }[];
};

export type Filter = 'all' | 'due' | 'owing';

type Raw = {
  id: string;
  name: string;
  address: string;
  postcode: string;
  phone: string;
  email: string;
  notes: string;
  lat: number | null;
  lng: number | null;
  price_pence: number | null;
  frequency_weeks: number | null;
  preferred_payment: string;
  last_done: string | null;
  next_due: string | null;
  owing_pence: number;
  rounds: { id: string; name: string }[] | null;
};

/** Dates are cast to text in SQL: Neon's driver and PGlite disagree on how they hand a `date` back. */
const SELECT = `
  SELECT c.id::text AS id, c.name, c.address, c.postcode, c.phone, c.email, c.notes, c.lat, c.lng,
         c.price_pence, c.frequency_weeks, c.preferred_payment,
         to_char(l.last_done, 'YYYY-MM-DD') AS last_done,
         to_char(CASE WHEN c.frequency_weeks IS NULL THEN NULL
                      ELSE coalesce(l.last_done, c.created_at::date) + c.frequency_weeks * 7 END, 'YYYY-MM-DD') AS next_due,
         coalesce(o.owing, 0)::int AS owing_pence,
         (SELECT coalesce(json_agg(json_build_object('id', r.id::text, 'name', r.name) ORDER BY r.position, r.name), '[]'::json)
            FROM customer_rounds cr JOIN rounds r ON r.id = cr.round_id WHERE cr.customer_id = c.id) AS rounds
    FROM customers c
    LEFT JOIN LATERAL (
      SELECT greatest(c.baseline_done_on, max(j.done_on)) AS last_done
        FROM jobs j WHERE j.customer_id = c.id AND j.status = 'done'
    ) l ON true
    LEFT JOIN LATERAL (
      SELECT sum(j.price_pence + coalesce((SELECT sum(e.price_pence) FROM job_extras e WHERE e.job_id = j.id), 0)) AS owing
        FROM jobs j WHERE j.customer_id = c.id AND j.status = 'done' AND NOT j.paid
    ) o ON true`;

const toRow = (r: Raw): CustomerRow => ({
  id: String(r.id),
  name: r.name,
  address: r.address,
  postcode: r.postcode,
  phone: r.phone,
  email: r.email,
  notes: r.notes,
  lat: r.lat,
  lng: r.lng,
  pricePence: r.price_pence,
  frequencyWeeks: r.frequency_weeks,
  preferredPayment: r.preferred_payment,
  lastDone: r.last_done,
  nextDue: r.next_due,
  owingPence: Number(r.owing_pence),
  rounds: r.rounds ?? [],
});

export async function listCustomers(
  args: { filter?: Filter; q?: string; today?: string; roundId?: string },
  db: Db = getDb(),
): Promise<CustomerRow[]> {
  const today = args.today ?? todayLondon();
  const where: string[] = [];
  const params: unknown[] = [];
  if (args.q?.trim()) {
    params.push(`%${args.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    where.push(`(c.name ILIKE $${params.length} OR c.address ILIKE $${params.length} OR c.postcode ILIKE $${params.length} OR c.phone ILIKE $${params.length})`);
  }
  if (args.roundId && /^\d+$/.test(args.roundId)) {
    params.push(args.roundId);
    where.push(`EXISTS (SELECT 1 FROM customer_rounds x WHERE x.customer_id = c.id AND x.round_id = $${params.length})`);
  }
  const rows = await db.query<Raw>(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY c.name`, params);
  const all = rows.map(toRow);
  if (args.filter === 'due') return all.filter((c) => c.nextDue !== null && c.nextDue <= today).sort((a, b) => (a.nextDue! < b.nextDue! ? -1 : 1));
  if (args.filter === 'owing') return all.filter((c) => c.owingPence > 0).sort((a, b) => b.owingPence - a.owingPence);
  return all;
}

export async function getCustomer(id: unknown, db: Db = getDb()): Promise<CustomerRow | null> {
  if (!/^\d+$/.test(String(id))) return null;
  const rows = await db.query<Raw>(`${SELECT} WHERE c.id = $1`, [id]);
  return rows[0] ? toRow(rows[0]) : null;
}

const audit = (by: string, action: string, detail: object) => ({
  text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
  params: [by, action, JSON.stringify(detail)],
});

export type CustomerInput = {
  name: unknown;
  address?: unknown;
  postcode?: unknown;
  phone?: unknown;
  email?: unknown;
  notes?: unknown;
  lat?: unknown;
  lng?: unknown;
  /** Pounds as typed ("12.50"), not pence. */
  price?: unknown;
  frequencyWeeks?: unknown;
  preferredPayment?: unknown;
  roundIds?: unknown;
};

type Clean = {
  name: string;
  address: string;
  postcode: string;
  phone: string;
  email: string;
  notes: string;
  lat: number | null;
  lng: number | null;
  pricePence: number | null;
  frequencyWeeks: number | null;
  preferredPayment: string;
  roundIds: string[];
};

/** "12", "12.5", "£12.50" -> pence; '' -> null; garbage -> undefined. Never floating-point money. */
export function poundsToPence(raw: unknown): number | null | undefined {
  const s = String(raw ?? '').replace(/[£\s]/g, '');
  if (s === '') return null;
  const m = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return undefined;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
}

const str = (v: unknown, max: number) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);

export function cleanCustomer(input: CustomerInput): { ok: true; value: Clean } | { ok: false; error: string } {
  const name = str(input.name, 120);
  if (!name) return { ok: false, error: 'A customer needs a name.' };
  const pricePence = poundsToPence(input.price);
  if (pricePence === undefined || (pricePence !== null && pricePence > MAX_PRICE_PENCE)) {
    return { ok: false, error: 'That price does not look right. Use pounds, like 12 or 12.50.' };
  }
  const freqRaw = String(input.frequencyWeeks ?? '').trim();
  const frequencyWeeks = freqRaw === '' ? null : Number(freqRaw);
  if (frequencyWeeks !== null && (!Number.isInteger(frequencyWeeks) || frequencyWeeks < 1 || frequencyWeeks > 52)) {
    return { ok: false, error: 'Frequency is a whole number of weeks, 1 to 52.' };
  }
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  const lat = num(input.lat);
  const lng = num(input.lng);
  if ((lat !== null && Math.abs(lat) > 90) || (lng !== null && Math.abs(lng) > 180)) {
    return { ok: false, error: 'That location is not valid.' };
  }
  const roundIds = Array.isArray(input.roundIds) ? [...new Set(input.roundIds.map(String))].filter((x) => /^\d+$/.test(x)) : [];
  return {
    ok: true,
    value: {
      name,
      address: str(input.address, 300),
      postcode: str(input.postcode, 12).toUpperCase(),
      phone: normalisePhone(str(input.phone, 40)),
      email: str(input.email, 200).toLowerCase(),
      notes: str(input.notes, 2000),
      lat,
      lng,
      pricePence,
      frequencyWeeks,
      preferredPayment: str(input.preferredPayment, 40),
      roundIds,
    },
  };
}

/** Replace a customer's rounds. A new round goes to the end of that round's order. */
export async function setCustomerRounds(customerId: string, roundIds: string[], by: string, db: Db = getDb()): Promise<Result> {
  if (!/^\d+$/.test(customerId)) return { ok: false, error: 'Unknown customer.' };
  try {
    await db.transaction([
      {
        text: 'DELETE FROM customer_rounds WHERE customer_id = $1 AND NOT (round_id = ANY($2::bigint[]))',
        params: [customerId, roundIds],
      },
      {
        text: `INSERT INTO customer_rounds (customer_id, round_id, position)
               SELECT $1, r.id, coalesce((SELECT max(position) + 1 FROM customer_rounds WHERE round_id = r.id), 0)
                 FROM rounds r WHERE r.id = ANY($2::bigint[])
               ON CONFLICT DO NOTHING`,
        params: [customerId, roundIds],
      },
      audit(by, 'customer_rounds', { id: customerId, rounds: roundIds }),
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[customers] setCustomerRounds failed:', err);
    return { ok: false, error: 'Could not save the rounds. Try again.' };
  }
}

export async function createCustomer(
  input: CustomerInput & { source?: unknown },
  by: string,
  db: Db = getDb(),
): Promise<Created> {
  const c = cleanCustomer(input);
  if (!c.ok) return c;
  const v = c.value;
  if (!v.address && v.lat === null) return { ok: false, error: 'Add an address, or use the location button.' };
  try {
    const [row] = await db.query<{ id: string }>(
      `INSERT INTO customers (name, phone, email, address, postcode, lat, lng, notes, source, price_pence, frequency_weeks, preferred_payment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id::text AS id`,
      [v.name, v.phone, v.email, v.address, v.postcode, v.lat, v.lng, v.notes, str(input.source, 60), v.pricePence, v.frequencyWeeks, v.preferredPayment],
    );
    const a = audit(by, 'customer_created', { id: row.id });
    await db.query(a.text, a.params);
    if (v.roundIds.length) {
      const r = await setCustomerRounds(row.id, v.roundIds, by, db);
      if (!r.ok) return { ok: false, error: `${r.error} The customer was added.`, id: row.id };
    }
    return { ok: true, id: row.id };
  } catch (err) {
    console.error('[customers] createCustomer failed:', err);
    return { ok: false, error: 'Could not add that customer. Try again.' };
  }
}

export async function updateCustomer(id: unknown, input: CustomerInput, by: string, db: Db = getDb()): Promise<Result> {
  if (!/^\d+$/.test(String(id))) return { ok: false, error: 'Unknown customer.' };
  const c = cleanCustomer(input);
  if (!c.ok) return c;
  const v = c.value;
  try {
    const found = await db.query(
      `UPDATE customers SET name = $2, phone = $3, email = $4, address = $5, postcode = $6, notes = $7,
              price_pence = $8, frequency_weeks = $9, preferred_payment = $10,
              lat = coalesce($11, lat), lng = coalesce($12, lng) WHERE id = $1 RETURNING id`,
      // A location is only replaced when a new one was grabbed; saving the form never wipes the pin.
      [id, v.name, v.phone, v.email, v.address, v.postcode, v.notes, v.pricePence, v.frequencyWeeks, v.preferredPayment, v.lat, v.lng],
    );
    if (found.length === 0) return { ok: false, error: 'That customer no longer exists.' };
    const a = audit(by, 'customer_edited', { id: String(id) });
    await db.query(a.text, a.params);
    if (Array.isArray(input.roundIds)) return setCustomerRounds(String(id), v.roundIds, by, db);
    return { ok: true };
  } catch (err) {
    console.error('[customers] updateCustomer failed:', err);
    return { ok: false, error: 'Could not save that. Try again.' };
  }
}

/**
 * Delete a customer for good (they asked). Their jobs, extras, photo rows and round places go with
 * them, and enquiries that pointed at them simply lose the link. The audit row records only the id.
 */
export async function deleteCustomer(id: unknown, by: string, db: Db = getDb()): Promise<Result> {
  if (!/^\d+$/.test(String(id))) return { ok: false, error: 'Unknown customer.' };
  try {
    const a = audit(by, 'customer_deleted', { id: String(id) });
    const found = await db.query('SELECT id FROM customers WHERE id = $1', [id]);
    if (found.length === 0) return { ok: false, error: 'That customer no longer exists.' };
    await db.transaction([{ text: 'DELETE FROM customers WHERE id = $1', params: [id] }, a]);
    return { ok: true };
  } catch (err) {
    console.error('[customers] deleteCustomer failed:', err);
    return { ok: false, error: 'Could not delete that. Try again.' };
  }
}

/** Customers in an import that are not already here (matched on the Squeegee reference). */
export async function existingRefs(refs: string[], db: Db = getDb()): Promise<Set<string>> {
  if (refs.length === 0) return new Set();
  const rows = await db.query<{ squeegee_ref: string }>('SELECT squeegee_ref FROM customers WHERE squeegee_ref = ANY($1::text[])', [refs]);
  return new Set(rows.map((r) => r.squeegee_ref));
}

/**
 * Import Squeegee customers. Safe to run again: a reference already imported is left exactly as it is,
 * so nothing Sam has edited since is overwritten.
 */
export async function importCustomers(
  rows: ImportRow[],
  by: string,
  db: Db = getDb(),
): Promise<Result & { added: number; skipped: number }> {
  if (rows.length === 0) return { ok: true, added: 0, skipped: 0 };
  if (rows.length > 2000) return { ok: false, error: 'That is more than 2000 customers. Split the file.', added: 0, skipped: 0 };
  try {
    const have = await existingRefs(rows.map((r) => r.ref), db);
    const fresh = rows.filter((r) => !have.has(r.ref));
    if (fresh.length) {
      await db.transaction([
        ...fresh.map((r) => ({
          text: `INSERT INTO customers (squeegee_ref, name, address, phone, source, created_at)
                 VALUES ($1, $2, $3, $4, $5, coalesce($6::date, now()))
                 ON CONFLICT (squeegee_ref) DO NOTHING`,
          params: [r.ref, r.name, r.address, r.phone, r.source, r.added || null],
        })),
        audit(by, 'customers_imported', { added: fresh.length, skipped: rows.length - fresh.length }),
      ]);
    }
    return { ok: true, added: fresh.length, skipped: rows.length - fresh.length };
  } catch (err) {
    console.error('[customers] importCustomers failed:', err);
    return { ok: false, error: 'Could not import that file. Nothing was changed.', added: 0, skipped: 0 };
  }
}

// ---- rounds ----

export type RoundRow = { id: string; name: string; weekday: number | null; customers: number };

export async function listRounds(db: Db = getDb()): Promise<RoundRow[]> {
  const rows = await db.query<{ id: string; name: string; weekday: number | null; customers: number }>(
    `SELECT r.id::text AS id, r.name, r.weekday, (SELECT count(*)::int FROM customer_rounds c WHERE c.round_id = r.id) AS customers
       FROM rounds r ORDER BY r.position, r.name`,
  );
  return rows.map((r) => ({ id: String(r.id), name: r.name, weekday: r.weekday, customers: Number(r.customers) }));
}

export async function createRound(args: { name: unknown; weekday?: unknown }, by: string, db: Db = getDb()): Promise<Created> {
  const name = str(args.name, 60);
  if (!name) return { ok: false, error: 'A round needs a name.' };
  const wd = String(args.weekday ?? '').trim();
  const weekday = wd === '' ? null : Number(wd);
  if (weekday !== null && (!Number.isInteger(weekday) || weekday < 1 || weekday > 7)) return { ok: false, error: 'Pick a day of the week.' };
  try {
    const [row] = await db.query<{ id: string }>(
      `INSERT INTO rounds (name, weekday, position) VALUES ($1, $2, coalesce((SELECT max(position) + 1 FROM rounds), 0)) RETURNING id::text AS id`,
      [name, weekday],
    );
    const a = audit(by, 'round_created', { id: row.id });
    await db.query(a.text, a.params);
    return { ok: true, id: row.id };
  } catch (err) {
    if (String((err as Error)?.message).includes('unique')) return { ok: false, error: 'There is already a round with that name.' };
    console.error('[customers] createRound failed:', err);
    return { ok: false, error: 'Could not add that round. Try again.' };
  }
}

export async function listPaymentMethods(db: Db = getDb()): Promise<{ key: string; label: string }[]> {
  return db.query<{ key: string; label: string }>('SELECT key, label FROM payment_methods ORDER BY position, label');
}
