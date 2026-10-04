import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { parseCustomersCsv, parseUkDate } from './customers-csv';
import { isUkMobile, normalisePhone, smsLink, whatsappLink } from './phone';
import {
  createCustomer,
  createRound,
  deleteCustomer,
  getCustomer,
  importCustomers,
  listCustomers,
  listRounds,
  poundsToPence,
  setCustomerRounds,
  updateCustomer,
} from './customers';

// Invented people only: the real export is personal data and never goes in the repo.
const CSV =
  '﻿"Cust Ref","Title","First Name","Last Name","Address Line 1","Phone","Mobile","Source","Added"\r\n' +
  '"101","Mrs","Ann","Example","1 Test Street","+447700 900111","","","12/05/24"\r\n' +
  '"102","","","","17 Sample Parade","0117 496 0000","","","21/10/24"\r\n' +
  '"103","Mr","Bob","Quote ""Q""","3 Test, Close","","07700 900222","Facebook","31/02/24"\r\n';

describe('phone numbers', () => {
  it('normalises UK formats to +44', () => {
    expect(normalisePhone('07700 900222')).toBe('+447700900222');
    expect(normalisePhone('+447700 900111')).toBe('+447700900111');
    expect(normalisePhone('0044 7700 900111')).toBe('+447700900111');
    expect(normalisePhone('+44 (0) 7700 900111')).toBe('+447700900111');
    expect(normalisePhone('0117 496 0000')).toBe('+441174960000');
    expect(normalisePhone('')).toBe('');
  });
  it('leaves odd input readable instead of rejecting it', () => {
    expect(normalisePhone('ask next door')).toBe('ask next door');
  });
  it('builds the shortcuts', () => {
    expect(whatsappLink('+447700900222', 'Hi Ann')).toBe('https://wa.me/447700900222?text=Hi%20Ann');
    expect(smsLink('+447700900222')).toBe('sms:+447700900222');
    expect(isUkMobile('07700 900222')).toBe(true);
    expect(isUkMobile('0117 496 0000')).toBe(false);
  });
});

describe('Squeegee CSV', () => {
  it('parses quoted fields, a BOM, CRLF and names', () => {
    const { rows, problems } = parseCustomersCsv(CSV);
    expect(problems).toEqual([]);
    expect(rows.map((r) => r.ref)).toEqual(['101', '102', '103']);
    expect(rows[0]).toMatchObject({ name: 'Mrs Ann Example', address: '1 Test Street', phone: '+447700900111', added: '2024-05-12' });
    expect(rows[2].name).toBe('Mr Bob Quote "Q"');
    expect(rows[2].address).toBe('3 Test, Close');
    expect(rows[2].phone).toBe('+447700900222'); // mobile wins over phone
  });
  it('uses the address as the name when there is no name, and ignores an impossible date', () => {
    const { rows } = parseCustomersCsv(CSV);
    expect(rows[1].name).toBe('17 Sample Parade');
    expect(rows[2].added).toBe('');
    expect(parseUkDate('31/02/24')).toBe('');
    expect(parseUkDate('01/03/2025')).toBe('2025-03-01');
  });
  it('rejects a file that is not the export, and skips duplicates and blank references', () => {
    expect(parseCustomersCsv('a,b\n1,2').rows).toEqual([]);
    expect(parseCustomersCsv('a,b\n1,2').problems[0]).toMatch(/Squeegee/);
    const dup = parseCustomersCsv('"Cust Ref","Address Line 1"\n"1","x"\n"1","y"\n"","z"\n');
    expect(dup.rows).toHaveLength(1);
    expect(dup.problems).toHaveLength(2);
  });
});

describe('money', () => {
  it('turns pounds into integer pence', () => {
    expect(poundsToPence('12')).toBe(1200);
    expect(poundsToPence('£12.5')).toBe(1250);
    expect(poundsToPence('0.07')).toBe(7);
    expect(poundsToPence('')).toBeNull();
    expect(poundsToPence('12.505')).toBeUndefined();
    expect(poundsToPence('abc')).toBeUndefined();
  });
});

describe('customers', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await makeTestDb());
  });

  it('imports once and leaves edited customers alone on a re-import', async () => {
    const { rows } = parseCustomersCsv(CSV);
    expect(await importCustomers(rows, 'sam@example.com', db)).toMatchObject({ ok: true, added: 3, skipped: 0 });
    const [first] = await listCustomers({ q: 'Ann' }, db);
    await updateCustomer(first.id, { name: 'Ann Renamed', address: first.address, price: '14', frequencyWeeks: '4' }, 'sam@example.com', db);
    expect(await importCustomers(rows, 'sam@example.com', db)).toMatchObject({ ok: true, added: 0, skipped: 3 });
    expect((await getCustomer(first.id, db))?.name).toBe('Ann Renamed');
  });

  it('adds a customer quickly from a location, with price, frequency and two rounds', async () => {
    const nash = await createRound({ name: 'Nash', weekday: 1 }, 's', db);
    const allway = await createRound({ name: 'Allway', weekday: 3 }, 's', db);
    if (!nash.ok || !allway.ok) throw new Error('rounds');
    const r = await createCustomer(
      { name: 'Cara Test', lat: 51.5, lng: -2.5, price: '15', frequencyWeeks: 4, roundIds: [nash.id, allway.id] },
      's',
      db,
    );
    expect(r.ok).toBe(true);
    const c = await getCustomer(r.ok ? r.id : '', db);
    expect(c).toMatchObject({ pricePence: 1500, frequencyWeeks: 4 });
    expect(c?.rounds.map((x) => x.name).sort()).toEqual(['Allway', 'Nash']);
    expect((await listRounds(db)).map((x) => x.customers)).toEqual([1, 1]);
  });

  it('needs a name, and either an address or a location', async () => {
    expect((await createCustomer({ name: '' , address: 'x'}, 's', db)).ok).toBe(false);
    expect((await createCustomer({ name: 'No place' }, 's', db)).ok).toBe(false);
    expect((await createCustomer({ name: 'Bad', address: 'x', price: 'abc' }, 's', db)).ok).toBe(false);
    expect((await createCustomer({ name: 'Bad', address: 'x', frequencyWeeks: 99 }, 's', db)).ok).toBe(false);
  });

  it('works out due from last done + frequency, and falls back to when they were added', async () => {
    const a = await createCustomer({ name: 'Due', address: 'x', frequencyWeeks: 4 }, 's', db);
    const b = await createCustomer({ name: 'Ad hoc', address: 'y' }, 's', db);
    if (!a.ok || !b.ok) throw new Error('create');
    await db.query("UPDATE customers SET baseline_done_on = '2026-09-01' WHERE id = $1", [a.id]);
    const due = await getCustomer(a.id, db);
    expect(due).toMatchObject({ lastDone: '2026-09-01', nextDue: '2026-09-29' });
    expect((await listCustomers({ filter: 'due', today: '2026-09-28' }, db)).map((c) => c.name)).toEqual([]);
    expect((await listCustomers({ filter: 'due', today: '2026-09-29' }, db)).map((c) => c.name)).toEqual(['Due']);
    // No frequency means never "due".
    expect((await getCustomer(b.id, db))?.nextDue).toBeNull();
  });

  it('counts only done, unpaid jobs (and their extras) as owing', async () => {
    const a = await createCustomer({ name: 'Owes', address: 'x' }, 's', db);
    if (!a.ok) throw new Error('create');
    const job = (status: string, price: number, paid: boolean) =>
      db.query("INSERT INTO jobs (customer_id, status, done_on, price_pence, paid, created_by) VALUES ($1,$2,'2026-10-01',$3,$4,'s') RETURNING id::text AS id", [a.id, status, price, paid]);
    const [unpaid] = await job('done', 1500, false);
    await job('done', 2000, true);
    await job('missed', 999, false);
    await db.query("INSERT INTO job_extras (job_id, label, price_pence) VALUES ($1, 'Conservatory', 500)", [unpaid.id]);
    expect((await getCustomer(a.id, db))?.owingPence).toBe(2000);
    expect((await listCustomers({ filter: 'owing' }, db)).map((c) => c.name)).toEqual(['Owes']);
  });

  it('filters by round and search, replaces rounds, and refuses a duplicate round name', async () => {
    const r1 = await createRound({ name: 'Nash' }, 's', db);
    const r2 = await createRound({ name: 'Ringland' }, 's', db);
    if (!r1.ok || !r2.ok) throw new Error('rounds');
    expect((await createRound({ name: 'Nash' }, 's', db)).ok).toBe(false);
    const c = await createCustomer({ name: 'Dee Test', address: '9 Road', postcode: 'np19 1aa', roundIds: [r1.id] }, 's', db);
    if (!c.ok) throw new Error('create');
    await createCustomer({ name: 'Other', address: '1 Lane' }, 's', db);
    expect((await listCustomers({ roundId: r1.id }, db)).map((x) => x.name)).toEqual(['Dee Test']);
    expect((await listCustomers({ q: 'np19' }, db)).map((x) => x.name)).toEqual(['Dee Test']);
    await setCustomerRounds(c.id, [r2.id], 's', db);
    expect((await listCustomers({ roundId: r1.id }, db)).length).toBe(0);
    expect((await listCustomers({ roundId: r2.id }, db)).length).toBe(1);
  });

  it('deletes a customer with their jobs, and the audit log keeps no personal details', async () => {
    const c = await createCustomer({ name: 'Remove Me', address: '5 Gone Street', phone: '07700 900333' }, 's', db);
    if (!c.ok) throw new Error('create');
    await db.query("INSERT INTO jobs (customer_id, status, done_on, created_by) VALUES ($1,'done','2026-10-01','s')", [c.id]);
    expect((await deleteCustomer(c.id, 'sam@example.com', db)).ok).toBe(true);
    expect(await getCustomer(c.id, db)).toBeNull();
    expect(await db.query('SELECT 1 FROM jobs')).toHaveLength(0);
    const log = JSON.stringify(await db.query('SELECT email, action, detail FROM audit_log'));
    expect(log).not.toMatch(/Remove Me|Gone Street|900333/);
    expect((await deleteCustomer(c.id, 's', db)).ok).toBe(false);
  });
});
