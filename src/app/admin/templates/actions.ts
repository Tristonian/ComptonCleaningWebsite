'use server';

import { revalidatePath } from 'next/cache';
import { getAdmin } from '@/lib/auth/session';
import { resetTemplate, saveTemplate, type Result } from '@/lib/templates';

/**
 * Server actions behind /admin/templates. These are HTTP endpoints, so EVERY one re-checks the
 * session and allow-list (ADR 0003).
 */

const DENIED: Result = { ok: false, error: 'Not signed in.' };

const refresh = () => {
  revalidatePath('/admin/templates');
  revalidatePath('/admin/customers');
  revalidatePath('/admin/enquiries', 'layout');
};

export async function saveTemplateAction(input: {
  key: string;
  enabled: boolean;
  subject: string;
  body: string;
}): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  const result = await saveTemplate({ ...input, by: admin.email });
  if (result.ok) refresh();
  return result;
}

export async function resetTemplateAction(key: string): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  const result = await resetTemplate({ key, by: admin.email });
  if (result.ok) refresh();
  return result;
}
