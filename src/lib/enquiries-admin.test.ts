import { beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { checkEnquiry } from './enquiry';
import { storeEnquiry } from './enquiries-store';
import {
  MAX_ADMIN_NOTES,
  addAsCustomer,
  enquiryCounts,
  getEnquiry,
  isId,
  isStatus,
  listEnquiries,
  markRead,
  recordReply,
  saveAdminNotes,
  setStatus,
} from './enquiries-admin';

let db: Db;
let pg: PGlite;
beforeEach(async () => {
  ({ db, pg } = await makeTestDb());
});

async function add(name: string, extra: Record<string, unknown> = {}): Promise<string> {
  const c = checkEnquiry({
    name,
    address: '98 Park Road',
    postcode: 'BS16 1AA',
    phone: '07700 900123',
    email: 'jo@example.com',
    service: 'window-cleaning',
    source: 'google-maps',
    lat: '51.4847',
    lng: '-2.5519',
    ...extra,
  });
  if (!c.ok) throw new Error('fixture invalid: ' + c.error);
  const r = await storeEnquiry(db, c.value, { ipHash: name, locale: 'en' });
  if (!r.ok) throw new Error('not stored');
  return r.id;
}

const audit = async () => (await pg.query<{ action: string; email: string }>('SELECT action, email FROM audit_log ORDER BY id')).rows;

describe('ids and statuses', () => {
  it('only digits are ids, only known words are statuses', () => {
    expect(isId('12')).toBe(true);
    for (const bad of ['', 'abc', '1; DROP TABLE x', '-1', '1.5', 12, null, '9'.repeat(16)]) expect(isId(bad)).toBe(false);
    expect(isStatus('booked')).toBe(true);
    expect(isStatus('archived')).toBe(false);
  });
});

describe('listing and counting', () => {
  it('lists newest first, filters by status, and starts everything as new and unread', async () => {
    const a = await add('Ann');
    await add('Bob');
    const all = await listEnquiries(db);
    expect(all.map((e) => e.name)).toEqual(['Bob', 'Ann']);
    expect(all.every((e) => e.status === 'new' && e.read_at === null)).toBe(true);
    await setStatus(db, a, 'quoted', 'sam@gmail.com');
    expect((await listEnquiries(db, 'quoted')).map((e) => e.name)).toEqual(['Ann']);
    expect(await listEnquiries(db, 'lost')).toEqual([]);
  });

  it('counts by status and unread', async () => {
    const a = await add('Ann');
    await add('Bob');
    await markRead(db, a);
    const c = await enquiryCounts(db);
    expect(c).toMatchObject({ total: 2, unread: 1 });
    expect(c.byStatus.new).toBe(2);
    expect(c.byStatus.booked).toBe(0);
  });
});

describe('reading', () => {
  it('gets one enquiry with its details, or null', async () => {
    const id = await add('Ann');
    const got = await getEnquiry(db, id);
    expect(got?.enquiry).toMatchObject({ name: 'Ann', service: 'window-cleaning', source: 'google-maps', postcode: 'BS16 1AA', lat: 51.4847, lng: -2.5519 });
    expect(got?.replies).toEqual([]);
    expect(await getEnquiry(db, '999999')).toBeNull();
    expect(await getEnquiry(db, 'x')).toBeNull();
  });

  it('markRead stamps it once and keeps the first time', async () => {
    const id = await add('Ann');
    await markRead(db, id);
    const first = (await pg.query<{ read_at: Date }>('SELECT read_at FROM enquiries')).rows[0].read_at;
    expect(first).toBeTruthy();
    await markRead(db, id);
    const again = (await pg.query<{ read_at: Date }>('SELECT read_at FROM enquiries')).rows[0].read_at;
    expect(again.getTime()).toBe(first.getTime());
  });
});

describe('status and notes', () => {
  it('changes status, marks it read, and writes an audit row', async () => {
    const id = await add('Ann');
    expect(await setStatus(db, id, 'contacted', 'sam@gmail.com')).toEqual({ ok: true });
    const got = await getEnquiry(db, id);
    expect(got?.enquiry.status).toBe('contacted');
    expect(got?.enquiry.read_at).not.toBeNull();
    expect(await audit()).toEqual([{ action: 'enquiry_status', email: 'sam@gmail.com' }]);
  });

  it('refuses an unknown status or id and changes nothing', async () => {
    const id = await add('Ann');
    expect((await setStatus(db, id, 'archived', 'a@b.c')).ok).toBe(false);
    expect((await setStatus(db, 'nope', 'booked', 'a@b.c')).ok).toBe(false);
    expect((await getEnquiry(db, id))?.enquiry.status).toBe('new');
    expect(await audit()).toEqual([]);
  });

  it('saves Sam\'s notes, trims them, and enforces the length cap', async () => {
    const id = await add('Ann');
    expect(await saveAdminNotes(db, id, '  Side gate code 1234\r\nDog  ', 's@g.c')).toEqual({ ok: true });
    expect((await getEnquiry(db, id))?.enquiry.admin_notes).toBe('Side gate code 1234\nDog');
    expect((await saveAdminNotes(db, id, 'x'.repeat(MAX_ADMIN_NOTES + 1), 's@g.c')).ok).toBe(false);
    expect((await saveAdminNotes(db, id, 42, 's@g.c')).ok).toBe(false);
    expect((await getEnquiry(db, id))?.enquiry.admin_notes).toBe('Side gate code 1234\nDog');
  });
});

describe('add as customer', () => {
  it('creates the customer from the enquiry, links it, and carries the pin', async () => {
    const id = await add('Ann');
    const r = await addAsCustomer(db, id, 'sam@gmail.com');
    expect(r.ok).toBe(true);
    const { rows } = await pg.query<{ name: string; phone: string; email: string; postcode: string; lat: number; source: string; created_from_enquiry: string }>(
      'SELECT name, phone, email, postcode, lat, source, created_from_enquiry FROM customers',
    );
    expect(rows).toEqual([{ name: 'Ann', phone: '+447700900123', email: 'jo@example.com', postcode: 'BS16 1AA', lat: 51.4847, source: 'google-maps', created_from_enquiry: id }]);
    expect((await getEnquiry(db, id))?.enquiry.customer_id).toBe(r.ok ? (r as { customerId?: string }).customerId : null);
  });

  it('does it once: pressing it again returns the same customer, not a duplicate', async () => {
    const id = await add('Ann');
    const first = await addAsCustomer(db, id, 's@g.c');
    const second = await addAsCustomer(db, id, 's@g.c');
    expect(second).toMatchObject({ ok: true, customerId: (first as { customerId?: string }).customerId });
    expect(Number((await pg.query<{ n: string }>('SELECT count(*) AS n FROM customers')).rows[0].n)).toBe(1);
  });

  it('refuses an unknown enquiry', async () => {
    expect((await addAsCustomer(db, '424242', 's@g.c')).ok).toBe(false);
    expect((await addAsCustomer(db, 'x', 's@g.c')).ok).toBe(false);
  });
});

describe('replies', () => {
  it('logs the reply and moves a new enquiry to contacted, but leaves a later status alone', async () => {
    const a = await add('Ann');
    expect(await recordReply(db, a, { by: 'sam@gmail.com', to: 'jo@example.com', subject: 'Re: your enquiry', body: 'Hi Ann' })).toEqual({ ok: true });
    const got = await getEnquiry(db, a);
    expect(got?.enquiry.status).toBe('contacted');
    expect(got?.replies).toMatchObject([{ to_email: 'jo@example.com', subject: 'Re: your enquiry', body: 'Hi Ann', sent_by: 'sam@gmail.com' }]);

    const b = await add('Bob');
    await setStatus(db, b, 'booked', 's@g.c');
    await recordReply(db, b, { by: 's@g.c', to: 'b@example.com', subject: 's', body: 'b' });
    expect((await getEnquiry(db, b))?.enquiry.status).toBe('booked');
  });

  it('deleting an enquiry removes its replies (cascade)', async () => {
    const a = await add('Ann');
    await recordReply(db, a, { by: 's@g.c', to: 'j@e.com', subject: 's', body: 'b' });
    await pg.query('DELETE FROM enquiries WHERE id = $1', [a]);
    expect(Number((await pg.query<{ n: string }>('SELECT count(*) AS n FROM enquiry_replies')).rows[0].n)).toBe(0);
  });
});

describe('row-level security stays on for the new tables', () => {
  it('customers and enquiry_replies have RLS enabled', async () => {
    const { rows } = await pg.query<{ relname: string }>(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });
});
