'use server';

import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth/session';
import { EMAIL_FROM } from '@/lib/business';
import { getDb } from '@/lib/db';
import {
  MAX_REPLY_BODY,
  addAsCustomer,
  getEnquiry,
  isId,
  recordReply,
  saveAdminNotes,
  setStatus,
} from '@/lib/enquiries-admin';
import { sendMail } from '@/lib/mail';

/**
 * Server actions behind the enquiry inbox. These are HTTP endpoints: hiding the buttons is not access
 * control, so EVERY action re-checks the session and allow-list first (ADR 0003). Next also checks the
 * Origin header on Server Actions, which covers CSRF.
 */

async function admin() {
  const a = await getAdmin();
  if (!a) redirect('/admin/login');
  return a;
}

const back = (id: string, flash?: string, kind: 'ok' | 'error' = 'ok') =>
  `/admin/enquiries/${id}${flash ? `?${kind}=${encodeURIComponent(flash)}` : ''}`;

function idFrom(form: FormData): string {
  const id = form.get('id');
  if (!isId(id)) redirect('/admin/enquiries');
  return id;
}

export async function setStatusAction(form: FormData): Promise<void> {
  const a = await admin();
  const id = idFrom(form);
  const r = await setStatus(getDb(), id, form.get('status'), a.email);
  redirect(r.ok ? back(id, 'Status updated.') : back(id, r.error, 'error'));
}

export async function saveNotesAction(form: FormData): Promise<void> {
  const a = await admin();
  const id = idFrom(form);
  const r = await saveAdminNotes(getDb(), id, form.get('notes'), a.email);
  redirect(r.ok ? back(id, 'Notes saved.') : back(id, r.error, 'error'));
}

export async function addCustomerAction(form: FormData): Promise<void> {
  const a = await admin();
  const id = idFrom(form);
  const r = await addAsCustomer(getDb(), id, a.email);
  redirect(r.ok ? back(id, 'Added as a customer.') : back(id, r.error, 'error'));
}

export type ReplyState = { status: 'idle' } | { status: 'sent' } | { status: 'error'; error: string };

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Send a reply to the customer's email, as hello@, and log it on the enquiry. */
export async function sendReplyAction(_prev: ReplyState, form: FormData): Promise<ReplyState> {
  const a = await admin();
  const id = form.get('id');
  if (!isId(id)) return { status: 'error', error: 'Unknown enquiry.' };

  const subject = String(form.get('subject') ?? '').trim();
  const body = String(form.get('body') ?? '').replace(/\r\n?/g, '\n').trim();
  if (!subject || subject.length > 200) return { status: 'error', error: 'Please give the email a subject (up to 200 characters).' };
  if (!body) return { status: 'error', error: 'Please write something to send.' };
  if (body.length > MAX_REPLY_BODY) return { status: 'error', error: `The message can be up to ${MAX_REPLY_BODY} characters.` };

  const db = getDb();
  const found = await getEnquiry(db, id);
  if (!found) return { status: 'error', error: 'Unknown enquiry.' };
  const to = found.enquiry.email;
  if (!to) return { status: 'error', error: 'They did not give an email address. Call or text them instead.' };

  try {
    await sendMail({
      to,
      subject,
      text: body,
      html: `<div style="font:16px/1.5 Arial,sans-serif;color:#0f2131;max-width:600px">${esc(body).replace(/\n/g, '<br>')}</div>`,
      from: { address: EMAIL_FROM, name: 'Compton Cleaning Services' },
      // Their reply lands on hello@, which forwards to Sam's inbox.
      replyTo: EMAIL_FROM,
    });
  } catch (err) {
    console.error('[enquiries] reply failed to send:', err);
    return { status: 'error', error: 'The email could not be sent. Nothing was logged. Try again, or call them.' };
  }
  const logged = await recordReply(db, id, { by: a.email, to, subject, body });
  if (!logged.ok) console.error('[enquiries] reply sent but not logged for enquiry', id);
  return { status: 'sent' };
}
