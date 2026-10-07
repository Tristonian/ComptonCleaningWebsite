import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import {
  addPaymentMethod,
  bulkSetup,
  createCustomer,
  createRound,
  createRoundFrom,
  deleteRound,
  getCustomer,
  listPaymentMethods,
  listRoundOrder,
  moveInRound,
  removePaymentMethod,
  renamePaymentMethod,
  setRoundOrder,
  updateCustomer,
  updateRound,
  methodKey,
} from './customers';
import { recordJob } from './jobs';

async function person(db: Db, name: string, extra: Record<string, unknown> = {}) {
  const r = await createCustomer({ name, address: `${name} Road`, ...extra }, 's', db);
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

describe('payment methods', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await makeTestDb());
  });

  it('makes a key from a label', () => {
    expect(methodKey('Bank Transfer!')).toBe('bank-transfer');
    expect(methodKey('???')).toBe('');
  });

  it('adds, refuses duplicates, renames, and keeps a method that is in use', async () => {
    expect((await addPaymentMethod('Cheque', 's', db)).ok).toBe(true);
    expect((await addPaymentMethod('cheque', 's', db)).ok).toBe(false);
    expect((await addPaymentMethod('   ', 's', db)).ok).toBe(false);
    expect((await listPaymentMethods(db)).map((m) => m.key)).toEqual(['transfer', 'cash', 'card', 'cheque']);

    expect((await renamePaymentMethod('cheque', 'Cheque (paper)', 's', db)).ok).toBe(true);
    expect((await listPaymentMethods(db)).at(-1)).toEqual({ key: 'cheque', label: 'Cheque (paper)' });

    const c = await person(db, 'Pay');
    await updateCustomer(c, { name: 'Pay', address: 'x', preferredPayment: 'cheque' }, 's', db);
    expect((await removePaymentMethod('cheque', 's', db)).ok).toBe(false); // a customer prefers it
    await updateCustomer(c, { name: 'Pay', address: 'x', preferredPayment: '' }, 's', db);
    await recordJob(c, { status: 'done', doneOn: '2026-01-01', price: '10', paymentMethod: 'cash', paid: true }, 's', db, '2026-10-01');
    expect((await removePaymentMethod('cash', 's', db)).ok).toBe(false); // a visit used it
    expect((await removePaymentMethod('cheque', 's', db)).ok).toBe(true);
    expect((await removePaymentMethod('cheque', 's', db)).ok).toBe(false);
  });
});

describe('round order', () => {
  let db: Db;
  let round: string;
  let ids: string[];
  beforeEach(async () => {
    ({ db } = await makeTestDb());
    const r = await createRound({ name: 'Nash', weekday: 1 }, 's', db);
    if (!r.ok) throw new Error('round');
    round = r.id;
    ids = [await person(db, 'Ann'), await person(db, 'Bob'), await person(db, 'Cara')];
    await bulkSetup(ids, { roundId: round }, 's', db);
  });

  it('starts in the order they were added to the round', async () => {
    expect(await listRoundOrder(round, db)).toEqual(ids);
  });

  it('reorders, ignoring strangers and keeping anyone left out', async () => {
    expect((await setRoundOrder(round, [ids[2], '999', ids[0]], 's', db)).ok).toBe(true);
    expect(await listRoundOrder(round, db)).toEqual([ids[2], ids[0], ids[1]]);
  });

  it('moves one stop up or down and stops at the ends', async () => {
    await moveInRound(round, ids[1], -1, 's', db);
    expect(await listRoundOrder(round, db)).toEqual([ids[1], ids[0], ids[2]]);
    await moveInRound(round, ids[1], -1, 's', db);
    expect(await listRoundOrder(round, db)).toEqual([ids[1], ids[0], ids[2]]);
    await moveInRound(round, ids[2], 1, 's', db);
    expect(await listRoundOrder(round, db)).toEqual([ids[1], ids[0], ids[2]]);
    expect((await moveInRound(round, '999', 1, 's', db)).ok).toBe(false);
  });

  it('renames a round and moves its day, but not onto a name already taken', async () => {
    const other = await createRound({ name: 'Allway', weekday: 3 }, 's', db);
    if (!other.ok) throw new Error('round');
    expect((await updateRound(round, { name: 'Nash Road', weekday: '2' }, 's', db)).ok).toBe(true);
    expect((await updateRound(round, { name: 'Allway', weekday: '2' }, 's', db)).ok).toBe(false);
    expect((await updateRound(round, { name: 'Nash Road', weekday: '9' }, 's', db)).ok).toBe(false);
  });
});

describe('bulk setup and last cleaned', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await makeTestDb());
  });

  it('sets only the fields given and leaves the rest', async () => {
    const a = await person(db, 'Ann', { price: '20', frequencyWeeks: 8 });
    const b = await person(db, 'Bob');
    const r = await bulkSetup([a, b], { price: '15' }, 's', db);
    expect(r).toMatchObject({ ok: true, changed: 2 });
    expect(await getCustomer(a, db)).toMatchObject({ pricePence: 1500, frequencyWeeks: 8 });
    expect(await getCustomer(b, db)).toMatchObject({ pricePence: 1500, frequencyWeeks: null });
    await bulkSetup([a, b], { frequencyWeeks: '4', preferredPayment: 'transfer' }, 's', db);
    expect(await getCustomer(b, db)).toMatchObject({ pricePence: 1500, frequencyWeeks: 4, preferredPayment: 'transfer' });
  });

  it('refuses nonsense and an empty selection, changing nothing', async () => {
    const a = await person(db, 'Ann', { price: '20' });
    expect((await bulkSetup([], { price: '15' }, 's', db)).ok).toBe(false);
    expect((await bulkSetup([a], {}, 's', db)).ok).toBe(false);
    expect((await bulkSetup([a], { price: 'lots' }, 's', db)).ok).toBe(false);
    expect((await bulkSetup([a], { frequencyWeeks: '99' }, 's', db)).ok).toBe(false);
    expect((await bulkSetup([a], { preferredPayment: 'barter' }, 's', db)).ok).toBe(false);
    expect((await bulkSetup([a], { roundId: 'x' }, 's', db)).ok).toBe(false);
    expect((await getCustomer(a, db))?.pricePence).toBe(2000);
  });

  it('does not add someone to a round twice', async () => {
    const r = await createRound({ name: 'Nash', weekday: 1 }, 's', db);
    if (!r.ok) throw new Error('round');
    const a = await person(db, 'Ann');
    await bulkSetup([a], { roundId: r.id }, 's', db);
    expect((await bulkSetup([a], { roundId: r.id }, 's', db)).ok).toBe(true);
    expect(await listRoundOrder(r.id, db)).toEqual([a]);
  });

  it('corrects the last clean, leaves it when not sent, and clears it when blank', async () => {
    const a = await person(db, 'Ann', { frequencyWeeks: 4 });
    await updateCustomer(a, { name: 'Ann', address: 'x', frequencyWeeks: '4', lastCleaned: '2026-09-01' }, 's', db);
    expect(await getCustomer(a, db)).toMatchObject({ baselineDoneOn: '2026-09-01', lastDone: '2026-09-01', nextDue: '2026-09-29' });
    await updateCustomer(a, { name: 'Ann', address: 'x', frequencyWeeks: '4' }, 's', db);
    expect((await getCustomer(a, db))?.baselineDoneOn).toBe('2026-09-01');
    expect((await updateCustomer(a, { name: 'Ann', address: 'x', lastCleaned: '2999-01-01' }, 's', db)).ok).toBe(false);
    expect((await updateCustomer(a, { name: 'Ann', address: 'x', lastCleaned: '2026-02-30' }, 's', db)).ok).toBe(false);
    await updateCustomer(a, { name: 'Ann', address: 'x', lastCleaned: '' }, 's', db);
    expect((await getCustomer(a, db))?.baselineDoneOn).toBeNull();
  });
});

describe('building a round on the fly', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await makeTestDb());
  });

  it('makes a round from ticked customers in the order given, keeping their other rounds', async () => {
    const old = await createRound({ name: 'Old', weekday: 1 }, 's', db);
    if (!old.ok) throw new Error('round');
    const a = await person(db, 'Ann');
    const b = await person(db, 'Bob');
    const c = await person(db, 'Cara');
    await bulkSetup([a], { roundId: old.id }, 's', db);
    const made = await createRoundFrom({ name: 'Thursday 8 Oct', weekday: 4 }, [c, a, b, a, 'x'], 's', db);
    expect(made).toMatchObject({ ok: true, added: 3 });
    if (!made.ok) throw new Error('made');
    expect(await listRoundOrder(made.id, db)).toEqual([c, a, b]);
    expect((await getCustomer(a, db))?.rounds.map((r) => r.name).sort()).toEqual(['Old', 'Thursday 8 Oct']);
  });

  it('refuses an empty selection or a taken name, and leaves nothing behind', async () => {
    const a = await person(db, 'Ann');
    expect((await createRoundFrom({ name: 'X' }, [], 's', db)).ok).toBe(false);
    expect((await createRoundFrom({ name: '' }, [a], 's', db)).ok).toBe(false);
    expect((await createRoundFrom({ name: 'Dup' }, [a], 's', db)).ok).toBe(true);
    expect((await createRoundFrom({ name: 'Dup' }, [a], 's', db)).ok).toBe(false);
    expect((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM rounds'))[0].n).toBe(1);
  });

  it('deletes a round but not its customers', async () => {
    const a = await person(db, 'Ann');
    const made = await createRoundFrom({ name: 'Temp' }, [a], 's', db);
    if (!made.ok) throw new Error('made');
    expect((await deleteRound(made.id, 's', db)).ok).toBe(true);
    expect((await getCustomer(a, db))?.rounds).toEqual([]);
    expect((await deleteRound(made.id, 's', db)).ok).toBe(false);
    expect((await deleteRound('x', 's', db)).ok).toBe(false);
  });
});
