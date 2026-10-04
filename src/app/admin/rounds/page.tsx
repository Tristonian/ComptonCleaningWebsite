import { AdminBar } from '@/components/AdminBar';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { listCustomers, listRoundOrder, listRounds } from '@/lib/customers';
import { addRoundAction } from '../customers/actions';
import { applyRoundPlanAction, moveInRoundAction, saveRoundAction } from '../settings/actions';
import { planRound } from '@/lib/round-plan';
import { formatDrive, mapsLinks } from '@/lib/route';
import { BASE } from '@/lib/weather';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rounds', robots: { index: false, follow: false } };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const input = 'rounded-xl border border-ink/20 bg-white p-3 text-base';
const arrow = 'flex h-11 w-11 items-center justify-center rounded-lg text-lg font-black text-brand-deep ring-1 ring-brand-deep/40 disabled:opacity-30';

export default async function RoundsPage({ searchParams }: { searchParams: Promise<{ round?: string; plan?: string; home?: string; ok?: string; error?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const db = getDb();
  const rounds = await listRounds(db);
  const round = rounds.find((r) => r.id === sp.round) ?? rounds[0];
  const [everyone, order] = round ? await Promise.all([listCustomers({ roundId: round.id }, db), listRoundOrder(round.id, db)]) : [[], []];
  const byId = new Map(everyone.map((c) => [c.id, c]));
  const stops = order.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const mode = sp.plan === 'due' ? 'due' : sp.plan === 'all' ? 'all' : null;
  const returnHome = sp.home !== '0';
  const plan = round && mode ? await planRound(round.id, { mode, returnHome, db }) : null;
  const planHref = (m: string, home = returnHome) => `/admin/rounds?round=${round?.id}&plan=${m}${home ? '' : '&home=0'}`;

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

            <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink/10">
              <h2 className="text-lg font-black text-brand-deep">🧭 Best order</h2>
              <p className="mt-1 text-sm text-ink/70">
                Works out the quickest way round using real drive times (a fast road counts for more than a lane), starting from home. Only customers with a pin on the map can be placed.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={planHref('all')} className="flex min-h-12 items-center justify-center rounded-xl px-3 text-center text-sm font-bold text-brand-deep ring-1 ring-brand-deep/40 active:bg-brand/10">
                  Whole round
                </a>
                <a href={planHref('due')} className="flex min-h-12 items-center justify-center rounded-xl px-3 text-center text-sm font-bold text-brand-deep ring-1 ring-brand-deep/40 active:bg-brand/10">
                  Due this week
                </a>
              </div>
              {mode && (
                <p className="mt-2 text-sm">
                  <a href={planHref(mode, !returnHome)} className="font-semibold text-brand-deep underline">
                    {returnHome ? 'Not coming back home at the end? Plan it that way' : 'Plan it coming back home at the end'}
                  </a>
                </p>
              )}

              {plan && (
                <div className="mt-4 border-t border-ink/10 pt-3">
                  {plan.note && <p className="mb-2 rounded-lg bg-amber-50 p-2 text-sm font-semibold text-amber-900">⚠️ {plan.note}</p>}
                  {plan.stops.length === 0 ? (
                    <p className="text-sm text-ink/70">
                      {mode === 'due' ? 'Nobody in this round is due this week with a pin on the map.' : 'Nobody in this round has a pin on the map yet.'} Use “Grab location” on a customer to give them one.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-bold">
                        {plan.stops.length} stop{plan.stops.length === 1 ? '' : 's'} · {formatDrive(plan.totalSeconds)} driving{plan.returnHome ? ' including the way home' : ''}
                        {plan.source === 'estimate' ? ' (estimated)' : ''}
                      </p>
                      {plan.currentSeconds - plan.totalSeconds >= 60 ? (
                        <p className="text-sm font-semibold text-green-800">Saves about {formatDrive(plan.currentSeconds - plan.totalSeconds)} compared with the order you have now.</p>
                      ) : (
                        <p className="text-sm text-ink/70">Your current order is already about as quick as it gets.</p>
                      )}
                      <ol className="mt-2 flex flex-col gap-1.5">
                        {plan.stops.map((c, i) => (
                          <li key={c.id} className="flex items-baseline gap-2 text-sm">
                            <span className="w-6 shrink-0 text-center font-black text-ink/60">{i + 1}</span>
                            <span className="min-w-0 flex-1 truncate font-semibold">{c.address || c.name}</span>
                            <span className="shrink-0 text-ink/70">{formatDrive(plan.legs[i])}</span>
                          </li>
                        ))}
                        {plan.returnHome && <li className="pl-8 text-sm text-ink/70">Home · {formatDrive(plan.legs[plan.legs.length - 1])}</li>}
                      </ol>
                      {plan.truncated > 0 && <p className="mt-2 text-sm text-amber-900">{plan.truncated} more stop{plan.truncated === 1 ? ' was' : 's were'} left out: one plan covers up to 36.</p>}
                      <form action={applyRoundPlanAction} className="mt-3">
                        <input type="hidden" name="roundId" value={round.id} />
                        {plan.stops.map((c) => (
                          <input key={c.id} type="hidden" name="ids" value={c.id} />
                        ))}
                        <button type="submit" className="w-full rounded-xl bg-brand-deep px-4 py-3 text-lg font-black text-white">
                          Use this order
                        </button>
                      </form>
                      <div className="mt-2 flex flex-col gap-2">
                        {mapsLinks(BASE, plan.stops, plan.returnHome).map((l) => (
                          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center rounded-xl text-base font-bold text-brand-deep ring-1 ring-brand-deep/40 active:bg-brand/10">
                            🗺️ {l.label}
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                  {plan.unlocated.length > 0 && (
                    <p className="mt-3 text-sm text-ink/70">
                      No pin yet, so not placed: {plan.unlocated.map((u, i) => (
                        <span key={u.id}>
                          {i > 0 && ', '}
                          <a href={`/admin/customers/${u.id}`} className="underline">
                            {u.name}
                          </a>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              )}
            </section>

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
