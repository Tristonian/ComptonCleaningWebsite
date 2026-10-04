'use client';

import { useActionState } from 'react';
import { Ed } from '@/components/Ed';
import { sendEnquiry, type ContactState } from '@/app/contact-actions';

const field = 'w-full rounded-lg border border-ink/20 bg-white px-3 py-3 text-base text-ink';

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendEnquiry, { status: 'idle' });

  if (state.status === 'sent') {
    return (
      <Ed id="contact.form.thanks" as="p" className="rounded-xl bg-brand/10 p-4 font-semibold text-brand-deep">
        {'Thanks, we’ll be in touch soon.'}
      </Ed>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.name">Name</Ed>
        <input name="name" required maxLength={100} autoComplete="name" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.address">Address</Ed>
        <input name="address" required maxLength={300} autoComplete="street-address" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.contact">Contact number / email</Ed>
        <input name="contact" required maxLength={120} autoComplete="tel" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        <Ed id="contact.form.notes">Notes (optional)</Ed>
        <textarea name="notes" rows={4} maxLength={1000} className={field} />
      </label>
      {/* Honeypot, hidden from people and assistive tech. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {state.status === 'error' && state.error === 'rate' && (
        <Ed id="contact.form.rate" as="p" className="text-sm font-semibold text-red-700">
          Too many messages just now. Please give us a call or text instead.
        </Ed>
      )}
      {state.status === 'error' && state.error !== 'rate' && (
        <Ed id="contact.form.error" as="p" className="text-sm font-semibold text-red-700">
          Please check your details and try again, or give us a call.
        </Ed>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-deep px-4 py-3 font-bold text-white disabled:opacity-60"
      >
        <Ed id="contact.form.submit">Send</Ed>
      </button>
    </form>
  );
}
