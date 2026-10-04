import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { createCustomer, getCustomer, listCustomers } from './customers';
import { deleteJob, endOfWeek, listDebts, listJobs, listPayments, markPaid, recordJob, updateJob } from './jobs';

const TODAY = '2026-10-04';
let db: Db;
let cid: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  const c = await createCustomer({ name: 'Test Person', address: '1 Road', price: '15', frequencyWeeks: 4 }, 's', db);
  if (!c.ok) throw new Error('create');
  cid = c.id;
});

const done = (over: Record<string, unknown> = {}) => ({ status: 'done', doneOn: TODAY, price: '15', paymentMethod: 'cash', paid: true, ...over });

describe('recording a visit', () => {
  it('saves price, payment and extras together and lists them newest first', async () => {
    const r = await recordJob(cid, done({ extras: [{ label: 'Conservatory', price: '10' }, { label: '', price: '' }] }), 's', db, TODAY);
    expect(r.ok).toBe(true);
    await recordJob(cid, done({ doneOn: '2026-09-01', price: '14', paid: true, paymentMethod: 'transfer' }), 's', db, TODAY);
    const jobs = await listJobs(cid, db);
    expect(jobs.map((j) => j.doneOn)).toEqual(['2026-10-04', '2026-09-01']);
    expect(jobs[0]).toMatchObject({ pricePence: 1500, totalPence: 2500, paid: true, paymentMethod: 'cash' });
    expect(jobs[0].extras).toEqual([expect.objectContaining({ label: 'Conservatory', pricePence: 1000 })]);
  });

  it('refuses a date in the future, a bad date, a bad price and an unknown payment method', async () => {
    expect((await recordJob(cid, done({ doneOn: '2026-10-05' }), 's', db, TODAY)).ok).toBe(false);
    expect((await recordJob(cid, done({ doneOn: '2026-02-31' }), 's', db, TODAY)).ok).toBe(false);
    expect((await recordJob(cid, done({ price: 'abc' }), 's', db, TODAY)).ok).toBe(false);
    expect((await recordJob(cid, done({ paymentMethod: 'bitcoin' }), 's', db, TODAY)).ok).toBe(false);
    expect((await recordJob(cid, done({ extras: [{ label: 'x', price: '' }] }), 's', db, TODAY)).ok).toBe(false);
    expect(await listJobs(cid, db)).toHaveLength(0);
  });

  it('refuses a visit for a customer that does not exist', async () => {
    expect((await recordJob('99999', done(), 's', db, TODAY)).ok).toBe(false);
  });

  it('a missed visit carries no money and does not move the due date', async () => {
    await db.query("UPDATE customers SET baseline_done_on = '2026-09-01' WHERE id = $1", [cid]);
    await recordJob(cid, { status: 'missed', doneOn: TODAY, price: '15', paymentMethod: 'cash', paid: true }, 's', db, TODAY);
    const [job] = await listJobs(cid, db);
    expect(job).toMatchObject({ status: 'missed', pricePence: 0, paid: false, paymentMethod: '' });
    expect(await getCustomer(cid, db)).toMatchObject({ lastDone: '2026-09-01', owingPence: 0 });
  });
});

describe('debts and payment', () => {
  it('a done visit with no payment is a debt until marked paid', async () => {
    const r = await recordJob(cid, done({ paymentMethod: '', paid: false, extras: [{ label: 'Gutters', price: '5' }] }), 's', db, TODAY);
    if (!r.ok || !r.id) throw new Error('record');
    expect((await getCustomer(cid, db))?.owingPence).toBe(2000);
    expect((await listCustomers({ filter: 'owing' }, db)).map((c) => c.name)).toEqual(['Test Person']);
    expect((await markPaid(r.id, '', 's', db)).ok).toBe(false);
    expect((await markPaid(r.id, 'transfer', 's', db)).ok).toBe(true);
    expect((await getCustomer(cid, db))?.owingPence).toBe(0);
    expect((await listJobs(cid, db))[0]).toMatchObject({ paid: true, paymentMethod: 'transfer' });
  });

  it('"paid" without a way of paying is stored as unpaid', async () => {
    await recordJob(cid, done({ paymentMethod: '', paid: true }), 's', db, TODAY);
    expect((await listJobs(cid, db))[0].paid).toBe(false);
  });

  it('a done visit moves last done and the due date', async () => {
    await recordJob(cid, done({ doneOn: '2026-09-20' }), 's', db, TODAY);
    expect(await getCustomer(cid, db)).toMatchObject({ lastDone: '2026-09-20', nextDue: '2026-10-18' });
  });
});

describe('editing and deleting', () => {
  it('edits date, price, method and replaces extras, still refusing the future', async () => {
    const r = await recordJob(cid, done({ extras: [{ label: 'Old', price: '1' }] }), 's', db, TODAY);
    if (!r.ok || !r.id) throw new Error('record');
    expect((await updateJob(r.id, done({ doneOn: '2026-10-05' }), 's', db, TODAY)).ok).toBe(false);
    expect((await updateJob(r.id, done({ doneOn: '2026-10-02', price: '18', paymentMethod: 'card', extras: [{ label: 'New', price: '2' }] }), 's', db, TODAY)).ok).toBe(true);
    const [job] = await listJobs(cid, db);
    expect(job).toMatchObject({ doneOn: '2026-10-02', pricePence: 1800, paymentMethod: 'card', totalPence: 2000 });
    expect(job.extras.map((e) => e.label)).toEqual(['New']);
  });

  it('deletes a visit and its extras', async () => {
    const r = await recordJob(cid, done({ extras: [{ label: 'x', price: '1' }] }), 's', db, TODAY);
    if (!r.ok || !r.id) throw new Error('record');
    expect((await deleteJob(r.id, 's', db)).ok).toBe(true);
    expect(await listJobs(cid, db)).toHaveLength(0);
    expect(await db.query('SELECT 1 FROM job_extras')).toHaveLength(0);
    expect((await deleteJob(r.id, 's', db)).ok).toBe(false);
  });
});

describe('money lists and weeks', () => {
  it('lists debts oldest first and payments newest first', async () => {
    await recordJob(cid, done({ doneOn: '2026-09-01', paymentMethod: '', paid: false }), 's', db, TODAY);
    await recordJob(cid, done({ doneOn: '2026-09-10', paymentMethod: '', paid: false, price: '20' }), 's', db, TODAY);
    await recordJob(cid, done({ doneOn: '2026-09-20' }), 's', db, TODAY);
    await recordJob(cid, done({ doneOn: '2026-09-25', price: '30', extras: [{ label: 'x', price: '5' }] }), 's', db, TODAY);
    expect((await listDebts(db)).map((d) => [d.doneOn, d.totalPence])).toEqual([['2026-09-01', 1500], ['2026-09-10', 2000]]);
    expect((await listPayments(db)).map((p) => [p.doneOn, p.totalPence])).toEqual([['2026-09-25', 3500], ['2026-09-20', 1500]]);
  });
  it('finds the Sunday ending the week', () => {
    expect(endOfWeek('2026-10-04')).toBe('2026-10-04'); // a Sunday
    expect(endOfWeek('2026-10-05')).toBe('2026-10-11'); // Monday
    expect(endOfWeek('2026-10-07')).toBe('2026-10-11');
  });
});
