import { DEFAULT_LOGO_SIZE, MAX_LOGO_BYTES } from '@/lib/appearance-shared';

/**
 * Browser-side logo preparation (ADR 0002: images are resized BEFORE upload; pattern from the
 * HairByRachel cropper). Always re-encodes to PNG so transparency survives and EXIF/GPS is dropped.
 * The server still enforces the byte cap and the PNG signature: this is the courtesy, that is the guard.
 */

export const LOGO_ASPECT = DEFAULT_LOGO_SIZE.width / DEFAULT_LOGO_SIZE.height;
export const LOGO_OUTPUT_WIDTHS = [1200, 900, 600] as const;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export class LogoError extends Error {}

export async function decodeLogo(file: File): Promise<ImageBitmap> {
  if (!ALLOWED.includes(file.type)) {
    throw new LogoError(
      file.type === 'image/svg+xml'
        ? 'SVG files are not supported. Please save it as a PNG and upload that.'
        : 'That file is not an image we can use. Please pick a PNG, JPG or WebP.',
    );
  }
  if (file.size > MAX_SOURCE_BYTES) throw new LogoError('That image is enormous. Please pick one under 25 MB.');
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new LogoError('That image could not be read. Please try a different file.');
  }
}

/** Where the image sits inside the crop frame, in frame fractions: centre offset and scale. */
export type Placement = {
  /** Image width as a fraction of the frame width. */
  scale: number;
  /** Image centre relative to the frame centre, as a fraction of frame width / height. */
  dx: number;
  dy: number;
};

/** Draws the frame exactly as previewed, at several widths until it fits under the byte cap. */
export async function renderLogo(bitmap: ImageBitmap, p: Placement, name: string): Promise<File> {
  for (const width of LOGO_OUTPUT_WIDTHS) {
    const height = Math.round(width / LOGO_ASPECT);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new LogoError('This browser cannot resize images. Please try another.');
    ctx.imageSmoothingQuality = 'high';
    const w = p.scale * width;
    const h = (w * bitmap.height) / bitmap.width;
    ctx.drawImage(bitmap, width / 2 + p.dx * width - w / 2, height / 2 + p.dy * height - h / 2, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob && blob.size <= MAX_LOGO_BYTES) {
      return new File([blob], `${name.replace(/\.[^.]+$/, '') || 'logo'}.png`, { type: 'image/png' });
    }
  }
  throw new LogoError('That image is still too large after shrinking. Please try a simpler picture.');
}
