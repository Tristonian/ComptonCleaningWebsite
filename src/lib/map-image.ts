import 'server-only';
import type { LatLng } from '@/lib/geo';
import { isPlausibleUkPoint } from '@/lib/geo';
import type { InlineImage } from '@/lib/mail';

const MAX_BYTES = 1_500_000;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * A map picture for the enquiry email, fetched server side from Mapbox's Static Images API and
 * attached inline. It cannot be a plain image link in the email: Gmail's image proxy sends no
 * Referer, and our token is URL-restricted, so Mapbox would refuse it. We send our own site as the
 * Referer instead. Any failure returns null: the email goes out without the picture.
 */
export async function fetchMapImage(
  point: LatLng,
  token: string | undefined,
  siteOrigin: string,
): Promise<InlineImage | null> {
  if (!token) return null;
  try {
    const { lat, lng } = point;
    const url =
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+085478(${lng},${lat})/` +
      `${lng},${lat},16,0/600x320@2x?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      headers: { Referer: `${siteOrigin}/` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.warn('[map-image] mapbox responded', res.status);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;
    return {
      filename: 'map.png',
      contentBase64: toBase64(bytes),
      contentType: res.headers.get('content-type') ?? 'image/png',
      contentId: 'map',
    };
  } catch (err) {
    console.warn('[map-image] could not fetch the map:', err);
    return null;
  }
}

/** The centre of a postcode (postcodes.io, free, no key), for a map when no pin was placed. */
export async function postcodeCentre(postcode: string): Promise<LatLng | null> {
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ''))}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const { result } = (await res.json()) as { result?: { latitude: number; longitude: number } };
    if (result && isPlausibleUkPoint(result.latitude, result.longitude)) {
      return { lat: result.latitude, lng: result.longitude };
    }
  } catch {
    // Fall through: no approximate map.
  }
  return null;
}
