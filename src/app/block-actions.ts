'use server';

import { revalidatePath } from 'next/cache';
import { getAdmin } from '@/lib/auth/session';
import { removePhotoObjects, storeUploadedPhoto } from '@/lib/photo-store';
import { addImageBlock, addTextBlock, deleteBlock, placeBlock, updateBlockText, type Result } from '@/lib/blocks';

/**
 * Server actions behind the pencil's photo and text blocks. Every one re-checks the session and
 * allow-list (ADR 0003); Next verifies Origin on Server Actions (CSRF). Hiding the buttons is not access control.
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

/** `file` was resized in the browser; width/height come from there and only drive layout (admin-only, clamped). */
export async function addPhotoBlockAction(formData: FormData): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  const stored = await storeUploadedPhoto(formData);
  if (!stored.ok) return stored;
  const { hash, width, height, type } = stored;
  return done(await addImageBlock({ zone: formData.get('zone'), hash, width, height, contentType: type, by: admin.email }));
}

export async function addTextBlockAction(zone: string): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  return done(await addTextBlock({ zone, by: admin.email }));
}

export async function updateBlockTextAction(id: string, locale: string, text: string): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  return done(await updateBlockText({ id, locale, text, by: admin.email }));
}

export async function placeBlockAction(id: string, zone: string, index: number): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  return done(await placeBlock({ id, zone, index, by: admin.email }));
}

export async function deleteBlockAction(id: string): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  const result = await deleteBlock({ id, by: admin.email });
  if (!result.ok) return result;
  if (result.orphanHash) await removePhotoObjects([result.orphanHash]);
  refresh();
  return { ok: true };
}
