import 'server-only';
import { getEnv } from '@/lib/env';
import { estimateSeconds, type Matrix } from '@/lib/route';

/**
 * Drive times between stops from the Mapbox Matrix API (real roads: a motorway is faster than a lane, one-way
 * streets count), fetched on the server. Fails soft: if the service cannot be reached, answers an error or
 * the token is refused, the times fall back to a straight-line estimate and `source` says so, so the page can
 * tell Sam the order is approximate instead of failing.
 *
 * The Matrix API takes at most 25 coordinates a request, so stops are split into chunks of CHUNK and each pair
 * of chunks is one request (sources = one chunk, destinations = the other).
 */

export type Point = { lat: number; lng: number };
export type TravelMatrix = { seconds: Matrix; source: 'mapbox' | 'estimate'; note?: string };

export const CHUNK = 12;
/** Stops (not counting the start) one plan will cover: 4 chunks, 16 requests, inside Mapbox's 60 a minute. */
export const MAX_STOPS = 36;

const coord = (p: Point) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`;

export function estimateMatrix(points: Point[]): Matrix {
  return points.map((a, i) => points.map((b, j) => (i === j ? 0 : estimateSeconds(a, b))));
}

type Fetcher = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

type Opts = { token?: string; referer?: string; fetchImpl?: Fetcher };

/** Index ranges [from, to) of each chunk of points. */
export function chunks(total: number, size = CHUNK): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < total; i += size) out.push([i, Math.min(i + size, total)]);
  return out;
}

export async function travelMatrix(points: Point[], opts: Opts = {}): Promise<TravelMatrix> {
  const estimate = (note: string): TravelMatrix => ({ seconds: estimateMatrix(points), source: 'estimate', note });
  if (points.length < 2) return { seconds: estimateMatrix(points), source: 'estimate' };
  if (points.length - 1 > MAX_STOPS) return estimate(`More than ${MAX_STOPS} stops, so drive times are estimated.`);
  const token = opts.token ?? getEnv('MAPBOX_SERVER_TOKEN') ?? getEnv('MAPBOX_TOKEN');
  if (!token) return estimate('No Mapbox token, so drive times are estimated.');
  const doFetch: Fetcher = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  // A public token is restricted to our website addresses, which Mapbox checks in the Referer header; a
  // server call has none of its own, so it states the site it belongs to.
  const referer = opts.referer ?? `${(getEnv('SITE_URL') ?? 'https://comptoncleaning.co.uk').replace(/\/+$/, '')}/`;

  const seconds: Matrix = points.map(() => points.map(() => NaN));
  const ranges = chunks(points.length);
  const jobs: [[number, number], [number, number]][] = ranges.flatMap((a) => ranges.map((b) => [a, b] as [[number, number], [number, number]]));

  async function run([a, b]: [[number, number], [number, number]]): Promise<string | null> {
    const same = a[0] === b[0];
    const idxA = Array.from({ length: a[1] - a[0] }, (_, i) => a[0] + i);
    const idxB = Array.from({ length: b[1] - b[0] }, (_, i) => b[0] + i);
    const used = same ? idxA : [...idxA, ...idxB];
    const url =
      `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${used.map((i) => coord(points[i])).join(';')}` +
      `?annotations=duration${same ? '' : `&sources=${idxA.map((_, k) => k).join(';')}&destinations=${idxB.map((_, k) => idxA.length + k).join(';')}`}` +
      `&access_token=${encodeURIComponent(token as string)}`;
    let body: { code?: string; durations?: (number | null)[][] };
    try {
      const res = await doFetch(url, { headers: { Referer: referer } });
      if (!res.ok) return res.status === 401 || res.status === 403 ? 'Mapbox refused the token' : `Mapbox answered ${res.status}`;
      body = (await res.json()) as typeof body;
    } catch {
      return 'Could not reach Mapbox';
    }
    if (body.code !== 'Ok' || !Array.isArray(body.durations)) return 'Mapbox could not work out the times';
    idxA.forEach((i, r) => idxB.forEach((j, c) => {
      const v = body.durations?.[r]?.[c];
      seconds[i][j] = typeof v === 'number' ? v : NaN;
    }));
    return null;
  }

  // A few at a time keeps well inside the rate limit and the Worker's connection limit.
  const problems: string[] = [];
  for (let i = 0; i < jobs.length; i += 4) {
    const results = await Promise.all(jobs.slice(i, i + 4).map(run));
    for (const r of results) if (r) problems.push(r);
    if (problems.length) break;
  }
  if (problems.length) return estimate(`${problems[0]}, so drive times are estimated.`);

  // A pair Mapbox found no road between (an island, a bad pin) is estimated rather than left empty.
  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      if (i === j) seconds[i][j] = 0;
      else if (!Number.isFinite(seconds[i][j])) seconds[i][j] = estimateSeconds(points[i], points[j]);
    }
  }
  return { seconds, source: 'mapbox' };
}
