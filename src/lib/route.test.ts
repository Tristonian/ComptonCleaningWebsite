import { describe, expect, it } from 'vitest';
import { EXACT_LIMIT, estimateSeconds, formatDrive, haversineKm, legSeconds, mapsLinks, optimiseOrder, tourSeconds, type Matrix } from './route';

/** Points on a line, travel time = distance, so the right answer is obvious. */
function line(xs: number[]): Matrix {
  const all = [0, ...xs];
  return all.map((a) => all.map((b) => Math.abs(a - b)));
}

/** Small deterministic generator so the random cases are the same on every run. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function randomMatrix(n: number, seed: number, asymmetric = false): Matrix {
  const r = rng(seed);
  const pts = Array.from({ length: n + 1 }, () => ({ x: r() * 100, y: r() * 100 }));
  return pts.map((a) =>
    pts.map((b) => {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      return a === b ? 0 : asymmetric && a.x > b.x ? d * 1.3 : d;
    }),
  );
}

const isPermutation = (order: number[], n: number) => order.length === n && new Set(order).size === n && order.every((i) => i >= 1 && i <= n);

describe('optimiseOrder', () => {
  it('handles no stops and one stop', () => {
    expect(optimiseOrder([[0]])).toEqual([]);
    expect(optimiseOrder(line([5]))).toEqual([1]);
  });

  it('visits stops along a line in order, out and back', () => {
    // Stops at 30, 10, 20 (indices 1, 2, 3): best is 10, 20, 30 = indices 2, 3, 1.
    expect(optimiseOrder(line([30, 10, 20]), true)).toEqual([2, 3, 1]);
  });

  it('can finish at the far end when it need not come home', () => {
    const m = line([10, -10]); // one stop each side of the base
    const home = optimiseOrder(m, true);
    const open = optimiseOrder(m, false);
    expect(tourSeconds(m, home, true)).toBe(40);
    expect(tourSeconds(m, open, false)).toBe(30); // go to one side, then across: 10 + 20
  });

  it('is exact up to the limit: matches brute force', () => {
    const m = randomMatrix(7, 11, true);
    const best = Math.min(...permutations([1, 2, 3, 4, 5, 6, 7]).map((p) => tourSeconds(m, p, true)));
    expect(tourSeconds(m, optimiseOrder(m, true), true)).toBeCloseTo(best, 6);
  });

  it('gives a valid, good order beyond the exact limit', () => {
    const n = EXACT_LIMIT + 8;
    for (const seed of [1, 2, 3]) {
      const m = randomMatrix(n, seed);
      const order = optimiseOrder(m, true);
      expect(isPermutation(order, n)).toBe(true);
      // Never worse than just visiting in the order given.
      const given = Array.from({ length: n }, (_, i) => i + 1);
      expect(tourSeconds(m, order, true)).toBeLessThan(tourSeconds(m, given, true));
    }
  });

  it('copes with asymmetric times (one-way streets)', () => {
    const n = EXACT_LIMIT + 3;
    const m = randomMatrix(n, 5, true);
    expect(isPermutation(optimiseOrder(m, true), n)).toBe(true);
  });

  it('reports each leg and the drive home', () => {
    const m = line([10, 25]);
    expect(legSeconds(m, [1, 2], true)).toEqual([10, 15, 25]);
    expect(legSeconds(m, [1, 2], false)).toEqual([10, 15]);
  });
});

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}

describe('distances and links', () => {
  it('measures a known distance', () => {
    // Bristol to Newport is roughly 20 km as the crow flies.
    const km = haversineKm({ lat: 51.4545, lng: -2.5879 }, { lat: 51.5842, lng: -2.9977 });
    expect(km).toBeGreaterThan(28);
    expect(km).toBeLessThan(34);
    expect(haversineKm({ lat: 51.5, lng: -2.5 }, { lat: 51.5, lng: -2.5 })).toBe(0);
  });

  it('estimates a longer drive for a longer distance', () => {
    const base = { lat: 51.5, lng: -2.5 };
    expect(estimateSeconds(base, { lat: 51.51, lng: -2.5 })).toBeLessThan(estimateSeconds(base, { lat: 51.6, lng: -2.5 }));
    expect(estimateSeconds(base, base)).toBe(0);
  });

  it('formats a drive time', () => {
    expect(formatDrive(0)).toBe('0 min');
    expect(formatDrive(12 * 60 + 20)).toBe('12 min');
    expect(formatDrive(65 * 60)).toBe('1 h 05 min');
  });

  it('builds Maps links nine stops at a time, each starting where the last ended', () => {
    const start = { lat: 51.5, lng: -2.5 };
    const stops = Array.from({ length: 12 }, (_, i) => ({ lat: 51.5 + i / 1000, lng: -2.5 }));
    const links = mapsLinks(start, stops, true);
    expect(links.map((l) => l.label)).toEqual(['Stops 1–9', 'Stops 10–12']);
    const first = new URL(links[0].url);
    expect(first.searchParams.get('origin')).toBe('51.500000,-2.500000');
    expect(first.searchParams.get('destination')).toBe('51.508000,-2.500000'); // stop 9
    expect(first.searchParams.get('waypoints')!.split('|')).toHaveLength(8);
    const second = new URL(links[1].url);
    expect(second.searchParams.get('origin')).toBe('51.508000,-2.500000');
    expect(second.searchParams.get('destination')).toBe('51.500000,-2.500000'); // home
    expect(second.searchParams.get('waypoints')!.split('|')).toHaveLength(3);
    expect(mapsLinks(start, stops.slice(0, 3), false)[0].label).toBe('Open in Google Maps');
  });
});
