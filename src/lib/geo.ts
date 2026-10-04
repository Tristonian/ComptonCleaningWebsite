/** Pure location helpers, shared by the form, the server action and their tests. */

export interface LatLng {
  lat: number;
  lng: number;
}

/** A rough box around the UK and Ireland: anything outside is a mistake or a spoof, so it is dropped. */
export function isPlausibleUkPoint(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 49.5 &&
    lat <= 61 &&
    lng >= -11 &&
    lng <= 2.5
  );
}

/** Parse form strings into a point, or null if absent or implausible. 6 decimals is about 10 cm. */
export function parsePoint(rawLat: unknown, rawLng: unknown): LatLng | null {
  const num = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  const lat = num(rawLat);
  const lng = num(rawLng);
  if (!isPlausibleUkPoint(lat, lng)) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

/**
 * A Google Maps link for the enquiry email. A confirmed pin wins; otherwise a text search on the
 * address. No API key: it just opens the Maps app or site.
 */
export function mapsLink(args: { address: string; postcode: string; point: LatLng | null }): string {
  const query = args.point ? `${args.point.lat},${args.point.lng}` : `${args.address}, ${args.postcode}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
