'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resetTemplateAction, saveTemplateAction } from '@/app/admin/templates/actions';

export type TemplateView = {
  key: string;
  kind: 'sms' | 'email';
  label: string;
  hint: string;
  tokens: string[];
  subject: string;
  body: string;
  enabled: boolean;
  edited: boolean;
};

const field = 'w-full rounded-lg border border-ink/20 bg-white px-3 py-3 text-base text-ink';

/** One template: on/off, wording, save, back to the default. Plain text for both texts and emails (replies are plain text). */
export function TemplateEditor({ t }: { t: TemplateView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(t.enabled);
  const [subject, setSubject] = useState(t.subject);
  const [body, setBody] = useState(t.body);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function run(job: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setMessage(null);
    start(async () => {
      const r = await job();
      setMessage(r.ok ? { ok: true, text: done } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <details className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/10">
      <summary className="flex cursor-pointer items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-lg font-black text-brand-deep">{t.label}</span>
          <span className="text-xs text-ink/70">{t.kind === 'sms' ? 'Text message' : 'Email'}</span>
        </span>
        <span className="flex shrink-0 gap-2 text-xs font-bold">
          {t.edited && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">Edited</span>}
          <span className={`rounded-full px-2 py-1 ${t.enabled ? 'bg-green-100 text-green-900' : 'bg-ink/10 text-ink/70'}`}>{t.enabled ? 'On' : 'Off'}</span>
        </span>
      </summary>

      <div className="mt-4 flex flex-col gap-3">
        <p className="text-sm text-ink/70">{t.hint}</p>
        <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
          <input type="checkbox" className="h-6 w-6" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Switched on
        </label>
        {t.kind === 'email' && (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Subject
            <input className={field} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t.kind === 'sms' ? 'Text' : 'Message'}
          <textarea className={field} rows={t.kind === 'sms' ? 6 : 12} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <p className="text-xs text-ink/70">
          Use {t.tokens.join(', ')} where the customer’s first name goes. Leave it in so it greets them by name.
        </p>

        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={`rounded-lg p-3 text-sm font-semibold ${message.ok ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => saveTemplateAction({ key: t.key, enabled, subject, body }), 'Saved.')}
            className="min-h-12 rounded-xl bg-brand-deep px-4 font-bold text-white disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            disabled={pending || !t.edited}
            onClick={() => {
              if (!window.confirm('Go back to the original wording and switch it on?')) return;
              run(async () => {
                const r = await resetTemplateAction(t.key);
                return r;
              }, 'Back to the original.');
            }}
            className="min-h-12 rounded-xl px-4 font-bold text-brand-deep ring-1 ring-brand-deep/40 disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </div>
    </details>
  );
}
