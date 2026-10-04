import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { createCustomer } from './customers';
import { markPaid, recordJob, updateJob } from './jobs';
import { cleanRange, csvCell, fillWeeks, getEarnings, listCollected, monthRangeOf, paymentsCsv } from './earnings';

const TODAY = '2026-10-20';

async function person(db: Db, name: string) {
  const r = await createCustomer({ name, address: `${name} Road` }, 's', db);
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

describe('earnings', () => {
  let db: Db;
  let ann: string;
  let bob: string;
  beforeEach(async () => {
    ({ db } = await makeTestDb());
    ann = await person(db, 'Ann');
    bob = await person(db, 'Bob');
  });

  const visit = (id: string, over: Record<string, unknown>) =>
    recordJob(id, { status: 'done', doneOn: '2026-10-06', price: '20', paymentMethod: 'cash', paid: true, ...over }, 's', db, TODAY);

  it('counts money on the day it was received, by method, with extras', async () => {
    await visit(ann, { extras: [{ label: 'Conservatory', price: '10' }] }); // £30 cash, 6 Oct
    await visit(bob, { paymentMethod: 'transfer', doneOn: '2026-10-13' }); // £20 transfer, 13 Oct
    await visit(bob, { paymentMethod: '', paid: false, doneOn: '2026-10-14' }); // owed, not collected

    const e = await getEarnings('2026-10-01', '2026-10-31', db);
    expect(e).toMatchObject({ collectedPence: 5000, paidVisits: 2, doneVisits: 3, workedPence: 7000, outstandingPence: 2000, outstandingVisits: 1 });
    expect(e.byMethod).toEqual([
      { method: 'cash', pence: 3000 },
      { method: 'transfer', pence: 2000 },
    ]);
    expect(e.byWeek).toEqual([
      { weekStart: '2026-10-05', pence: 3000 },
      { weekStart: '2026-10-12', pence: 2000 },
    ]);
    expect(e.topExtras).toEqual([{ label: 'Conservatory', pence: 1000, times: 1 }]);
    expect(e.topCustomers.map((c) => [c.name, c.pence])).toEqual([['Ann', 3000], ['Bob', 2000]]);
  });

  it('counts a debt cleared later in the month it was paid, not the month of the visit', async () => {
    const r = await visit(ann, { paymentMethod: '', paid: false, doneOn: '2026-09-28' });
    expect(r.ok).toBe(true);
    expect((await getEarnings('2026-09-01', '2026-09-30', db)).collectedPence).toBe(0);
    await markPaid(r.id, 'cash', 's', db, '2026-10-05');
    expect((await getEarnings('2026-09-01', '2026-09-30', db)).collectedPence).toBe(0);
    expect((await getEarnings('2026-10-01', '2026-10-31', db)).collectedPence).toBe(2000);
    expect((await getEarnings('2026-10-01', '2026-10-31', db)).outstandingPence).toBe(0);
  });

  it('keeps the received date when a paid visit is edited, and clears it if it becomes unpaid', async () => {
    const r = await visit(ann, {});
    await updateJob(r.id, { status: 'done', doneOn: '2026-10-07', price: '25', paymentMethod: 'cash', paid: true }, 's', db, TODAY);
    expect((await listCollected('2026-10-01', '2026-10-31', db))[0]).toMatchObject({ receivedOn: '2026-10-06', pence: 2500 });
    await updateJob(r.id, { status: 'done', doneOn: '2026-10-07', price: '25', paymentMethod: '', paid: false }, 's', db, TODAY);
    expect((await getEarnings('2026-10-01', '2026-10-31', db)).collectedPence).toBe(0);
  });

  it('counts missed visits and ignores them for money', async () => {
    await recordJob(ann, { status: 'missed', doneOn: '2026-10-06' }, 's', db, TODAY);
    const e = await getEarnings('2026-10-01', '2026-10-31', db);
    expect(e).toMatchObject({ missedVisits: 1, doneVisits: 0, collectedPence: 0, workedPence: 0 });
  });

  it('reads a paid row written without paid_on by its visit date', async () => {
    await db.query("INSERT INTO jobs (customer_id, status, done_on, price_pence, payment_method, paid, created_by) VALUES ($1,'done','2026-10-02',1500,'cash',true,'s')", [ann]);
    expect((await getEarnings('2026-10-01', '2026-10-31', db)).collectedPence).toBe(1500);
  });

  it('exports a CSV that cannot be run as a formula', async () => {
    const evil = await person(db, '=HYPERLINK("x")');
    await visit(evil, { doneOn: '2026-10-08' });
    const rows = await listCollected('2026-10-01', '2026-10-31', db);
    const csv = paymentsCsv(rows, (k) => (k === 'cash' ? 'Cash' : k));
    expect(csv.split('\r\n')[0]).toBe('Received,Customer,Visit date,Paid by,Amount (GBP)');
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csv).toContain(',Cash,20.00');
    expect(csvCell('+44')).toBe("'+44");
    expect(csvCell('a,b')).toBe('"a,b"');
  });
});

describe('earnings dates', () => {
  it('cleans a requested range', () => {
    const fb = { from: '2026-10-01', to: '2026-10-31' };
    expect(cleanRange('2026-09-01', '2026-09-30', fb)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(cleanRange('2026-09-30', '2026-09-01', fb)).toEqual(fb);
    expect(cleanRange('nope', '2026-09-01', fb)).toEqual(fb);
    expect(cleanRange('2000-01-01', '2026-09-01', fb)).toEqual(fb);
  });
  it('finds a month and fills quiet weeks', () => {
    expect(monthRangeOf('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRangeOf('2028-02-10').to).toBe('2028-02-29');
    expect(fillWeeks('2026-10-01', '2026-10-20', [{ weekStart: '2026-10-12', pence: 500 }])).toEqual([
      { weekStart: '2026-09-28', pence: 0 },
      { weekStart: '2026-10-05', pence: 0 },
      { weekStart: '2026-10-12', pence: 500 },
      { weekStart: '2026-10-19', pence: 0 },
    ]);
  });
});
