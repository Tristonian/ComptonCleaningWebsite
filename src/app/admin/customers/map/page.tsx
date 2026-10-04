import { AdminBar } from '@/components/AdminBar';
import { CustomerMap, type MapCustomer } from '@/components/admin/CustomerMap';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { listCustomers, listRounds, todayLondon } from '@/lib/customers';
import { endOfWeek } from '@/lib/jobs';
import { pinStatus } from '@/lib/pin-status';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Customer map', robots: { index: false, follow: false } };

const pounds = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export default async function CustomerMapPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const admin = await requireAdmin();
  const { round } = await searchParams;
  const db = getDb();
  const today = todayLondon();
  const weekEnd = endOfWeek(today);
  const [rows, rounds] = await Promise.all([listCustomers({ roundId: round, today }, db), listRounds(db)]);
  const token = getEnv('MAPBOX_TOKEN');

  const located = rows.filter((c): c is typeof c & { lat: number; lng: number } => c.lat !== null && c.lng !== null);
  const unlocated = rows.length - located.length;
  const pins: MapCustomer[] = located.map((c) => {
    const status = pinStatus(c, today, weekEnd);
    const bits = [c.owingPence > 0 ? `owes ${pounds(c.owingPence)}` : c.nextDue ? `due ${shortDate(c.nextDue)}` : '', c.pricePence !== null ? pounds(c.pricePence) : ''];
    return {
      id: c.id,
      name: c.name,
      address: [c.address, c.postcode].filter(Boolean).join(', '),
      lat: c.lat,
      lng: c.lng,
      status,
      detail: bits.filter(Boolean).join(' · '),
    };
  });

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold text-brand-deep">Map</h1>
          <a href="/admin/customers" className="text-sm font-semibold text-brand-deep underline">
            List view
          </a>
        </div>

        {rounds.length > 0 && (
          <nav aria-label="Round" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <a href="/admin/customers/map" aria-current={!round ? 'page' : undefined} className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold ${!round ? 'bg-amber-200 text-amber-950' : 'text-ink/80 ring-1 ring-ink/30'}`}>
              Every round
            </a>
            {rounds.map((r) => (
              <a
                key={r.id}
                href={`/admin/customers/map?round=${r.id}`}
                aria-current={round === r.id ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold ${round === r.id ? 'bg-amber-200 text-amber-950' : 'text-ink/80 ring-1 ring-ink/30'}`}
              >
                {r.name}
              </a>
            ))}
          </nav>
        )}

        {!token ? (
          <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">The map needs the Mapbox token, which is not set here.</p>
        ) : pins.length === 0 ? (
          <p className="rounded-xl bg-white p-6 text-center text-ink/70 ring-1 ring-ink/10">
            No customers with a location yet. Add one with 📍 Grab location and they will appear here.
          </p>
        ) : (
          <CustomerMap token={token} customers={pins} />
        )}

        {unlocated > 0 && (
          <p className="text-sm text-ink/70">
            {unlocated} customer{unlocated === 1 ? ' has' : 's have'} no location yet, so no pin. Open them and use 📍 Grab location when you are next there.
          </p>
        )}
      </main>
    </>
  );
}
