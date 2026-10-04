'use server';

import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { deleteJob, markPaid, recordJob, updateJob, type JobInput } from '@/lib/jobs';

/**
 * Server actions for visits (Done / Missed, edit, delete, mark paid), used from the customer page and
 * the work screen. Each re-checks the session and allow-list first (ADR 0003).
 */

async function admin() {
  const a = await getAdmin();
  if (!a) redirect('/admin/login');
  return a;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '');

/** Only ever send people back to somewhere inside /admin. */
function backTo(form: FormData, fallback = '/admin/work'): string {
  const b = text(form, 'back');
  return /^\/admin(\/[\w\-[\]/]*)?(\?[\w=&%.\-]*)?$/.test(b) ? b : fallback;
}

const flash = (path: string, kind: 'ok' | 'error', msg: string) => `${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`;

function jobFrom(form: FormData): JobInput {
  const extras = [0, 1, 2].map((i) => ({ label: text(form, `extraLabel${i}`), price: text(form, `extraPrice${i}`) }));
  return {
    status: text(form, 'status'),
    doneOn: text(form, 'doneOn'),
    price: text(form, 'price'),
    paymentMethod: text(form, 'paymentMethod'),
    paid: form.get('paid') === 'on',
    notes: text(form, 'notes'),
    extras,
  };
}

export async function recordVisitAction(form: FormData): Promise<void> {
  const a = await admin();
  const back = backTo(form);
  const r = await recordJob(text(form, 'customerId'), jobFrom(form), a.email, getDb());
  redirect(flash(back, r.ok ? 'ok' : 'error', r.ok ? 'Visit saved.' : r.error));
}

export async function updateVisitAction(form: FormData): Promise<void> {
  const a = await admin();
  const back = backTo(form);
  const r = await updateJob(text(form, 'jobId'), jobFrom(form), a.email, getDb());
  redirect(flash(back, r.ok ? 'ok' : 'error', r.ok ? 'Visit updated.' : r.error));
}

export async function markPaidAction(form: FormData): Promise<void> {
  const a = await admin();
  const back = backTo(form);
  const r = await markPaid(text(form, 'jobId'), text(form, 'paymentMethod'), a.email, getDb());
  redirect(flash(back, r.ok ? 'ok' : 'error', r.ok ? 'Marked as paid.' : r.error));
}

export async function deleteVisitAction(form: FormData): Promise<void> {
  const a = await admin();
  const back = backTo(form);
  if (form.get('confirm') !== 'on') redirect(flash(back, 'error', 'Tick the box to confirm the delete.'));
  const r = await deleteJob(text(form, 'jobId'), a.email, getDb());
  redirect(flash(back, r.ok ? 'ok' : 'error', r.ok ? 'Visit deleted.' : r.error));
}
