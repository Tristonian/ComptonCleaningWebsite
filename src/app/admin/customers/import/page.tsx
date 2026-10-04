import { AdminBar } from '@/components/AdminBar';
import { CustomerImport } from '@/components/admin/CustomerImport';
import { requireAdmin } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Import customers', robots: { index: false, follow: false } };

export default async function ImportPage() {
  const admin = await requireAdmin();
  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold text-brand-deep">Import customers</h1>
          <a href="/admin/customers" className="text-sm font-semibold text-brand-deep underline">
            Customers
          </a>
        </div>
        <p className="text-sm text-ink/70">
          Export your customers from Squeegee and pick the file here. Anyone already imported is left exactly as
          they are, so it is safe to do this again.
        </p>
        <CustomerImport />
      </main>
    </>
  );
}
