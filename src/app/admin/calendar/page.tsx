import { AdminBar } from '@/components/AdminBar';
import { CalendarGrid, type GridDay } from '@/components/admin/CalendarGrid';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { listRounds, todayLondon } from '@/lib/customers';
import { listCallHours, listEntries } from '@/lib/schedule';
import { addDays, monthGrid, roundColour, shiftMonth, validDate, weekStart, weekdayOf, windowsOn } from '@/lib/schedule-shared';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Calendar', robots: { index: false, follow: false } };

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const nav = 'flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-brand-deep ring-1 ring-brand-deep/40 active:bg-brand/10';
const HATCH = 'bg-[repeating-linear-gradient(135deg,#f6f3ee,#f6f3ee_6px,#e9e4dc_6px,#e9e4dc_12px)]';

type View = 'day' | 'week' | 'month';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const today = todayLondon();
  const date = validDate(sp.date) ?? today;
  const view: View = sp.view === 'month' ? 'month' : sp.view === 'day' ? 'day' : 'week';
  const db = getDb();

  const grid = view === 'month' ? monthGrid(date) : [];
  const from = view === 'month' ? grid[0][0] : view === 'day' ? date : weekStart(date);
  const to = view === 'month' ? grid.at(-1)![6] : view === 'day' ? date : addDays(from, 6);
  const [rounds, weekly, entries] = await Promise.all([listRounds(db), listCallHours(db), listEntries(from, to, db)]);
  const back = `/admin/calendar?${new URLSearchParams({ view, date })}`;
  const link = (v: View, d: string) => `/admin/calendar?${new URLSearchParams({ view: v, date: d })}`;
  const step = view === 'month' ? [shiftMonth(date, -1), shiftMonth(date, 1)] : view === 'day' ? [addDays(date, -1), addDays(date, 1)] : [addDays(from, -7), addDays(from, 7)];
  const title = view === 'month' ? monthLabel(date) : view === 'day' ? dayLabel(date) : `${shortDay(from)} – ${shortDay(to)}`;
  const hasHours = weekly.length > 0;

  const days: GridDay[] = view === 'month' ? [] : Array.from({ length: view === 'day' ? 1 : 7 }, (_, i) => addDays(from, i)).map((d) => {
    const day = entries.filter((e) => e.onDate === d);
    return {
      date: d,
      weekday: weekdayOf(d),
      // With no hours set at all the Call button is always on, so there is nothing to draw.
      windows: hasHours
        ? [
            ...windowsOn(d, weekly, day.filter((e) => e.kind !== 'callable')).map((w) => ({ ...w, extra: false })),
            ...(day.some((e) => e.kind === 'not_callable') ? [] : day.filter((e) => e.kind === 'callable' && e.starts && e.ends).map((e) => ({ opens: e.starts as string, closes: e.ends as string, extra: true }))),
          ]
        : [],
      usual: weekly.filter((w) => w.weekday === weekdayOf(d)).map((w) => ({ opens: w.opens, closes: w.closes })),
      offId: day.find((e) => e.kind === 'not_callable')?.id ?? null,
    };
  });

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-3xl flex-col gap-3 px-3 py-5">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h1 className="text-2xl font-bold text-brand-deep">Calendar</h1>
          <a href="/admin/settings" className="text-sm font-semibold text-brand-deep underline">
            Settings
          </a>
        </div>
        {sp.ok && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">{sp.ok}</p>}
        {sp.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{sp.error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <a href={link(view, step[0])} aria-label="Previous" className={nav}>
            ←
          </a>
          <a href={link(view, today)} className={nav}>
            Today
          </a>
          <a href={link(view, step[1])} aria-label="Next" className={nav}>
            →
          </a>
          <nav aria-label="View" className="ml-auto flex gap-1">
            {(['day', 'week', 'month'] as const).map((v) => (
              <a key={v} href={link(v, date)} aria-current={view === v ? 'page' : undefined} className={`rounded-full px-3 py-2 text-sm font-bold ${view === v ? 'bg-brand-deep text-white' : 'text-brand-deep ring-1 ring-brand-deep/40'}`}>
                {v === 'day' ? 'Day' : v === 'week' ? 'Week' : 'Month'}
              </a>
            ))}
          </nav>
        </div>
        <p className="px-1 text-lg font-black text-brand-deep">{title}</p>

        {!hasHours && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-950">
            No call hours are set yet, so the website always shows the Call button. Tap a day’s heading and choose “Usually take calls on…” to set them.
          </p>
        )}

        {view === 'month' ? (
          <div className="overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-sm">
            <div className="grid grid-cols-7 border-b border-ink/10">
              {HEAD.map((h) => (
                <span key={h} className="py-1 text-center text-[10px] uppercase text-ink/70">
                  {h}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.flat().map((d) => {
                const day = entries.filter((e) => e.onDate === d);
                const off = day.some((e) => e.kind === 'not_callable');
                const open = hasHours && !off && windowsOn(d, weekly, day).length > 0;
                const extra = day.some((e) => e.kind === 'callable');
                const roundEntries = day.filter((e) => e.kind === 'round');
                const inMonth = d.slice(0, 7) === date.slice(0, 7);
                return (
                  <a
                    key={d}
                    href={link('day', d)}
                    aria-label={`${dayLabel(d)}${roundEntries.length ? `, ${roundEntries.map((e) => e.roundName).join(', ')}` : ''}${off ? ', calls off' : ''}`}
                    className={`flex min-h-20 flex-col gap-0.5 border-b border-l border-ink/10 p-0.5 ${off ? 'bg-red-100/70' : open || !hasHours ? 'bg-white' : HATCH} ${inMonth ? '' : 'opacity-40'}`}
                  >
                    <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-sm ${d === today ? 'bg-amber-300 font-black' : ''}`}>{Number(d.slice(8))}</span>
                    {roundEntries.slice(0, 2).map((e) => {
                      const c = roundColour(Math.max(0, rounds.findIndex((r) => r.id === e.roundId)));
                      return (
                        <span key={e.id} className="truncate rounded border-l-[3px] px-0.5 text-[9px] font-semibold leading-tight" style={{ backgroundColor: c.fill, borderColor: c.accent }}>
                          {e.roundName}
                        </span>
                      );
                    })}
                    {roundEntries.length > 2 && <span className="text-center text-[9px] font-semibold text-ink/70">+{roundEntries.length - 2}</span>}
                    <span className="mt-auto text-center text-[9px] leading-none" aria-hidden>
                      {off ? '🚫' : extra ? '📞+' : ''}
                    </span>
                  </a>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 border-t border-ink/10 px-3 py-2 text-[10px] text-ink/70">
              <span>White: taking calls</span>
              <span>Hatched: no calls</span>
              <span>Red: calls off all day</span>
              <span>📞+: extra call hours</span>
              <span>Tap a day to open it</span>
            </div>
          </div>
        ) : (
          <CalendarGrid
            days={days}
            events={entries.map((e) => ({ id: e.id, date: e.onDate, kind: e.kind, roundId: e.roundId, roundName: e.roundName, starts: e.starts, ends: e.ends, note: e.note }))}
            rounds={rounds.map((r) => ({ id: r.id, name: r.name, weekday: r.weekday }))}
            today={today}
            back={back}
            alwaysOn={!hasHours}
          />
        )}
      </main>
    </>
  );
}
