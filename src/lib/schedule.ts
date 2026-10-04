import 'server-only';
import { getDb, type Db } from '@/lib/db';
import { todayLondon, type Created, type Result } from '@/lib/customers';
import { callableAt, cleanTime, type CallWindow, type Entry } from '@/lib/schedule-shared';

/**
 * Sam's calendar (ADR 0011): the usual call hours for each weekday, plus dated entries on top (a round he
 * is working, an extra window he takes calls, or a day with calls off). Times are wall-clock Europe/London.
 * Every change writes an audit row with ids only.
 */

const audit = (by: string, action: string, detail: object) => ({
  text: 'INSERT INTO audit_log (email, action, detail) VALUES ($1, $2, $3)',
  params: [by, action, JSON.stringify(detail)],
});

const isoDate = (v: unknown) => {
  const s = String(v ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toISOString().slice(0, 10) === s ? s : null;
};

export type WeeklyHours = { weekday: number; opens: string; closes: string };

export async function listCallHours(db: Db = getDb()): Promise<WeeklyHours[]> {
  const rows = await db.query<{ weekday: number; opens: string; closes: string }>(
    `SELECT weekday, to_char(opens, 'HH24:MI') AS opens, to_char(closes, 'HH24:MI') AS closes FROM call_hours ORDER BY weekday, opens`,
  );
  return rows.map((r) => ({ weekday: Number(r.weekday), opens: r.opens, closes: r.closes }));
}

/** Replace one weekday's windows. No windows = no calls that day (Saturday and Sunday work this way). */
export async function setCallHours(weekday: unknown, windows: { opens: unknown; closes: unknown }[], by: string, db: Db = getDb()): Promise<Result> {
  const wd = Number(weekday);
  if (!Number.isInteger(wd) || wd < 1 || wd > 7) return { ok: false, error: 'Pick a day of the week.' };
  const clean: CallWindow[] = [];
  for (const w of windows.slice(0, 4)) {
    const opens = cleanTime(w.opens);
    const closes = cleanTime(w.closes);
    if (!opens && !closes) continue; // an empty row
    if (!opens || !closes || closes <= opens) return { ok: false, error: 'Each window needs a start and a later finish.' };
    clean.push({ opens, closes });
  }
  try {
    await db.transaction([
      { text: 'DELETE FROM call_hours WHERE weekday = $1', params: [wd] },
      ...clean.map((w) => ({ text: 'INSERT INTO call_hours (weekday, opens, closes) VALUES ($1, $2::time, $3::time) ON CONFLICT DO NOTHING', params: [wd, w.opens, w.closes] })),
      audit(by, 'call_hours_set', { weekday: wd, windows: clean.length }),
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[schedule] setCallHours failed:', err);
    return { ok: false, error: 'Could not save those hours. Try again.' };
  }
}

export type ScheduleEntry = {
  id: string;
  onDate: string;
  kind: 'round' | 'callable' | 'not_callable';
  roundId: string | null;
  roundName: string | null;
  starts: string | null;
  ends: string | null;
  note: string;
};

type RawEntry = {
  id: string;
  on_date: string;
  kind: ScheduleEntry['kind'];
  round_id: string | null;
  round_name: string | null;
  starts: string | null;
  ends: string | null;
  note: string;
};

const toEntry = (r: RawEntry): ScheduleEntry => ({
  id: String(r.id),
  onDate: r.on_date,
  kind: r.kind,
  roundId: r.round_id === null ? null : String(r.round_id),
  roundName: r.round_name,
  starts: r.starts,
  ends: r.ends,
  note: r.note,
});

/** Entries from `from` to `to` inclusive, in day then time order. */
export async function listEntries(from: string, to: string, db: Db = getDb()): Promise<ScheduleEntry[]> {
  if (!isoDate(from) || !isoDate(to)) return [];
  const rows = await db.query<RawEntry>(
    `SELECT e.id::text AS id, to_char(e.on_date, 'YYYY-MM-DD') AS on_date, e.kind, e.round_id::text AS round_id, r.name AS round_name,
            to_char(e.starts, 'HH24:MI') AS starts, to_char(e.ends, 'HH24:MI') AS ends, e.note
       FROM schedule_entries e LEFT JOIN rounds r ON r.id = e.round_id
      WHERE e.on_date BETWEEN $1::date AND $2::date
      ORDER BY e.on_date, e.starts NULLS FIRST, e.id`,
    [from, to],
  );
  return rows.map(toEntry);
}

export type EntryInput = {
  onDate: unknown;
  kind: unknown;
  roundId?: unknown;
  starts?: unknown;
  ends?: unknown;
  note?: unknown;
};

export async function addEntry(input: EntryInput, by: string, db: Db = getDb()): Promise<Created> {
  const onDate = isoDate(input.onDate);
  if (!onDate) return { ok: false, error: 'That date does not look right.' };
  const kind = input.kind === 'round' || input.kind === 'callable' || input.kind === 'not_callable' ? input.kind : null;
  if (!kind) return { ok: false, error: 'Pick what to add.' };
  const note = String(input.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const starts = cleanTime(input.starts);
  const ends = cleanTime(input.ends);
  let roundId: string | null = null;
  if (kind === 'round') {
    roundId = String(input.roundId ?? '');
    if (!/^\d+$/.test(roundId)) return { ok: false, error: 'Pick a round.' };
  }
  if (kind === 'callable' && (!starts || !ends || ends <= starts)) return { ok: false, error: 'Calls need a start and a later finish.' };
  if (kind === 'round' && starts && ends && ends <= starts) return { ok: false, error: 'The finish must be after the start.' };
  try {
    const rows = await db.query<{ id: string }>(
      `INSERT INTO schedule_entries (on_date, kind, round_id, starts, ends, note)
       VALUES ($1::date, $2, $3, $4::time, $5::time, $6) RETURNING id::text AS id`,
      [onDate, kind, roundId, kind === 'not_callable' ? null : starts, kind === 'not_callable' ? null : ends, note],
    );
    const a = audit(by, 'schedule_added', { id: rows[0].id, kind });
    await db.query(a.text, a.params);
    return { ok: true, id: rows[0].id };
  } catch (err) {
    console.error('[schedule] addEntry failed:', err);
    return { ok: false, error: 'Could not add that. Try again (is the round still there?).' };
  }
}

export async function deleteEntry(id: unknown, by: string, db: Db = getDb()): Promise<Result> {
  if (!/^\d+$/.test(String(id))) return { ok: false, error: 'Unknown entry.' };
  try {
    const rows = await db.query('DELETE FROM schedule_entries WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) return { ok: false, error: 'That entry no longer exists.' };
    const a = audit(by, 'schedule_deleted', { id: String(id) });
    await db.query(a.text, a.params);
    return { ok: true };
  } catch (err) {
    console.error('[schedule] deleteEntry failed:', err);
    return { ok: false, error: 'Could not remove that. Try again.' };
  }
}

/**
 * Should the public "Call me" button be offered right now? Fails OPEN: if the hours cannot be read, or
 * Sam has never set any, the button shows (a missed call costs more than an unwanted one).
 */
export async function isTakingCalls(now: Date = new Date(), db?: Db): Promise<boolean> {
  try {
    const d = db ?? getDb();
    const weekly = await listCallHours(d);
    if (weekly.length === 0) return true;
    const today = todayLondon(now);
    const entries = await listEntries(today, today, d);
    const asEntries: Entry[] = entries.map((e) => ({ onDate: e.onDate, kind: e.kind, starts: e.starts, ends: e.ends }));
    return callableAt(now, weekly, asEntries);
  } catch (err) {
    console.error('[schedule] could not read call hours, showing the call button:', err);
    return true;
  }
}
