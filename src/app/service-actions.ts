'use server';

import { revalidatePath } from 'next/cache';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getAdmin } from '@/lib/auth/session';
import { addService, deleteService, moveService, updateService, type Result } from '@/lib/services-custom';
import { setSectionHidden } from '@/lib/sections';

/**
 * Server actions behind the pencil's services tools: add/edit/move/delete a service, hide/show a
 * section. Every one re-checks the admin session (ADR 0003); Next verifies
 * Origin on Server Actions (CSRF). Hiding the buttons is not access control.
 */

const DENIED: Result = { ok: false, error: 'Not signed in.' };
const refresh = () => {
  revalidatePath('/');
  revalidatePath('/cy');
};
const done = (r: Result) => {
  if (r.ok) refresh();
  return r;
};

async function removeFromR2(hashes: (string | null)[]) {
  for (const h of hashes) {
    if (!h) continue;
    try {
      await getCloudflareContext().env.SITE_IMAGES.delete(`photo/${h}`);
    } catch (err) {
      console.error('[services] R2 delete failed:', err); // unreachable stray object: harmless
    }
  }
}

export async function addServiceAction(): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  return done(await addService({ by: admin.email }));
}

export async function updateServiceAction(id: string, locale: string, title: string, body: string): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  return done(await updateService({ id, locale, title, body, by: admin.email }));
}

export async function moveServiceAction(id: string, dir: number): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  return done(await moveService({ id, dir, by: admin.email }));
}

export async function deleteServiceAction(id: string): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  const r = await deleteService({ id, by: admin.email });
  if (!r.ok) return r;
  await removeFromR2(r.orphanHashes);
  refresh();
  return { ok: true };
}

export async function setSectionHiddenAction(id: string, hidden: boolean): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  return done(await setSectionHidden({ id, hidden, by: admin.email }));
}
