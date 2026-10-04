import { AdminBar } from '@/components/AdminBar';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { enquiryCounts } from '@/lib/enquiries-admin';

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

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-bold text-brand-deep">Admin</h1>

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

        <a href="/admin/appearance" className={tile}>
          <span className="text-xl font-black text-brand-deep">Logo and colour</span>
          <span className="text-sm text-ink/70">Upload and switch the logo at the top of the site, and change the header colour.</span>
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
