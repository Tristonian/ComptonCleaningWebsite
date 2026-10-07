import { AdminBar } from '@/components/AdminBar';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { enquiryCounts } from '@/lib/enquiries-admin';
import { listRounds, todayLondon } from '@/lib/customers';
import { BASE, getForecast } from '@/lib/weather';
import { WeatherWeek } from '@/components/admin/WeatherWeek';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

const tile = 'flex flex-col gap-1 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/10 active:bg-brand/5';

export default async function AdminHome() {
  const admin = await requireAdmin();
  // A database hiccup must not lock Sam out of the dashboard: show the tiles without the count.
  const counts = await enquiryCounts(getDb()).catch((err) => {
    console.error('[admin] could not count enquiries:', err);
    return null;
  });

  const forecast = await getForecast(BASE.lat, BASE.lng);
  // A hiccup here only means the round shortcuts are left out.
  const rounds = await listRounds(getDb(), { withTemporary: true }).catch(() => []);

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-bold text-brand-deep">Admin</h1>

        {forecast && <WeatherWeek title="Weather this week, Lyde Green" days={forecast} today={todayLondon()} />}

        <section aria-label="Rounds" className="rounded-2xl bg-brand-deep p-5 text-white shadow-md">
          <h2 className="text-xl font-black">Rounds and best order</h2>
          <p className="mt-1 text-sm text-white/85">Plan the quickest way round, or build a round from who’s due.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href="/admin/rounds?plan=due" className="flex min-h-14 items-center justify-center rounded-xl bg-white px-3 text-center text-base font-black text-brand-deep active:bg-white/80">
              🧭 Best order
            </a>
            <a href="/admin/rounds?build=1" className="flex min-h-14 items-center justify-center rounded-xl bg-white px-3 text-center text-base font-black text-brand-deep active:bg-white/80">
              ➕ Build from who’s due
            </a>
          </div>
          {rounds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {rounds.map((r) => (
                <a key={r.id} href={`/admin/rounds?round=${r.id}&plan=due`} className="rounded-full bg-white/15 px-3 py-2 text-sm font-bold ring-1 ring-white/40 active:bg-white/30">
                  {r.name} <span className="font-normal text-white/80">({r.customers})</span>
                </a>
              ))}
            </div>
          )}
        </section>

        <a href="/admin/enquiries" className={tile}>
          <span className="flex items-center justify-between gap-3">
            <span className="text-xl font-black text-brand-deep">Enquiries</span>
            {counts && counts.unread > 0 && (
              <span className="rounded-full bg-brand-deep px-3 py-1 text-sm font-bold text-white">{counts.unread} new</span>
            )}
          </span>
          <span className="text-sm text-ink/70">
            {counts ? `${counts.total} in total. Read them, reply, keep notes, add customers.` : 'Read them, reply, keep notes, add customers.'}
          </span>
        </a>

        <a href="/admin/work" className={tile}>
          <span className="text-xl font-black text-brand-deep">Work</span>
          <span className="text-sm text-ink/70">Who is due this week, mark visits done or missed, debts and payments.</span>
        </a>

        <a href="/admin/customers" className={tile}>
          <span className="text-xl font-black text-brand-deep">Customers</span>
          <span className="text-sm text-ink/70">Who is due, who owes, call or text in one tap. Add customers, import from Squeegee.</span>
        </a>

        <a href="/admin/earnings" className={tile}>
          <span className="text-xl font-black text-brand-deep">Earnings</span>
          <span className="text-sm text-ink/70">Money received by day, week and month, how people paid, top extras and customers, what is still owed.</span>
        </a>

        <a href="/admin/calendar" className={tile}>
          <span className="text-xl font-black text-brand-deep">Calendar</span>
          <span className="text-sm text-ink/70">Schedule your rounds, and set the days and hours the website offers the Call button.</span>
        </a>

        <a href="/admin/settings" className={tile}>
          <span className="text-xl font-black text-brand-deep">Settings</span>
          <span className="text-sm text-ink/70">Rounds and their order, call hours, ways of paying, texts and emails, logo and colour.</span>
        </a>

        <a href="/" className={tile}>
          <span className="text-xl font-black text-brand-deep">See the site</span>
          <span className="text-sm text-ink/70">
            Open the website as visitors see it. Tap the ✏️ Edit button (bottom right) to change any text.
          </span>
        </a>

        <p className="text-sm text-ink/60">
          Signed in as <strong>{admin.email}</strong>.
        </p>
      </main>
    </>
  );
}
