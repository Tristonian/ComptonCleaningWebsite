'use server';

import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { bulkSetup, createCustomer, createRound, deleteCustomer, importCustomers, updateCustomer, type CustomerInput } from '@/lib/customers';
import { removePhotoObjects } from '@/lib/photo-store';
import { parseCustomersCsv } from '@/lib/customers-csv';

/**
 * Server actions behind the customer screens. These are HTTP endpoints: hiding the buttons is not
 * access control, so EVERY action re-checks the session and allow-list first (ADR 0003).
 */

async function admin() {
  const a = await getAdmin();
  if (!a) redirect('/admin/login');
  return a;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '');

function inputFrom(form: FormData): CustomerInput & { source?: unknown } {
  return {
    name: text(form, 'name'),
    address: text(form, 'address'),
    postcode: text(form, 'postcode'),
    phone: text(form, 'phone'),
    email: text(form, 'email'),
    notes: text(form, 'notes'),
    lat: text(form, 'lat'),
    lng: text(form, 'lng'),
    price: text(form, 'price'),
    frequencyWeeks: text(form, 'frequencyWeeks'),
    preferredPayment: text(form, 'preferredPayment'),
    roundIds: form.getAll('roundIds').map(String),
    source: text(form, 'source'),
    // Only the edit form has this field; an add leaves it out (undefined) and a blank edit clears it.
    lastCleaned: form.has('lastCleaned') ? text(form, 'lastCleaned') : undefined,
  };
}

const withFlash = (path: string, kind: 'ok' | 'error', msg: string) => `${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`;

export async function addCustomerAction(form: FormData): Promise<void> {
  const a = await admin();
  const r = await createCustomer(inputFrom(form), a.email, getDb());
  if (!r.ok) redirect(withFlash(r.id ? `/admin/customers/${r.id}` : '/admin/customers/new', 'error', r.error));
  redirect(withFlash('/admin/customers', 'ok', 'Customer added.'));
}

export async function saveCustomerAction(form: FormData): Promise<void> {
  const a = await admin();
  const id = text(form, 'id');
  const r = await updateCustomer(id, inputFrom(form), a.email, getDb());
  redirect(withFlash(`/admin/customers/${id}`, r.ok ? 'ok' : 'error', r.ok ? 'Saved.' : r.error));
}

export async function deleteCustomerAction(form: FormData): Promise<void> {
  const a = await admin();
  // A typed confirmation, not just a click: this cannot be undone.
  if (text(form, 'confirm').trim().toLowerCase() !== 'delete') {
    redirect(withFlash(`/admin/customers/${text(form, 'id')}`, 'error', 'Type delete to confirm.'));
  }
  const r = await deleteCustomer(text(form, 'id'), a.email, getDb());
  if (r.ok) await removePhotoObjects(r.orphans);
  redirect(withFlash('/admin/customers', r.ok ? 'ok' : 'error', r.ok ? 'Customer deleted.' : r.error));
}

export async function addRoundAction(form: FormData): Promise<void> {
  const a = await admin();
  const r = await createRound({ name: text(form, 'name'), weekday: text(form, 'weekday') }, a.email, getDb());
  redirect(withFlash(text(form, 'back') || '/admin/customers', r.ok ? 'ok' : 'error', r.ok ? 'Round added.' : r.error));
}

/** The CSV text is parsed again here: the browser's preview is for Sam, not for trust. */
export async function importCustomersAction(csv: string): Promise<{ ok: boolean; message: string }> {
  const a = await getAdmin();
  if (!a) return { ok: false, message: 'Not signed in.' };
  if (typeof csv !== 'string' || csv.length > 2_000_000) return { ok: false, message: 'That file is too big.' };
  const parsed = parseCustomersCsv(csv);
  if (parsed.rows.length === 0) return { ok: false, message: parsed.problems[0] ?? 'Nothing to import.' };
  const r = await importCustomers(parsed.rows, a.email, getDb());
  if (!r.ok) return { ok: false, message: r.error };
  return {
    ok: true,
    message: `Added ${r.added} customer${r.added === 1 ? '' : 's'}${r.skipped ? `, ${r.skipped} already here (left as they are)` : ''}.${
      parsed.problems.length ? ` ${parsed.problems.length} row${parsed.problems.length === 1 ? '' : 's'} skipped.` : ''
    }`,
  };
}

/** "Set up several": price / every / round / usual payment for the ticked customers; blank fields are left alone. */
export async function bulkSetupAction(form: FormData): Promise<void> {
  const a = await admin();
  const r = await bulkSetup(
    form.getAll('ids').map(String),
    { price: text(form, 'price'), frequencyWeeks: text(form, 'frequencyWeeks'), roundId: text(form, 'roundId'), preferredPayment: text(form, 'preferredPayment') },
    a.email,
    getDb(),
  );
  const back = /^\/admin\/customers(\?[\w=&%.\-]*)?$/.test(text(form, 'back')) ? text(form, 'back') : '/admin/customers?bulk=1';
  redirect(withFlash(back, r.ok ? 'ok' : 'error', r.ok ? `Updated ${r.changed} customer${r.changed === 1 ? '' : 's'}.` : r.error));
}
