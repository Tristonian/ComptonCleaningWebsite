import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { bulkSetup, createCustomer, createRound, listRoundOrder, setRoundOrder } from './customers';
import { estimateMatrix, type Point } from './travel';
import { planRound } from './round-plan';

const travel = async (points: Point[]) => ({ seconds: estimateMatrix(points), source: 'estimate' as const });

describe('planRound', () => {
  let db: Db;
  let round: string;
  beforeEach(async () => {
    ({ db } = await makeTestDb());
    const r = await createRound({ name: 'Nash', weekday: 1 }, 's', db);
    if (!r.ok) throw new Error('round');
    round = r.id;
  });

  async function add(name: string, lat: number | null, lng: number | null, extra: Record<string, unknown> = {}) {
    const c = await createCustomer({ name, address: `${name} Road`, lat, lng, ...extra }, 's', db);
    if (!c.ok) throw new Error(c.error);
    await bulkSetup([c.id], { roundId: round }, 's', db);
    return c.id;
  }

  it('orders stops along a road from the base outwards, and beats a bad current order', async () => {
    // Stops due east of the base (51.5, -2.5) at increasing distance, added in a jumbled order.
    const far = await add('Far', 51.5, -2.3);
    const near = await add('Near', 51.5, -2.48);
    const mid = await add('Mid', 51.5, -2.4);
    // Finishing wherever the last stop is (out and back along one road ties, so skip the drive home here).
    const plan = await planRound(round, { db, travel, returnHome: false });
    expect(plan.stops.map((s) => s.id)).toEqual([near, mid, far]);
    expect(plan.legs).toHaveLength(3);
    expect(plan.totalSeconds).toBeLessThan(plan.currentSeconds);
    expect(plan.source).toBe('estimate');
    expect(plan.unlocated).toEqual([]);
  });

  it('leaves out customers with no pin and lists them', async () => {
    await add('Placed', 51.5, -2.4);
    const nowhere = await add('Nowhere', null, null);
    const plan = await planRound(round, { db, travel });
    expect(plan.stops).toHaveLength(1);
    expect(plan.unlocated).toEqual([{ id: nowhere, name: 'Nowhere' }]);
  });

  it('plans only those due this week when asked', async () => {
    const due = await add('Due', 51.5, -2.4, { frequencyWeeks: 4 });
    await add('Later', 51.5, -2.3, { frequencyWeeks: 4 });
    const plan = await planRound(round, { db, travel, mode: 'due', today: '2026-10-20' });
    // Both were added "today" in real time, so they are due weeks after the fake date: none is due.
    expect(plan.stops).toEqual([]);
    const real = await planRound(round, { db, travel, mode: 'due', today: '2999-01-01' });
    expect(real.stops.map((s) => s.id)).toContain(due);
  });

  it('returns an empty plan for an empty round, and can leave out the drive home', async () => {
    expect((await planRound(round, { db, travel })).stops).toEqual([]);
    await add('A', 51.5, -2.4);
    expect((await planRound(round, { db, travel, returnHome: false })).legs).toHaveLength(1);
  });

  it('applying the plan with setRoundOrder changes the saved order', async () => {
    await add('Far', 51.5, -2.3);
    await add('Near', 51.5, -2.48);
    const plan = await planRound(round, { db, travel });
    await setRoundOrder(round, plan.stops.map((s) => s.id), 's', db);
    expect(await listRoundOrder(round, db)).toEqual(plan.stops.map((s) => s.id));
  });
});
