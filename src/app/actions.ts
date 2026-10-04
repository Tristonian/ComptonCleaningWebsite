'use server';

import { getAdmin } from '@/lib/auth/session';
import { resetNode, saveNode, type SaveResult } from '@/lib/content/store';

/**
 * Server actions behind the pencil (ADR 0004). These are HTTP endpoints: hiding the button
 * from visitors is not access control, so EVERY action re-checks the session and allow-list
 * first. Next also verifies the Origin header on Server Actions, which covers CSRF.
 */

const DENIED: SaveResult = { ok: false, error: 'Not signed in.' };

export async function saveNodeAction(locale: string, key: string, value: string): Promise<SaveResult> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  return saveNode({ locale, key, value, by: admin.email });
}

export async function resetNodeAction(locale: string, key: string): Promise<SaveResult> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  return resetNode({ locale, key, by: admin.email });
}
