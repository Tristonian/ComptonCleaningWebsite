import { isPlausibleUkPoint } from '@/lib/geo';

/**
 * Where today's plan should start: the phone's location, remembered for a couple of hours in a cookie so it
 * never appears in a web address (a location is personal data). Pure parsing, safe in tests.
 */

export const PLAN_START_COOKIE = 'plan_start';
export const PLAN_START_MAX_AGE_SECONDS = 2 * 60 * 60;

export type PlanStart = { lat: number; lng: number; at: number };

export function serialisePlanStart(lat: number, lng: number, now: number = Date.now()): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)},${Math.round(now)}`;
}

/** The remembered start, or null if it is missing, malformed, outside the UK, or older than the cookie's life. */
export function parsePlanStart(raw: string | undefined | null, now: number = Date.now()): PlanStart | null {
  const m = /^(-?\d{1,2}\.\d{1,6}),(-?\d{1,3}\.\d{1,6}),(\d{10,14})$/.exec(String(raw ?? ''));
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  const at = Number(m[3]);
  if (!isPlausibleUkPoint(lat, lng)) return null;
  if (now - at > PLAN_START_MAX_AGE_SECONDS * 1000 || at > now + 60_000) return null;
  return { lat, lng, at };
}
