'use server';

import { revalidatePath } from 'next/cache';
import { getAdmin } from '@/lib/auth/session';
import { replaceOptions, resetOptions, type OptionRow, type Result } from '@/lib/form-options';

/**
 * Server actions behind the pencil's "Edit the choices" sheet for the contact form's drop-downs.
 * Every one re-checks the admin session (ADR 0003); Next verifies Origin on Server Actions (CSRF).
 */

const DENIED: Result = { ok: false, error: 'Not signed in.' };
const done = (r: Result) => {
  if (r.ok) {
    revalidatePath('/');
    revalidatePath('/cy');
  }
  return r;
};

export async function saveOptionsAction(list: string, rows: OptionRow[]): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  return done(await replaceOptions({ list, rows, by: admin.email }));
}

export async function resetOptionsAction(list: string): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  return done(await resetOptions({ list, by: admin.email }));
}
