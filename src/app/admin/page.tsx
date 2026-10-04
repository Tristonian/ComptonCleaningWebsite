import { AdminBar } from '@/components/AdminBar';
import { requireAdmin } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default async function AdminHome() {
  const admin = await requireAdmin();
  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
        <h1 className="text-2xl font-bold text-brand-deep">Admin</h1>
        <p>
          Signed in as <strong>{admin.email}</strong>.
        </p>
        <a
          href="/"
          className="rounded-xl bg-brand-deep px-4 py-4 text-center text-lg font-bold text-white shadow"
        >
          Open the website to edit it
        </a>
        <p className="text-sm text-ink/70">
          On the website, tap the <strong>✏️ Edit</strong> button (bottom right), then tap any text to change it.
        </p>
      </main>
    </>
  );
}
