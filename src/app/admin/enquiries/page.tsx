import { AdminBar } from '@/components/AdminBar';
import { requireAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { STATUSES, STATUS_LABEL, enquiryCounts, isStatus, listEnquiries, type Status } from '@/lib/enquiries-admin';
import { SERVICES, labelOf } from '@/lib/enquiry-options';
import { formatLondon, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enquiries', robots: { index: false, follow: false } };

const CHIP: Record<Status, string> = {
  new: 'bg-brand-deep text-white',
  contacted: 'bg-amber-100 text-amber-900',
  quoted: 'bg-sky-100 text-sky-900',
  booked: 'bg-green-100 text-green-900',
  lost: 'bg-ink/10 text-ink/70',
};

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const admin = await requireAdmin();
  const { status } = await searchParams;
  const filter = isStatus(status) ? status : undefined;
  const db = getDb();
  const [rows, counts] = await Promise.all([listEnquiries(db, filter), enquiryCounts(db)]);

  const tab = (label: string, href: string, active: boolean, n?: number) => (
    <a
      key={label}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold ${active ? 'bg-brand-deep text-white' : 'text-brand-deep ring-1 ring-brand-deep/40'}`}
    >
      {label}
      {n !== undefined ? ` (${n})` : ''}
    </a>
  );

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold text-brand-deep">Enquiries</h1>
          <a href="/admin" className="text-sm font-semibold text-brand-deep underline">
            Dashboard
          </a>
        </div>

        <nav aria-label="Filter by status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tab('All', '/admin/enquiries', !filter, counts.total)}
          {STATUSES.map((s) => tab(STATUS_LABEL[s], `/admin/enquiries?status=${s}`, filter === s, counts.byStatus[s]))}
        </nav>

        {rows.length === 0 ? (
          <p className="rounded-xl bg-white p-6 text-center text-ink/70 ring-1 ring-ink/10">
            {filter ? `Nothing marked ${STATUS_LABEL[filter]} yet.` : 'No enquiries yet. They will appear here when someone fills in the contact form.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((e) => {
              const unread = e.read_at === null;
              return (
                <li key={e.id}>
                  <a
                    href={`/admin/enquiries/${e.id}`}
                    className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink/10 active:bg-brand/5"
                  >
                    <span
                      aria-label={unread ? 'Unread' : 'Read'}
                      className={`mt-2 h-3 w-3 shrink-0 rounded-full ${unread ? 'bg-brand-deep' : 'bg-transparent ring-1 ring-ink/20'}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`truncate text-lg ${unread ? 'font-black' : 'font-semibold'}`}>{e.name}</span>
                      <span className="truncate text-sm text-ink/80">
                        {labelOf(SERVICES, e.service) || 'No service chosen'} · {e.postcode}
                      </span>
                      <span className="text-xs text-ink/60" title={formatLondon(e.created_at)}>
                        {timeAgo(e.created_at)}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${CHIP[e.status]}`}>{STATUS_LABEL[e.status]}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
