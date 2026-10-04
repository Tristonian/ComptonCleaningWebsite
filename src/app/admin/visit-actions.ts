'use server';

import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { addJobPhoto, deleteJobPhoto, unreferenced } from '@/lib/job-photos';
import { removePhotoObjects, storeUploadedPhoto } from '@/lib/photo-store';
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
  const customerId = text(form, 'customerId');
  const r = await recordJob(customerId, jobFrom(form), a.email, getDb());
  // A done visit hands back its id so the Work screen can offer "Add photos" for it.
  const photos = r.ok && r.id && text(form, 'status') === 'done' && /^\d+$/.test(customerId) ? `&job=${r.id}&cust=${customerId}` : '';
  redirect(`${flash(back, r.ok ? 'ok' : 'error', r.ok ? 'Visit saved.' : r.error)}${photos}`);
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
  if (r.ok) await removePhotoObjects(r.orphans);
  redirect(flash(back, r.ok ? 'ok' : 'error', r.ok ? 'Visit deleted.' : r.error));
}

/** Called from the client after it has shrunk the photo. Returns a result instead of redirecting so several can go up in turn. */
export async function addVisitPhotoAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const a = await getAdmin();
  if (!a) return { ok: false, error: 'Not signed in.' };
  const stored = await storeUploadedPhoto(formData);
  if (!stored.ok) return stored;
  const r = await addJobPhoto({ jobId: formData.get('jobId'), hash: stored.hash, width: stored.width, height: stored.height, by: a.email }, getDb());
  // The object was written before we knew the visit would take it; tidy it if nothing references it.
  if (!r.ok) await removePhotoObjects(await unreferenced([stored.hash], getDb()));
  return r;
}

export async function deleteVisitPhotoAction(photoId: string): Promise<{ ok: boolean; error?: string }> {
  const a = await getAdmin();
  if (!a) return { ok: false, error: 'Not signed in.' };
  const r = await deleteJobPhoto(photoId, a.email, getDb());
  if (!r.ok) return r;
  await removePhotoObjects(r.orphans);
  return { ok: true };
}
