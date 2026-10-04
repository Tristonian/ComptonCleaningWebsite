import { AdminBar } from '@/components/AdminBar';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { listPaymentMethods, todayLondon } from '@/lib/customers';
import { cleanRange, fillWeeks, getEarnings, monthRangeOf } from '@/lib/earnings';
import { addDays, shiftMonth, weekStart } from '@/lib/schedule-shared';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Earnings', robots: { index: false, follow: false } };

const pounds = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
const short = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const card = 'rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink/10';
const h2 = 'mb-3 text-lg font-black text-brand-deep';

/** Earnings reports: money actually received, like HairByRachel's, on the day it came in. */
export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const today = todayLondon();
  const thisWeek = { from: weekStart(today), to: addDays(weekStart(today), 6) };
  const thisMonth = monthRangeOf(today);
  const { from, to } = cleanRange(sp.from, sp.to, thisMonth);

  const db = getDb();
  const [e, methods] = await Promise.all([getEarnings(from, to, db), listPaymentMethods(db)]);
  const label = (key: string) => methods.find((m) => m.key === key)?.label ?? (key || 'Not recorded');
  const weeks = fillWeeks(from, to, e.byWeek);
  const peak = Math.max(1, ...weeks.map((w) => w.pence));

  const presets = [
    { label: 'Today', ...{ from: today, to: today } },
    { label: 'This week', ...thisWeek },
    { label: 'This month', ...thisMonth },
    { label: 'Last month', ...monthRangeOf(shiftMonth(today, -1)) },
    { label: 'This year', from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` },
  ];

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold text-brand-deep">Earnings</h1>
          <a href="/admin/work?view=debts" className="text-sm font-semibold text-brand-deep underline">
            Debts
          </a>
        </div>
        <p className="text-sm text-ink/70">Money actually received, counted on the day it came in. Visits not yet paid are not included; they show as owed.</p>

        <nav aria-label="Period" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {presets.map((p) => (
            <a
              key={p.label}
              href={`/admin/earnings?from=${p.from}&to=${p.to}`}
              aria-current={from === p.from && to === p.to ? 'page' : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold ${from === p.from && to === p.to ? 'bg-brand-deep text-white' : 'text-brand-deep ring-1 ring-brand-deep/40'}`}
            >
              {p.label}
            </a>
          ))}
        </nav>

        <form action="/admin/earnings" className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-ink/80">
            From
            <input type="date" name="from" defaultValue={from} className="mt-1 block rounded-xl border border-ink/20 bg-white p-2 text-base font-normal" />
          </label>
          <label className="text-xs font-semibold text-ink/80">
            To
            <input type="date" name="to" defaultValue={to} className="mt-1 block rounded-xl border border-ink/20 bg-white p-2 text-base font-normal" />
          </label>
          <button type="submit" className="rounded-xl px-4 py-2.5 text-sm font-bold text-brand-deep ring-1 ring-brand-deep/40">
            Apply
          </button>
        </form>

        <section className={card}>
          <p className="text-sm text-ink/70">
            Received, {short(from)} – {short(to)}
          </p>
          <p className="text-4xl font-black text-brand-deep">{pounds(e.collectedPence)}</p>
          <p className="mt-1 text-sm text-ink/70">
            {e.paidVisits} paid visit{e.paidVisits === 1 ? '' : 's'}
            {e.paidVisits > 0 && ` · average ${pounds(Math.round(e.collectedPence / e.paidVisits))}`}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-ink/10 pt-3 text-center text-sm">
            <div>
              <dt className="text-xs text-ink/70">Visits done</dt>
              <dd className="font-black">{e.doneVisits}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink/70">Work done</dt>
              <dd className="font-black">{pounds(e.workedPence)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink/70">Missed</dt>
              <dd className="font-black">{e.missedVisits}</dd>
            </div>
          </dl>
          {e.outstandingPence > 0 && (
            <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-800">
              {pounds(e.outstandingPence)} still owed across {e.outstandingVisits} visit{e.outstandingVisits === 1 ? '' : 's'} (all time).{' '}
              <a href="/admin/work?view=debts" className="underline">
                See who
              </a>
            </p>
          )}
        </section>

        {weeks.length > 1 && (
          <section className={card} aria-label="Received by week">
            <h2 className={h2}>By week</h2>
            <ol className="flex flex-col gap-1.5">
              {weeks.map((w) => (
                <li key={w.weekStart} className="grid grid-cols-[4.5rem_1fr_4rem] items-center gap-2 text-sm">
                  <span className="text-ink/70">{short(w.weekStart)}</span>
                  <span className="h-4 overflow-hidden rounded bg-ink/5">
                    <span className="block h-full rounded bg-brand-deep" style={{ width: `${(w.pence / peak) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold">{pounds(w.pence)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-ink/70">Weeks start on Monday.</p>
          </section>
        )}

        <section className={card}>
          <h2 className={h2}>How they paid</h2>
          {e.byMethod.length === 0 ? (
            <p className="text-sm text-ink/70">Nothing received in this period.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {e.byMethod.map((m) => (
                <li key={m.method} className="flex justify-between text-sm">
                  <span className="text-ink/80">{label(m.method)}</span>
                  <span className="font-semibold">{pounds(m.pence)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h2 className={h2}>Top extras</h2>
          {e.topExtras.length === 0 ? (
            <p className="text-sm text-ink/70">No extras (conservatory, gutters…) in this period.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {e.topExtras.map((x) => (
                <li key={x.label} className="flex justify-between text-sm">
                  <span className="text-ink/80">
                    {x.label} <span className="text-xs">×{x.times}</span>
                  </span>
                  <span className="font-semibold">{pounds(x.pence)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h2 className={h2}>Top customers</h2>
          {e.topCustomers.length === 0 ? (
            <p className="text-sm text-ink/70">Nobody has paid in this period.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {e.topCustomers.map((c) => (
                <li key={c.id}>
                  <a href={`/admin/customers/${c.id}`} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-ink/80">
                      {c.name} <span className="text-xs">×{c.visits}</span>
                    </span>
                    <span className="shrink-0 font-semibold">{pounds(c.pence)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <a
          href={`/api/admin/earnings/export?from=${from}&to=${to}`}
          className="flex min-h-12 items-center justify-center rounded-xl text-base font-bold text-brand-deep ring-1 ring-brand-deep/40 active:bg-brand/10"
        >
          ⬇ Download as a spreadsheet (CSV)
        </a>
      </main>
    </>
  );
}
