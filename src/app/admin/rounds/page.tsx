import { AdminBar } from '@/components/AdminBar';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { listCustomers, listRoundOrder, listRounds } from '@/lib/customers';
import { addRoundAction } from '../customers/actions';
import { moveInRoundAction, saveRoundAction } from '../settings/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rounds', robots: { index: false, follow: false } };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const input = 'rounded-xl border border-ink/20 bg-white p-3 text-base';
const arrow = 'flex h-11 w-11 items-center justify-center rounded-lg text-lg font-black text-brand-deep ring-1 ring-brand-deep/40 disabled:opacity-30';

export default async function RoundsPage({ searchParams }: { searchParams: Promise<{ round?: string; ok?: string; error?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const db = getDb();
  const rounds = await listRounds(db);
  const round = rounds.find((r) => r.id === sp.round) ?? rounds[0];
  const [everyone, order] = round ? await Promise.all([listCustomers({ roundId: round.id }, db), listRoundOrder(round.id, db)]) : [[], []];
  const byId = new Map(everyone.map((c) => [c.id, c]));
  const stops = order.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold text-brand-deep">Rounds</h1>
          <a href="/admin/settings" className="text-sm font-semibold text-brand-deep underline">
            Settings
          </a>
        </div>
        {sp.ok && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">{sp.ok}</p>}
        {sp.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{sp.error}</p>}

        {rounds.length > 0 && (
          <nav aria-label="Round" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {rounds.map((r) => (
              <a
                key={r.id}
                href={`/admin/rounds?round=${r.id}`}
                aria-current={round?.id === r.id ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold ${round?.id === r.id ? 'bg-amber-200 text-amber-950' : 'text-ink/80 ring-1 ring-ink/30'}`}
              >
                {r.name} ({r.customers})
              </a>
            ))}
          </nav>
        )}

        {round ? (
          <>
            <form action={saveRoundAction} className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink/10">
              <input type="hidden" name="id" value={round.id} />
              <label className="min-w-0 flex-1 text-sm font-semibold text-ink/80">
                Name
                <input name="name" required defaultValue={round.name} className={`${input} mt-1 w-full font-normal`} />
              </label>
              <label className="text-sm font-semibold text-ink/80">
                Usual day
                <select name="weekday" defaultValue={round.weekday ?? ''} className={`${input} mt-1 block font-normal`}>
                  <option value="">Any</option>
                  {DAYS.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="rounded-xl bg-brand-deep px-4 py-3 font-bold text-white">
                Save
              </button>
            </form>

            <section>
              <h2 className="text-lg font-black text-brand-deep">Order of stops</h2>
              <p className="mb-2 text-sm text-ink/70">The order you work this round. The Work screen lists a round in this order.</p>
              {stops.length === 0 ? (
                <p className="rounded-xl bg-white p-6 text-center text-ink/70 ring-1 ring-ink/10">
                  Nobody is in this round yet. Add people from the customer page, or use “Set up several” on the Customers screen.
                </p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {stops.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-ink/10">
                      <span className="w-6 shrink-0 text-center font-black text-ink/60">{i + 1}</span>
                      <a href={`/admin/customers/${c.id}`} className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{c.address || c.name}</span>
                        <span className="block truncate text-sm text-ink/70">{c.address ? c.name : ''}</span>
                      </a>
                      {(['up', 'down'] as const).map((step) => (
                        <form key={step} action={moveInRoundAction}>
                          <input type="hidden" name="roundId" value={round.id} />
                          <input type="hidden" name="customerId" value={c.id} />
                          <input type="hidden" name="step" value={step} />
                          <button type="submit" disabled={step === 'up' ? i === 0 : i === stops.length - 1} aria-label={`Move ${c.name} ${step}`} className={arrow}>
                            {step === 'up' ? '↑' : '↓'}
                          </button>
                        </form>
                      ))}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        ) : (
          <p className="rounded-xl bg-white p-6 text-center text-ink/70 ring-1 ring-ink/10">No rounds yet. Add one below.</p>
        )}

        <details className="rounded-xl bg-white p-3 ring-1 ring-ink/10" open={rounds.length === 0}>
          <summary className="cursor-pointer text-sm font-bold text-brand-deep">Add a round</summary>
          <form action={addRoundAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="back" value="/admin/rounds" />
            <label className="min-w-0 flex-1 text-sm font-semibold text-ink/80">
              Name
              <input name="name" required placeholder="Nash" className={`${input} mt-1 w-full font-normal`} />
            </label>
            <label className="text-sm font-semibold text-ink/80">
              Day
              <select name="weekday" className={`${input} mt-1 block font-normal`}>
                <option value="">Any</option>
                {DAYS.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-xl bg-brand-deep px-4 py-3 font-bold text-white">
              Add
            </button>
          </form>
        </details>
      </main>
    </>
  );
}
