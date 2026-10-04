import { AdminBar } from '@/components/AdminBar';
import { CustomerForm } from '@/components/admin/CustomerForm';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { listPaymentMethods, listRounds } from '@/lib/customers';
import { addCustomerAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Add customer', robots: { index: false, follow: false } };

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const admin = await requireAdmin();
  const { error } = await searchParams;
  const db = getDb();
  const [rounds, payments] = await Promise.all([listRounds(db), listPaymentMethods(db)]);
  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold text-brand-deep">Add customer</h1>
          <a href="/admin/customers" className="text-sm font-semibold text-brand-deep underline">
            Customers
          </a>
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
        <CustomerForm
          action={addCustomerAction}
          rounds={rounds}
          payments={payments}
          mapboxToken={getEnv('MAPBOX_TOKEN')}
          submitLabel="Add customer"
        />
      </main>
    </>
  );
}
