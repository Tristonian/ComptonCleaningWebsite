import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { MAX_PHOTO_BYTES, sniffImage } from '@/lib/blocks-shared';

/**
 * R2 side of photos (ADR 0002): validate the bytes of an upload, store them under `photo/<sha256>`, and
 * remove objects nothing references any more. Server actions only; the database never calls this, so
 * tests need no Cloudflare.
 */

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type Stored = { ok: true; hash: string; width: number; height: number; type: string } | { ok: false; error: string };

/** `file`, `width`, `height` come from a form; the browser resized the photo, the server trusts only the bytes. */
export async function storeUploadedPhoto(formData: FormData): Promise<Stored> {
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
    console.error('[photos] R2 put failed:', err);
    return { ok: false, error: 'Could not store the photo. Try again.' };
  }
  return { ok: true, hash, width, height, type };
}

/** Best effort: a leftover object is unreachable by anything and harmless, so failures are only logged. */
export async function removePhotoObjects(hashes: string[]): Promise<void> {
  if (hashes.length === 0) return;
  try {
    const bucket = getCloudflareContext().env.SITE_IMAGES;
    await Promise.all(hashes.map((h) => bucket.delete(`photo/${h}`)));
  } catch (err) {
    console.error('[photos] R2 delete failed:', err);
  }
}
