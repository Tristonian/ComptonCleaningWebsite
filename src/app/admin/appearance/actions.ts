'use server';

import { revalidatePath } from 'next/cache';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getAdmin } from '@/lib/auth/session';
import { MAX_LOGO_BYTES, pngSize } from '@/lib/appearance-shared';
import { addLogo, removeLogo, setActiveLogo, setHeroColour, type Result } from '@/lib/appearance';

/**
 * Server actions behind /admin/appearance. These are HTTP endpoints, so EVERY one re-checks the
 * session and allow-list (ADR 0003); Next verifies the Origin header on Server Actions (CSRF).
 */

const DENIED: Result = { ok: false, error: 'Not signed in.' };

const refresh = () => {
  revalidatePath('/');
  revalidatePath('/cy');
  revalidatePath('/admin/appearance');
};

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function uploadLogoAction(formData: FormData): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;

  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'No file received.' };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: 'That file is too large.' };

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const size = pngSize(bytes);
  if (!size) return { ok: false, error: 'Only PNG logos are accepted (the cropper makes one for you).' };

  const hash = await sha256Hex(buffer);
  try {
    const { env } = getCloudflareContext();
    await env.SITE_IMAGES.put(`logo/${hash}`, buffer, {
      httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' },
    });
  } catch (err) {
    console.error('[appearance] R2 put failed:', err);
    return { ok: false, error: 'Could not store the image. Try again.' };
  }

  const label = String(formData.get('label') ?? '').trim();
  const result = await addLogo({ hash, ...size, label, by: admin.email });
  if (result.ok) refresh();
  return result;
}

export async function selectLogoAction(hash: string | null): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  const result = await setActiveLogo(hash, admin.email);
  if (result.ok) refresh();
  return result;
}

export async function deleteLogoAction(hash: string): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  const result = await removeLogo(hash, admin.email);
  if (result.ok) {
    try {
      await getCloudflareContext().env.SITE_IMAGES.delete(`logo/${hash}`);
    } catch (err) {
      // The row is gone, so the image is unreachable; a stray object is harmless and cheap.
      console.error('[appearance] R2 delete failed:', err);
    }
    refresh();
  }
  return result;
}

export async function setHeroColourAction(colour: string | null): Promise<Result> {
  const admin = await getAdmin();
  if (!admin) return DENIED;
  const result = await setHeroColour(colour, admin.email);
  if (result.ok) refresh();
  return result;
}
