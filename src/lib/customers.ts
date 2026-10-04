import 'server-only';
import { getDb, type Db } from '@/lib/db';
import { normalisePhone } from '@/lib/phone';
import type { ImportRow } from '@/lib/customers-csv';
import { hashesForCustomer, unreferenced } from '@/lib/job-photos';

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
  /** The last clean from before the tracker (editable); lastDone is the later of this and the newest done visit. */
  baselineDoneOn: string | null;
  nextDue: string | null;
  owingPence: number;
  rounds: { id: string; name: string }[];
};

/** 'unset' = still needs a price or a frequency (imported customers arrive without either). */
export type Filter = 'all' | 'due' | 'owing' | 'unset';

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
  baseline: string | null;
  next_due: string | null;
  owing_pence: number;
  rounds: { id: string; name: string }[] | null;
};

/** Dates are cast to text in SQL: Neon's driver and PGlite disagree on how they hand a `date` back. */
const SELECT = `
  SELECT c.id::text AS id, c.name, c.address, c.postcode, c.phone, c.email, c.notes, c.lat, c.lng,
         c.price_pence, c.frequency_weeks, c.preferred_payment,
         to_char(l.last_done, 'YYYY-MM-DD') AS last_done,
         to_char(c.baseline_done_on, 'YYYY-MM-DD') AS baseline,
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
  baselineDoneOn: r.baseline,
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
  if (args.filter === 'unset') return all.filter((c) => c.pricePence === null || c.frequencyWeeks === null);
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
  /** YYYY-MM-DD: the last clean from before the tracker. Left out = leave as it is; '' = clear it. */
  lastCleaned?: unknown;
};

type Clean = {
  /** undefined = leave alone, null = clear, string = set. */
  baseline: string | null | undefined;
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
  let baseline: string | null | undefined;
  if (input.lastCleaned !== undefined) {
    const s = String(input.lastCleaned ?? '').trim();
    if (s === '') baseline = null;
    else {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      const real = m && new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toISOString().slice(0, 10) === s;
      if (!real) return { ok: false, error: 'That last-cleaned date does not look right.' };
      if (s > todayLondon()) return { ok: false, error: 'The last clean cannot be in the future.' };
      baseline = s;
    }
  }
  return {
    ok: true,
    value: {
      baseline,
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
              lat = coalesce($11, lat), lng = coalesce($12, lng),
              baseline_done_on = CASE WHEN $13::boolean THEN $14::date ELSE baseline_done_on END
        WHERE id = $1 RETURNING id`,
      // A location is only replaced when a new one was grabbed; saving the form never wipes the pin.
      [id, v.name, v.phone, v.email, v.address, v.postcode, v.notes, v.pricePence, v.frequencyWeeks, v.preferredPayment, v.lat, v.lng, v.baseline !== undefined, v.baseline ?? null],
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
 * Set price, frequency, round and/or usual payment for many customers at once (the imported ones arrive
 * with none of these). Only the fields given are touched; a blank field means "leave it".
 */
export async function bulkSetup(
  ids: unknown[],
  fields: { price?: unknown; frequencyWeeks?: unknown; roundId?: unknown; preferredPayment?: unknown },
  by: string,
  db: Db = getDb(),
): Promise<Result & { changed: number }> {
  const customerIds = [...new Set(ids.map(String))].filter((x) => /^\d+$/.test(x)).slice(0, 500);
  if (customerIds.length === 0) return { ok: false, error: 'Tick at least one customer.', changed: 0 };
  const pricePence = poundsToPence(fields.price);
  if (pricePence === undefined || (pricePence !== null && pricePence > MAX_PRICE_PENCE)) {
    return { ok: false, error: 'That price does not look right. Use pounds, like 12 or 12.50.', changed: 0 };
  }
  const freqRaw = String(fields.frequencyWeeks ?? '').trim();
  const freq = freqRaw === '' ? null : Number(freqRaw);
  if (freq !== null && (!Number.isInteger(freq) || freq < 1 || freq > 52)) return { ok: false, error: 'Frequency is a whole number of weeks, 1 to 52.', changed: 0 };
  const roundId = String(fields.roundId ?? '').trim();
  if (roundId && !/^\d+$/.test(roundId)) return { ok: false, error: 'Unknown round.', changed: 0 };
  const method = String(fields.preferredPayment ?? '').trim();
  if (method && (await db.query('SELECT 1 FROM payment_methods WHERE key = $1', [method])).length === 0) return { ok: false, error: 'Unknown way of paying.', changed: 0 };
  if (pricePence === null && freq === null && !roundId && !method) return { ok: false, error: 'Fill in at least one thing to set.', changed: 0 };
  try {
    const statements: { text: string; params: unknown[] }[] = [];
    if (pricePence !== null || freq !== null || method) {
      statements.push({
        text: `UPDATE customers SET price_pence = coalesce($2::int, price_pence), frequency_weeks = coalesce($3::int, frequency_weeks),
                      preferred_payment = CASE WHEN $4 <> '' THEN $4 ELSE preferred_payment END
                WHERE id = ANY($1::bigint[])`,
        params: [customerIds, pricePence, freq, method],
      });
    }
    if (roundId) {
      statements.push({
        text: `INSERT INTO customer_rounds (customer_id, round_id, position)
               SELECT c.id, r.id, coalesce((SELECT max(position) + 1 FROM customer_rounds WHERE round_id = r.id), 0) + row_number() OVER (ORDER BY c.name, c.id) - 1
                 FROM customers c, rounds r WHERE c.id = ANY($1::bigint[]) AND r.id = $2
               ON CONFLICT DO NOTHING`,
        params: [customerIds, roundId],
      });
    }
    statements.push(audit(by, 'customers_bulk_setup', { count: customerIds.length, round: roundId || null }));
    await db.transaction(statements);
    return { ok: true, changed: customerIds.length };
  } catch (err) {
    console.error('[customers] bulkSetup failed:', err);
    return { ok: false, error: 'Could not save that. Nothing was changed.', changed: 0 };
  }
}

/**
 * Delete a customer for good (they asked). Their jobs, extras, photo rows and round places go with
 * them, and enquiries that pointed at them simply lose the link. The audit row records only the id.
 */
export async function deleteCustomer(
  id: unknown,
  by: string,
  db: Db = getDb(),
): Promise<{ ok: true; orphans: string[] } | { ok: false; error: string }> {
  if (!/^\d+$/.test(String(id))) return { ok: false, error: 'Unknown customer.' };
  try {
    const a = audit(by, 'customer_deleted', { id: String(id) });
    const found = await db.query('SELECT id FROM customers WHERE id = $1', [id]);
    if (found.length === 0) return { ok: false, error: 'That customer no longer exists.' };
    // Collect the photo hashes first (the rows cascade away), then report which are now unused so the
    // caller can remove them from R2 after the delete has really happened.
    const hashes = await hashesForCustomer(id, db);
    await db.transaction([{ text: 'DELETE FROM customers WHERE id = $1', params: [id] }, a]);
    return { ok: true, orphans: await unreferenced(hashes, db) };
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

/** "Bank transfer" -> "bank-transfer": the stored key for a way of paying. */
export function methodKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
}

export async function addPaymentMethod(labelRaw: unknown, by: string, db: Db = getDb()): Promise<Result> {
  const label = str(labelRaw, 40).replace(/\s+/g, ' ');
  const key = methodKey(label);
  if (!label || !key) return { ok: false, error: 'Give the way of paying a name.' };
  try {
    const rows = await db.query(
      `INSERT INTO payment_methods (key, label, position)
       VALUES ($1, $2, coalesce((SELECT max(position) + 1 FROM payment_methods), 1))
       ON CONFLICT (key) DO NOTHING RETURNING key`,
      [key, label],
    );
    if (rows.length === 0) return { ok: false, error: 'That is already in the list.' };
    const a = audit(by, 'payment_method_added', { key });
    await db.query(a.text, a.params);
    return { ok: true };
  } catch (err) {
    console.error('[customers] addPaymentMethod failed:', err);
    return { ok: false, error: 'Could not add that. Try again.' };
  }
}

/** Rename only: the key stays, so visits and customers that use it keep working. */
export async function renamePaymentMethod(key: unknown, labelRaw: unknown, by: string, db: Db = getDb()): Promise<Result> {
  const label = str(labelRaw, 40).replace(/\s+/g, ' ');
  if (!label) return { ok: false, error: 'Give the way of paying a name.' };
  try {
    const rows = await db.query('UPDATE payment_methods SET label = $2 WHERE key = $1 RETURNING key', [String(key), label]);
    if (rows.length === 0) return { ok: false, error: 'That way of paying no longer exists.' };
    const a = audit(by, 'payment_method_renamed', { key: String(key) });
    await db.query(a.text, a.params);
    return { ok: true };
  } catch (err) {
    console.error('[customers] renamePaymentMethod failed:', err);
    return { ok: false, error: 'Could not save that. Try again.' };
  }
}

/** A way of paying that any visit or customer still uses cannot be removed: it would orphan their record. */
export async function removePaymentMethod(key: unknown, by: string, db: Db = getDb()): Promise<Result> {
  const k = String(key ?? '');
  try {
    const [use] = await db.query<{ n: number }>(
      `SELECT ((SELECT count(*) FROM jobs WHERE payment_method = $1) + (SELECT count(*) FROM customers WHERE preferred_payment = $1))::int AS n`,
      [k],
    );
    if (Number(use.n) > 0) return { ok: false, error: 'Visits or customers still use that one. Rename it instead.' };
    const rows = await db.query('DELETE FROM payment_methods WHERE key = $1 RETURNING key', [k]);
    if (rows.length === 0) return { ok: false, error: 'That way of paying no longer exists.' };
    const a = audit(by, 'payment_method_removed', { key: k });
    await db.query(a.text, a.params);
    return { ok: true };
  } catch (err) {
    console.error('[customers] removePaymentMethod failed:', err);
    return { ok: false, error: 'Could not remove that. Try again.' };
  }
}

// ---- round order ----

/** The customers of a round, in the order Sam works them (position, then name). */
export async function listRoundOrder(roundId: unknown, db: Db = getDb()): Promise<string[]> {
  if (!/^\d+$/.test(String(roundId))) return [];
  const rows = await db.query<{ id: string }>(
    `SELECT c.id::text AS id FROM customer_rounds cr JOIN customers c ON c.id = cr.customer_id
      WHERE cr.round_id = $1 ORDER BY cr.position, c.name, c.id`,
    [roundId],
  );
  return rows.map((r) => String(r.id));
}

/**
 * Save a round's order. `orderedIds` is the whole round, first stop first. Ids that are not in the round
 * are ignored; members missing from the list keep their relative order after it, so a stale page cannot
 * drop anyone off the round.
 */
export async function setRoundOrder(roundId: unknown, orderedIds: unknown[], by: string, db: Db = getDb()): Promise<Result> {
  if (!/^\d+$/.test(String(roundId))) return { ok: false, error: 'Unknown round.' };
  try {
    const current = await listRoundOrder(roundId, db);
    const member = new Set(current);
    const asked = [...new Set(orderedIds.map(String))].filter((id) => member.has(id));
    const final = [...asked, ...current.filter((id) => !asked.includes(id))];
    await db.transaction([
      ...final.map((id, i) => ({
        text: 'UPDATE customer_rounds SET position = $3 WHERE round_id = $1 AND customer_id = $2',
        params: [roundId, id, i],
      })),
      audit(by, 'round_reordered', { round: String(roundId), stops: final.length }),
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[customers] setRoundOrder failed:', err);
    return { ok: false, error: 'Could not save the order. Try again.' };
  }
}

/** Move one customer a step up (-1) or down (+1) in a round. */
export async function moveInRound(roundId: unknown, customerId: unknown, step: -1 | 1, by: string, db: Db = getDb()): Promise<Result> {
  const order = await listRoundOrder(roundId, db);
  const i = order.indexOf(String(customerId));
  if (i < 0) return { ok: false, error: 'That customer is not in this round.' };
  const j = i + step;
  if (j < 0 || j >= order.length) return { ok: true };
  [order[i], order[j]] = [order[j], order[i]];
  return setRoundOrder(roundId, order, by, db);
}

/** Change a round's name and usual weekday. */
export async function updateRound(id: unknown, args: { name: unknown; weekday?: unknown }, by: string, db: Db = getDb()): Promise<Result> {
  if (!/^\d+$/.test(String(id))) return { ok: false, error: 'Unknown round.' };
  const name = str(args.name, 60);
  if (!name) return { ok: false, error: 'A round needs a name.' };
  const wd = String(args.weekday ?? '').trim();
  const weekday = wd === '' ? null : Number(wd);
  if (weekday !== null && (!Number.isInteger(weekday) || weekday < 1 || weekday > 7)) return { ok: false, error: 'Pick a day of the week.' };
  try {
    const rows = await db.query('UPDATE rounds SET name = $2, weekday = $3 WHERE id = $1 RETURNING id', [id, name, weekday]);
    if (rows.length === 0) return { ok: false, error: 'That round no longer exists.' };
    const a = audit(by, 'round_edited', { id: String(id) });
    await db.query(a.text, a.params);
    return { ok: true };
  } catch (err) {
    if (String((err as Error)?.message).includes('unique')) return { ok: false, error: 'There is already a round with that name.' };
    console.error('[customers] updateRound failed:', err);
    return { ok: false, error: 'Could not save that. Try again.' };
  }
}
