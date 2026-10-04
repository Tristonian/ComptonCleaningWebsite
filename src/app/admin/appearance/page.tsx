import { AdminBar } from '@/components/AdminBar';
import { AppearanceManager } from '@/components/admin/AppearanceManager';
import { requireAdmin } from '@/lib/auth/session';
import { getAppearance, listLogos } from '@/lib/appearance';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Logo and colour', robots: { index: false, follow: false } };

export default async function AppearancePage() {
  const admin = await requireAdmin();
  const db = getDb();
  const [{ logos, activeHash }, { heroColour }] = await Promise.all([listLogos(db), getAppearance(db)]);

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
        <a href="/admin" className="text-sm font-bold text-brand-deep">
          ← Admin
        </a>
        <h1 className="text-2xl font-bold text-brand-deep">Logo and colour</h1>
        <AppearanceManager
          logos={logos.map((l) => ({ hash: l.hash, label: l.label }))}
          activeHash={activeHash}
          heroColour={heroColour}
        />
      </main>
    </>
  );
}
