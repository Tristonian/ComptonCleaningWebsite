import { AdminBar } from '@/components/AdminBar';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { listRounds, todayLondon } from '@/lib/customers';
import { listCallHours, listEntries, type ScheduleEntry } from '@/lib/schedule';
import { addDays, monthGrid, shiftMonth, validDate, weekStart, weekdayOf, windowsOn } from '@/lib/schedule-shared';
import { addEntryAction, deleteEntryAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Calendar', robots: { index: false, follow: false } };

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const field = 'rounded-xl border border-ink/20 bg-white p-3 text-base font-normal text-ink';
const nav = 'flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-brand-deep ring-1 ring-brand-deep/40 active:bg-brand/10';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const today = todayLondon();
  const date = validDate(sp.date) ?? today;
  const view = sp.view === 'month' ? 'month' : 'week';
  const db = getDb();

  const grid = view === 'month' ? monthGrid(date) : [];
  const from = view === 'month' ? grid[0][0] : weekStart(date);
  const to = view === 'month' ? grid.at(-1)![6] : addDays(from, 6);
  const [rounds, weekly, entries] = await Promise.all([listRounds(db), listCallHours(db), listEntries(from, to, db)]);
  const onDay = (d: string) => entries.filter((e) => e.onDate === d);
  const back = `/admin/calendar?${new URLSearchParams({ view, date })}`;
  const link = (v: string, d: string) => `/admin/calendar?${new URLSearchParams({ view: v, date: d })}`;

  const prev = view === 'month' ? shiftMonth(date, -1) : addDays(from, -7);
  const next = view === 'month' ? shiftMonth(date, 1) : addDays(from, 7);

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold text-brand-deep">Calendar</h1>
          <a href="/admin/settings" className="text-sm font-semibold text-brand-deep underline">
            Usual call hours
          </a>
        </div>
        {sp.ok && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">{sp.ok}</p>}
        {sp.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{sp.error}</p>}

        <div className="flex items-center gap-2">
          <a href={link(view, prev)} aria-label="Previous" className={nav}>
            ←
          </a>
          <a href={link(view, today)} className={nav}>
            Today
          </a>
          <a href={link(view, next)} aria-label="Next" className={nav}>
            →
          </a>
          <p className="min-w-0 flex-1 truncate text-center font-black text-brand-deep">{view === 'month' ? monthLabel(date) : `Week of ${dayLabel(from)}`}</p>
          <nav aria-label="View" className="flex gap-1">
            {(['week', 'month'] as const).map((v) => (
              <a key={v} href={link(v, date)} aria-current={view === v ? 'page' : undefined} className={`rounded-full px-3 py-2 text-sm font-bold ${view === v ? 'bg-brand-deep text-white' : 'text-brand-deep ring-1 ring-brand-deep/40'}`}>
                {v === 'week' ? 'Week' : 'Month'}
              </a>
            ))}
          </nav>
        </div>

        {view === 'month' ? (
          <div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-ink/70">
              {HEAD.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {grid.flat().map((d) => {
                const day = onDay(d);
                const off = day.some((e) => e.kind === 'not_callable');
                const count = day.filter((e) => e.kind === 'round').length;
                const inMonth = d.slice(0, 7) === date.slice(0, 7);
                return (
                  <a
                    key={d}
                    href={link('week', d)}
                    aria-label={`${dayLabel(d)}${count ? `, ${count} round${count === 1 ? '' : 's'}` : ''}${off ? ', calls off' : ''}`}
                    className={`flex min-h-16 flex-col items-center gap-1 rounded-lg p-1 text-sm ring-1 ${d === today ? 'bg-amber-100 ring-amber-400' : 'bg-white ring-ink/10'} ${inMonth ? '' : 'opacity-40'}`}
                  >
                    <span className="font-bold">{Number(d.slice(8))}</span>
                    <span className="flex flex-wrap justify-center gap-0.5" aria-hidden>
                      {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                        <span key={i} className="h-2 w-2 rounded-full bg-brand-deep" />
                      ))}
                      {off && <span className="h-2 w-2 rounded-full bg-red-600" />}
                      {day.some((e) => e.kind === 'callable') && <span className="h-2 w-2 rounded-full bg-green-600" />}
                    </span>
                  </a>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink/70">Blue dot: a round. Red: calls off that day. Green: extra call hours. Tap a day to edit it.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => (
              <DayCard key={d} date={d} today={today} entries={onDay(d)} windows={windowsOn(d, weekly, onDay(d))} rounds={rounds} back={back} hasHours={weekly.length > 0} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function DayCard({
  date,
  today,
  entries,
  windows,
  rounds,
  back,
  hasHours,
}: {
  date: string;
  today: string;
  entries: ScheduleEntry[];
  windows: { opens: string; closes: string }[];
  rounds: { id: string; name: string; weekday: number | null }[];
  back: string;
  hasHours: boolean;
}) {
  const off = entries.some((e) => e.kind === 'not_callable');
  const scheduled = new Set(entries.filter((e) => e.kind === 'round').map((e) => e.roundId));
  const usual = rounds.filter((r) => r.weekday === weekdayOf(date) && !scheduled.has(r.id));
  const remove = (e: ScheduleEntry, label: string, tone: string) => (
    <li key={e.id} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tone}`}>
      <span className="min-w-0 truncate">
        {label}
        {e.note ? ` · ${e.note}` : ''}
      </span>
      <form action={deleteEntryAction}>
        <input type="hidden" name="id" value={e.id} />
        <input type="hidden" name="back" value={back} />
        <button type="submit" aria-label={`Remove ${label}`} className="h-9 w-9 rounded-full text-lg font-black ring-1 ring-current/30">
          ×
        </button>
      </form>
    </li>
  );
  return (
    <li id={date} className={`rounded-xl bg-white p-3 shadow-sm ring-1 ${date === today ? 'ring-2 ring-amber-400' : 'ring-ink/10'}`}>
      <h2 className="font-black text-brand-deep">
        {dayLabel(date)}
        {date === today && <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-950">Today</span>}
      </h2>
      <p className="mt-1 text-sm text-ink/80">
        {!hasHours ? '📞 Calls: always on (no hours set)' : off ? '📞 Calls off all day' : windows.length ? `📞 Calls ${windows.map((w) => `${w.opens}–${w.closes}`).join(', ')}` : '📞 No calls today'}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {entries.map((e) =>
          e.kind === 'round'
            ? remove(e, `🔁 ${e.roundName ?? 'Round'}${e.starts ? ` from ${e.starts}` : ''}`, 'bg-brand/10 text-brand-deep')
            : e.kind === 'callable'
              ? remove(e, `📞 Extra calls ${e.starts}–${e.ends}`, 'bg-green-50 text-green-900')
              : remove(e, '🚫 Calls off', 'bg-red-50 text-red-900'),
        )}
      </ul>
      {usual.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {usual.map((r) => (
            <form key={r.id} action={addEntryAction}>
              <input type="hidden" name="onDate" value={date} />
              <input type="hidden" name="kind" value="round" />
              <input type="hidden" name="roundId" value={r.id} />
              <input type="hidden" name="back" value={back} />
              <button type="submit" className="rounded-full px-3 py-2 text-sm font-bold text-brand-deep ring-1 ring-dashed ring-brand-deep/60">
                + {r.name} (usual)
              </button>
            </form>
          ))}
        </div>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-bold text-brand-deep">➕ Add something</summary>
        <form action={addEntryAction} className="mt-2 flex flex-col gap-2 rounded-xl bg-paper p-3 ring-1 ring-ink/10">
          <input type="hidden" name="onDate" value={date} />
          <input type="hidden" name="back" value={back} />
          <label className="text-sm font-semibold text-ink/80">
            What
            <select name="kind" className={`${field} mt-1 block w-full`} defaultValue="round">
              <option value="round">A round</option>
              <option value="callable">Extra call hours</option>
              <option value="not_callable">No calls all day (day off)</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-ink/80">
            Round (for a round)
            <select name="roundId" className={`${field} mt-1 block w-full`} defaultValue="">
              <option value="">—</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-semibold text-ink/80">
              From
              <input type="time" name="starts" className={`${field} mt-1 w-full`} />
            </label>
            <label className="text-sm font-semibold text-ink/80">
              Until
              <input type="time" name="ends" className={`${field} mt-1 w-full`} />
            </label>
          </div>
          <label className="text-sm font-semibold text-ink/80">
            Note (optional)
            <input name="note" maxLength={200} className={`${field} mt-1 w-full`} />
          </label>
          <button type="submit" className="rounded-xl bg-brand-deep px-4 py-3 font-bold text-white">
            Add
          </button>
          <p className="text-xs text-ink/70">Times are needed for extra call hours; for a round they are optional.</p>
        </form>
      </details>
    </li>
  );
}
