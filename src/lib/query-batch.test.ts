import { describe, expect, it, vi } from 'vitest';
import { createReadBatcher, isReadQuery } from '@/lib/query-batch';

type R = { n: number };
const make = (over: { runMany?: (s: { text: string; params: unknown[] }[]) => Promise<R[][]> } = {}) => {
  const runOne = vi.fn(async (text: string) => [{ n: text.length }] as R[]);
  const runMany = vi.fn(over.runMany ?? (async (s: { text: string }[]) => s.map((x) => [{ n: x.text.length }] as R[])));
  return { runOne, runMany, q: createReadBatcher<R>({ runOne, runMany }) };
};

describe('read batcher', () => {
  it('recognises plain selects only', () => {
    expect(isReadQuery('  SELECT 1')).toBe(true);
    expect(isReadQuery('select * from x')).toBe(true);
    expect(isReadQuery('INSERT INTO x VALUES (1)')).toBe(false);
    expect(isReadQuery('WITH a AS (DELETE FROM x RETURNING *) SELECT * FROM a')).toBe(false);
  });

  it('sends reads issued in the same tick as one batch, in order', async () => {
    const { q, runOne, runMany } = make();
    const out = await Promise.all([q('SELECT a'), q('SELECT bb'), q('SELECT ccc')]);
    expect(out).toEqual([[{ n: 8 }], [{ n: 9 }], [{ n: 10 }]]);
    expect(runMany).toHaveBeenCalledTimes(1);
    expect(runOne).not.toHaveBeenCalled();
  });

  it('sends a lone read on its own', async () => {
    const { q, runOne, runMany } = make();
    await q('SELECT 1');
    expect(runOne).toHaveBeenCalledTimes(1);
    expect(runMany).not.toHaveBeenCalled();
  });

  it('never batches writes', async () => {
    const { q, runOne, runMany } = make();
    await Promise.all([q('INSERT INTO a VALUES (1)'), q('UPDATE a SET b = 1')]);
    expect(runOne).toHaveBeenCalledTimes(2);
    expect(runMany).not.toHaveBeenCalled();
  });

  it('retries each query alone if the batch fails, so one bad query cannot sink the rest', async () => {
    const { q, runOne } = make({ runMany: async () => { throw new Error('boom'); } });
    runOne.mockImplementation(async (text: string) => {
      if (text.includes('bad')) throw new Error('bad table');
      return [{ n: 1 }];
    });
    const results = await Promise.allSettled([q('SELECT ok'), q('SELECT bad'), q('SELECT ok2')]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  });

  it('starts a new batch for queries issued after the flush', async () => {
    const { q, runMany } = make();
    await Promise.all([q('SELECT a'), q('SELECT b')]);
    await Promise.all([q('SELECT c'), q('SELECT d')]);
    expect(runMany).toHaveBeenCalledTimes(2);
  });
});
