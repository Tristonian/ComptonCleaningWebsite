import 'server-only';
import { getDb, type Db } from '@/lib/db';
import { addDays, validDate, weekStart } from '@/lib/schedule-shared';

/**
 * Earnings reports (like HairByRachel's): money actually received in a period, by way of paying, by week,
 * the extras and customers that bring in most, and what is still owed. Counted on the day it was received
 * (`paid_on`, else the visit date). Money is integer pence; dates are London dates.
 */

export type Earnings = {
  from: string;
  to: string;
  collectedPence: number;
  paidVisits: number;
  byMethod: { method: string; pence: number }[];
  byWeek: { weekStart: string; pence: number }[];
  topExtras: { label: string; pence: number; times: number }[];
  topCustomers: { id: string; name: string; pence: number; visits: number }[];
  /** Visits done in the period (whether or not paid yet). */
  doneVisits: number;
  workedPence: number;
  missedVisits: number;
  /** Everything owed right now, whatever the period. */
  outstandingPence: number;
  outstandingVisits: number;
};

const BASE = `
  WITH j AS (
    SELECT j.id, j.customer_id, j.status, j.done_on, j.paid, j.payment_method,
           coalesce(j.paid_on, j.done_on) AS received_on,
           j.price_pence + coalesce((SELECT sum(e.price_pence) FROM job_extras e WHERE e.job_id = j.id), 0) AS total
      FROM jobs j
  )`;

/** Hard cap on a report window, so a typo cannot ask the database for decades of weeks. */
export const MAX_DAYS = 800;

/** Clean a requested window: valid dates, from <= to, not absurdly long. Falls back to the given default. */
export function cleanRange(from: unknown, to: unknown, fallback: { from: string; to: string }): { from: string; to: string } {
  const f = validDate(from);
  const t = validDate(to);
  if (!f || !t || f > t || addDays(f, MAX_DAYS) < t) return fallback;
  return { from: f, to: t };
}

export async function getEarnings(from: string, to: string, db: Db = getDb()): Promise<Earnings> {
  const range = [from, to];
  const [sum] = await db.query<{ pence: number; visits: number }>(
    `${BASE} SELECT coalesce(sum(total), 0)::int AS pence, count(*)::int AS visits FROM j
      WHERE status = 'done' AND paid AND received_on BETWEEN $1::date AND $2::date`,
    range,
  );
  const methods = await db.query<{ method: string; pence: number }>(
    `${BASE} SELECT payment_method AS method, sum(total)::int AS pence FROM j
      WHERE status = 'done' AND paid AND received_on BETWEEN $1::date AND $2::date GROUP BY payment_method ORDER BY pence DESC`,
    range,
  );
  const weeks = await db.query<{ week: string; pence: number }>(
    `${BASE} SELECT to_char(date_trunc('week', received_on), 'YYYY-MM-DD') AS week, sum(total)::int AS pence FROM j
      WHERE status = 'done' AND paid AND received_on BETWEEN $1::date AND $2::date GROUP BY 1 ORDER BY 1`,
    range,
  );
  const extras = await db.query<{ label: string; pence: number; times: number }>(
    `${BASE} SELECT min(e.label) AS label, sum(e.price_pence)::int AS pence, count(*)::int AS times
       FROM j JOIN job_extras e ON e.job_id = j.id
      WHERE j.status = 'done' AND j.paid AND j.received_on BETWEEN $1::date AND $2::date
      GROUP BY lower(e.label) ORDER BY pence DESC, times DESC LIMIT 10`,
    range,
  );
  const customers = await db.query<{ id: string; name: string; pence: number; visits: number }>(
    `${BASE} SELECT c.id::text AS id, c.name, sum(j.total)::int AS pence, count(*)::int AS visits
       FROM j JOIN customers c ON c.id = j.customer_id
      WHERE j.status = 'done' AND j.paid AND j.received_on BETWEEN $1::date AND $2::date
      GROUP BY c.id, c.name ORDER BY pence DESC, c.name LIMIT 10`,
    range,
  );
  const [work] = await db.query<{ done: number; worked: number; missed: number }>(
    `${BASE} SELECT count(*) FILTER (WHERE status = 'done')::int AS done,
                    coalesce(sum(total) FILTER (WHERE status = 'done'), 0)::int AS worked,
                    count(*) FILTER (WHERE status = 'missed')::int AS missed
               FROM j WHERE done_on BETWEEN $1::date AND $2::date`,
    range,
  );
  const [owed] = await db.query<{ pence: number; visits: number }>(
    `${BASE} SELECT coalesce(sum(total), 0)::int AS pence, count(*)::int AS visits FROM j WHERE status = 'done' AND NOT paid`,
  );
  return {
    from,
    to,
    collectedPence: Number(sum.pence),
    paidVisits: Number(sum.visits),
    byMethod: methods.map((m) => ({ method: m.method, pence: Number(m.pence) })),
    byWeek: weeks.map((w) => ({ weekStart: w.week, pence: Number(w.pence) })),
    topExtras: extras.map((e) => ({ label: e.label, pence: Number(e.pence), times: Number(e.times) })),
    topCustomers: customers.map((c) => ({ id: String(c.id), name: c.name, pence: Number(c.pence), visits: Number(c.visits) })),
    doneVisits: Number(work.done),
    workedPence: Number(work.worked),
    missedVisits: Number(work.missed),
    outstandingPence: Number(owed.pence),
    outstandingVisits: Number(owed.visits),
  };
}

/** Every week from the one containing `from` to the one containing `to`, with zero for the quiet ones, so the bars have no gaps. */
export function fillWeeks(from: string, to: string, byWeek: { weekStart: string; pence: number }[]): { weekStart: string; pence: number }[] {
  const have = new Map(byWeek.map((w) => [w.weekStart, w.pence]));
  const out: { weekStart: string; pence: number }[] = [];
  for (let w = weekStart(from); w <= to && out.length < 120; w = addDays(w, 7)) out.push({ weekStart: w, pence: have.get(w) ?? 0 });
  return out;
}

/** The first and last day of the month containing `date`. */
export function monthRangeOf(date: string): { from: string; to: string } {
  const from = `${date.slice(0, 7)}-01`;
  const [y, m] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10);
  return { from, to: last };
}

export type PaymentRow = { receivedOn: string; customer: string; visitOn: string; method: string; pence: number };

export async function listCollected(from: string, to: string, db: Db = getDb()): Promise<PaymentRow[]> {
  const rows = await db.query<{ received_on: string; customer: string; visit_on: string; method: string; pence: number }>(
    `${BASE} SELECT to_char(j.received_on, 'YYYY-MM-DD') AS received_on, c.name AS customer, to_char(j.done_on, 'YYYY-MM-DD') AS visit_on,
                    j.payment_method AS method, j.total::int AS pence
               FROM j JOIN customers c ON c.id = j.customer_id
              WHERE j.status = 'done' AND j.paid AND j.received_on BETWEEN $1::date AND $2::date
              ORDER BY j.received_on, j.id LIMIT 5000`,
    [from, to],
  );
  return rows.map((r) => ({ receivedOn: r.received_on, customer: r.customer, visitOn: r.visit_on, method: r.method, pence: Number(r.pence) }));
}

/** One CSV cell. A leading = + - @ would be run as a formula by a spreadsheet, so it is defused with a quote. */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function paymentsCsv(rows: PaymentRow[], methodLabel: (key: string) => string): string {
  const pounds = (p: number) => `${Math.floor(p / 100)}.${String(p % 100).padStart(2, '0')}`;
  const lines = [['Received', 'Customer', 'Visit date', 'Paid by', 'Amount (GBP)'].join(',')];
  for (const r of rows) lines.push([r.receivedOn, csvCell(r.customer), r.visitOn, csvCell(methodLabel(r.method)), pounds(r.pence)].join(','));
  return `${lines.join('\r\n')}\r\n`;
}
