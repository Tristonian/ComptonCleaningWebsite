'use server';

import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { addPaymentMethod, moveInRound, removePaymentMethod, renamePaymentMethod, setRoundOrder, updateRound } from '@/lib/customers';
import { setCallHours } from '@/lib/schedule';

/**
 * Server actions behind Settings (payment methods, usual call hours, rounds). These are HTTP endpoints:
 * every one re-checks the session and allow-list first (ADR 0003).
 */

async function admin() {
  const a = await getAdmin();
  if (!a) redirect('/admin/login');
  return a;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '');
const flash = (path: string, kind: 'ok' | 'error', msg: string) => `${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`;

export async function addPaymentMethodAction(form: FormData): Promise<void> {
  const a = await admin();
  const r = await addPaymentMethod(text(form, 'label'), a.email, getDb());
  redirect(flash('/admin/settings', r.ok ? 'ok' : 'error', r.ok ? 'Added.' : r.error));
}

export async function renamePaymentMethodAction(form: FormData): Promise<void> {
  const a = await admin();
  const r = await renamePaymentMethod(text(form, 'key'), text(form, 'label'), a.email, getDb());
  redirect(flash('/admin/settings', r.ok ? 'ok' : 'error', r.ok ? 'Renamed.' : r.error));
}

export async function removePaymentMethodAction(form: FormData): Promise<void> {
  const a = await admin();
  const r = await removePaymentMethod(text(form, 'key'), a.email, getDb());
  redirect(flash('/admin/settings', r.ok ? 'ok' : 'error', r.ok ? 'Removed.' : r.error));
}

/** One weekday's windows: up to two, from `opens0`/`closes0`, `opens1`/`closes1`. Blank rows are ignored. */
export async function saveCallHoursAction(form: FormData): Promise<void> {
  const a = await admin();
  const weekday = text(form, 'weekday');
  // A day that is switched off has no windows at all.
  const windows = form.get('open') === 'on' ? [0, 1].map((i) => ({ opens: text(form, `opens${i}`), closes: text(form, `closes${i}`) })) : [];
  const r = await setCallHours(weekday, windows, a.email, getDb());
  redirect(flash('/admin/settings', r.ok ? 'ok' : 'error', r.ok ? 'Call hours saved.' : r.error));
}

export async function saveRoundAction(form: FormData): Promise<void> {
  const a = await admin();
  const r = await updateRound(text(form, 'id'), { name: text(form, 'name'), weekday: text(form, 'weekday') }, a.email, getDb());
  redirect(flash('/admin/rounds', r.ok ? 'ok' : 'error', r.ok ? 'Round saved.' : r.error));
}

export async function moveInRoundAction(form: FormData): Promise<void> {
  const a = await admin();
  const round = text(form, 'roundId');
  const r = await moveInRound(round, text(form, 'customerId'), text(form, 'step') === 'up' ? -1 : 1, a.email, getDb());
  redirect(flash(`/admin/rounds?round=${/^\d+$/.test(round) ? round : ''}`, r.ok ? 'ok' : 'error', r.ok ? 'Moved.' : r.error));
}

/** Save the order the planner proposed. The ids come back from the page, but only members of the round are used. */
export async function applyRoundPlanAction(form: FormData): Promise<void> {
  const a = await admin();
  const round = text(form, 'roundId');
  const r = await setRoundOrder(round, form.getAll('ids').map(String), a.email, getDb());
  redirect(flash(`/admin/rounds?round=${/^\d+$/.test(round) ? round : ''}`, r.ok ? 'ok' : 'error', r.ok ? 'Order saved. The Work screen now follows it.' : r.error));
}
