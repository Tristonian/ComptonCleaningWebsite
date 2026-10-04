'use client';

import { useActionState, useState } from 'react';
import { sendReplyAction, type ReplyState } from '@/app/admin/enquiries/actions';
import { fillTemplate } from '@/lib/reply-templates';

/** The switched-on reply templates, with Sam's edits applied (resolved on the server). */
export type ReplyChoice = { key: string; label: string; subject: string; body: string };

const field = 'w-full rounded-lg border border-ink/20 bg-white px-3 py-3 text-base text-ink';

/**
 * Write a reply to the customer. Pick a template to fill the box, edit it freely, and send. It goes
 * from hello@ to the email they gave; their answer arrives in Sam's usual inbox.
 */
export function ReplyForm({ id, customerName, email, templates }: { id: string; customerName: string; email: string; templates: ReplyChoice[] }) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(sendReplyAction, { status: 'idle' });
  const [subject, setSubject] = useState(templates[0]?.subject ?? '');
  const [body, setBody] = useState(() => (templates[0] ? fillTemplate(templates[0].body, customerName) : ''));
  const [sentOnce, setSentOnce] = useState(false);

  if (!email) {
    return (
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-400">
        They didn’t give an email address, so use the Call, Text or WhatsApp buttons above.
      </p>
    );
  }

  function pick(templateId: string) {
    const t = templates.find((x) => x.key === templateId);
    if (!t) return;
    setSubject(t.subject);
    setBody(fillTemplate(t.body, customerName));
  }

  return (
    <form
      action={action}
      onSubmit={() => setSentOnce(true)}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={id} />
      {state.status === 'sent' && sentOnce && (
        <p role="status" className="rounded-lg bg-brand/10 p-3 text-sm font-semibold text-brand-deep">
          ✓ Sent to {email}. It’s logged below.
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 ring-1 ring-red-600">
          {state.error}
        </p>
      )}
      {templates.length > 0 && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Start from a template
          <select className={field} defaultValue={templates[0].key} onChange={(e) => pick(e.target.value)}>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="text-sm text-ink/70">
        To: <strong>{email}</strong> · from hello@comptoncleaning.co.uk
      </p>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Subject
        <input
          name="subject"
          required
          maxLength={200}
          className={field}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Message
        <textarea
          name="body"
          required
          rows={12}
          maxLength={5000}
          className={field}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-deep px-4 py-3 font-bold text-white disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send reply'}
      </button>
    </form>
  );
}
