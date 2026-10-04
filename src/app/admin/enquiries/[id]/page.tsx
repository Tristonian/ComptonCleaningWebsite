import { notFound } from 'next/navigation';
import { AdminBar } from '@/components/AdminBar';
import { ReplyForm } from '@/components/admin/ReplyForm';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { STATUSES, STATUS_LABEL, getEnquiry, isId, markRead } from '@/lib/enquiries-admin';
import { SERVICES, SOURCES, labelOf } from '@/lib/enquiry-options';
import { formatPhone } from '@/lib/enquiry';
import { getEnv } from '@/lib/env';
import { formatLondon } from '@/lib/format';
import { directionsLink, mapsLink } from '@/lib/geo';
import { addCustomerAction, saveNotesAction, setStatusAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enquiry', robots: { index: false, follow: false } };

const card = 'flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink/10';
const h2 = 'text-sm font-bold uppercase tracking-wide text-ink/60';
const btn = 'rounded-xl px-4 py-3 text-center font-bold';
const solid = `${btn} bg-brand-deep text-white`;
const outline = `${btn} text-brand-deep ring-2 ring-brand-deep`;
const field = 'w-full rounded-lg border border-ink/20 bg-white px-3 py-3 text-base text-ink';

export default async function EnquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const { ok, error } = await searchParams;
  if (!isId(id)) notFound();

  const db = getDb();
  const found = await getEnquiry(db, id);
  if (!found) notFound();
  const { enquiry: e, replies } = found;
  if (e.read_at === null) await markRead(db, id);

  const point = e.lat !== null && e.lng !== null ? { lat: e.lat, lng: e.lng } : null;
  const mapsUrl = mapsLink({ address: e.address, postcode: e.postcode, point });
  const dirUrl = directionsLink({ address: e.address, postcode: e.postcode, point });
  const token = getEnv('MAPBOX_TOKEN');
  const mapSrc =
    point && token
      ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+085478(${point.lng},${point.lat})/${point.lng},${point.lat},16,0/600x300@2x?access_token=${encodeURIComponent(token)}`
      : null;
  const waDigits = e.phone.replace(/\D/g, '');

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <a href="/admin/enquiries" className="text-sm font-bold text-brand-deep underline">
          ← All enquiries
        </a>

        {ok && (
          <p role="status" className="rounded-lg bg-brand/10 p-3 text-sm font-semibold text-brand-deep">
            ✓ {ok}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 ring-1 ring-red-600">
            {error}
          </p>
        )}

        <section className={card}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-black text-brand-deep">{e.name}</h1>
              <p className="text-sm text-ink/70">Received {formatLondon(e.created_at)}</p>
            </div>
            <span className="shrink-0 rounded-full bg-ink/10 px-2 py-1 text-xs font-bold">{STATUS_LABEL[e.status]}</span>
          </div>
          <form action={setStatusAction} className="flex gap-2">
            <input type="hidden" name="id" value={e.id} />
            <select name="status" defaultValue={e.status} aria-label="Status" className={field}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <button type="submit" className={`${outline} shrink-0`}>
              Update
            </button>
          </form>
        </section>

        <section className={card}>
          <h2 className={h2}>Get in touch</h2>
          <div className="grid grid-cols-2 gap-2">
            {e.phone && (
              <>
                <a href={`tel:${e.phone}`} className={solid}>
                  Call {formatPhone(e.phone)}
                </a>
                <a href={`sms:${e.phone}`} className={outline}>
                  Text
                </a>
                <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" className={outline}>
                  WhatsApp
                </a>
              </>
            )}
            {e.email && (
              <a href={`mailto:${e.email}`} className={outline}>
                Email
              </a>
            )}
          </div>
          {e.email && <p className="break-all text-sm text-ink/70">{e.email}</p>}
        </section>

        <section className={card}>
          <h2 className={h2}>The job</h2>
          <p className="text-lg font-bold">{labelOf(SERVICES, e.service) || 'No service chosen'}</p>
          {e.source && <p className="text-sm text-ink/80">Heard about us: {labelOf(SOURCES, e.source)}</p>}
          {e.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">Their notes</p>
              <p className="whitespace-pre-line break-words">{e.notes}</p>
            </div>
          )}
        </section>

        <section className={card}>
          <h2 className={h2}>Where</h2>
          <p className="text-lg font-bold">
            {e.address}, {e.postcode}
          </p>
          {mapSrc && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mapSrc} alt="Map showing the customer's confirmed pin" width={600} height={300} className="w-full rounded-xl ring-1 ring-ink/20" />
              <p className="text-sm font-semibold text-brand-deep">✓ The customer confirmed this pin</p>
            </>
          )}
          {!point && <p className="text-sm text-ink/70">No pin was placed: the map link searches the address.</p>}
          <div className="grid grid-cols-2 gap-2">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={solid}>
              Open in Maps
            </a>
            <a href={dirUrl} target="_blank" rel="noopener noreferrer" className={outline}>
              Directions
            </a>
          </div>
        </section>

        <section className={card}>
          <h2 className={h2}>Your notes (private)</h2>
          <form action={saveNotesAction} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={e.id} />
            <textarea name="notes" rows={4} maxLength={2000} defaultValue={e.admin_notes} className={field} placeholder="Gate codes, dogs, what you quoted…" />
            <button type="submit" className={outline}>
              Save notes
            </button>
          </form>
        </section>

        <section className={card}>
          <h2 className={h2}>Reply</h2>
          <ReplyForm id={e.id} customerName={e.name} email={e.email} />
          {replies.length > 0 && (
            <div className="mt-2 flex flex-col gap-3 border-t border-ink/10 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">Sent so far</p>
              {replies.map((r) => (
                <article key={r.id} className="rounded-lg bg-ink/5 p-3 text-sm">
                  <p className="font-semibold">{r.subject}</p>
                  <p className="text-xs text-ink/60">
                    {formatLondon(r.sent_at)} · to {r.to_email} · by {r.sent_by}
                  </p>
                  <p className="mt-2 whitespace-pre-line break-words">{r.body}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={card}>
          <h2 className={h2}>Customer</h2>
          {e.customer_id ? (
            <p className="font-semibold text-brand-deep">✓ Added as a customer (#{e.customer_id}).</p>
          ) : (
            <form action={addCustomerAction}>
              <input type="hidden" name="id" value={e.id} />
              <button type="submit" className={`${solid} w-full`}>
                Add as a customer
              </button>
              <p className="mt-2 text-sm text-ink/70">Saves their name, contact details, address and pin as a customer record.</p>
            </form>
          )}
        </section>
      </main>
    </>
  );
}
