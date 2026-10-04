import { describe, expect, it } from 'vitest';
import { CHUNK, MAX_STOPS, chunks, estimateMatrix, travelMatrix, type Point } from './travel';

const pts = (n: number): Point[] => Array.from({ length: n }, (_, i) => ({ lat: 51.5 + i * 0.01, lng: -2.5 + i * 0.005 }));

/** A fake Mapbox that answers every pair with 100 * (from index) + (to index) seconds, in request order. */
function fakeMapbox(calls: string[]) {
  return async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push(`${url}|${init?.headers?.Referer}`);
    const u = new URL(url);
    const n = u.pathname.split('/').pop()!.split(';').length;
    const sources = (u.searchParams.get('sources') ?? Array.from({ length: n }, (_, i) => i).join(';')).split(';').map(Number);
    const dests = (u.searchParams.get('destinations') ?? Array.from({ length: n }, (_, i) => i).join(';')).split(';').map(Number);
    return {
      ok: true,
      status: 200,
      json: async () => ({ code: 'Ok', durations: sources.map((s) => dests.map((d) => (s === d ? 0 : 60))) }),
    };
  };
}

describe('travel matrix', () => {
  it('splits points into chunks', () => {
    expect(chunks(5, 2)).toEqual([[0, 2], [2, 4], [4, 5]]);
    expect(chunks(CHUNK).length).toBe(1);
    expect(chunks(CHUNK + 1).length).toBe(2);
  });

  it('asks Mapbox once for a small round, stating the site as referer, and uses its answer', async () => {
    const calls: string[] = [];
    const m = await travelMatrix(pts(4), { token: 'pk.test', referer: 'https://example.test/', fetchImpl: fakeMapbox(calls) });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('/mapbox/driving/');
    expect(calls[0]).toContain('access_token=pk.test');
    expect(calls[0].endsWith('|https://example.test/')).toBe(true);
    expect(m.source).toBe('mapbox');
    expect(m.seconds[0][1]).toBe(60);
    expect(m.seconds[2][2]).toBe(0);
  });

  it('covers every pair for a bigger round with several requests', async () => {
    const calls: string[] = [];
    const m = await travelMatrix(pts(CHUNK + 6), { token: 'pk.test', fetchImpl: fakeMapbox(calls) });
    expect(calls).toHaveLength(4); // 2 chunks x 2 chunks
    expect(m.source).toBe('mapbox');
    for (let i = 0; i < m.seconds.length; i++) for (let j = 0; j < m.seconds.length; j++) expect(m.seconds[i][j]).toBe(i === j ? 0 : 60);
  });

  it('falls back to estimates, and says why, when the token is refused', async () => {
    const m = await travelMatrix(pts(3), { token: 'pk.test', fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }) });
    expect(m.source).toBe('estimate');
    expect(m.note).toContain('refused the token');
    expect(m.seconds[0][1]).toBeGreaterThan(0);
  });

  it('falls back when the network fails, there is no token, or there are too many stops', async () => {
    const down = await travelMatrix(pts(3), { token: 'x', fetchImpl: async () => { throw new Error('down'); } });
    expect(down).toMatchObject({ source: 'estimate', note: expect.stringContaining('Could not reach') });
    expect((await travelMatrix(pts(3), { token: '', fetchImpl: fakeMapbox([]) })).note).toContain('No Mapbox token');
    const many = await travelMatrix(pts(MAX_STOPS + 2), { token: 'x', fetchImpl: fakeMapbox([]) });
    expect(many.source).toBe('estimate');
    expect(many.note).toContain(String(MAX_STOPS));
  });

  it('estimates the pairs Mapbox found no road for', async () => {
    const m = await travelMatrix(pts(3), {
      token: 'x',
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ code: 'Ok', durations: [[0, null, 60], [60, 0, 60], [60, 60, 0]] }) }),
    });
    expect(m.source).toBe('mapbox');
    expect(m.seconds[0][1]).toBeGreaterThan(0);
    expect(m.seconds[0][2]).toBe(60);
  });

  it('builds a symmetric-looking estimate matrix with a zero diagonal', () => {
    const m = estimateMatrix(pts(3));
    expect(m[1][1]).toBe(0);
    expect(m[0][2]).toBeGreaterThan(m[0][1]);
  });
});
