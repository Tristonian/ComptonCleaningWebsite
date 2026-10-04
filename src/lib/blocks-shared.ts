/** Pure block definitions: safe for client and server. */

/** The places a block can go, top to bottom on the page. Adding a zone = add here + one <BlockZone> in HomePage. */
export const ZONES = [
  { id: 'intro', label: 'Under the intro' },
  { id: 'service-windows', label: 'Under Window cleaning' },
  { id: 'service-gutters', label: 'Under Gutters' },
  { id: 'service-other', label: 'Under Other jobs' },
  { id: 'services', label: 'Under Services' },
  { id: 'prices', label: 'Under Prices' },
  { id: 'reviews', label: 'Under Reviews' },
] as const;

export type ZoneId = (typeof ZONES)[number]['id'];
export const isZone = (v: unknown): v is ZoneId => ZONES.some((z) => z.id === v);

export type Block = {
  id: string;
  zone: ZoneId;
  kind: 'image' | 'text';
  hash: string | null;
  width: number | null;
  height: number | null;
  textEn: string;
  textCy: string;
};

export const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
export const MAX_BLOCK_TEXT = 2000;

export type PhotoType = 'image/png' | 'image/jpeg' | 'image/webp';

/** What the bytes really are (never the client's claim). SVG is deliberately not accepted (stored XSS). */
export function sniffImage(b: Uint8Array): PhotoType | null {
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  const ascii = (from: number, s: string) => [...s].every((c, i) => b[from + i] === c.charCodeAt(0));
  if (b.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  return null;
}

/** Block text as shown in a language: Welsh falls back to English while it is empty. */
export const blockText = (b: Block, locale: 'en' | 'cy') => (locale === 'cy' && b.textCy ? b.textCy : b.textEn);
