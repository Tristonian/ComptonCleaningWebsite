// Weather for the admin home and work screen, from Open-Meteo (free, no key). Server-side only, cached per
// ~1 km area per London day, and it fails soft: any problem returns null and the page just omits the tile.
// Parsing and the window/ladder verdict are pure and unit tested.

/** Sam's base (Lyde Green, BS16). */
export const BASE = { lat: 51.5, lng: -2.5 };

export type Verdict = 'good' | 'ok' | 'poor' | 'ladders';

export type Day = {
  date: string; // YYYY-MM-DD, Europe/London
  rainChance: number | null; // %
  gustMph: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  verdict: Verdict;
  note: string; // plain-English reason, '' when all is well
};

// Thresholds. Rain streaks windows; gusts and ice make ladders and gutters dangerous.
export const RAIN_POOR = 60;
export const RAIN_OK = 35;
export const GUST_NO_LADDERS = 35;
export const GUST_CAUTION = 25;
export const FROST_ICE = 0;
export const FROST_RISK = 2;

export function assess(d: { rainChance: number | null; gustMph: number | null; tempMinC: number | null }): { verdict: Verdict; note: string } {
  const { rainChance: rain, gustMph: gust, tempMinC: min } = d;
  const notes: string[] = [];
  let verdict: Verdict = 'good';
  const raise = (v: Verdict) => {
    const order: Verdict[] = ['good', 'ok', 'poor', 'ladders'];
    if (order.indexOf(v) > order.indexOf(verdict)) verdict = v;
  };

  if (gust !== null && gust >= GUST_NO_LADDERS) {
    raise('ladders');
    notes.push(`Gusts to ${Math.round(gust)} mph: no ladders`);
  } else if (gust !== null && gust >= GUST_CAUTION) {
    raise('ok');
    notes.push(`Gusty (${Math.round(gust)} mph): take care with ladders`);
  }
  if (min !== null && min <= FROST_ICE) {
    raise('ladders');
    notes.push('Freezing: ice on ladders and gutters');
  } else if (min !== null && min <= FROST_RISK) {
    raise('ok');
    notes.push('Frost possible early on');
  }
  if (rain !== null && rain >= RAIN_POOR) {
    raise('poor');
    notes.push(`Rain likely (${Math.round(rain)}%)`);
  } else if (rain !== null && rain >= RAIN_OK) {
    raise('ok');
    notes.push(`Some rain risk (${Math.round(rain)}%)`);
  }
  return { verdict, note: notes.join('. ') };
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  good: 'Good for windows',
  ok: 'Fine, with care',
  poor: 'Poor for windows',
  ladders: 'Ladder warning',
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Turn an Open-Meteo `daily` payload into days. Returns null when the shape is not what we expect. */
export function parseForecast(json: unknown): Day[] | null {
  const daily = (json as { daily?: Record<string, unknown> } | null)?.daily;
  if (!daily || !Array.isArray(daily.time)) return null;
  const times = daily.time as unknown[];
  const col = (k: string) => (Array.isArray(daily[k]) ? (daily[k] as unknown[]) : []);
  const rain = col('precipitation_probability_max');
  const gust = col('wind_gusts_10m_max');
  const tmin = col('temperature_2m_min');
  const tmax = col('temperature_2m_max');
  const days: Day[] = [];
  times.forEach((t, i) => {
    if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return;
    const d = { rainChance: num(rain[i]), gustMph: num(gust[i]), tempMinC: num(tmin[i]), tempMaxC: num(tmax[i]) };
    days.push({ date: t, ...d, ...assess(d) });
  });
  return days.length ? days : null;
}

/** Centre of a set of pins (mean is fine for one town's round), or null with none. */
export function centroid(points: { lat: number | null; lng: number | null }[]): { lat: number; lng: number } | null {
  const ok = points.filter((p): p is { lat: number; lng: number } => p.lat !== null && p.lng !== null);
  if (!ok.length) return null;
  return { lat: ok.reduce((s, p) => s + p.lat, 0) / ok.length, lng: ok.reduce((s, p) => s + p.lng, 0) / ok.length };
}

/** ISO weekday of a YYYY-MM-DD date: Monday 1 … Sunday 7 (matches `rounds.weekday`). */
export function isoWeekday(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay() || 7;
}

/** ~1 km grid so nearby rounds share a cache entry. */
export const roundCoord = (n: number) => Math.round(n * 100) / 100;

export function forecastUrl(lat: number, lng: number): string {
  const q = new URLSearchParams({
    latitude: String(roundCoord(lat)),
    longitude: String(roundCoord(lng)),
    daily: 'precipitation_probability_max,wind_gusts_10m_max,temperature_2m_min,temperature_2m_max',
    wind_speed_unit: 'mph',
    timezone: 'Europe/London',
    forecast_days: '7',
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

const londonDate = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now);

/**
 * Fetch the week for a place. Cached per area per London day (Workers Cache API when present) for an hour at
 * most, and never throws: returns null on any failure so the admin never breaks over the weather.
 */
export async function getForecast(lat: number, lng: number, now: Date = new Date()): Promise<Day[] | null> {
  try {
    const url = forecastUrl(lat, lng);
    const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
    const key = new Request(`https://weather.cache.invalid/${londonDate(now)}/${roundCoord(lat)}/${roundCoord(lng)}`);
    if (cache) {
      const hit = await cache.match(key).catch(() => undefined);
      if (hit) return parseForecast(await hit.json());
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const json = await res.json();
    const days = parseForecast(json);
    if (days && cache) {
      await cache
        .put(key, new Response(JSON.stringify(json), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' } }))
        .catch(() => undefined);
    }
    return days;
  } catch (err) {
    console.error('[weather] forecast failed:', err);
    return null;
  }
}
