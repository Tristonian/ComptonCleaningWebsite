import { requireAdmin } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default async function AdminHome() {
  const admin = await requireAdmin();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-2xl font-bold text-brand-deep">Admin</h1>
      <p>
        Signed in as <strong>{admin.email}</strong>.
      </p>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="rounded-xl border border-ink/20 px-4 py-2">
          Sign out
        </button>
      </form>
    </main>
  );
}
