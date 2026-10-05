'use client';

import { useEffect, useState } from 'react';
import { addEntryAction, deleteEntryAction } from '@/app/admin/calendar/actions';
import { saveCallHoursAction } from '@/app/admin/settings/actions';
import { DEFAULT_ROUND_MINUTES, assignLanes, fromMinutes, hourRange, laneStyle, roundColour, snapQuarter, toMinutes } from '@/lib/schedule-shared';

/**
 * Sam's calendar as a time grid, laid out like HairByRachel's: a time gutter and one column per day (one
 * for the day view, seven for the week). Call hours are the white bands (extra ones greener, with a dashed
 * edge); everything outside them is hatched, so "can they ring me now" reads at a glance. Rounds are
 * coloured blocks (side by side when they overlap); a round with no time sits in the all-day strip. A red
 * wash with "Calls off" marks a day off. A line marks the time now. Tap an empty bit of a column to add
 * something at that time, a block to see or remove it, a day heading to change that day.
 */

export type GridWindow = { opens: string; closes: string; extra: boolean };
export type GridDay = {
  date: string;
  weekday: number;
  /** The windows calls are taken in on this day (usual plus extra); empty when the day is off. */
  windows: GridWindow[];
  /** The usual windows for this weekday, for the "change every Tuesday" form. */
  usual: { opens: string; closes: string }[];
  /** The id of the "calls off" entry, when the day is off. */
  offId: string | null;
};
export type GridEvent = {
  id: string;
  date: string;
  kind: 'round' | 'callable' | 'not_callable';
  roundId: string | null;
  roundName: string | null;
  starts: string | null;
  ends: string | null;
  note: string;
};
export type GridRound = { id: string; name: string; weekday: number | null };

const PX_PER_HOUR = 56;
const QUARTER = PX_PER_HOUR / 4;
const HATCH = 'bg-[repeating-linear-gradient(135deg,#f6f3ee,#f6f3ee_6px,#e9e4dc_6px,#e9e4dc_12px)]';
const field = 'rounded-xl border border-ink/20 bg-white p-3 text-base font-normal text-ink';
const WEEKDAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type Selection = { type: 'slot'; date: string; minutes: number } | { type: 'event'; id: string } | { type: 'day'; date: string } | null;

const dayName = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });

export function CalendarGrid({
  days,
  events,
  rounds,
  today,
  back,
  alwaysOn = false,
}: {
  days: GridDay[];
  events: GridEvent[];
  rounds: GridRound[];
  today: string;
  back: string;
  /** No call hours are set, so the website always shows the Call button: nothing is hatched as "no calls". */
  alwaysOn?: boolean;
}) {
  const [selected, setSelected] = useState<Selection>(null);
  const cols = days.length;
  const colourOf = (roundId: string | null) => roundColour(Math.max(0, rounds.findIndex((r) => r.id === roundId)));

  // The hours shown: 07:00-19:00 at least, widened for anything outside it.
  const spans: { start: number; end: number }[] = [];
  for (const d of days) for (const w of d.windows) spans.push({ start: toMinutes(w.opens), end: toMinutes(w.closes) });
  for (const e of events) {
    if (e.kind === 'not_callable' || !e.starts) continue;
    const start = toMinutes(e.starts);
    spans.push({ start, end: e.ends ? toMinutes(e.ends) : start + DEFAULT_ROUND_MINUTES });
  }
  const { minHour, maxHour } = hourRange(spans);
  const totalHours = maxHour - minHour;
  const bodyHeight = totalHours * PX_PER_HOUR;
  const topFor = (minutes: number) => ((minutes - minHour * 60) / 60) * PX_PER_HOUR;
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => minHour + i);

  // "Now" starts null so the server and the first browser render agree; the clock only runs in the browser.
  const [now, setNow] = useState<{ date: string; minutes: number } | null>(null);
  useEffect(() => {
    const tick = () => {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
          .formatToParts(new Date())
          .map((p) => [p.type, p.value]),
      );
      setNow({ date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) });
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const timed = events.filter((e) => e.kind === 'round' && e.starts);
  const allDay = events.filter((e) => e.kind === 'round' && !e.starts);
  const selectedEvent = selected?.type === 'event' ? events.find((e) => e.id === selected.id) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-sm">
        {/* Day headings */}
        <div className="grid" style={{ gridTemplateColumns: `30px repeat(${cols}, minmax(0, 1fr))` }}>
          <div className="border-b border-ink/10" />
          {days.map((d) => {
            const isToday = d.date === today;
            const off = d.offId !== null;
            const noCalls = !off && !alwaysOn && d.windows.length === 0;
            const selectedDay = selected?.type === 'day' && selected.date === d.date;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelected({ type: 'day', date: d.date })}
                aria-label={`${dayName(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}: change this day`}
                className={`min-h-0 border-b border-l border-ink/10 py-1 text-center ${isToday ? 'bg-amber-100' : ''} ${selectedDay ? 'ring-2 ring-inset ring-brand-deep' : ''}`}
              >
                <span className="block text-[10px] uppercase text-ink/70">{dayName(d.date, { weekday: 'short' })}</span>
                <span className={`block text-sm ${isToday ? 'font-black' : ''}`}>{Number(d.date.slice(8))}</span>
                <span className="block h-3 text-[9px] leading-3" aria-hidden>
                  {off ? '🚫' : noCalls ? '' : '📞'}
                </span>
                {cols === 1 && (
                  <span className="block text-[11px] font-semibold text-brand-deep underline">
                    {off ? 'Calls off. Change' : 'Change this day'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Rounds with no time of day */}
        {allDay.length > 0 && (
          <div className="grid border-b border-ink/10" style={{ gridTemplateColumns: `30px repeat(${cols}, minmax(0, 1fr))` }}>
            <div className="flex items-center justify-end pr-1 text-[8px] font-medium text-ink/60">all day</div>
            {days.map((d) => (
              <div key={d.date} className="flex min-w-0 flex-col gap-0.5 border-l border-ink/10 p-0.5">
                {allDay
                  .filter((e) => e.date === d.date)
                  .map((e) => {
                    const c = colourOf(e.roundId);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setSelected({ type: 'event', id: e.id })}
                        className={`min-h-0 truncate rounded border border-l-[3px] px-1 py-0.5 text-left text-[9px] font-semibold leading-tight text-ink ${selected?.type === 'event' && selected.id === e.id ? 'ring-2 ring-brand-deep' : ''}`}
                        style={{ backgroundColor: c.fill, borderColor: c.accent }}
                      >
                        {e.roundName}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        )}

        {/* The time grid */}
        <div className="grid" style={{ gridTemplateColumns: `30px repeat(${cols}, minmax(0, 1fr))` }}>
          <div className="relative" style={{ height: bodyHeight }}>
            {hours.map((h, i) => (
              <div key={h} className="absolute right-1 -translate-y-1/2 text-[9px] font-medium text-ink/70" style={{ top: i * PX_PER_HOUR }}>
                {i === 0 ? '' : `${h}:00`}
              </div>
            ))}
          </div>

          {days.map((d) => {
            const dayEvents = timed.filter((e) => e.date === d.date).map((e) => {
              const start = toMinutes(e.starts as string);
              return { e, start, end: e.ends ? toMinutes(e.ends) : start + DEFAULT_ROUND_MINUTES };
            });
            const lanes = assignLanes(dayEvents.map(({ e, start, end }) => ({ id: e.id, start, end })));
            const off = d.offId !== null;
            return (
              <div
                key={d.date}
                className={`relative cursor-pointer overflow-hidden border-l border-ink/10 ${alwaysOn ? 'bg-white' : HATCH}`}
                style={{ height: bodyHeight }}
                onClick={(ev) => {
                  const box = ev.currentTarget.getBoundingClientRect();
                  const raw = minHour * 60 + ((ev.clientY - box.top) / PX_PER_HOUR) * 60;
                  setSelected({ type: 'slot', date: d.date, minutes: Math.min(Math.max(snapQuarter(raw), minHour * 60), maxHour * 60 - 15) });
                }}
              >
                {/* Call hours: bright bands on the hatch */}
                {d.windows.map((w, i) => (
                  <div
                    key={i}
                    aria-hidden
                    className={`pointer-events-none absolute inset-x-0 ${w.extra ? 'border border-dashed border-green-600/60 bg-green-50' : 'bg-white'}`}
                    style={{ top: topFor(toMinutes(w.opens)), height: ((toMinutes(w.closes) - toMinutes(w.opens)) / 60) * PX_PER_HOUR }}
                  />
                ))}
                {/* Hour and quarter-hour lines */}
                {hours.map((h, i) => (
                  <div key={h} className="pointer-events-none">
                    <div className="absolute inset-x-0 border-t border-ink/10" style={{ top: i * PX_PER_HOUR }} />
                    {i < totalHours &&
                      [1, 2, 3].map((q) => <div key={q} className="absolute inset-x-0 border-t border-ink/5" style={{ top: i * PX_PER_HOUR + q * QUARTER }} />)}
                  </div>
                ))}
                {off && (
                  <div aria-hidden className="pointer-events-none absolute inset-0 bg-red-100/60">
                    <span className="mt-1 block text-center text-[9px] font-bold uppercase tracking-wide text-red-800">Calls off</span>
                  </div>
                )}
                {/* The slot being added to */}
                {selected?.type === 'slot' && selected.date === d.date && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-brand-deep" style={{ top: topFor(selected.minutes) }}>
                    <span className="absolute -top-2 left-0 rounded-r bg-brand-deep px-1 text-[9px] font-bold text-white">{fromMinutes(selected.minutes)}</span>
                  </div>
                )}
                {/* Timed rounds */}
                {dayEvents.map(({ e, start, end }) => {
                  const c = colourOf(e.roundId);
                  const placement = lanes.get(e.id) ?? { lane: 0, lanes: 1 };
                  const { left, width } = laneStyle(placement);
                  const height = Math.max(16, ((end - start) / 60) * PX_PER_HOUR);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelected({ type: 'event', id: e.id });
                      }}
                      title={`${e.roundName} from ${e.starts}${e.ends ? ` to ${e.ends}` : ''}`}
                      className={`absolute min-h-0 overflow-hidden rounded-md border border-l-[3px] px-1 py-0.5 text-left text-[9px] leading-tight text-ink ${selected?.type === 'event' && selected.id === e.id ? 'ring-2 ring-brand-deep' : ''}`}
                      style={{ top: topFor(start), height, left, width, backgroundColor: c.fill, borderColor: c.accent }}
                    >
                      <span className="block truncate font-semibold">{e.roundName}</span>
                      {height >= 30 && placement.lanes === 1 && <span className="block truncate text-ink/70">{e.starts}{e.ends ? `–${e.ends}` : ''}</span>}
                    </button>
                  );
                })}
                {/* The time now, on today only */}
                {now && now.date === d.date && now.minutes >= minHour * 60 && now.minutes <= maxHour * 60 && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 -translate-y-1/2" style={{ top: topFor(now.minutes) }}>
                    <div className="h-0.5 w-full bg-red-500" />
                    <div className="absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-red-500 ring-1 ring-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Key */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-ink/10 px-3 py-2 text-[10px] text-ink/70">
          {rounds.map((r, i) => {
            const c = roundColour(i);
            return (
              <span key={r.id} className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm border border-l-[3px]" style={{ backgroundColor: c.fill, borderColor: c.accent }} />
                {r.name}
              </span>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-ink/10 px-3 py-2 text-[10px] text-ink/70">
          <Key className="bg-white ring-1 ring-ink/20" label="Taking calls" />
          <Key className="border border-dashed border-green-600/60 bg-green-50" label="Extra call hours" />
          <Key className={HATCH} label="No calls" />
          <Key className="bg-red-100" label="Calls off all day" />
        </div>
      </div>

      {selected === null && <p className="px-1 text-sm text-ink/70">Tap an empty bit of a day to add a round or call hours at that time. Tap a block to remove it. Tap a day’s heading to change that day.</p>}

      {selected?.type === 'slot' && <AddPanel key={`${selected.date}-${selected.minutes}`} date={selected.date} minutes={selected.minutes} rounds={rounds} back={back} onClose={() => setSelected(null)} />}
      {selectedEvent && <EventPanel event={selectedEvent} back={back} onClose={() => setSelected(null)} />}
      {selected?.type === 'day' && (() => {
        const day = days.find((d) => d.date === selected.date);
        return day ? <DayPanel key={day.date} day={day} rounds={rounds} back={back} onClose={() => setSelected(null)} /> : null;
      })()}
    </div>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

const panel = 'rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink/10';
const closeBtn = 'rounded-lg px-3 py-1.5 text-sm font-bold text-ink/70 ring-1 ring-ink/20';

function AddPanel({ date, minutes, rounds, back, onClose }: { date: string; minutes: number; rounds: GridRound[]; back: string; onClose: () => void }) {
  const [kind, setKind] = useState<'round' | 'callable'>('round');
  const [starts, setStarts] = useState(fromMinutes(minutes));
  const [ends, setEnds] = useState(fromMinutes(Math.min(minutes + 60, 24 * 60 - 1)));
  return (
    <section className={panel}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-black text-brand-deep">
          {dayName(date, { weekday: 'long', day: 'numeric', month: 'short' })} at {fromMinutes(minutes)}
        </h2>
        <button type="button" onClick={onClose} className={closeBtn}>
          Close
        </button>
      </div>
      <form action={addEntryAction} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="onDate" value={date} />
        <input type="hidden" name="back" value={back} />
        <input type="hidden" name="kind" value={kind} />
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="What to add">
          {([['round', '🔁 A round'], ['callable', '📞 Extra call hours']] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-12 rounded-xl px-3 text-sm font-bold ${kind === k ? 'bg-brand-deep text-white' : 'text-brand-deep ring-1 ring-brand-deep/40'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {kind === 'round' && (
          <label className="text-sm font-semibold text-ink/80">
            Which round
            <select name="roundId" required defaultValue={rounds[0]?.id ?? ''} className={`${field} mt-1 block w-full`}>
              {rounds.length === 0 && <option value="">No rounds yet (add one in Settings → Rounds)</option>}
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold text-ink/80">
            From
            <input type="time" name="starts" value={starts} onChange={(e) => setStarts(e.target.value)} className={`${field} mt-1 w-full`} />
          </label>
          <label className="text-sm font-semibold text-ink/80">
            Until {kind === 'round' && <span className="font-normal">(optional)</span>}
            <input type="time" name="ends" value={ends} onChange={(e) => setEnds(e.target.value)} className={`${field} mt-1 w-full`} />
          </label>
        </div>
        <label className="text-sm font-semibold text-ink/80">
          Note (optional)
          <input name="note" maxLength={200} className={`${field} mt-1 w-full`} />
        </label>
        <button type="submit" className="rounded-xl bg-brand-deep px-4 py-3 text-lg font-black text-white">
          Add
        </button>
        {kind === 'round' && <p className="text-xs text-ink/70">With no finish time a round is drawn one hour long. Clear “From” to put it in the all-day strip.</p>}
      </form>
    </section>
  );
}

function EventPanel({ event, back, onClose }: { event: GridEvent; back: string; onClose: () => void }) {
  return (
    <section className={panel}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-black text-brand-deep">
          {event.kind === 'round' ? `🔁 ${event.roundName ?? 'Round'}` : event.kind === 'callable' ? '📞 Extra call hours' : '🚫 Calls off'}
        </h2>
        <button type="button" onClick={onClose} className={closeBtn}>
          Close
        </button>
      </div>
      <p className="mt-1 text-sm text-ink/80">
        {dayName(event.date, { weekday: 'long', day: 'numeric', month: 'long' })}
        {event.starts ? `, ${event.starts}${event.ends ? ` to ${event.ends}` : ''}` : event.kind === 'round' ? ', all day' : ''}
      </p>
      {event.note && <p className="mt-1 text-sm text-ink/70">{event.note}</p>}
      {event.kind === 'round' && (
        <a href={`/admin/work?round=${event.roundId}`} className="mt-2 inline-block text-sm font-bold text-brand-deep underline">
          Open this round on the Work screen
        </a>
      )}
      <form action={deleteEntryAction} className="mt-3">
        <input type="hidden" name="id" value={event.id} />
        <input type="hidden" name="back" value={back} />
        <button type="submit" className="min-h-12 w-full rounded-xl text-base font-bold text-red-800 ring-1 ring-red-300 active:bg-red-50">
          Remove this
        </button>
      </form>
    </section>
  );
}

function DayPanel({ day, rounds, back, onClose }: { day: GridDay; rounds: GridRound[]; back: string; onClose: () => void }) {
  const [open, setOpen] = useState(day.usual.length > 0);
  const usualRounds = rounds.filter((r) => r.weekday === day.weekday);
  const first = day.usual[0] ?? { opens: '09:00', closes: '17:00' };
  return (
    <section className={panel}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-black text-brand-deep">{dayName(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        <button type="button" onClick={onClose} className={closeBtn}>
          Close
        </button>
      </div>
      <p className="mt-1 text-sm text-ink/80">
        {day.offId ? '📞 Calls are off all day.' : day.windows.length ? `📞 Calls ${day.windows.map((w) => `${w.opens}–${w.closes}`).join(', ')}.` : '📞 No calls this day.'}
      </p>

      {/* Just this date */}
      {day.offId ? (
        <form action={deleteEntryAction} className="mt-3">
          <input type="hidden" name="id" value={day.offId} />
          <input type="hidden" name="back" value={back} />
          <button type="submit" className="min-h-12 w-full rounded-xl text-base font-bold text-brand-deep ring-1 ring-brand-deep/40">
            Allow calls again this day
          </button>
        </form>
      ) : (
        <form action={addEntryAction} className="mt-3">
          <input type="hidden" name="onDate" value={day.date} />
          <input type="hidden" name="kind" value="not_callable" />
          <input type="hidden" name="back" value={back} />
          <button type="submit" className="min-h-12 w-full rounded-xl text-base font-bold text-red-800 ring-1 ring-red-300 active:bg-red-50">
            🚫 No calls this day (day off)
          </button>
        </form>
      )}

      {rounds.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-bold text-ink/80">Add a round for the whole day</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {(usualRounds.length ? usualRounds : rounds).map((r) => (
              <form key={r.id} action={addEntryAction}>
                <input type="hidden" name="onDate" value={day.date} />
                <input type="hidden" name="kind" value="round" />
                <input type="hidden" name="roundId" value={r.id} />
                <input type="hidden" name="back" value={back} />
                <button type="submit" className="rounded-full px-3 py-2 text-sm font-bold text-brand-deep ring-1 ring-dashed ring-brand-deep/60">
                  + {r.name}
                  {usualRounds.length ? ' (usual)' : ''}
                </button>
              </form>
            ))}
          </div>
        </div>
      )}

      {/* Every week */}
      <form action={saveCallHoursAction} className="mt-4 rounded-xl bg-paper p-3 ring-1 ring-ink/10">
        <input type="hidden" name="weekday" value={day.weekday} />
        <input type="hidden" name="back" value={back} />
        <label className="flex items-center gap-3 font-bold">
          <input type="checkbox" name="open" checked={open} onChange={(e) => setOpen(e.target.checked)} className="h-5 w-5" />
          Usually take calls on {WEEKDAYS[day.weekday]}s
        </label>
        {open && (
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            {[0, 1].map((n) => (
              <div key={n} className="contents">
                <input type="time" name={`opens${n}`} defaultValue={day.usual[n]?.opens ?? (n === 0 ? first.opens : '')} aria-label={`Window ${n + 1} from`} className={field} />
                <span className="text-sm text-ink/70">to</span>
                <input type="time" name={`closes${n}`} defaultValue={day.usual[n]?.closes ?? (n === 0 ? first.closes : '')} aria-label={`Window ${n + 1} until`} className={field} />
              </div>
            ))}
          </div>
        )}
        <button type="submit" className="mt-2 rounded-xl px-4 py-2 text-sm font-bold text-brand-deep ring-1 ring-brand-deep/40">
          Save every {WEEKDAYS[day.weekday]}
        </button>
      </form>
    </section>
  );
}
