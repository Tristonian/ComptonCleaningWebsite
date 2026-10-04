'use server';

import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { addEntry, deleteEntry } from '@/lib/schedule';

/** Calendar actions. Each re-checks the session and allow-list first (ADR 0003). */

async function admin() {
  const a = await getAdmin();
  if (!a) redirect('/admin/login');
  return a;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '');

/** Only ever send people back to the calendar. */
function backTo(form: FormData): string {
  const b = text(form, 'back');
  return /^\/admin\/calendar(\?[\w=&%.\-]*)?$/.test(b) ? b : '/admin/calendar';
}

const flash = (path: string, kind: 'ok' | 'error', msg: string) => `${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`;

export async function addEntryAction(form: FormData): Promise<void> {
  const a = await admin();
  const r = await addEntry(
    { onDate: text(form, 'onDate'), kind: text(form, 'kind'), roundId: text(form, 'roundId'), starts: text(form, 'starts'), ends: text(form, 'ends'), note: text(form, 'note') },
    a.email,
    getDb(),
  );
  redirect(flash(backTo(form), r.ok ? 'ok' : 'error', r.ok ? 'Added.' : r.error));
}

export async function deleteEntryAction(form: FormData): Promise<void> {
  const a = await admin();
  const r = await deleteEntry(text(form, 'id'), a.email, getDb());
  redirect(flash(backTo(form), r.ok ? 'ok' : 'error', r.ok ? 'Removed.' : r.error));
}
