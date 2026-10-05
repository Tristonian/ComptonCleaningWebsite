/**
 * Pure calendar rules, safe in the browser and in tests (no database, no server-only).
 * Times are 'HH:MM' wall-clock Europe/London; the weekday is ISO (1 = Monday ... 7 = Sunday).
 */

export type CallWindow = { opens: string; closes: string };
export type Entry = { onDate: string; kind: 'round' | 'callable' | 'not_callable'; starts: string | null; ends: string | null };

/** "9:5", "09:05", "09:05:00" -> "09:05"; anything else -> null. */
export function cleanTime(v: unknown): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(v ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** The London date, wall-clock time and ISO weekday of an instant. */
export function londonParts(now: Date): { date: string; time: string; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekday };
}

/** ISO weekday of a YYYY-MM-DD date. */
export function weekdayOf(date: string): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/**
 * The call windows in force on `date`: nothing if that day has a 'not_callable' entry (a day off),
 * otherwise the usual windows for the weekday plus any extra 'callable' windows on the date.
 */
export function windowsOn(date: string, weekly: { weekday: number; opens: string; closes: string }[], entries: Entry[]): CallWindow[] {
  const day = entries.filter((e) => e.onDate === date);
  if (day.some((e) => e.kind === 'not_callable')) return [];
  const usual = weekly.filter((w) => w.weekday === weekdayOf(date)).map((w) => ({ opens: w.opens, closes: w.closes }));
  const extra = day.filter((e) => e.kind === 'callable' && e.starts && e.ends).map((e) => ({ opens: e.starts!, closes: e.ends! }));
  return [...usual, ...extra].sort((a, b) => (a.opens < b.opens ? -1 : 1));
}

/** Is `now` inside a call window? A window is open at its start and closed at its finish. */
export function callableAt(now: Date, weekly: { weekday: number; opens: string; closes: string }[], entries: Entry[]): boolean {
  const { date, time } = londonParts(now);
  return windowsOn(date, weekly, entries).some((w) => time >= w.opens && time < w.closes);
}

/** YYYY-MM-DD plus a number of days (calendar arithmetic in UTC, so the clock change cannot shift a date). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week containing `date`. */
export function weekStart(date: string): string {
  return addDays(date, 1 - weekdayOf(date));
}

/** A valid YYYY-MM-DD, or null. */
export function validDate(v: unknown): string | null {
  const s = String(v ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toISOString().slice(0, 10) === s ? s : null;
}

/** The weeks that show a month, Monday first, each as seven dates (days outside the month included). */
export function monthGrid(date: string): string[][] {
  const first = `${date.slice(0, 7)}-01`;
  const start = weekStart(first);
  const month = date.slice(0, 7);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const row = Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i));
    if (w > 0 && row[0].slice(0, 7) !== month) break;
    weeks.push(row);
  }
  return weeks;
}

/** The first of the month before / after. */
export function shiftMonth(date: string, by: number): string {
  const [y, m] = date.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1, 12));
  return d.toISOString().slice(0, 10);
}

// ---- the time grid (day and week views) ----

/** "09:30" -> 570. */
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** 570 -> "09:30". */
export function fromMinutes(min: number): string {
  const c = Math.min(Math.max(Math.round(min), 0), 24 * 60 - 1);
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
}

/** Round to the nearest quarter hour. */
export const snapQuarter = (min: number) => Math.round(min / 15) * 15;

/** A round with only a start time is drawn this long, and labelled as a guess. */
export const DEFAULT_ROUND_MINUTES = 60;

/**
 * The hours the grid shows: at least 07:00 to 19:00, widened to include any call window or timed round,
 * so nothing is ever drawn off the edge. Whole hours.
 */
export function hourRange(spans: { start: number; end: number }[]): { minHour: number; maxHour: number } {
  let min = 7 * 60;
  let max = 19 * 60;
  for (const s of spans) {
    min = Math.min(min, s.start);
    max = Math.max(max, s.end);
  }
  return { minHour: Math.max(0, Math.floor(min / 60)), maxHour: Math.min(24, Math.ceil(max / 60)) };
}

export type LaneInput = { id: string; start: number; end: number };
export type LanePlacement = { lane: number; lanes: number };

/**
 * Where things that happen at the same time sit side by side instead of on top of each other. Events are
 * clustered (a new cluster starts when one begins at or after everything before it has finished, so
 * back-to-back is NOT overlapping), then packed into the first free lane; every member of a cluster
 * shares the cluster's lane count so their edges line up. Order-independent: ties break on length, then id.
 */
export function assignLanes(events: LaneInput[]): Map<string, LanePlacement> {
  const out = new Map<string, LanePlacement>();
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let cluster: LaneInput[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const ev of cluster) out.set(ev.id, { lane: out.get(ev.id)?.lane ?? 0, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };
  for (const ev of sorted) {
    const end = Math.max(ev.end, ev.start);
    if (ev.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= ev.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else laneEnds[lane] = end;
    out.set(ev.id, { lane, lanes: laneEnds.length });
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return out;
}

/** CSS left/width, as percentages of the day column, for one placement. */
export function laneStyle({ lane, lanes }: LanePlacement): { left: string; width: string } {
  if (lanes <= 1) return { left: '0%', width: '100%' };
  const gap = 1.5;
  const width = (100 - gap * (lanes - 1)) / lanes;
  return { left: `${lane * (width + gap)}%`, width: `${width}%` };
}

/** A pastel fill and a darker edge for the nth round, spread round the colour wheel so neighbours differ. */
export function roundColour(index: number): { fill: string; accent: string } {
  const hue = (index * 67 + 205) % 360;
  return { fill: `hsl(${hue} 70% 90%)`, accent: `hsl(${hue} 55% 38%)` };
}
