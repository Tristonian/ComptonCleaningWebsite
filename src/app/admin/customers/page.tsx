import { AdminBar } from '@/components/AdminBar';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { listCustomers, listPaymentMethods, listRounds, todayLondon, type CustomerRow, type Filter } from '@/lib/customers';
import { addRoundAction, bulkSetupAction } from './actions';
import { COMING_TOMORROW, fillTemplate, firstNameOf } from '@/lib/message-templates';
import { getTemplate } from '@/lib/templates';
import { isUkMobile, smsLink, telLink, whatsappLink } from '@/lib/phone';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Customers', robots: { index: false, follow: false } };

const pounds = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'due', label: 'Due' },
  { key: 'owing', label: 'Owing' },
  { key: 'unset', label: 'To set up' },
];
const btn = 'flex min-h-11 items-center justify-center rounded-lg px-2 text-center text-sm font-bold text-brand-deep ring-1 ring-brand-deep/40 active:bg-brand/10';
const topBtn = 'flex min-h-12 items-center justify-center rounded-xl px-4 text-center text-base font-bold text-brand-deep ring-1 ring-brand-deep/40 active:bg-brand/10';

function Row({ c, today, comingTomorrow }: { c: CustomerRow; today: string; comingTomorrow: string | null }) {
  const overdue = c.nextDue !== null && c.nextDue <= today;
  const message = comingTomorrow === null ? null : fillTemplate(comingTomorrow, { first_name: firstNameOf(c.name) });
  return (
    <li className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink/10">
      <a href={`/admin/customers/${c.id}`} className="flex flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-lg font-black">{c.name}</span>
          {c.pricePence !== null && <span className="shrink-0 font-bold text-brand-deep">{pounds(c.pricePence)}</span>}
        </span>
        <span className="truncate text-sm text-ink/80">
          {[c.address, c.postcode].filter(Boolean).join(', ') || 'No address yet'}
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs">
          {c.frequencyWeeks && <span className="text-ink/70">Every {c.frequencyWeeks} wk</span>}
          {c.lastDone && <span className="text-ink/70">Last {shortDate(c.lastDone)}</span>}
          {c.nextDue && (
            <span className={overdue ? 'font-bold text-amber-800' : 'text-ink/70'}>
              {overdue ? 'Due' : 'Next'} {shortDate(c.nextDue)}
            </span>
          )}
          {c.owingPence > 0 && <span className="font-bold text-red-700">Owes {pounds(c.owingPence)}</span>}
          {c.rounds.map((r) => (
            <span key={r.id} className="rounded-full bg-brand/10 px-2 font-semibold text-brand-deep">
              {r.name}
            </span>
          ))}
        </span>
      </a>
      {c.phone && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <a href={telLink(c.phone)} className={`${btn} ${isUkMobile(c.phone) ? '' : 'col-span-3'}`}>
            📞 Call
          </a>
          {isUkMobile(c.phone) && (
            <>
              <a href={smsLink(c.phone)} className={btn}>
                💬 Text
              </a>
              <a href={whatsappLink(c.phone)} className={btn} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              {message !== null && (
                <a href={smsLink(c.phone, message)} className={`${btn} col-span-3`} title={message}>
                  ⏰ Coming tomorrow
                </a>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; round?: string; bulk?: string; ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const filter: Filter = sp.filter === 'due' || sp.filter === 'owing' || sp.filter === 'unset' ? sp.filter : 'all';
  const bulk = sp.bulk === '1';
  const db = getDb();
  const today = todayLondon();
  const [rows, everyone, rounds, comingTomorrowTemplate, methods] = await Promise.all([
    listCustomers({ filter, q: sp.q, roundId: sp.round, today }, db),
    listCustomers({}, db),
    listRounds(db),
    getTemplate(COMING_TOMORROW, db),
    listPaymentMethods(db),
  ]);
  const comingTomorrow = comingTomorrowTemplate?.enabled === false ? null : (comingTomorrowTemplate?.body ?? null);
  const counts = {
    all: everyone.length,
    due: everyone.filter((c) => c.nextDue !== null && c.nextDue <= today).length,
    owing: everyone.filter((c) => c.owingPence > 0).length,
    unset: everyone.filter((c) => c.pricePence === null || c.frequencyWeeks === null).length,
  };
  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { filter: filter === 'all' ? undefined : filter, q: sp.q, round: sp.round, bulk: bulk ? '1' : undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/customers${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold text-brand-deep">Customers</h1>
          <a href="/admin" className="text-sm font-semibold text-brand-deep underline">
            Dashboard
          </a>
        </div>

        {sp.ok && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">{sp.ok}</p>}
        {sp.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{sp.error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <a href="/admin/customers/new" className="col-span-2 flex min-h-14 items-center justify-center rounded-xl bg-brand-deep px-4 text-center text-lg font-black text-white">
            ➕ Add customer
          </a>
          <a href="/admin/customers/map" className={topBtn}>
            🗺️ Map
          </a>
          <a href="/admin/customers/import" className={topBtn}>
            Import
          </a>
          <a href={href({ bulk: bulk ? undefined : '1' })} className={topBtn}>
            {bulk ? 'Done setting up' : '✅ Set up several'}
          </a>
          <a href="/admin/rounds" className={topBtn}>
            🔁 Rounds
          </a>
        </div>

        <form action="/admin/customers" className="flex gap-2">
          {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
          {sp.round && <input type="hidden" name="round" value={sp.round} />}
          {bulk && <input type="hidden" name="bulk" value="1" />}
          <input
            name="q"
            defaultValue={sp.q}
            type="search"
            placeholder="Search name, street, postcode, phone"
            className="min-w-0 flex-1 rounded-xl border border-ink/20 bg-white p-3 text-base"
          />
          <button type="submit" className="rounded-xl px-4 text-sm font-bold text-brand-deep ring-1 ring-brand-deep/40">
            Search
          </button>
        </form>

        <nav aria-label="Filter" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <a
              key={f.key}
              href={href({ filter: f.key === 'all' ? undefined : f.key })}
              aria-current={filter === f.key ? 'page' : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold ${filter === f.key ? 'bg-brand-deep text-white' : 'text-brand-deep ring-1 ring-brand-deep/40'}`}
            >
              {f.label} ({counts[f.key]})
            </a>
          ))}
          {rounds.map((r) => (
            <a
              key={r.id}
              href={href({ round: sp.round === r.id ? undefined : r.id })}
              aria-current={sp.round === r.id ? 'page' : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold ${sp.round === r.id ? 'bg-amber-200 text-amber-950' : 'text-ink/80 ring-1 ring-ink/30'}`}
            >
              {r.name} ({r.customers})
            </a>
          ))}
        </nav>

        {rows.length === 0 ? (
          <p className="rounded-xl bg-white p-6 text-center text-ink/70 ring-1 ring-ink/10">
            {everyone.length === 0 ? 'No customers yet. Add one, or import the Squeegee file.' : 'Nobody matches that.'}
          </p>
        ) : bulk ? (
          <form action={bulkSetupAction} className="flex flex-col gap-3">
            <input type="hidden" name="back" value={href({})} />
            <div className="sticky top-0 z-10 flex flex-col gap-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-300">
              <p className="text-sm font-bold text-amber-950">Tick the customers, fill in only what you want to set, then Apply. Blank boxes are left alone.</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm font-semibold text-ink/80">
                  Price (£)
                  <input name="price" inputMode="decimal" placeholder="15" className="mt-1 w-full rounded-xl border border-ink/20 bg-white p-3 text-base font-normal" />
                </label>
                <label className="text-sm font-semibold text-ink/80">
                  Every (weeks)
                  <input name="frequencyWeeks" inputMode="numeric" placeholder="4" className="mt-1 w-full rounded-xl border border-ink/20 bg-white p-3 text-base font-normal" />
                </label>
                <label className="text-sm font-semibold text-ink/80">
                  Add to round
                  <select name="roundId" defaultValue="" className="mt-1 w-full rounded-xl border border-ink/20 bg-white p-3 text-base font-normal">
                    <option value="">Leave</option>
                    {rounds.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-ink/80">
                  Usually pays by
                  <select name="preferredPayment" defaultValue="" className="mt-1 w-full rounded-xl border border-ink/20 bg-white p-3 text-base font-normal">
                    <option value="">Leave</option>
                    {methods.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="submit" className="rounded-xl bg-brand-deep px-4 py-3 text-lg font-black text-white">
                Apply to ticked
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {rows.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-ink/10">
                    <input type="checkbox" name="ids" value={c.id} className="h-6 w-6 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black">{c.name}</span>
                      <span className="block truncate text-sm text-ink/80">{[c.address, c.postcode].filter(Boolean).join(', ') || 'No address yet'}</span>
                      <span className="block text-xs text-ink/70">
                        {c.pricePence !== null ? pounds(c.pricePence) : 'No price'} · {c.frequencyWeeks ? `every ${c.frequencyWeeks} wk` : 'no frequency'}
                        {c.rounds.length ? ` · ${c.rounds.map((r) => r.name).join(', ')}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </form>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((c) => (
              <Row key={c.id} c={c} today={today} comingTomorrow={comingTomorrow} />
            ))}
          </ul>
        )}

        <details className="rounded-xl bg-white p-3 ring-1 ring-ink/10">
          <summary className="cursor-pointer text-sm font-bold text-brand-deep">Add a round</summary>
          <form action={addRoundAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="back" value="/admin/customers" />
            <label className="flex-1 text-sm font-semibold text-ink/80">
              Name
              <input name="name" required placeholder="Nash" className="mt-1 w-full rounded-xl border border-ink/20 p-3 text-base font-normal" />
            </label>
            <label className="text-sm font-semibold text-ink/80">
              Day
              <select name="weekday" className="mt-1 block rounded-xl border border-ink/20 bg-white p-3 text-base font-normal">
                <option value="">Any</option>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d, i) => (
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
