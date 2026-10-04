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
