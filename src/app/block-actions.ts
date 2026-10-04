'use server';

import { revalidatePath } from 'next/cache';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getAdmin } from '@/lib/auth/session';
import { MAX_PHOTO_BYTES, sniffImage } from '@/lib/blocks-shared';
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

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** `file` was resized in the browser; width/height come from there and only drive layout (admin-only, clamped). */
export async function addPhotoBlockAction(formData: FormData): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;

  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'No file received.' };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: 'That photo is too large even after shrinking.' };

  const buffer = await file.arrayBuffer();
  const type = sniffImage(new Uint8Array(buffer));
  if (!type) return { ok: false, error: 'Only PNG, JPG or WebP photos are accepted.' };

  const width = Math.round(Number(formData.get('width')));
  const height = Math.round(Number(formData.get('height')));
  if (!(width >= 1 && width <= 4000 && height >= 1 && height <= 4000)) return { ok: false, error: 'Bad image size.' };

  const hash = await sha256Hex(buffer);
  try {
    await getCloudflareContext().env.SITE_IMAGES.put(`photo/${hash}`, buffer, {
      httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
    });
  } catch (err) {
    console.error('[blocks] R2 put failed:', err);
    return { ok: false, error: 'Could not store the photo. Try again.' };
  }
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
  if (result.orphanHash) {
    try {
      await getCloudflareContext().env.SITE_IMAGES.delete(`photo/${result.orphanHash}`);
    } catch (err) {
      console.error('[blocks] R2 delete failed:', err); // unreachable stray object: harmless
    }
  }
  refresh();
  return { ok: true };
}
