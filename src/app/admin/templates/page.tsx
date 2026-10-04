import { AdminBar } from '@/components/AdminBar';
import { TemplateEditor } from '@/components/admin/TemplateEditor';
import { requireAdmin } from '@/lib/auth/session';
import { listTemplates } from '@/lib/templates';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Templates', robots: { index: false, follow: false } };

export default async function TemplatesPage() {
  const admin = await requireAdmin();
  const templates = await listTemplates();

  return (
    <>
      <AdminBar email={admin.email} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-bold text-brand-deep">Templates</h1>
        <p className="text-sm text-ink/70">
          The texts and emails you send. Tap one to switch it off or change the wording. Nothing is ever sent without you pressing the button.
        </p>
        {templates.map((t) => (
          <TemplateEditor
            key={t.key}
            t={{ key: t.key, kind: t.kind, label: t.label, hint: t.hint, tokens: [...t.tokens], subject: t.subject, body: t.body, enabled: t.enabled, edited: t.edited }}
          />
        ))}
      </main>
    </>
  );
}
