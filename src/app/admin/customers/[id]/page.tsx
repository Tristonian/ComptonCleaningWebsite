import { notFound } from 'next/navigation';
import { AdminBar } from '@/components/AdminBar';
import { CustomerForm } from '@/components/admin/CustomerForm';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { getCustomer, listPaymentMethods, listRounds, todayLondon } from '@/lib/customers';
import { listJobs } from '@/lib/jobs';
import { VisitForm } from '@/components/admin/VisitForm';
import { VisitHistory } from '@/components/admin/VisitHistory';
import { deleteCustomerAction, saveCustomerAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Customer', robots: { index: false, follow: false } };

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();
  const c = await getCustomer(id, db);
  if (!c) notFound();
  const [rounds, payments, jobs] = await Promise.all([listRounds(db), listPaymentMethods(db), listJobs(c.id, db)]);
  const today = todayLondon();

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="truncate text-2xl font-bold text-brand-deep">{c.name}</h1>
          <a href="/admin/customers" className="text-sm font-semibold text-brand-deep underline">
            Customers
          </a>
        </div>
        {sp.ok && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">{sp.ok}</p>}
        {sp.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{sp.error}</p>}

        <CustomerForm
          action={saveCustomerAction}
          initial={{
            id: c.id,
            name: c.name,
            address: c.address,
            postcode: c.postcode,
            phone: c.phone,
            email: c.email,
            notes: c.notes,
            price: c.pricePence === null ? '' : String(c.pricePence / 100),
            frequencyWeeks: c.frequencyWeeks === null ? '' : String(c.frequencyWeeks),
            preferredPayment: c.preferredPayment,
            roundIds: c.rounds.map((r) => r.id),
            lastCleaned: c.baselineDoneOn ?? '',
          }}
          rounds={rounds}
          payments={payments}
          mapboxToken={getEnv('MAPBOX_TOKEN')}
          submitLabel="Save"
        />

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-black text-brand-deep">Visits and payments</h2>
          <details className="rounded-xl bg-white p-3 ring-1 ring-ink/10">
            <summary className="cursor-pointer text-base font-black text-brand-deep">➕ Log a visit</summary>
            <div className="mt-3">
              <VisitForm
                customerId={c.id}
                defaults={{ pricePence: c.pricePence, preferredPayment: c.preferredPayment }}
                methods={payments}
                today={today}
                back={`/admin/customers/${c.id}`}
              />
            </div>
          </details>
          <VisitHistory
            customerId={c.id}
            jobs={jobs}
            methods={payments}
            today={today}
            back={`/admin/customers/${c.id}`}
            preferredPayment={c.preferredPayment}
          />
        </section>

        <section className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
          <h2 className="font-black text-red-900">Delete this customer</h2>
          <p className="mt-1 text-sm text-red-900/80">
            For when they ask to be removed. This deletes their details, visits and photos for good and cannot be undone.
          </p>
          <form action={deleteCustomerAction} className="mt-3 flex gap-2">
            <input type="hidden" name="id" value={c.id} />
            <input
              name="confirm"
              placeholder="Type delete"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-red-300 bg-white p-3 text-base"
            />
            <button type="submit" className="rounded-xl bg-red-700 px-4 font-bold text-white">
              Delete
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
