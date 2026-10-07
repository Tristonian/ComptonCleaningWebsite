'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { PLAN_START_COOKIE, PLAN_START_MAX_AGE_SECONDS, serialisePlanStart } from '@/lib/plan-start';
import { isPlausibleUkPoint } from '@/lib/geo';
import { getAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { addPaymentMethod, createRoundFrom, deleteRound, removePaymentMethod, renamePaymentMethod, setRoundOrder, updateRound } from '@/lib/customers';
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
  // Saved from Settings, or from a day's panel on the Calendar (which sends that page's address back).
  const b = text(form, 'back');
  const back = /^\/admin\/calendar(\?[\w=&%.\-]*)?$/.test(b) ? b : '/admin/settings';
  redirect(flash(back, r.ok ? 'ok' : 'error', r.ok ? 'Call hours saved.' : r.error));
}

export async function saveRoundAction(form: FormData): Promise<void> {
  const a = await admin();
  const r = await updateRound(text(form, 'id'), { name: text(form, 'name'), weekday: text(form, 'weekday') }, a.email, getDb());
  redirect(flash('/admin/rounds', r.ok ? 'ok' : 'error', r.ok ? 'Round saved.' : r.error));
}

/** Called by the drag-to-order list. Returns a result so the list can stay on the page. */
export async function saveRoundOrderAction(roundId: string, ids: string[]): Promise<{ ok: boolean; error?: string }> {
  const a = await getAdmin();
  if (!a) return { ok: false, error: 'Not signed in.' };
  if (!Array.isArray(ids) || ids.length > 2000) return { ok: false, error: 'That order does not look right.' };
  return setRoundOrder(String(roundId), ids.map(String), a.email, getDb());
}

/** Save the order the planner proposed. The ids come back from the page, but only members of the round are used. */
export async function applyRoundPlanAction(form: FormData): Promise<void> {
  const a = await admin();
  const round = text(form, 'roundId');
  const r = await setRoundOrder(round, form.getAll('ids').map(String), a.email, getDb());
  redirect(flash(`/admin/rounds?round=${/^\d+$/.test(round) ? round : ''}`, r.ok ? 'ok' : 'error', r.ok ? 'Order saved. The Work screen now follows it.' : r.error));
}

/** Remember the phone's position for two hours so the route planner can start from it. Never put in a URL. */
export async function setPlanStartAction(lat: number, lng: number): Promise<{ ok: boolean }> {
  const a = await getAdmin();
  if (!a) return { ok: false };
  if (typeof lat !== 'number' || typeof lng !== 'number' || !isPlausibleUkPoint(lat, lng)) return { ok: false };
  (await cookies()).set(PLAN_START_COOKIE, serialisePlanStart(lat, lng), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/admin',
    maxAge: PLAN_START_MAX_AGE_SECONDS,
  });
  return { ok: true };
}

export async function clearPlanStartAction(): Promise<{ ok: boolean }> {
  const a = await getAdmin();
  if (!a) return { ok: false };
  (await cookies()).delete({ name: PLAN_START_COOKIE, path: '/admin' });
  return { ok: true };
}

/** Build a round from the ticked customers, then open it on its best-order preview. */
export async function buildRoundAction(form: FormData): Promise<void> {
  const a = await admin();
  const r = await createRoundFrom({ name: text(form, 'name'), weekday: text(form, 'weekday') }, form.getAll('ids').map(String), a.email, getDb());
  if (!r.ok) redirect(flash('/admin/rounds', 'error', r.error));
  redirect(flash(`/admin/rounds?round=${r.id}&plan=all`, 'ok', `Round built with ${r.added} stop${r.added === 1 ? '' : 's'}. Here is its best order.`));
}

export async function deleteRoundAction(form: FormData): Promise<void> {
  const a = await admin();
  if (form.get('confirm') !== 'on') redirect(flash(`/admin/rounds?round=${/^\d+$/.test(text(form, 'id')) ? text(form, 'id') : ''}`, 'error', 'Tick the box to confirm the delete.'));
  const r = await deleteRound(text(form, 'id'), a.email, getDb());
  redirect(flash('/admin/rounds', r.ok ? 'ok' : 'error', r.ok ? 'Round deleted. Its customers are untouched.' : r.error));
}
