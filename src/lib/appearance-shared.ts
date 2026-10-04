/** Pure helpers for logo/colour validation: safe to import from client and server code. */

export const DEFAULT_LOGO_SRC = '/ccs-logo.png';
export const DEFAULT_LOGO_SIZE = { width: 1482, height: 778 };
export const MAX_LOGO_BYTES = 3 * 1024 * 1024;

const HEX = /^#[0-9a-f]{6}$/;

/** Normalises "#0E8ABE" / "0e8abe" to "#0e8abe"; null if it is not a six-digit hex colour. */
export function normaliseHex(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const t = input.trim().toLowerCase();
  const withHash = t.startsWith('#') ? t : `#${t}`;
  return HEX.test(withHash) ? withHash : null;
}

/** WCAG contrast ratio of white text on this colour (the hero text is white). */
export function whiteContrast(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  return 1.05 / (lum + 0.05);
}

/** Reads width/height from a PNG's IHDR chunk; null if the bytes are not a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || sig.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width < 1 || height < 1 || width > 4000 || height > 4000) return null;
  return { width, height };
}

export const isImageHash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);

export const logoSrc = (hash: string) => `/img/${hash}`;
