/**
 * Round ordering maths (ADR 0012). Pure: no network, no database, safe in tests and the browser.
 *
 * A "matrix" is `m[i][j]` = seconds to drive from stop i to stop j. Stop 0 is where the day starts (Sam's
 * base). The solver finds the order of the other stops that makes the total drive shortest. Up to
 * EXACT_LIMIT stops the answer is exact (Held-Karp); beyond that it is nearest-neighbour improved by
 * 2-opt and relocate moves, which on a round-sized problem is within a few percent of the best.
 * Durations may be asymmetric (one-way streets), so every candidate is costed in full, never by edge swaps.
 */

export type Matrix = number[][];

/** Exact search is cheap up to here (2^12 * 12 * 12 steps). */
export const EXACT_LIMIT = 12;

export const EARTH_KM = 6371;

/** Great-circle distance in kilometres. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A stand-in drive time when there is no road data: straight line, a 1.35 detour factor for real roads,
 * and an average 32 km/h for town driving with stops. Only used when the routing service is unavailable.
 */
export function estimateSeconds(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return Math.round(((haversineKm(a, b) * 1.35) / 32) * 3600);
}

/** Total seconds for base -> order[0] -> ... -> order[n-1] (-> base when `returnToStart`). */
export function tourSeconds(m: Matrix, order: number[], returnToStart: boolean): number {
  let total = 0;
  let prev = 0;
  for (const stop of order) {
    total += m[prev][stop];
    prev = stop;
  }
  if (returnToStart && order.length > 0) total += m[prev][0];
  return total;
}

/** Exact best order of stops 1..n-1 by dynamic programming over subsets. */
function heldKarp(m: Matrix, returnToStart: boolean): number[] {
  const n = m.length - 1; // stops, excluding the start
  if (n <= 0) return [];
  const full = (1 << n) - 1;
  const cost = Array.from({ length: 1 << n }, () => new Float64Array(n).fill(Infinity));
  const from = Array.from({ length: 1 << n }, () => new Int16Array(n).fill(-1));
  for (let j = 0; j < n; j++) cost[1 << j][j] = m[0][j + 1];
  for (let set = 1; set <= full; set++) {
    for (let last = 0; last < n; last++) {
      if (!(set & (1 << last))) continue;
      const here = cost[set][last];
      if (here === Infinity) continue;
      for (let next = 0; next < n; next++) {
        if (set & (1 << next)) continue;
        const nset = set | (1 << next);
        const c = here + m[last + 1][next + 1];
        if (c < cost[nset][next]) {
          cost[nset][next] = c;
          from[nset][next] = last;
        }
      }
    }
  }
  let best = Infinity;
  let end = 0;
  for (let j = 0; j < n; j++) {
    const c = cost[full][j] + (returnToStart ? m[j + 1][0] : 0);
    if (c < best) {
      best = c;
      end = j;
    }
  }
  const order: number[] = [];
  let set = full;
  let at = end;
  while (at !== -1) {
    order.push(at + 1);
    const prev = from[set][at];
    set &= ~(1 << at);
    at = prev;
  }
  return order.reverse();
}

function nearestNeighbour(m: Matrix): number[] {
  const left = new Set(Array.from({ length: m.length - 1 }, (_, i) => i + 1));
  const order: number[] = [];
  let at = 0;
  while (left.size) {
    let best = -1;
    for (const j of left) if (best === -1 || m[at][j] < m[at][best]) best = j;
    order.push(best);
    left.delete(best);
    at = best;
  }
  return order;
}

/** Keep applying the first improving 2-opt reversal or single-stop relocation until none helps. */
function improve(m: Matrix, start: number[], returnToStart: boolean): number[] {
  let order = start.slice();
  let cost = tourSeconds(m, order, returnToStart);
  for (let pass = 0; pass < 200; pass++) {
    let better = false;
    for (let i = 0; i < order.length && !better; i++) {
      for (let j = i + 1; j < order.length && !better; j++) {
        const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        const c = tourSeconds(m, cand, returnToStart);
        if (c < cost - 1e-9) {
          order = cand;
          cost = c;
          better = true;
        }
      }
    }
    for (let i = 0; i < order.length && !better; i++) {
      const without = order.filter((_, k) => k !== i);
      for (let pos = 0; pos <= without.length && !better; pos++) {
        if (pos === i) continue;
        const cand = [...without.slice(0, pos), order[i], ...without.slice(pos)];
        const c = tourSeconds(m, cand, returnToStart);
        if (c < cost - 1e-9) {
          order = cand;
          cost = c;
          better = true;
        }
      }
    }
    if (!better) break;
  }
  return order;
}

/**
 * The best order of stops 1..n-1 (indices into the matrix) starting from stop 0. `returnToStart` counts the
 * drive home at the end; without it the day simply finishes at the last stop.
 */
export function optimiseOrder(m: Matrix, returnToStart = true): number[] {
  const n = m.length - 1;
  if (n <= 1) return n === 1 ? [1] : [];
  if (n <= EXACT_LIMIT) return heldKarp(m, returnToStart);
  return improve(m, nearestNeighbour(m), returnToStart);
}

/** Legs of a tour in seconds: base -> first, ..., (last -> base). Handy for the "12 min" labels. */
export function legSeconds(m: Matrix, order: number[], returnToStart: boolean): number[] {
  const legs: number[] = [];
  let prev = 0;
  for (const stop of order) {
    legs.push(m[prev][stop]);
    prev = stop;
  }
  if (returnToStart && order.length > 0) legs.push(m[prev][0]);
  return legs;
}

/**
 * Google Maps directions links for an ordered list of points, in chunks, because a link takes at most nine
 * waypoints. Each link starts where the last one ended, so tapping them in turn walks the whole day.
 */
export function mapsLinks(start: { lat: number; lng: number }, stops: { lat: number; lng: number }[], returnHome: boolean, chunk = 9): { label: string; url: string }[] {
  const pt = (p: { lat: number; lng: number }) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  const links: { label: string; url: string }[] = [];
  let origin = start;
  for (let i = 0; i < stops.length; i += chunk) {
    const part = stops.slice(i, i + chunk);
    const lastChunk = i + chunk >= stops.length;
    const destination = lastChunk && returnHome ? start : part[part.length - 1];
    const via = lastChunk && returnHome ? part : part.slice(0, -1);
    const params = new URLSearchParams({ api: '1', origin: pt(origin), destination: pt(destination), travelmode: 'driving' });
    if (via.length) params.set('waypoints', via.map(pt).join('|'));
    links.push({
      label: stops.length <= chunk ? 'Open in Google Maps' : `Stops ${i + 1}–${Math.min(i + chunk, stops.length)}`,
      url: `https://www.google.com/maps/dir/?${params.toString().replace(/%2C/g, ',').replace(/%7C/g, '|')}`,
    });
    origin = part[part.length - 1];
  }
  return links;
}

/** "12 min", "1 h 05 min". */
export function formatDrive(seconds: number): string {
  const mins = Math.max(0, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}
