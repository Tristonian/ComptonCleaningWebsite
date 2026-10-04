import { AdminBar } from '@/components/AdminBar';
import { MarkPaidForm, VisitForm } from '@/components/admin/VisitForm';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { listCustomers, listPaymentMethods, listRounds, todayLondon, type CustomerRow } from '@/lib/customers';
import { endOfWeek, listDebts, listPayments } from '@/lib/jobs';
import { recordVisitAction } from '../visit-actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Work', robots: { index: false, follow: false } };

const pounds = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const WEEKDAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Method = { key: string; label: string };

/** One customer on the work list: who and where, due / last / owing, and the DONE and MISSED controls. */
function Job({ c, methods, today, back }: { c: CustomerRow; methods: Method[]; today: string; back: string }) {
  const overdue = c.nextDue !== null && c.nextDue < today;
  return (
    <li className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-ink/10">
      <a href={`/admin/customers/${c.id}`} className="block">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-lg font-black">{c.address || c.name}</span>
          {c.pricePence !== null && <span className="shrink-0 font-bold text-brand-deep">{pounds(c.pricePence)}</span>}
        </span>
        <span className="block truncate text-sm text-ink/80">{c.address ? c.name : ''}</span>
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5 text-xs">
          {c.nextDue && <span className={overdue ? 'font-bold text-amber-800' : 'text-ink/70'}>Due {day(c.nextDue)}</span>}
          {c.lastDone && <span className="text-ink/70">Last {day(c.lastDone)}</span>}
          {c.owingPence > 0 && <span className="font-bold text-red-700">Owes {pounds(c.owingPence)}</span>}
        </span>
      </a>
      <div className="mt-3 flex gap-2">
        <details className="flex-1 [&[open]>summary]:hidden">
          <summary className="cursor-pointer list-none rounded-xl bg-brand-deep px-4 py-3 text-center text-lg font-black text-white">DONE</summary>
          <div className="mt-1 rounded-xl bg-paper p-3 ring-1 ring-ink/10">
            <VisitForm
              customerId={c.id}
              defaults={{ pricePence: c.pricePence, preferredPayment: c.preferredPayment }}
              methods={methods}
              today={today}
              back={back}
            />
          </div>
        </details>
        {/* One tap: a missed visit has no money, so there is nothing to fill in. */}
        <form action={recordVisitAction}>
          <input type="hidden" name="customerId" value={c.id} />
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="doneOn" value={today} />
          <button type="submit" name="status" value="missed" className="h-full rounded-xl px-4 py-3 text-lg font-black text-amber-900 ring-2 ring-amber-500">
            MISSED
          </button>
        </form>
      </div>
    </li>
  );
}

export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; round?: string; ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const view = sp.view === 'debts' || sp.view === 'payments' ? sp.view : 'due';
  const db = getDb();
  const today = todayLondon();
  const weekEnd = endOfWeek(today);
  const [everyone, rounds, methods] = await Promise.all([listCustomers({}, db), listRounds(db), listPaymentMethods(db)]);

  const round = rounds.find((r) => r.id === sp.round);
  const dueThisWeek = everyone.filter((c) => c.nextDue !== null && c.nextDue <= weekEnd).sort((a, b) => (a.nextDue! < b.nextDue! ? -1 : 1));
  const inRound = (c: CustomerRow) => !round || c.rounds.some((r) => r.id === round.id);
  const due = dueThisWeek.filter(inRound);
  const alsoDue = round ? dueThisWeek.filter((c) => !inRound(c)) : [];
  const alsoInRound = round ? everyone.filter((c) => inRound(c) && !dueThisWeek.includes(c)) : [];

  const [debts, payments] = await Promise.all([view === 'debts' ? listDebts(db) : [], view === 'payments' ? listPayments(db) : []]);

  const back = `/admin/work${view !== 'due' || round ? `?${new URLSearchParams({ ...(view !== 'due' ? { view } : {}), ...(round ? { round: round.id } : {}) })}` : ''}`;
  const tab = (key: string, label: string, n?: number) => (
    <a
      key={key}
      href={`/admin/work${key === 'due' ? '' : `?view=${key}`}`}
      aria-current={view === key ? 'page' : undefined}
      className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold ${view === key ? 'bg-brand-deep text-white' : 'text-brand-deep ring-1 ring-brand-deep/40'}`}
    >
      {label}
      {n !== undefined ? ` (${n})` : ''}
    </a>
  );

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-bold text-brand-deep">Work</h1>

        {sp.ok && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">{sp.ok}</p>}
        {sp.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{sp.error}</p>}

        <nav aria-label="Work" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tab('due', 'Due this week', dueThisWeek.length)}
          {tab('debts', 'Debts', everyone.filter((c) => c.owingPence > 0).length)}
          {tab('payments', 'Payments')}
        </nav>

        {view === 'due' && (
          <>
            {rounds.length > 0 && (
              <nav aria-label="Round" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <a href="/admin/work" aria-current={!round ? 'page' : undefined} className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold ${!round ? 'bg-amber-200 text-amber-950' : 'text-ink/80 ring-1 ring-ink/30'}`}>
                  Every round
                </a>
                {rounds.map((r) => (
                  <a
                    key={r.id}
                    href={`/admin/work?round=${r.id}`}
                    aria-current={round?.id === r.id ? 'page' : undefined}
                    className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold ${round?.id === r.id ? 'bg-amber-200 text-amber-950' : 'text-ink/80 ring-1 ring-ink/30'}`}
                  >
                    {r.name}
                    {r.weekday ? ` · ${WEEKDAY[r.weekday]}` : ''}
                  </a>
                ))}
              </nav>
            )}

            {due.length === 0 ? (
              <p className="rounded-xl bg-white p-6 text-center text-ink/70 ring-1 ring-ink/10">
                {everyone.length === 0
                  ? 'No customers yet. Add or import some first.'
                  : 'Nobody is due this week. Customers need a price and a "every … weeks" to show up here.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {due.map((c) => (
                  <Job key={c.id} c={c} methods={methods} today={today} back={back} />
                ))}
              </ul>
            )}

            {alsoDue.length > 0 && (
              <details className="rounded-xl bg-white p-3 ring-1 ring-ink/10">
                <summary className="cursor-pointer text-sm font-bold text-brand-deep">Also due this week, other rounds ({alsoDue.length})</summary>
                <ul className="mt-3 flex flex-col gap-2">
                  {alsoDue.map((c) => (
                    <Job key={c.id} c={c} methods={methods} today={today} back={back} />
                  ))}
                </ul>
              </details>
            )}
            {alsoInRound.length > 0 && (
              <details className="rounded-xl bg-white p-3 ring-1 ring-ink/10">
                <summary className="cursor-pointer text-sm font-bold text-brand-deep">Also in this round, not due yet ({alsoInRound.length})</summary>
                <ul className="mt-3 flex flex-col gap-2">
                  {alsoInRound.map((c) => (
                    <Job key={c.id} c={c} methods={methods} today={today} back={back} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        {view === 'debts' &&
          (debts.length === 0 ? (
            <p className="rounded-xl bg-white p-6 text-center text-ink/70 ring-1 ring-ink/10">Nobody owes anything.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {debts.map((d) => {
                const owner = everyone.find((c) => c.id === d.customerId);
                return (
                  <li key={d.jobId} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-ink/10">
                    <a href={`/admin/customers/${d.customerId}`} className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-black">{d.customerName}</span>
                      <span className="shrink-0 font-black text-red-700">{pounds(d.totalPence)}</span>
                    </a>
                    <p className="text-sm text-ink/70">{day(d.doneOn)}</p>
                    <div className="mt-2">
                      <MarkPaidForm jobId={d.jobId} methods={methods} back={back} preferred={owner?.preferredPayment} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ))}

        {view === 'payments' &&
          (payments.length === 0 ? (
            <p className="rounded-xl bg-white p-6 text-center text-ink/70 ring-1 ring-ink/10">No payments logged yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {payments.map((p) => (
                <li key={p.jobId}>
                  <a href={`/admin/customers/${p.customerId}`} className="flex items-baseline justify-between gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-ink/10">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{p.customerName}</span>
                      <span className="text-sm text-ink/70">
                        {day(p.doneOn)} · {methods.find((m) => m.key === p.paymentMethod)?.label ?? p.paymentMethod}
                      </span>
                    </span>
                    <span className="shrink-0 font-black text-brand-deep">{pounds(p.totalPence)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ))}
      </main>
    </>
  );
}
