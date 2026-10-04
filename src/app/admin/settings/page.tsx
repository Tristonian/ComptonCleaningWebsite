import { AdminBar } from '@/components/AdminBar';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { listPaymentMethods } from '@/lib/customers';
import { listCallHours } from '@/lib/schedule';
import { addPaymentMethodAction, removePaymentMethodAction, renamePaymentMethodAction, saveCallHoursAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings', robots: { index: false, follow: false } };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const card = 'rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink/10';
const input = 'rounded-xl border border-ink/20 bg-white p-3 text-base';
const link = 'flex min-h-14 items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-ink/10 active:bg-brand/5';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const db = getDb();
  const [methods, hours] = await Promise.all([listPaymentMethods(db), listCallHours(db)]);

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-bold text-brand-deep">Settings</h1>
        {sp.ok && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">{sp.ok}</p>}
        {sp.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{sp.error}</p>}

        <nav aria-label="Settings" className="flex flex-col gap-2">
          <a href="/admin/rounds" className={link}>
            <span className="font-black text-brand-deep">🔁 Rounds</span>
            <span className="text-sm text-ink/70">Names, days and the order you work them</span>
          </a>
          <a href="/admin/templates" className={link}>
            <span className="font-black text-brand-deep">✉️ Templates</span>
            <span className="text-sm text-ink/70">Texts and emails</span>
          </a>
          <a href="/admin/appearance" className={link}>
            <span className="font-black text-brand-deep">🎨 Logo and colour</span>
            <span className="text-sm text-ink/70">The top of the site</span>
          </a>
        </nav>

        <section className={card}>
          <h2 className="text-lg font-black text-brand-deep">When you take calls</h2>
          <p className="mt-1 text-sm text-ink/70">
            The Call button on the website only shows in these hours. Outside them visitors see “I’m not working right now, leave me a message”
            (change that wording with the ✏️ pencil on the site). A day left off means no calls that day. For one-off changes, such as a day off or
            extra hours, use the <a href="/admin/calendar" className="font-semibold text-brand-deep underline">Calendar</a>. Times are UK time. If you set no hours at all, the button always shows.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {DAYS.map((name, i) => {
              const wd = i + 1;
              const windows = hours.filter((h) => h.weekday === wd);
              return (
                <form key={wd} action={saveCallHoursAction} className="rounded-xl bg-paper p-3 ring-1 ring-ink/10">
                  <input type="hidden" name="weekday" value={wd} />
                  <label className="flex items-center gap-3 font-bold">
                    <input type="checkbox" name="open" defaultChecked={windows.length > 0} className="h-5 w-5" />
                    {name}
                  </label>
                  <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    {[0, 1].map((n) => (
                      <div key={n} className="contents">
                        <input type="time" name={`opens${n}`} defaultValue={windows[n]?.opens ?? (n === 0 ? '09:00' : '')} aria-label={`${name} window ${n + 1} from`} className={input} />
                        <span className="text-sm text-ink/70">to</span>
                        <input type="time" name={`closes${n}`} defaultValue={windows[n]?.closes ?? (n === 0 ? '17:00' : '')} aria-label={`${name} window ${n + 1} until`} className={input} />
                      </div>
                    ))}
                  </div>
                  <button type="submit" className="mt-2 rounded-xl px-4 py-2 text-sm font-bold text-brand-deep ring-1 ring-brand-deep/40">
                    Save {name}
                  </button>
                </form>
              );
            })}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-lg font-black text-brand-deep">Ways customers pay</h2>
          <p className="mt-1 text-sm text-ink/70">These appear when you mark a visit paid. A way of paying that visits or customers already use can be renamed but not removed.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {methods.map((m) => (
              <li key={m.key} className="flex gap-2">
                <form action={renamePaymentMethodAction} className="flex min-w-0 flex-1 gap-2">
                  <input type="hidden" name="key" value={m.key} />
                  <input name="label" defaultValue={m.label} aria-label={`Name for ${m.label}`} className={`${input} min-w-0 flex-1`} />
                  <button type="submit" className="rounded-xl px-3 text-sm font-bold text-brand-deep ring-1 ring-brand-deep/40">
                    Rename
                  </button>
                </form>
                <form action={removePaymentMethodAction}>
                  <input type="hidden" name="key" value={m.key} />
                  <button type="submit" aria-label={`Remove ${m.label}`} className="h-full rounded-xl px-3 text-sm font-bold text-red-800 ring-1 ring-red-300">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addPaymentMethodAction} className="mt-3 flex gap-2">
            <input name="label" required placeholder="e.g. Cheque" aria-label="New way of paying" className={`${input} min-w-0 flex-1`} />
            <button type="submit" className="rounded-xl bg-brand-deep px-4 font-bold text-white">
              Add
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
