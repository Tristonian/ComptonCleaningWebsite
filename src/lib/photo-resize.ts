import { MAX_PHOTO_BYTES } from '@/lib/blocks-shared';

/**
 * Shrinks a photo in the browser before upload (ADR 0002): a phone photo is 5-10 MB. Re-encoding
 * also drops EXIF, including the GPS position phones embed. Ladder: smaller size and lower quality
 * until it fits under the server's cap. WebP where the browser can encode it, JPEG otherwise.
 * Never upscales.
 */

const QUALITIES = [0.82, 0.7, 0.55] as const;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

export class PhotoError extends Error {}

/** `maxEdge` is the longest side in px: 1600 for page photos, 256 for service icons. */
export async function shrinkPhoto(file: File, maxEdge = 1600): Promise<{ file: File; width: number; height: number }> {
  if (!ALLOWED.includes(file.type)) {
    throw new PhotoError(
      file.type === 'image/svg+xml'
        ? 'SVG files are not supported. Please use a PNG, JPG or WebP.'
        : `${file.name || 'That file'} is not an image we can use. Please pick PNG, JPG or WebP photos.`,
    );
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError(`${file.name || 'That image'} could not be read.`);
  }
  try {
    for (const edge of [1, 0.75, 0.5].map((k) => Math.max(1, Math.round(maxEdge * k)))) {
      const k = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * k));
      const height = Math.max(1, Math.round(bitmap.height * k));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new PhotoError('This browser cannot resize images. Please try another.');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
      for (const q of QUALITIES) {
        let blob = await toBlob(canvas, 'image/webp', q);
        if (!blob || blob.type !== 'image/webp') {
          // No WebP encoder: JPEG has no alpha, so lay the photo on white first.
          const flat = document.createElement('canvas');
          flat.width = width;
          flat.height = height;
          const fctx = flat.getContext('2d')!;
          fctx.fillStyle = '#fff';
          fctx.fillRect(0, 0, width, height);
          fctx.drawImage(canvas, 0, 0);
          blob = await toBlob(flat, 'image/jpeg', q);
        }
        if (blob && blob.size <= MAX_PHOTO_BYTES) {
          const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
          const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
          return { file: new File([blob], `${base}.${ext}`, { type: blob.type }), width, height };
        }
      }
    }
  } finally {
    bitmap.close();
  }
  throw new PhotoError(`${file.name || 'That photo'} is still too large after shrinking.`);
}

const toBlob = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>((resolve) => c.toBlob(resolve, type, q));
